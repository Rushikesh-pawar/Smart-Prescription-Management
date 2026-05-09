import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { pdfUrl } from '../api/client.js';

export default function PatientDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/patients/${id}`)
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-slate-500">Loading…</div>;
  if (!data?.patient) return <div className="text-slate-500">Patient not found.</div>;

  const { patient, prescriptions } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{patient.name}</h1>
          <p className="text-sm text-slate-500">
            {patient.phone} {patient.email && `· ${patient.email}`} · {patient.sex}
          </p>
        </div>
        <Link to="/patients/new" className="btn-primary">
          + New prescription
        </Link>
      </div>

      <div className="space-y-4">
        {prescriptions.map((rx) => (
          <div key={rx._id} className="card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">
                {new Date(rx.createdAt).toLocaleString()}
              </span>
              {rx.bmi && <span className="text-xs text-slate-500">BMI: {rx.bmi}</span>}
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-600">Diagnosis</h3>
              <p className="text-slate-800">{rx.diagnosis}</p>
            </div>
            {rx.medications?.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-600 mb-1">Medications</h3>
                <ul className="space-y-1 text-sm">
                  {rx.medications.map((m, i) => (
                    <li key={i} className="text-slate-700">
                      <strong>{m.name}</strong>
                      {m.dosage && ` — ${m.dosage}`}
                      {m.frequency && `, ${m.frequency}`}
                      {m.duration && `, ${m.duration}`}
                      {m.notes && <span className="text-slate-500"> ({m.notes})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {rx.pdfPath && (
              <a
                href={pdfUrl(rx.pdfPath)}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-brand-700 hover:underline"
              >
                Download PDF →
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
