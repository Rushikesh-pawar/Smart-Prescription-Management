// HuggingFace Inference Providers — direct model URL with raw audio body.
// The OpenAI-compatible /v1/audio/transcriptions path returns "Model not supported"
// for whisper variants on the free hf-inference provider; the per-model route works.
const HF_BASE = 'https://router.huggingface.co/hf-inference/models';

export async function transcribeAudio({ audioBuffer, mimeType = 'audio/webm' }) {
  const token = process.env.HF_API_TOKEN;
  if (!token) {
    return { error: 'HF_API_TOKEN not configured', text: '' };
  }
  const model = process.env.HF_WHISPER_MODEL || 'openai/whisper-large-v3-turbo';
  const url = `${HF_BASE}/${model}`;

  async function callHF() {
    return fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': mimeType,
      },
      body: audioBuffer,
    });
  }

  let res = await callHF();

  // HuggingFace warms up cold models — retry once after a short wait
  if (res.status === 503) {
    await new Promise((r) => setTimeout(r, 5000));
    res = await callHF();
  }

  if (!res.ok) {
    const errText = await res.text();
    return {
      error: `Whisper API error: ${res.status} ${errText.slice(0, 300)}`,
      text: '',
    };
  }

  const data = await res.json();
  return { text: data.text || '' };
}
