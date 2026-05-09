import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-7';

let cached = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!cached) cached = new Anthropic();
  return cached;
}

const ICD_SYSTEM = `You are a medical coding assistant helping doctors map free-text diagnoses to ICD-10-CM codes.

For each diagnosis, return up to 5 plausible ICD-10-CM candidates ranked by confidence (most likely first).

Rules:
- Return only real ICD-10-CM codes (e.g., "J02.9", "E11.9", "I10").
- Include the official short description for each code.
- Confidence is a number between 0 and 1 representing how well the code matches the diagnosis text.
- If the diagnosis is too vague to code confidently, return fewer (or zero) candidates rather than guessing.
- Never invent codes.

This is an educational/portfolio tool. Codes are suggestions for the doctor to review, not for billing or clinical use.`;

const SUMMARY_SYSTEM = `You write friendly, clear, plain-language prescription summaries for patients.

Take a doctor's prescription (diagnosis + medications) and produce a short summary the patient can understand at home.

Rules:
- 4-7 short sentences. No medical jargon. No headings. No bullet points.
- Explain what the diagnosis means in everyday words.
- For each medication: what it's for, when to take it, and any obvious cautions (e.g. "after meals", "don't skip doses").
- End with one sentence reminding the patient to contact the doctor if symptoms worsen.
- Do NOT add medical advice beyond what the doctor prescribed.
- Write in second person ("you").

This is an educational tool. The summary supplements the doctor's instructions; it does not replace them.`;

const INTERACTION_SYSTEM = `You are a clinical pharmacist's assistant flagging potential drug interactions, contraindications, and dosing concerns.

Given a list of prescribed medications, identify clinically significant risks:
- Drug-drug interactions
- Dose-related warnings (especially for elderly or pediatric patients)
- Common contraindications

Rules:
- Only flag well-known, clinically significant interactions.
- Each flag must list the drugs involved (1-3 names from the input list), a severity ("low" | "moderate" | "high"), and a one-sentence plain-language description.
- If you are unsure, or there are no notable interactions, return an empty array.
- Skip generic "monitor liver function" boilerplate unless severity is moderate or higher.

This is an educational/portfolio tool. All flags must be reviewed by a qualified medical professional.`;

export async function suggestICD10(diagnosis) {
  const client = getClient();
  if (!client || !diagnosis?.trim()) return [];

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: [{ type: 'text', text: ICD_SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: `Diagnosis: ${diagnosis}` }],
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            candidates: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  description: { type: 'string' },
                  confidence: { type: 'number' },
                },
                required: ['code', 'description', 'confidence'],
                additionalProperties: false,
              },
            },
          },
          required: ['candidates'],
          additionalProperties: false,
        },
      },
    },
  });

  const text = resp.content.find((b) => b.type === 'text')?.text || '{}';
  try {
    return JSON.parse(text).candidates ?? [];
  } catch {
    return [];
  }
}

export async function summarizeForPatient({ patient, prescription }) {
  const client = getClient();
  if (!client) return '';

  const medsText =
    prescription.medications
      .map(
        (m) =>
          `- ${m.name}${m.dosage ? ` ${m.dosage}` : ''}${m.frequency ? `, ${m.frequency}` : ''}${m.duration ? `, ${m.duration}` : ''}${m.notes ? ` (${m.notes})` : ''}`
      )
      .join('\n') || '(no medications)';

  const userMessage = `Patient: ${patient.name}, age ${prescription.ageAtVisit}, ${patient.sex}.
Diagnosis: ${prescription.diagnosis}
Medications:
${medsText}

Write the plain-language summary now.`;

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    system: [{ type: 'text', text: SUMMARY_SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userMessage }],
  });

  return resp.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

export async function checkInteractions({ medications, ageAtVisit, sex }) {
  const client = getClient();
  if (!client) return [];
  if (!medications || medications.length === 0) return [];

  const medsText = medications
    .map((m) => `- ${m.name}${m.dosage ? ` ${m.dosage}` : ''}${m.frequency ? `, ${m.frequency}` : ''}`)
    .join('\n');

  const userMessage = `Patient: age ${ageAtVisit}, ${sex}.
Medications:
${medsText}

List clinically significant interactions, contraindications, or dose concerns.`;

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: [{ type: 'text', text: INTERACTION_SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userMessage }],
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            flags: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  drugs: { type: 'array', items: { type: 'string' } },
                  severity: { type: 'string', enum: ['low', 'moderate', 'high'] },
                  description: { type: 'string' },
                },
                required: ['drugs', 'severity', 'description'],
                additionalProperties: false,
              },
            },
          },
          required: ['flags'],
          additionalProperties: false,
        },
      },
    },
  });

  const text = resp.content.find((b) => b.type === 'text')?.text || '{}';
  try {
    return JSON.parse(text).flags ?? [];
  } catch {
    return [];
  }
}
