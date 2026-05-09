import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import {
  suggestICD10,
  summarizeForPatient,
  checkInteractions,
} from '../services/claudeService.js';
import { transcribeAudio } from '../services/whisperService.js';

const router = Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.post(
  '/icd-suggest',
  asyncHandler(async (req, res) => {
    const { diagnosis } = z.object({ diagnosis: z.string().min(1) }).parse(req.body);
    const candidates = await suggestICD10(diagnosis);
    res.json({ candidates });
  })
);

const interactionsSchema = z.object({
  medications: z
    .array(
      z.object({
        name: z.string(),
        dosage: z.string().optional().default(''),
        frequency: z.string().optional().default(''),
      })
    )
    .min(1),
  ageAtVisit: z.number().int().min(0).max(130),
  sex: z.enum(['male', 'female', 'other']),
});

router.post(
  '/check-interactions',
  asyncHandler(async (req, res) => {
    const data = interactionsSchema.parse(req.body);
    const flags = await checkInteractions(data);
    res.json({ flags });
  })
);

const summarizeSchema = z.object({
  patient: z.object({ name: z.string(), sex: z.enum(['male', 'female', 'other']) }),
  prescription: z.object({
    ageAtVisit: z.number(),
    diagnosis: z.string(),
    medications: z.array(z.any()),
  }),
});

router.post(
  '/summarize',
  asyncHandler(async (req, res) => {
    const data = summarizeSchema.parse(req.body);
    const summary = await summarizeForPatient(data);
    res.json({ summary });
  })
);

router.post(
  '/transcribe',
  upload.single('audio'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400);
      throw new Error('audio file required (multipart field "audio")');
    }
    const result = await transcribeAudio({
      audioBuffer: req.file.buffer,
      mimeType: req.file.mimetype || 'audio/webm',
    });
    if (result.error) {
      res.status(502).json({ error: result.error });
      return;
    }
    res.json({ text: result.text });
  })
);

export default router;
