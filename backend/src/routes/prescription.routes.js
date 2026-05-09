import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import { z } from 'zod';
import { Patient } from '../models/Patient.js';
import { Prescription } from '../models/Prescription.js';
import { requireAuth } from '../middleware/auth.js';
import { generatePrescriptionPDF } from '../services/pdfService.js';
import { sendPrescriptionWhatsApp } from '../services/whatsappService.js';
import {
  suggestICD10,
  summarizeForPatient,
  checkInteractions,
} from '../services/claudeService.js';

const router = Router();
router.use(requireAuth);

const medicationSchema = z.object({
  name: z.string().min(1),
  dosage: z.string().optional().default(''),
  frequency: z.string().optional().default(''),
  duration: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

function normalizePhone(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('+')) {
    const cleaned = '+' + trimmed.slice(1).replace(/\D/g, '');
    return cleaned;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  return '+' + digits;
}

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().min(5).transform(normalizePhone),
  sex: z.enum(['male', 'female', 'other']),
  age: z.number().int().min(0).max(130),
  weightKg: z.number().min(0).optional(),
  heightCm: z.number().min(0).optional(),
  diagnosis: z.string().min(1),
  medications: z.array(medicationSchema).default([]),
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);

    const patient = await Patient.findOneAndUpdate(
      { doctorId: req.doctor._id, phone: data.phone },
      {
        $set: { name: data.name, email: data.email || undefined, sex: data.sex },
        $setOnInsert: { doctorId: req.doctor._id, phone: data.phone },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const prescription = await Prescription.create({
      doctorId: req.doctor._id,
      patientId: patient._id,
      ageAtVisit: data.age,
      weightKg: data.weightKg,
      heightCm: data.heightCm,
      diagnosis: data.diagnosis,
      medications: data.medications,
    });

    // Run AI tasks in parallel — failures are non-fatal
    const [icdResult, summaryResult, interactionsResult] = await Promise.allSettled([
      suggestICD10(data.diagnosis),
      summarizeForPatient({ patient, prescription }),
      checkInteractions({
        medications: data.medications,
        ageAtVisit: data.age,
        sex: data.sex,
      }),
    ]);
    if (icdResult.status === 'fulfilled') prescription.icd10Codes = icdResult.value;
    if (summaryResult.status === 'fulfilled') prescription.patientFriendlySummary = summaryResult.value;
    if (interactionsResult.status === 'fulfilled') prescription.interactionFlags = interactionsResult.value;

    // PDF generation — fatal failures are also tolerated
    try {
      const { publicPath } = await generatePrescriptionPDF({
        doctor: req.doctor,
        patient,
        prescription,
      });
      prescription.pdfPath = publicPath;
    } catch (err) {
      console.error('PDF generation failed:', err);
    }

    await prescription.save();

    // WhatsApp delivery — fire-and-forget; status updates the doc when it lands
    if (prescription.pdfPath && process.env.PUBLIC_BASE_URL) {
      const mediaUrl = `${process.env.PUBLIC_BASE_URL}${prescription.pdfPath}`;
      sendPrescriptionWhatsApp({
        phone: data.phone,
        mediaUrl,
        patientName: patient.name,
        doctorName: req.doctor.name,
      })
        .then(async (result) => {
          if (result.sid) {
            prescription.whatsappStatus = 'sent';
            prescription.whatsappMessageId = result.sid;
          } else if (result.skipped) {
            prescription.whatsappStatus = 'pending';
            prescription.whatsappError = result.reason;
          }
          await prescription.save();
        })
        .catch(async (err) => {
          prescription.whatsappStatus = 'failed';
          prescription.whatsappError = err.message?.slice(0, 500) || 'Unknown error';
          await prescription.save();
        });
    }

    res.status(201).json({
      patient,
      prescription: prescription.toJSON({ virtuals: true }),
    });
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const prescriptions = await Prescription.find({ doctorId: req.doctor._id })
      .sort('-createdAt')
      .populate('patientId', 'name phone email sex')
      .lean();
    res.json({ prescriptions });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const prescription = await Prescription.findOne({
      _id: req.params.id,
      doctorId: req.doctor._id,
    })
      .populate('patientId')
      .lean();
    if (!prescription) {
      res.status(404);
      throw new Error('Prescription not found');
    }
    res.json({ prescription });
  })
);

export default router;
