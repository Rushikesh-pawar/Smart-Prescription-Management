import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';

export default function Profile() {
  const { doctor, updateProfile, changePassword } = useAuth();
  const [form, setForm] = useState({
    name: '',
    specialization: '',
    registrationNumber: '',
    clinicName: '',
  });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    if (doctor) {
      setForm({
        name: doctor.name || '',
        specialization: doctor.specialization || '',
        registrationNumber: doctor.registrationNumber || '',
        clinicName: doctor.clinicName || '',
      });
    }
  }, [doctor]);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function onSaveProfile(e) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateProfile(form);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed');
    } finally {
      setSavingProfile(false);
    }
  }

  async function onChangePassword(e) {
    e.preventDefault();
    if (pw.newPassword !== pw.confirm) {
      toast.error("New passwords don't match");
      return;
    }
    if (pw.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    setSavingPw(true);
    try {
      await changePassword(pw.currentPassword, pw.newPassword);
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
      toast.success('Password changed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Password change failed');
    } finally {
      setSavingPw(false);
    }
  }

  if (!doctor) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My profile</h1>
        <p className="text-sm text-slate-500">
          These details appear on the prescription PDF and the WhatsApp message.
        </p>
      </div>

      <form onSubmit={onSaveProfile} className="card space-y-4">
        <h2 className="font-medium">Doctor details</h2>
        <div>
          <label className="label">Email</label>
          <input
            disabled
            value={doctor.email}
            className="input bg-slate-50 text-slate-500 cursor-not-allowed"
          />
          <p className="mt-1 text-xs text-slate-500">
            Email is your login and cannot be changed here.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Full name</label>
            <input
              required
              minLength={2}
              className="input"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Specialization</label>
            <input
              className="input"
              placeholder="e.g. General Practitioner"
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
          <div>
            <label className="label">Clinic / hospital name</label>
            <input
              className="input"
              value={form.clinicName}
              onChange={(e) => update('clinicName', e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={savingProfile} className="btn-primary">
            {savingProfile ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>

      <form onSubmit={onChangePassword} className="card space-y-4">
        <h2 className="font-medium">Change password</h2>
        <div>
          <label className="label">Current password</label>
          <input
            type="password"
            required
            className="input"
            value={pw.currentPassword}
            onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">New password</label>
            <input
              type="password"
              required
              minLength={8}
              className="input"
              value={pw.newPassword}
              onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input
              type="password"
              required
              minLength={8}
              className="input"
              value={pw.confirm}
              onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={savingPw} className="btn-primary">
            {savingPw ? 'Changing…' : 'Change password'}
          </button>
        </div>
      </form>
    </div>
  );
}
