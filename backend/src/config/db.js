import mongoose from 'mongoose';

export async function connectDB(uri) {
  if (!uri) {
    // Diagnostic: which env vars *are* present? List the ones we expect.
    const expected = [
      'NODE_ENV',
      'PORT',
      'MONGODB_URI',
      'JWT_SECRET',
      'CORS_ORIGIN',
      'PUBLIC_BASE_URL',
      'ANTHROPIC_API_KEY',
      'ANTHROPIC_MODEL',
      'TWILIO_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN',
      'TWILIO_WHATSAPP_FROM',
      'HF_API_TOKEN',
      'HF_WHISPER_MODEL',
    ];
    console.log('=== ENV DIAG ===');
    for (const k of expected) {
      const v = process.env[k];
      const status = v == null ? 'MISSING' : v === '' ? 'EMPTY' : `SET (len=${v.length})`;
      console.log(`  ${k}: ${status}`);
    }
    const mongoLike = Object.keys(process.env).filter((k) => /mongo/i.test(k));
    console.log('  mongo-ish keys found:', mongoLike.length ? mongoLike : '(none)');
    console.log('=== END DIAG ===');
    throw new Error('MONGODB_URI is not set');
  }
  mongoose.set('strictQuery', true);
  // Fail fast on bad Atlas creds / network — default is 30s which can mask the issue.
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  console.log('MongoDB connected');
}
