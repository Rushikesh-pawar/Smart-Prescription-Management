import mongoose from 'mongoose';

const medicationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    dosage: { type: String, trim: true },
    frequency: { type: String, trim: true },
    duration: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const icdCodeSchema = new mongoose.Schema(
  {
    code: String,
    description: String,
    confidence: Number,
  },
  { _id: false }
);

const interactionFlagSchema = new mongoose.Schema(
  {
    drugs: [String],
    severity: { type: String, enum: ['low', 'moderate', 'high'] },
    description: String,
  },
  { _id: false }
);

const prescriptionSchema = new mongoose.Schema(
  {
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },

    ageAtVisit: { type: Number, required: true, min: 0, max: 130 },
    weightKg: { type: Number, min: 0 },
    heightCm: { type: Number, min: 0 },

    diagnosis: { type: String, required: true, trim: true },
    medications: { type: [medicationSchema], default: [] },

    // AI fields — populated by services in later phases
    icd10Codes: { type: [icdCodeSchema], default: [] },
    patientFriendlySummary: { type: String, default: '' },
    interactionFlags: { type: [interactionFlagSchema], default: [] },

    pdfPath: { type: String, default: '' },
    whatsappStatus: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
    whatsappMessageId: { type: String, default: '' },
    whatsappError: { type: String, default: '' },
  },
  { timestamps: true }
);

prescriptionSchema.virtual('bmi').get(function () {
  if (!this.weightKg || !this.heightCm) return null;
  const m = this.heightCm / 100;
  return +(this.weightKg / (m * m)).toFixed(1);
});

prescriptionSchema.set('toJSON', { virtuals: true });

export const Prescription = mongoose.model('Prescription', prescriptionSchema);
