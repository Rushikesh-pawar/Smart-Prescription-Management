import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import { Patient } from '../models/Patient.js';
import { Prescription } from '../models/Prescription.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const doctorId = new mongoose.Types.ObjectId(req.doctor._id);

    const [
      totalPatients,
      totalPrescriptions,
      bySex,
      byMonth,
      ageBuckets,
      bmiBuckets,
      topDiagnoses,
      avgInteractionsAndCodes,
    ] = await Promise.all([
      Patient.countDocuments({ doctorId }),
      Prescription.countDocuments({ doctorId }),

      Patient.aggregate([
        { $match: { doctorId } },
        { $group: { _id: '$sex', count: { $sum: 1 } } },
      ]),

      Prescription.aggregate([
        { $match: { doctorId } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 24 },
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

      Prescription.aggregate([
        { $match: { doctorId, weightKg: { $gt: 0 }, heightCm: { $gt: 0 } } },
        {
          $project: {
            bmi: {
              $divide: [
                '$weightKg',
                { $pow: [{ $divide: ['$heightCm', 100] }, 2] },
              ],
            },
          },
        },
        {
          $bucket: {
            groupBy: '$bmi',
            boundaries: [0, 18.5, 25, 30, 35, 100],
            default: 'unknown',
            output: { count: { $sum: 1 } },
          },
        },
      ]),

      Prescription.aggregate([
        { $match: { doctorId } },
        { $group: { _id: '$diagnosis', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
        { $project: { diagnosis: '$_id', count: 1, _id: 0 } },
      ]),

      Prescription.aggregate([
        { $match: { doctorId } },
        {
          $group: {
            _id: null,
            avgMeds: { $avg: { $size: { $ifNull: ['$medications', []] } } },
            avgInteractions: { $avg: { $size: { $ifNull: ['$interactionFlags', []] } } },
            withInteractions: {
              $sum: { $cond: [{ $gt: [{ $size: { $ifNull: ['$interactionFlags', []] } }, 0] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    const ageLabels = { 0: '0-17', 18: '18-34', 35: '35-54', 55: '55-74', 75: '75+' };
    const ageDistribution = ageBuckets.map((b) => ({
      label: ageLabels[b._id] ?? 'other',
      count: b.count,
    }));

    const bmiLabels = {
      0: 'Underweight',
      18.5: 'Normal',
      25: 'Overweight',
      30: 'Obese I',
      35: 'Obese II+',
    };
    const bmiDistribution = bmiBuckets.map((b) => ({
      label: bmiLabels[b._id] ?? 'unknown',
      count: b.count,
    }));

    res.json({
      totals: { patients: totalPatients, prescriptions: totalPrescriptions },
      bySex: bySex.reduce((acc, b) => ({ ...acc, [b._id]: b.count }), {}),
      byMonth: byMonth.map((m) => ({ month: m._id, count: m.count })),
      ageDistribution,
      bmiDistribution,
      topDiagnoses,
      averages: avgInteractionsAndCodes[0] || {
        avgMeds: 0,
        avgInteractions: 0,
        withInteractions: 0,
      },
    });
  })
);

export default router;
