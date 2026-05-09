import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import { Patient } from '../models/Patient.js';
import { Prescription } from '../models/Prescription.js';
import { requireAuth } from '../middleware/auth.js';

function withBmi(rx) {
  if (!rx?.weightKg || !rx?.heightCm) return rx;
  const m = rx.heightCm / 100;
  return { ...rx, bmi: +(rx.weightKg / (m * m)).toFixed(1) };
}

const router = Router();

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const patients = await Patient.find({ doctorId: req.doctor._id }).sort('-updatedAt').lean();
    res.json({ patients });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const patient = await Patient.findOne({ _id: req.params.id, doctorId: req.doctor._id }).lean();
    if (!patient) {
      res.status(404);
      throw new Error('Patient not found');
    }
    const prescriptions = await Prescription.find({ patientId: patient._id })
      .sort('-createdAt')
      .lean();
    res.json({ patient, prescriptions: prescriptions.map(withBmi) });
  })
);

export default router;
