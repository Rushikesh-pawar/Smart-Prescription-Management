import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client.js';

const emptyMed = { name: '', dosage: '', frequency: '', duration: '', notes: '' };

export default function PatientForm() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [icdLoading, setIcdLoading] = useState(false);
  const [icdCodes, setIcdCodes] = useState([]);
  const [interactionsLoading, setInteractionsLoading] = useState(false);
  const [interactions, setInteractions] = useState([]);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    sex: 'male',
    age: '',
    weightKg: '',
    heightCm: '',
    diagnosis: '',
    medications: [{ ...emptyMed }],
  });

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateMed(i, field, value) {
    setForm((prev) => {
      const meds = prev.medications.map((m, idx) => (idx === i ? { ...m, [field]: value } : m));
      return { ...prev, medications: meds };
    });
  }

  function addMed() {
    setForm((prev) => ({ ...prev, medications: [...prev.medications, { ...emptyMed }] }));
  }

  function removeMed(i) {
    setForm((prev) => ({
      ...prev,
      medications: prev.medications.filter((_, idx) => idx !== i),
    }));
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setTranscribing(true);
        try {
          const fd = new FormData();
          fd.append('audio', blob, 'recording.webm');
          const { data } = await api.post('/ai/transcribe', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          if (data.text) {
            setForm((prev) => ({
              ...prev,
              diagnosis: prev.diagnosis ? `${prev.diagnosis} ${data.text}` : data.text,
            }));
            toast.success('Transcribed');
          } else {
            toast.error('No speech detected');
          }
        } catch (err) {
          toast.error(err.response?.data?.error || 'Transcription failed');
        } finally {
          setTranscribing(false);
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch (err) {
      toast.error('Microphone access denied');
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  async function suggestICD() {
    if (!form.diagnosis.trim()) {
      toast.error('Enter a diagnosis first');
      return;
    }
    setIcdLoading(true);
    try {
      const { data } = await api.post('/ai/icd-suggest', { diagnosis: form.diagnosis });
      setIcdCodes(data.candidates);
      if (!data.candidates.length) toast('No confident matches', { icon: 'ℹ️' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'AI request failed');
    } finally {
      setIcdLoading(false);
    }
  }

  async function checkInteractions() {
    const meds = form.medications.filter((m) => m.name.trim());
    if (meds.length < 1) {
      toast.error('Add at least one medication');
      return;
    }
    if (!form.age) {
      toast.error('Enter patient age first');
      return;
    }
    setInteractionsLoading(true);
    try {
      const { data } = await api.post('/ai/check-interactions', {
        medications: meds,
        ageAtVisit: Number(form.age),
        sex: form.sex,
      });
      setInteractions(data.flags);
      if (!data.flags.length) toast.success('No interactions flagged');
    } catch (err) {
      toast.error(err.response?.data?.error || 'AI request failed');
    } finally {
      setInteractionsLoading(false);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        age: Number(form.age),
        weightKg: form.weightKg ? Number(form.weightKg) : undefined,
        heightCm: form.heightCm ? Number(form.heightCm) : undefined,
        medications: form.medications.filter((m) => m.name.trim()),
      };
      await api.post('/prescriptions', payload);
      toast.success('Prescription saved · PDF generated');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New prescription</h1>
        <p className="text-sm text-slate-500">
          AI assistance is on: ICD-10 suggestions, drug interaction checks, and voice-to-text.
        </p>
      </div>

      <section className="card space-y-4">
        <h2 className="font-medium">Patient details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Full name</label>
            <input
              required
              className="input"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Phone (WhatsApp)</label>
            <input
              required
              placeholder="+1 617 505 8797"
              className="input"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-500">
              Any format works (dashes, spaces, with or without +1 — we'll normalize US numbers automatically).
            </p>
          </div>
          <div>
            <label className="label">Sex</label>
            <select
              className="input"
              value={form.sex}
              onChange={(e) => update('sex', e.target.value)}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="label">Age</label>
            <input
              required
              type="number"
              min="0"
              max="130"
              className="input"
              value={form.age}
              onChange={(e) => update('age', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                className="input"
                value={form.weightKg}
                onChange={(e) => update('weightKg', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Height (cm)</label>
              <input
                type="number"
                step="0.1"
                className="input"
                value={form.heightCm}
                onChange={(e) => update('heightCm', e.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Diagnosis</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={recording ? stopRecording : startRecording}
              disabled={transcribing}
              className={
                recording
                  ? 'btn bg-red-600 text-white hover:bg-red-700'
                  : 'btn-secondary'
              }
            >
              {transcribing
                ? 'Transcribing…'
                : recording
                  ? '■ Stop & transcribe'
                  : '🎙 Voice input'}
            </button>
            <button
              type="button"
              onClick={suggestICD}
              disabled={icdLoading || !form.diagnosis.trim()}
              className="btn-secondary"
            >
              {icdLoading ? 'Thinking…' : '✨ Suggest ICD-10'}
            </button>
          </div>
        </div>
        <textarea
          required
          rows={4}
          className="input"
          placeholder="e.g. Acute pharyngitis with fever — or click voice input"
          value={form.diagnosis}
          onChange={(e) => update('diagnosis', e.target.value)}
        />
        {icdCodes.length > 0 && (
          <div className="border border-brand-100 bg-brand-50 rounded-md p-3">
            <h3 className="text-xs font-semibold text-brand-700 mb-2">
              ICD-10 candidates (AI · for review)
            </h3>
            <div className="flex flex-wrap gap-2">
              {icdCodes.map((c, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-full bg-white border border-brand-200 px-2.5 py-1 text-xs"
                >
                  <strong>{c.code}</strong> · {c.description}
                  <span className="text-slate-400">
                    ({Math.round(c.confidence * 100)}%)
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Medications</h2>
          <div className="flex gap-2">
            <button type="button" onClick={addMed} className="btn-secondary">
              + Add
            </button>
            <button
              type="button"
              onClick={checkInteractions}
              disabled={interactionsLoading}
              className="btn-secondary"
            >
              {interactionsLoading ? 'Checking…' : '⚠ Check interactions'}
            </button>
          </div>
        </div>

        {interactions.length > 0 && (
          <div className="border-l-4 border-amber-400 bg-amber-50 p-3 rounded">
            <h3 className="text-xs font-semibold text-amber-800 mb-2">
              Interaction warnings (AI · for review)
            </h3>
            <ul className="space-y-1 text-sm text-amber-900">
              {interactions.map((f, i) => (
                <li key={i}>
                  <strong className="uppercase text-xs">[{f.severity}]</strong>{' '}
                  {f.drugs.join(' + ')}: {f.description}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-4">
          {form.medications.map((m, i) => (
            <div key={i} className="rounded-md border border-slate-200 p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Name</label>
                  <input
                    className="input"
                    value={m.name}
                    onChange={(e) => updateMed(i, 'name', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Dosage</label>
                  <input
                    className="input"
                    placeholder="500 mg"
                    value={m.dosage}
                    onChange={(e) => updateMed(i, 'dosage', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Frequency</label>
                  <input
                    className="input"
                    placeholder="Twice daily"
                    value={m.frequency}
                    onChange={(e) => updateMed(i, 'frequency', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Duration</label>
                  <input
                    className="input"
                    placeholder="5 days"
                    value={m.duration}
                    onChange={(e) => updateMed(i, 'duration', e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Notes</label>
                  <input
                    className="input"
                    placeholder="After meals"
                    value={m.notes}
                    onChange={(e) => updateMed(i, 'notes', e.target.value)}
                  />
                </div>
              </div>
              {form.medications.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeMed(i)}
                  className="mt-3 text-xs text-red-600 hover:underline"
                >
                  Remove medication
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => navigate('/')} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? 'Saving & sending…' : 'Save · Generate PDF · Send WhatsApp'}
        </button>
      </div>
    </form>
  );
}
