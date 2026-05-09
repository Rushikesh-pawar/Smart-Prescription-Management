console.log('[boot] node version:', process.version);
console.log('[boot] cwd:', process.cwd());

process.on('uncaughtException', (err) => {
  console.error('[boot] UNCAUGHT EXCEPTION:', err.stack || err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('[boot] UNHANDLED REJECTION:', reason?.stack || reason);
  process.exit(1);
});

console.log('[boot] importing modules…');

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

console.log('[boot] imports complete');
console.log('[boot] env check: MONGODB_URI is', process.env.MONGODB_URI ? `set (len=${process.env.MONGODB_URI.length})` : 'MISSING');
console.log('[boot] env check: PORT is', process.env.PORT || '(unset)');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
console.log('[boot] express app created');

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

console.log('[boot] routes mounted');

const PORT = process.env.PORT || 5000;

console.log('[boot] connecting to MongoDB…');

// Bind the listener FIRST so Render can see the port open even if Mongo is slow.
// This avoids a deploy timeout while keeping the DB error visible in logs.
const server = app.listen(PORT, () => {
  console.log(`[boot] API listening on http://localhost:${PORT}`);
});

connectDB(process.env.MONGODB_URI)
  .then(() => {
    console.log('[boot] MongoDB ready');
  })
  .catch((err) => {
    console.error('[boot] MONGO CONNECT FAILED:', err.message);
    console.error(err.stack);
    // Don't exit — let the user see the error in logs while the server still responds with 500s.
  });
