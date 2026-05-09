import twilio from 'twilio';

let cached = null;

function getClient() {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return null;
  if (!cached) {
    cached = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return cached;
}

export async function sendPrescriptionWhatsApp({ phone, mediaUrl, patientName, doctorName }) {
  const client = getClient();
  if (!client) {
    return { skipped: true, reason: 'Twilio not configured' };
  }
  const to = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;
  const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

  const msg = await client.messages.create({
    from,
    to,
    body:
      `Hello ${patientName}, here is your prescription from Dr. ${doctorName}. ` +
      `Please follow the instructions carefully and contact your doctor if symptoms worsen.`,
    mediaUrl: [mediaUrl],
  });

  return { sid: msg.sid, status: msg.status };
}
