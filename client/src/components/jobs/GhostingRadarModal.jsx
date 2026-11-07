import { useState, useEffect } from 'react';
import {
  X, AlertTriangle, Clock, CheckCircle2, Copy, Check,
  Send, Sparkles, MessageSquare, Linkedin, Mail, RefreshCw,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../utils/api';

export default function GhostingRadarModal({ job, onClose, onLogged }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [customDays, setCustomDays] = useState(null);

  // Calculate default days since last contact or creation
  const defaultDays = Math.max(
    1,
    Math.floor((Date.now() - new Date(job.updatedAt || job.appliedDate || job.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24))
  );

  const days = customDays !== null ? customDays : defaultDays;

  const fetchFollowUp = async (daysCount) => {
    setLoading(true);
    try {
      const res = await api.post('/intel/follow-up', {
        jobTitle: job.role || job.title || 'Role',
        company: job.company || 'Company',
        stage: job.stage || 'Applied',
        daysSinceLastContact: daysCount,
        recipientName: job.contactName || job.contactPerson || 'Hiring Manager',
        notes: (job.notes || []).map((n) => n.text).join(' '),
      });
      setData(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate follow-up strategy');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowUp(days);
  }, []);

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleLogFollowUp = async () => {
    try {
      await api.post(`/jobs/${job._id}/notes`, {
        text: `Sent follow-up outreach (${days} days in ${job.stage} stage)`,
      });
      toast.success('Logged follow-up in job notes!');
      if (onLogged) onLogged();
    } catch (err) {
      toast.error('Could not log note');
    }
  };

  const riskBadge = {
    on_track: { bg: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle2, text: 'On Track (1-5 days)' },
    follow_up_window: { bg: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock, text: 'Prime Follow-Up Window (6-10 days)' },
    stalled_ghost_risk: { bg: 'bg-rose-50 text-rose-700 border-rose-200', icon: AlertTriangle, text: 'Stalled / Ghost Risk (11+ days)' },
  }[data?.status || 'follow_up_window'];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-gray-100 overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-gray-900 via-primary-950 to-gray-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center text-primary-400">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="font-semibold text-base leading-tight">Ghosting Radar & Follow-up AI</h2>
              <p className="text-xs text-gray-400 mt-0.5">{job.role || job.title} at {job.company}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Status Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-gray-50 border border-gray-200/80">
            <div className="flex items-center gap-2.5">
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${riskBadge.bg}`}>
                <riskBadge.icon size={13} />
                {riskBadge.text}
              </span>
              <span className="text-xs text-gray-500">
                Stage: <strong className="text-gray-800">{job.stage || 'Applied'}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span>Days since contact:</span>
              <input
                type="number"
                min="1"
                max="90"
                value={days}
                onChange={(e) => setCustomDays(Number(e.target.value))}
                className="w-14 px-2 py-1 rounded border border-gray-300 text-center font-medium focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <button
                onClick={() => fetchFollowUp(days)}
                disabled={loading}
                className="btn-secondary !py-1 !px-2 text-xs flex items-center gap-1"
                title="Recalculate"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-gray-500 font-medium">Generating high-conversion follow-ups...</p>
            </div>
          ) : data ? (
            <div className="space-y-5">
              {/* Tactical Recommendation */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
                <Sparkles size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-blue-950">Tactical Assessment: </span>
                  {data.recommendation}
                </div>
              </div>

              {/* Template 1: Polite Check-in */}
              <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-800">
                    <Mail size={14} className="text-primary-600" />
                    Option 1: Professional Status Check-in
                    <span className="text-[10px] text-gray-400 font-normal">({data.politeCheckIn?.bestTiming})</span>
                  </div>
                  <button
                    onClick={() => handleCopy(`Subject: ${data.politeCheckIn?.subject}\n\n${data.politeCheckIn?.body}`, 'polite')}
                    className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1 font-medium transition-colors"
                  >
                    {copiedKey === 'polite' ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                    {copiedKey === 'polite' ? 'Copied' : 'Copy Email'}
                  </button>
                </div>
                <div className="bg-gray-50/70 border border-gray-100 rounded-lg p-3 text-xs text-gray-700 font-mono whitespace-pre-wrap leading-relaxed">
                  <span className="text-gray-400 font-sans">Subject:</span> <strong>{data.politeCheckIn?.subject}</strong>
                  {'\n\n'}
                  {data.politeCheckIn?.body}
                </div>
              </div>

              {/* Template 2: Value-Add Update */}
              <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-800">
                    <Sparkles size={14} className="text-amber-500" />
                    Option 2: Value-Add Project Re-engagement
                    <span className="text-[10px] text-gray-400 font-normal">({data.valueAddUpdate?.bestTiming})</span>
                  </div>
                  <button
                    onClick={() => handleCopy(`Subject: ${data.valueAddUpdate?.subject}\n\n${data.valueAddUpdate?.body}`, 'value')}
                    className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1 font-medium transition-colors"
                  >
                    {copiedKey === 'value' ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                    {copiedKey === 'value' ? 'Copied' : 'Copy Email'}
                  </button>
                </div>
                <div className="bg-gray-50/70 border border-gray-100 rounded-lg p-3 text-xs text-gray-700 font-mono whitespace-pre-wrap leading-relaxed">
                  <span className="text-gray-400 font-sans">Subject:</span> <strong>{data.valueAddUpdate?.subject}</strong>
                  {'\n\n'}
                  {data.valueAddUpdate?.body}
                </div>
              </div>

              {/* Template 3: LinkedIn InMail / Short DM */}
              <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-800">
                    <Linkedin size={14} className="text-blue-600" />
                    Option 3: Quick LinkedIn / Recruiter DM
                    <span className="text-[10px] text-gray-400 font-normal">({data.linkedInInMail?.characterCount || 240} chars)</span>
                  </div>
                  <button
                    onClick={() => handleCopy(data.linkedInInMail?.message, 'inmail')}
                    className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1 font-medium transition-colors"
                  >
                    {copiedKey === 'inmail' ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                    {copiedKey === 'inmail' ? 'Copied' : 'Copy Message'}
                  </button>
                </div>
                <div className="bg-gray-50/70 border border-gray-100 rounded-lg p-3 text-xs text-gray-700 font-mono whitespace-pre-wrap leading-relaxed">
                  {data.linkedInInMail?.message}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200/80 flex items-center justify-between">
          <button
            onClick={handleLogFollowUp}
            className="text-xs text-gray-700 hover:text-gray-900 font-medium flex items-center gap-1.5"
          >
            <Send size={13} className="text-primary-600" />
            Mark As Followed-Up (Log Note)
          </button>
          <button onClick={onClose} className="btn-secondary !py-1.5 text-xs">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

