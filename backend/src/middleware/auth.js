import asyncHandler from 'express-async-handler';
import { verifyToken } from '../utils/jwt.js';
import { Doctor } from '../models/Doctor.js';

export const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    res.status(401);
    throw new Error('Missing auth token');
  }
  const decoded = verifyToken(token);
  const doctor = await Doctor.findById(decoded.id);
  if (!doctor) {
    res.status(401);
    throw new Error('Doctor not found');
  }
  req.doctor = doctor;
  next();
});
