import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/auth.js';
import { Patient } from '../models/Patient.js';
import { Prescription } from '../models/Prescription.js';

const router = Router();
router.use(requireAuth);

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-7';

let cachedClient = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!cachedClient) cachedClient = new Anthropic();
  return cachedClient;
}

const SYSTEM_PROMPT = `You are a helpful clinical assistant chatbot for a doctor managing their own patient records.

You can answer questions about THIS doctor's patients and prescriptions by calling the available tools. You CANNOT see or query other doctors' data — every tool is automatically scoped to the current doctor.

Guidelines:
- Be concise. Format lists as short bullet points.
- Always call tools to get real data — never invent patient names, dates, or medications.
- When showing patient names, include the visit date if relevant.
- For "trend" or "over time" questions, fetch the patient's prescription history and compute trends in your reply.
- For aggregate questions ("how many", "how often"), use get_practice_overview or list_recent_prescriptions.
- If the user asks something the tools can't answer (e.g. general medical advice not tied to their data), say so briefly and suggest a more specific question they could ask.

This is an educational/portfolio tool. Do NOT provide clinical advice or diagnostic conclusions; surface what's in the records and let the doctor decide.`;

const messagesSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.union([z.string(), z.array(z.any())]),
      })
    )
    .min(1),
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const client = getClient();
    if (!client) {
      res.status(503).json({
        error:
          'Chat is disabled in the demo. Add ANTHROPIC_API_KEY to backend/.env to enable.',
        message: {
          role: 'assistant',
          content:
            "I'm not connected to the LLM right now. To enable me, add an `ANTHROPIC_API_KEY` from console.anthropic.com to the backend `.env` file and restart the server.",
        },
      });
      return;
    }

    const { messages } = messagesSchema.parse(req.body);
    const doctorId = new mongoose.Types.ObjectId(req.doctor._id);

    // Tools defined inline so they capture doctorId via closure — every query
    // is automatically scoped to the authenticated doctor.
    const searchPatients = betaZodTool({
      name: 'search_patients',
      description:
        'Search this doctor\'s patients by partial match against name, phone, or email. Use for "find John", "patient with phone 617...", etc.',
      inputSchema: z.object({
        query: z.string().min(1),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      run: async ({ query, limit = 10 }) => {
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(escaped, 'i');
        const patients = await Patient.find({
          doctorId,
          $or: [{ name: re }, { phone: re }, { email: re }],
        })
          .limit(limit)
          .lean();
        return JSON.stringify(patients);
      },
    });

    const getPatientHistory = betaZodTool({
      name: 'get_patient_history',
      description:
        'Get full prescription history (all visits) for one patient by patient_id. Returns demographics + every prescription sorted newest first.',
      inputSchema: z.object({
        patient_id: z.string(),
      }),
      run: async ({ patient_id }) => {
        if (!mongoose.isValidObjectId(patient_id)) {
          return JSON.stringify({ error: 'Invalid patient_id' });
        }
        const patient = await Patient.findOne({ _id: patient_id, doctorId }).lean();
        if (!patient) return JSON.stringify({ error: 'Patient not found' });
        const prescriptions = await Prescription.find({
          patientId: patient._id,
          doctorId,
        })
          .sort('-createdAt')
          .lean();
        const enriched = prescriptions.map((rx) => {
          let bmi = null;
          if (rx.weightKg && rx.heightCm) {
            const m = rx.heightCm / 100;
            bmi = +(rx.weightKg / (m * m)).toFixed(1);
          }
          return { ...rx, bmi };
        });
        return JSON.stringify({ patient, prescriptions: enriched });
      },
    });

    const findByMedication = betaZodTool({
      name: 'find_patients_by_medication',
      description:
        'Find this doctor\'s patients who were prescribed a medication matching the given name (case-insensitive partial match). Returns patient list + the prescription where it appeared.',
      inputSchema: z.object({
        medication_name: z.string().min(1),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      run: async ({ medication_name, limit = 20 }) => {
        const escaped = medication_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(escaped, 'i');
        const prescriptions = await Prescription.find({
          doctorId,
          'medications.name': re,
        })
          .sort('-createdAt')
          .limit(limit)
          .populate('patientId', 'name phone email sex')
          .lean();
        return JSON.stringify(
          prescriptions.map((rx) => ({
            prescription_id: rx._id,
            patient: rx.patientId,
            date: rx.createdAt,
            diagnosis: rx.diagnosis,
            medications: rx.medications.filter((m) => re.test(m.name)),
          }))
        );
      },
    });

    const findByDiagnosis = betaZodTool({
      name: 'find_patients_by_diagnosis',
      description:
        'Find this doctor\'s prescriptions whose diagnosis text matches a query (case-insensitive partial match). Returns prescriptions with patient info.',
      inputSchema: z.object({
        query: z.string().min(1),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      run: async ({ query, limit = 20 }) => {
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(escaped, 'i');
        const prescriptions = await Prescription.find({
          doctorId,
          diagnosis: re,
        })
          .sort('-createdAt')
          .limit(limit)
          .populate('patientId', 'name phone sex')
          .lean();
        return JSON.stringify(
          prescriptions.map((rx) => ({
            prescription_id: rx._id,
            patient: rx.patientId,
            date: rx.createdAt,
            diagnosis: rx.diagnosis,
            medications: rx.medications.map((m) => m.name),
          }))
        );
      },
    });

    const listRecentPrescriptions = betaZodTool({
      name: 'list_recent_prescriptions',
      description:
        'List the most recent prescriptions, optionally filtered by a time window. Use for "recent visits", "last week", etc.',
      inputSchema: z.object({
        days_back: z.number().int().min(1).max(365).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      run: async ({ days_back, limit = 10 }) => {
        const filter = { doctorId };
        if (days_back) {
          const since = new Date(Date.now() - days_back * 86400 * 1000);
          filter.createdAt = { $gte: since };
        }
        const prescriptions = await Prescription.find(filter)
          .sort('-createdAt')
          .limit(limit)
          .populate('patientId', 'name phone sex')
          .lean();
        return JSON.stringify(
          prescriptions.map((rx) => ({
            prescription_id: rx._id,
            patient: rx.patientId,
            date: rx.createdAt,
            diagnosis: rx.diagnosis,
            medications: rx.medications.map(
              (m) => `${m.name}${m.dosage ? ' ' + m.dosage : ''}`
            ),
          }))
        );
      },
    });

    const getPracticeOverview = betaZodTool({
      name: 'get_practice_overview',
      description:
        'Get aggregated stats across this doctor\'s entire practice: total patients, total prescriptions, sex/age/BMI distributions, top diagnoses.',
      inputSchema: z.object({}),
      run: async () => {
        const [totalPatients, totalPrescriptions, bySex, topDiagnoses, ageBuckets] =
          await Promise.all([
            Patient.countDocuments({ doctorId }),
            Prescription.countDocuments({ doctorId }),
            Patient.aggregate([
              { $match: { doctorId } },
              { $group: { _id: '$sex', count: { $sum: 1 } } },
            ]),
            Prescription.aggregate([
              { $match: { doctorId } },
              { $group: { _id: '$diagnosis', count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 5 },
            ]),
            Prescription.aggregate([
              { $match: { doctorId } },
              {
                $bucket: {
                  groupBy: '$ageAtVisit',
                  boundaries: [0, 18, 35, 55, 75, 130],
                  default: 'other',
                  output: { count: { $sum: 1 } },
                },
              },
            ]),
          ]);
        return JSON.stringify({
          total_patients: totalPatients,
          total_prescriptions: totalPrescriptions,
          by_sex: bySex.reduce((acc, b) => ({ ...acc, [b._id]: b.count }), {}),
          top_diagnoses: topDiagnoses.map((d) => ({
            diagnosis: d._id,
            count: d.count,
          })),
          age_buckets: ageBuckets,
        });
      },
    });

    const finalMessage = await client.beta.messages.toolRunner({
      model: MODEL,
      max_tokens: 4000,
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      ],
      tools: [
        searchPatients,
        getPatientHistory,
        findByMedication,
        findByDiagnosis,
        listRecentPrescriptions,
        getPracticeOverview,
      ],
      messages,
    });

    const text = finalMessage.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    res.json({ message: { role: 'assistant', content: text } });
  })
);

export default router;
