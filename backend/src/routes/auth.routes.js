import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import { z } from 'zod';
import { Doctor } from '../models/Doctor.js';
import { signToken } from '../utils/jwt.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  specialization: z.string().optional(),
  registrationNumber: z.string().optional(),
  clinicName: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const data = signupSchema.parse(req.body);
    const existing = await Doctor.findOne({ email: data.email });
    if (existing) {
      res.status(409);
      throw new Error('Email already registered');
    }
    const doctor = await Doctor.create(data);
    const token = signToken({ id: doctor._id });
    res.status(201).json({ token, doctor: sanitize(doctor) });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body);
    const doctor = await Doctor.findOne({ email: data.email }).select('+password');
    if (!doctor || !(await doctor.comparePassword(data.password))) {
      res.status(401);
      throw new Error('Invalid email or password');
    }
    const token = signToken({ id: doctor._id });
    res.json({ token, doctor: sanitize(doctor) });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ doctor: sanitize(req.doctor) });
  })
);

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  specialization: z.string().optional(),
  registrationNumber: z.string().optional(),
  clinicName: z.string().optional(),
});

router.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = updateProfileSchema.parse(req.body);
    Object.assign(req.doctor, data);
    await req.doctor.save();
    res.json({ doctor: sanitize(req.doctor) });
  })
);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

router.post(
  '/me/password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = changePasswordSchema.parse(req.body);
    const doctor = await Doctor.findById(req.doctor._id).select('+password');
    if (!(await doctor.comparePassword(data.currentPassword))) {
      res.status(401);
      throw new Error('Current password is incorrect');
    }
    doctor.password = data.newPassword;
    await doctor.save();
    res.json({ ok: true });
  })
);

function sanitize(doc) {
  const { password, ...rest } = doc.toObject();
  return rest;
}

export default router;
