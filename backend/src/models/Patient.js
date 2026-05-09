import mongoose from 'mongoose';

const patientSchema = new mongoose.Schema(
  {
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    sex: { type: String, enum: ['male', 'female', 'other'], required: true },
  },
  { timestamps: true }
);

patientSchema.index({ doctorId: 1, phone: 1 }, { unique: true });

export const Patient = mongoose.model('Patient', patientSchema);
