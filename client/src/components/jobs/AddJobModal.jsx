import { useState } from 'react';
import { X, Sparkles, Wand2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import api from '../../utils/api';
import { STAGES, SOURCES } from '../../utils/constants';

const defaultForm = {
  company: '', role: '', stage: 'Applied',
  salaryMin: '', salaryMax: '', currency: 'USD',
  location: '', remote: false, source: 'LinkedIn',
  jobUrl: '', jobDescription: '', contactName: '',
  contactEmail: '', priority: 'medium', tags: '',
};

export default function AddJobModal({ onClose, initialStage }) {
  const [form, setForm] = useState({ ...defaultForm, stage: initialStage || 'Applied' });
  const [showSmartPaste, setShowSmartPaste] = useState(false);
  const [rawText, setRawText] = useState('');
  const [parsing, setParsing] = useState(false);
  const qc = useQueryClient();

  const handleSmartExtract = async () => {
    if (!rawText.trim() || rawText.trim().length < 20) {
      toast.error('Please paste the job posting text or description (at least a few lines)');
      return;
    }
    setParsing(true);
    try {
      const res = await api.post('/intel/parse-job', { rawText });
      const d = res.data;
      setForm((prev) => ({
        ...prev,
        company: d.company || prev.company,
        role: d.role || prev.role,
        location: d.location || prev.location,
        remote: d.remote ?? prev.remote,
        salaryMin: d.salaryMin ? String(d.salaryMin) : prev.salaryMin,
        salaryMax: d.salaryMax ? String(d.salaryMax) : prev.salaryMax,
        currency: d.currency || prev.currency,
        source: SOURCES.includes(d.source) ? d.source : prev.source,
        tags: Array.isArray(d.tags) ? d.tags.join(', ') : prev.tags,
        jobDescription: d.jobDescription || prev.jobDescription,
        contactName: d.contactName || prev.contactName,
        contactEmail: d.contactEmail || prev.contactEmail,
      }));
      toast.success(`Extracted details for ${d.company || 'role'}!`);
      setShowSmartPaste(false);
      setRawText('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to auto-extract job details');
    } finally {
      setParsing(false);
    }
  };

  const mutation = useMutation({
    mutationFn: (data) => api.post('/jobs', data),
    onSuccess: () => {
      qc.invalidateQueries(['jobs']);
      toast.success('Job added!');
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to add job'),
  });

  const set = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: val }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      salaryMin: form.salaryMin ? Number(form.salaryMin) : undefined,
      salaryMax: form.salaryMax ? Number(form.salaryMax) : undefined,
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    };
    mutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-gray-900">Add new job</h2>
            <button
              type="button"
              onClick={() => setShowSmartPaste(!showSmartPaste)}
              className="text-[11px] font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 px-2.5 py-1 rounded-full flex items-center gap-1 transition-all"
            >
              <Sparkles size={12} />
              {showSmartPaste ? 'Cancel Smart Paste' : 'AI Smart Fill'}
            </button>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* AI Smart Paste Area */}
        {showSmartPaste && (
          <div className="p-4 bg-gradient-to-r from-primary-50/70 to-blue-50/70 border-b border-primary-100 space-y-2.5 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-primary-900 flex items-center gap-1.5">
                <Wand2 size={13} className="text-primary-600" />
                Paste Raw Job Posting or LinkedIn Snippet
              </span>
              <span className="text-[10px] text-gray-400">Auto-detects title, salary, location & tech stack</span>
            </div>
            <textarea
              rows="4"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste job posting text from LinkedIn, Indeed, Greenhouse, or company portal..."
              className="input text-xs font-mono resize-none w-full bg-white"
            />
            <div className="flex justify-end">
              <button
                type="button"
                disabled={parsing || !rawText.trim()}
                onClick={handleSmartExtract}
                className="btn-primary !py-1.5 !px-3 text-xs flex items-center gap-1.5 shadow-sm"
              >
                {parsing ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Sparkles size={13} />
                    Auto-Fill Form
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Company *</label>
              <input className="input" placeholder="e.g. Stripe" value={form.company} onChange={set('company')} required autoFocus />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Role *</label>
              <input className="input" placeholder="e.g. Senior Frontend Engineer" value={form.role} onChange={set('role')} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Stage</label>
              <select className="input" value={form.stage} onChange={set('stage')}>
                {STAGES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Source</label>
              <select className="input" value={form.source} onChange={set('source')}>
                {SOURCES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Salary min</label>
              <input type="number" className="input" placeholder="80000" value={form.salaryMin} onChange={set('salaryMin')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Salary max</label>
              <input type="number" className="input" placeholder="120000" value={form.salaryMax} onChange={set('salaryMax')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Location</label>
              <input className="input" placeholder="San Francisco, CA" value={form.location} onChange={set('location')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Priority</label>
              <select className="input" value={form.priority} onChange={set('priority')}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Job URL</label>
              <input className="input" placeholder="https://..." value={form.jobUrl} onChange={set('jobUrl')} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Job description <span className="text-gray-400">(for AI resume matching)</span>
              </label>
              <textarea
                className="input resize-none"
                rows={3}
                placeholder="Paste job description here..."
                value={form.jobDescription}
                onChange={set('jobDescription')}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Contact name</label>
              <input className="input" placeholder="Recruiter name" value={form.contactName} onChange={set('contactName')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Contact email</label>
              <input type="email" className="input" placeholder="recruiter@co.com" value={form.contactEmail} onChange={set('contactEmail')} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Tags <span className="text-gray-400">(comma separated)</span></label>
              <input className="input" placeholder="startup, fintech, remote" value={form.tags} onChange={set('tags')} />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="remote" checked={form.remote} onChange={set('remote')} className="rounded" />
              <label htmlFor="remote" className="text-sm text-gray-700">Remote position</label>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1 justify-center">
              {mutation.isPending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Add job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
