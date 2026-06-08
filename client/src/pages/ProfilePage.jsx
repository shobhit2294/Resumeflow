import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { User, Lock, Briefcase, Save } from 'lucide-react';
import api from '../utils/api';
import useAuthStore from '../context/authStore';
import { getCompanyColor } from '../utils/constants';

export default function ProfilePage() {
  const { user, updateProfile } = useAuthStore();

  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    title: user?.title || '',
    skills: user?.skills?.join(', ') || '',
  });

  const [prefForm, setPrefForm] = useState({
    targetRoles: user?.preferences?.targetRoles?.join(', ') || '',
    targetSalaryMin: user?.preferences?.targetSalaryMin || '',
    targetSalaryMax: user?.preferences?.targetSalaryMax || '',
    preferredLocations: user?.preferences?.preferredLocations?.join(', ') || '',
    remoteOnly: user?.preferences?.remoteOnly || false,
  });

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });

  const profileMutation = useMutation({
    mutationFn: (data) => updateProfile(data),
    onSuccess: () => toast.success('Profile updated!'),
    onError: (e) => toast.error(e.response?.data?.error || 'Update failed'),
  });

  const pwMutation = useMutation({
    mutationFn: (data) => api.put('/auth/change-password', data),
    onSuccess: () => {
      toast.success('Password changed!');
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to change password'),
  });

  const handleProfileSubmit = (e) => {
    e.preventDefault();
    profileMutation.mutate({
      name: profileForm.name,
      title: profileForm.title,
      skills: profileForm.skills.split(',').map(s => s.trim()).filter(Boolean),
      preferences: {
        targetRoles: prefForm.targetRoles.split(',').map(s => s.trim()).filter(Boolean),
        targetSalaryMin: prefForm.targetSalaryMin ? Number(prefForm.targetSalaryMin) : undefined,
        targetSalaryMax: prefForm.targetSalaryMax ? Number(prefForm.targetSalaryMax) : undefined,
        preferredLocations: prefForm.preferredLocations.split(',').map(s => s.trim()).filter(Boolean),
        remoteOnly: prefForm.remoteOnly,
      },
    });
  };

  const handlePwSubmit = (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (pwForm.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    pwMutation.mutate({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
  };

  const setP = (field) => (e) => setProfileForm(f => ({ ...f, [field]: e.target.value }));
  const setPref = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setPrefForm(f => ({ ...f, [field]: val }));
  };
  const setPw = (field) => (e) => setPwForm(f => ({ ...f, [field]: e.target.value }));

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  const avatarColor = getCompanyColor(user?.name || '');

  return (
    <div className="p-6 max-w-xl space-y-6">
      <div>
        <h1 className="font-semibold text-gray-900">Profile & Settings</h1>
        <p className="text-xs text-gray-400 mt-0.5">Manage your account and preferences</p>
      </div>

      {/* Avatar */}
      <div className="card p-5 flex items-center gap-4">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0 ${avatarColor}`}>
          {initials}
        </div>
        <div>
          <p className="font-semibold text-gray-900">{user?.name}</p>
          <p className="text-sm text-gray-500">{user?.email}</p>
          {user?.title && <p className="text-xs text-gray-400 mt-0.5">{user.title}</p>}
        </div>
      </div>

      {/* Profile form */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <User size={15} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Personal info</h3>
        </div>
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Full name</label>
            <input className="input" value={profileForm.name} onChange={setP('name')} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Job title</label>
            <input className="input" placeholder="e.g. Software Engineer" value={profileForm.title} onChange={setP('title')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Skills <span className="text-gray-400">(comma separated)</span>
            </label>
            <input className="input" placeholder="React, Node.js, TypeScript, AWS" value={profileForm.skills} onChange={setP('skills')} />
          </div>

          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <Briefcase size={14} className="text-gray-400" />
              <p className="text-xs font-semibold text-gray-700">Job preferences</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Target roles</label>
                <input className="input text-sm" placeholder="Frontend, Full Stack" value={prefForm.targetRoles} onChange={setPref('targetRoles')} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Locations</label>
                <input className="input text-sm" placeholder="Remote, NYC, SF" value={prefForm.preferredLocations} onChange={setPref('preferredLocations')} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Min salary ($)</label>
                <input type="number" className="input text-sm" placeholder="80000" value={prefForm.targetSalaryMin} onChange={setPref('targetSalaryMin')} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Max salary ($)</label>
                <input type="number" className="input text-sm" placeholder="150000" value={prefForm.targetSalaryMax} onChange={setPref('targetSalaryMax')} />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <input type="checkbox" id="remoteOnly" checked={prefForm.remoteOnly} onChange={setPref('remoteOnly')} className="rounded" />
              <label htmlFor="remoteOnly" className="text-sm text-gray-700">Remote only</label>
            </div>
          </div>

          <button type="submit" disabled={profileMutation.isPending} className="btn-primary w-full justify-center">
            {profileMutation.isPending
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><Save size={14} /> Save profile</>}
          </button>
        </form>
      </div>

      {/* Change password */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lock size={15} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Change password</h3>
        </div>
        <form onSubmit={handlePwSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Current password</label>
            <input type="password" className="input" value={pwForm.currentPassword} onChange={setPw('currentPassword')} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">New password</label>
            <input type="password" className="input" placeholder="Min 6 characters" value={pwForm.newPassword} onChange={setPw('newPassword')} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Confirm new password</label>
            <input type="password" className="input" value={pwForm.confirm} onChange={setPw('confirm')} required />
          </div>
          <button type="submit" disabled={pwMutation.isPending} className="btn-secondary w-full justify-center">
            {pwMutation.isPending
              ? <span className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-600 rounded-full animate-spin" />
              : 'Change password'}
          </button>
        </form>
      </div>

      {/* Account info */}
      <div className="card p-5 bg-gray-50">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Account</p>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Email</span>
            <span className="text-gray-900">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Member since</span>
            <span className="text-gray-900">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
