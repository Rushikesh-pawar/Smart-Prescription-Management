# Smart Prescription Management

A doctor-facing prescription web app: log in, fill a patient form, the system stores it in MongoDB, generates a PDF, sends it to the patient's WhatsApp, and uses Claude + Whisper for AI-assisted clinical features.

> Educational/portfolio project. **Not for clinical use.** Disclaimers are surfaced on every PDF and in the UI footer.

## Stack

- **Frontend:** React (Vite) · React Router · Tailwind · Recharts · Axios
- **Backend:** Node.js · Express · Mongoose · JWT · Zod · Multer · pdfkit · Twilio · `@anthropic-ai/sdk`
- **Database:** MongoDB (Atlas free tier or local)
- **AI features (all wired in):**
  1. **Claude clinical assistant** — ICD-10 suggestions and patient-friendly summaries (Opus 4.7 + prompt caching + structured outputs) **[disabled in demo, see below]**
  2. **Drug interaction checker** — Claude reasoning over the medication list, severity-graded **[disabled in demo, see below]**
  3. **Voice-to-text** — OpenAI Whisper via HuggingFace Inference API (free)
  4. **Patient analytics dashboard** — Recharts: BMI, age, sex, top diagnoses, prescription timeline

> **Why are the Claude features disabled in the demo?** Anthropic's Claude API is paid (~$5/$25 per million tokens for Opus 4.7). The integration code is fully written, prompt-cached, and tested — every endpoint, schema, and UI button is in place. To activate, paste an `ANTHROPIC_API_KEY` from console.anthropic.com into `backend/.env`. The system gracefully no-ops without the key: ICD-10 buttons return empty arrays, the interaction checker returns no flags, and patient summaries stay blank — all without crashing. This way the demo runs free for visitors but the resume story (Anthropic SDK + prompt caching + structured outputs) stays intact.
- **WhatsApp delivery:** Twilio WhatsApp Sandbox

## Project layout

```
backend/    Express API + Mongo models + AI services
  src/
    services/   pdfService, whatsappService, claudeService, whisperService
    routes/     auth, patients, prescriptions, ai, analytics
    models/     Doctor, Patient, Prescription
frontend/   Vite + React app
  src/
    pages/      Login, Signup, Dashboard, PatientForm, PatientDetail, Analytics
```

## Getting started

### 1. Backend

```bash
cd backend
cp .env.example .env       # then fill in values (see below)
npm install
npm run dev                # → http://localhost:5000
```

You will need a MongoDB URI. Either run MongoDB locally (`brew services start mongodb-community`) or use a free Atlas cluster.

#### `.env` keys

| Key | Required for | Notes |
|---|---|---|
| `MONGODB_URI` | always | `mongodb://localhost:27017/smart_prescription` for local |
| `JWT_SECRET` | always | any long random string |
| `ANTHROPIC_API_KEY` | AI features 1 & 2 | from console.anthropic.com |
| `ANTHROPIC_MODEL` | optional | defaults to `claude-opus-4-7`; switch to `claude-sonnet-4-6` or `claude-haiku-4-5` to lower cost |
| `HF_API_TOKEN` | Whisper voice input | free token from huggingface.co/settings/tokens |
| `TWILIO_ACCOUNT_SID` | WhatsApp | from twilio.com/console |
| `TWILIO_AUTH_TOKEN` | WhatsApp | from twilio.com/console |
| `TWILIO_WHATSAPP_FROM` | WhatsApp | sandbox is `whatsapp:+14155238886` |
| `PUBLIC_BASE_URL` | WhatsApp delivery | must be a **publicly reachable** URL — see below |

**Without any of the optional keys, the app still runs.** Missing AI keys mean those buttons return empty results; missing Twilio keys mean WhatsApp status stays `pending`.

#### WhatsApp delivery in local development

Twilio's WhatsApp Sandbox fetches the PDF from `PUBLIC_BASE_URL` to attach as media. `localhost` won't work — Twilio's servers can't reach your machine. You have two options:

1. **Skip WhatsApp during dev** — leave `TWILIO_*` empty; the prescription saves and PDF is still generated locally at `backend/generated-pdfs/`.
2. **Tunnel with ngrok:**
   ```bash
   ngrok http 5000
   # copy the https URL into PUBLIC_BASE_URL in .env
   ```

Patients must first send `join <sandbox-code>` to the Twilio sandbox WhatsApp number before they can receive messages — see your Twilio console for the code.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                # → http://localhost:5173
```

Vite proxies `/api` and `/pdfs` to the backend automatically.

### 3. First run

1. Open `http://localhost:5173/signup`, create a doctor account.
2. Land on the dashboard, click **+ New prescription**.
3. Fill the form. Try:
   - **🎙 Voice input** — click, speak the diagnosis, click stop, watch it transcribe.
   - **✨ Suggest ICD-10** — Claude returns ranked ICD-10 candidates.
   - **⚠ Check interactions** — Claude flags drug interactions/dose concerns.
4. Submit. The prescription saves, a PDF is generated under `backend/generated-pdfs/`, and (if Twilio is configured) is sent to the patient's WhatsApp.
5. Visit `/analytics` for charts across all your patients.

## How the AI features work

- **ICD-10 suggestions** — `POST /api/ai/icd-suggest` calls Claude Opus 4.7 with a cached system prompt and `output_config.format` for structured JSON output. Up to 5 candidates ranked by confidence.
- **Patient-friendly summary** — runs automatically on prescription save. Plain-language 4-7 sentence summary written in second person, embedded in the PDF.
- **Drug interaction checker** — `POST /api/ai/check-interactions`. Returns severity-graded flags. Empty array if nothing notable — model is instructed not to guess.
- **Voice-to-text** — browser `MediaRecorder` → `POST /api/ai/transcribe` (multipart) → HuggingFace Inference API → `openai/whisper-small`. Supports cold-start retry.
- **Analytics** — `GET /api/analytics/overview` runs MongoDB aggregations: prescriptions over time, age/BMI buckets, sex distribution, top diagnoses, average meds per Rx, % of Rx with flagged interactions.

## Roadmap

- [x] Backend foundation (auth, patient/prescription CRUD)
- [x] Frontend foundation (auth flow, dashboard, patient form)
- [x] PDF generation (pdfkit)
- [x] Twilio WhatsApp delivery
- [x] Claude clinical assistant (ICD-10 + summaries)
- [x] Drug interaction checker
- [x] Whisper voice-to-text input
- [x] Patient analytics dashboard
- [ ] Hosted demo (Render/Railway + Vercel + Atlas)
