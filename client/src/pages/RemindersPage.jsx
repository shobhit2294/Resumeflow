import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Bell, Check, Trash2, Calendar, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../utils/api';
import { REMINDER_TYPES, daysUntil } from '../utils/constants';

const PRIORITY_STYLES = {
  high:   'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low:    'bg-gray-100 text-gray-600 border-gray-200',
};

const TYPE_COLORS = {
  'follow-up':      'bg-blue-100 text-blue-700',
  'interview':      'bg-violet-100 text-violet-700',
  'offer-deadline': 'bg-red-100 text-red-700',
  'prep':           'bg-teal-100 text-teal-700',
  'other':          'bg-gray-100 text-gray-600',
};

const defaultForm = {
  title: '', description: '', dueDate: '', type: 'follow-up', priority: 'medium', jobId: '',
};

export default function RemindersPage() {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [filter, setFilter] = useState('upcoming'); // upcoming | all | completed
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['reminders', filter],
    queryFn: () =>
      api.get('/reminders', {
        params: filter === 'upcoming' ? { upcoming: 'true' } : filter === 'completed' ? { completed: 'true' } : {},
      }).then(r => r.data),
  });

  const { data: jobsData } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => api.get('/jobs').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/reminders', payload),
    onSuccess: () => {
      qc.invalidateQueries(['reminders']);
      toast.success('Reminder added!');
      setShowModal(false);
      setForm(defaultForm);
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to add'),
  });

  const completeMutation = useMutation({
    mutationFn: (id) => api.patch(`/reminders/${id}/complete`),
    onSuccess: () => { qc.invalidateQueries(['reminders']); toast.success('Marked complete!'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/reminders/${id}`),
    onSuccess: () => { qc.invalidateQueries(['reminders']); toast.success('Deleted'); },
  });

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({ ...form, jobId: form.jobId || undefined });
  };

  const reminders = data?.reminders || [];

  const isOverdue = (r) => !r.completed && new Date(r.dueDate) < new Date();

  return (
    <div className="p-6 max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-gray-900">Reminders</h1>
          <p className="text-xs text-gray-400 mt-0.5">Track follow-ups, deadlines, and prep tasks</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <Plus size={14} /> Add reminder
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {[['upcoming', 'Upcoming'], ['all', 'All'], ['completed', 'Completed']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all ${
              filter === val ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Reminder list */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : reminders.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-center">
          <Bell size={28} className="text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">No reminders {filter === 'upcoming' ? 'upcoming' : filter === 'completed' ? 'completed' : ''}</p>
          <button onClick={() => setShowModal(true)} className="text-xs text-primary-600 hover:underline mt-2">
            Add one now
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {reminders.map(r => (
            <div
              key={r._id}
              className={`card p-4 flex items-start gap-3 transition-all ${
                r.completed ? 'opacity-60' : isOverdue(r) ? 'border-red-200 bg-red-50/30' : ''
              }`}
            >
              {/* Complete button */}
              {!r.completed && (
                <button
                  onClick={() => completeMutation.mutate(r._id)}
                  className="w-5 h-5 rounded-full border-2 border-gray-300 hover:border-primary-400 hover:bg-primary-50 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
                >
                  <Check size={10} className="text-transparent hover:text-primary-500" />
                </button>
              )}
              {r.completed && (
                <div className="w-5 h-5 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check size={10} className="text-primary-600" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 flex-wrap">
                  <p className={`text-sm font-medium ${r.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                    {r.title}
                  </p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${TYPE_COLORS[r.type] || TYPE_COLORS['other']}`}>
                    {REMINDER_TYPES.find(t => t.value === r.type)?.label || r.type}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${PRIORITY_STYLES[r.priority]}`}>
                    {r.priority}
                  </span>
                </div>

                {r.description && (
                  <p className="text-xs text-gray-400 mt-1">{r.description}</p>
                )}

                {r.job && (
                  <p className="text-xs text-gray-400 mt-1">
                    📋 {r.job.role} at {r.job.company}
                  </p>
                )}

                <div className="flex items-center gap-2 mt-2">
                  <Calendar size={11} className="text-gray-400" />
                  <span className={`text-xs ${isOverdue(r) && !r.completed ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                    {new Date(r.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {!r.completed && (
                      <span className="ml-1">· {daysUntil(r.dueDate)}</span>
                    )}
                    {r.completed && r.completedAt && (
                      <span className="ml-1 text-primary-600">
                        · Completed {new Date(r.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <button
                onClick={() => deleteMutation.mutate(r._id)}
                className="p-1 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add reminder modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Add reminder</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Title *</label>
                <input className="input" placeholder="e.g. Follow up with Stripe recruiter" value={form.title} onChange={set('title')} required autoFocus />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Description</label>
                <input className="input" placeholder="Optional notes..." value={form.description} onChange={set('description')} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Due date *</label>
                  <input type="date" className="input" value={form.dueDate} onChange={set('dueDate')} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Type</label>
                  <select className="input" value={form.type} onChange={set('type')}>
                    {REMINDER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Priority</label>
                  <select className="input" value={form.priority} onChange={set('priority')}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Link to job</label>
                  <select className="input" value={form.jobId} onChange={set('jobId')}>
                    <option value="">— None —</option>
                    {jobsData?.jobs?.map(j => (
                      <option key={j._id} value={j._id}>{j.company} — {j.role}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="btn-primary flex-1 justify-center">
                  {createMutation.isPending
                    ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : 'Add reminder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
