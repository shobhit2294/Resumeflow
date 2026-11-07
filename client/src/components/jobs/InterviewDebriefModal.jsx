import { useState } from 'react';
import {
  X, Sparkles, Send, Copy, Check, AlertOctagon, HelpCircle,
  Mail, BookOpen, Clock, HeartHandshake, ShieldAlert
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../utils/api';

export default function InterviewDebriefModal({ job, onClose, onLogged }) {
  const [roundName, setRoundName] = useState('Technical Coding Round');
  const [overallFeeling, setOverallFeeling] = useState('mixed');
  const [questionsAsked, setQuestionsAsked] = useState('');
  const [stumbledQuestion, setStumbledQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  const role = job.role || job.title || 'Role';
  const company = job.company || 'Company';

  const handleDebrief = async (e) => {
    e.preventDefault();
    if (!questionsAsked.trim() && !stumbledQuestion.trim()) {
      toast.error('Please describe at least one question asked or stumbled on.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/intel/interview-debrief', {
        company,
        role,
        roundName,
        overallFeeling,
        questionsAsked,
        stumbledQuestion,
      });
      setData(res.data);
      toast.success('Generated interview debrief & thank-you note!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate interview debrief');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied!');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleLogNote = async () => {
    try {
      await api.post(`/jobs/${job._id}/notes`, {
        text: `Interview Debrief (${roundName}): Feeling ${overallFeeling}. Review prep logged.`,
      });
      toast.success('Logged debrief into job timeline!');
      if (onLogged) onLogged();
    } catch (err) {
      toast.error('Could not log note');
    }
  };

  const severityBadge = {
    minor: { bg: 'bg-emerald-50 text-emerald-800 border-emerald-200', text: 'Minor Slip · Very Recoverable' },
    medium: { bg: 'bg-amber-50 text-amber-800 border-amber-200', text: 'Noticeable Gap · Clarification Recommended' },
    critical: { bg: 'bg-rose-50 text-rose-800 border-rose-200', text: 'High Risk · Swift Clarification Critical' },
  }[data?.severityRating || 'minor'];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-gray-100 overflow-hidden my-8 animate-fade-in">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-gray-900 via-primary-950 to-gray-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center text-primary-400">
              <HeartHandshake size={18} />
            </div>
            <div>
              <h2 className="font-semibold text-base leading-tight">Post-Interview Debrief & Recovery AI</h2>
              <p className="text-xs text-gray-400 mt-0.5">{role} at {company}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Input Form */}
          {!data ? (
            <form onSubmit={handleDebrief} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Interview Round</label>
                  <select
                    value={roundName}
                    onChange={(e) => setRoundName(e.target.value)}
                    className="input text-xs"
                  >
                    <option value="Recruiter Screen">Recruiter Screen</option>
                    <option value="Technical Coding Round">Technical Coding Round</option>
                    <option value="System Design Round">System Design Round</option>
                    <option value="Hiring Manager / Behavioral">Hiring Manager / Behavioral</option>
                    <option value="Executive / Culture Fit">Executive / Culture Fit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">How did you feel?</label>
                  <select
                    value={overallFeeling}
                    onChange={(e) => setOverallFeeling(e.target.value)}
                    className="input text-xs"
                  >
                    <option value="great">Great - Confident answers</option>
                    <option value="mixed">Mixed - Some stumbles or hesitation</option>
                    <option value="rough">Rough - Missed critical concepts</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Questions asked during this round:
                </label>
                <textarea
                  rows="3"
                  value={questionsAsked}
                  onChange={(e) => setQuestionsAsked(e.target.value)}
                  placeholder="e.g. Asked about PostgreSQL indexing, concurrency bottlenecks, and why I left my previous company..."
                  className="input text-xs resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Specific question you stumbled on or want to clarify (Optional but recommended):
                </label>
                <textarea
                  rows="2"
                  value={stumbledQuestion}
                  onChange={(e) => setStumbledQuestion(e.target.value)}
                  placeholder="e.g. I blanked on how to handle distributed deadlocks in Microservices..."
                  className="input text-xs resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center py-2.5 flex items-center gap-2"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Sparkles size={16} />
                    Run Interview Autopsy & Generate Recovery Plan
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-5 animate-fade-in">
              {/* Severity & Post-Mortem Card */}
              <div className="card p-4 border border-gray-200/90 bg-gray-50/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                    Post-Mortem Analysis
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${severityBadge.bg}`}>
                    {severityBadge.text}
                  </span>
                </div>
                <p className="text-xs text-gray-700 leading-relaxed">
                  {data.postMortemAnalysis}
                </p>
              </div>

              {/* Thank You Note with Graceful Clarification */}
              <div className="card p-4 border border-emerald-200 bg-emerald-50/30 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                    <Mail size={14} className="text-emerald-600" />
                    Same-Day Thank You Email (With Clarification)
                  </div>
                  <button
                    onClick={() => handleCopy(`Subject: ${data.thankYouEmail?.subject}\n\n${data.thankYouEmail?.body}`, 'email')}
                    className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1 font-medium transition-colors"
                  >
                    {copiedKey === 'email' ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                    {copiedKey === 'email' ? 'Copied' : 'Copy Email'}
                  </button>
                </div>
                <div className="bg-white border border-emerald-100 rounded-lg p-3 text-xs text-gray-800 font-mono whitespace-pre-wrap leading-relaxed shadow-sm">
                  <span className="text-gray-400 font-sans">Subject:</span> <strong>{data.thankYouEmail?.subject}</strong>
                  {'\n\n'}
                  {data.thankYouEmail?.body}
                </div>
                <p className="text-[11px] text-emerald-800 italic">
                  💡 Send Tip: {data.thankYouEmail?.timingTip}
                </p>
              </div>

              {/* Polished Technical Clarification */}
              {data.clarifiedAnswer && (
                <div className="card p-4 border border-blue-200 bg-blue-50/40 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                      <BookOpen size={14} className="text-blue-600" />
                      Enhanced Technical Clarification
                    </span>
                    <button
                      onClick={() => handleCopy(data.clarifiedAnswer, 'clarified')}
                      className="text-xs text-blue-700 hover:text-blue-900 flex items-center gap-1 font-medium"
                    >
                      {copiedKey === 'clarified' ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                      {copiedKey === 'clarified' ? 'Copied' : 'Copy Snippet'}
                    </button>
                  </div>
                  <p className="text-xs text-blue-950 font-mono bg-white p-3 rounded-lg border border-blue-100">
                    {data.clarifiedAnswer}
                  </p>
                </div>
              )}

              {/* Next Round Prep Focus */}
              <div className="card p-4 border border-gray-200 bg-white rounded-xl space-y-2">
                <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Next Round Mastery Focus
                </span>
                <ul className="space-y-1.5">
                  {data.nextRoundPrepFocus?.map((item, idx) => (
                    <li key={idx} className="text-xs text-gray-700 flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-primary-100 text-primary-800 font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setData(null)}
                  className="btn-secondary !py-1 text-xs"
                >
                  Edit Answers & Re-run
                </button>
                <button
                  type="button"
                  onClick={handleLogNote}
                  className="btn-primary !py-1.5 text-xs flex items-center gap-1"
                >
                  <Send size={13} />
                  Log Debrief to Job Timeline
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200/80 flex items-center justify-end">
          <button onClick={onClose} className="btn-secondary !py-1.5 text-xs">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

