import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';

export default function Dashboard() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/prescriptions')
      .then((res) => setPrescriptions(res.data.prescriptions))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Patient dashboard</h1>
          <p className="text-sm text-slate-500">Recent prescriptions you've issued.</p>
        </div>
        <Link to="/patients/new" className="btn-primary">
          + New prescription
        </Link>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading…</div>
        ) : prescriptions.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No prescriptions yet. Click <strong>New prescription</strong> to add your first patient.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Patient</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Diagnosis</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">WhatsApp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {prescriptions.map((rx) => (
                <tr key={rx._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      to={`/patients/${rx.patientId?._id}`}
                      className="text-brand-700 hover:underline"
                    >
                      {rx.patientId?.name || 'Unknown'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{rx.patientId?.phone}</td>
                  <td className="px-4 py-3 text-slate-700">{truncate(rx.diagnosis, 60)}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(rx.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={rx.whatsappStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const styles = {
    sent: 'bg-emerald-100 text-emerald-700',
    pending: 'bg-amber-100 text-amber-700',
    failed: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${styles[status] || ''}`}>
      {status}
    </span>
  );
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}
