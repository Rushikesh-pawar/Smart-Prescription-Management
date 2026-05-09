console.log('[boot] node version:', process.version);
console.log('[boot] cwd:', process.cwd());
console.log('[boot] starting imports…');

process.on('uncaughtException', (err) => {
  console.error('[boot] UNCAUGHT EXCEPTION:', err.stack || err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('[boot] UNHANDLED REJECTION:', reason);
  process.exit(1);
});

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import patientRoutes from './routes/patient.routes.js';
import prescriptionRoutes from './routes/prescription.routes.js';
import aiRoutes from './routes/ai.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import chatRoutes from './routes/chat.routes.js';
import { errorHandler, notFound } from './middleware/error.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

app.use('/pdfs', express.static(path.join(__dirname, '..', 'generated-pdfs')));

app.get('/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/chat', chatRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB(process.env.MONGODB_URI).then(() => {
  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
  });
});
