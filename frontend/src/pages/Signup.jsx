import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    specialization: '',
    registrationNumber: '',
    clinicName: '',
  });
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signup(form);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Signup failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="card w-full max-w-lg">
        <h1 className="text-xl font-semibold mb-1">Create doctor account</h1>
        <p className="text-sm text-slate-500 mb-6">Start managing your patients.</p>
        <form onSubmit={onSubmit} className="space-y-4">
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
                required
                className="input"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Password</label>
              <input
                type="password"
                required
                minLength={8}
                className="input"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>
            </div>
            <div>
              <label className="label">Specialization</label>
              <input
                className="input"
                value={form.specialization}
                onChange={(e) => update('specialization', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Registration number</label>
              <input
                className="input"
                value={form.registrationNumber}
                onChange={(e) => update('registrationNumber', e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Clinic / hospital name</label>
              <input
                className="input"
                value={form.clinicName}
                onChange={(e) => update('clinicName', e.target.value)}
              />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-600">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-700 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
