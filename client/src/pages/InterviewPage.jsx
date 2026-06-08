import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, MessageSquare, Star, ChevronRight, Trash2, Video, Mic, BarChart2, Clock, Award } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../utils/api';
import { INTERVIEW_TYPES } from '../utils/constants';

export default function InterviewPage() {
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ type: 'mixed', jobId: '' });
  const [mode, setMode] = useState('text'); // 'text' | 'video'

  const { data: jobsData } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => api.get('/jobs').then(r => r.data),
  });
  const { data, isLoading } = useQuery({
    queryKey: ['interviews'],
    queryFn: () => api.get('/interview').then(r => r.data),
  });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = location.state;

  const startMutation = useMutation({
    mutationFn: (payload) => api.post('/interview/start', payload),
    onSuccess: (res) => {
      toast.success('Interview started!');
      const base = `/interview/${res.data.interview._id}`;
      navigate(mode === 'video' ? `${base}/video` : base);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to start'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/interview/${id}`),
    onSuccess: () => { qc.invalidateQueries(['interviews']); toast.success('Deleted'); },
  });

  const handleStart = (e) => {
    e.preventDefault();
    startMutation.mutate({ type: form.type, jobId: form.jobId || undefined });
  };

  const interviews = data?.interviews || [];
  const active = interviews.filter(i => i.status === 'active');
  const completed = interviews.filter(i => i.status === 'completed');

  return (
    <div className="p-6 max-w-3xl space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-gray-900">AI Mock Interviews</h1>
          <p className="text-xs text-gray-400 mt-0.5">Practice with AI, get scored and behaviorally analyzed</p>
        </div>
        <button onClick={() => setShowNew(v => !v)} className="btn-primary">
          <Plus size={14} /> New session
        </button>
      </div>

      {/* ── New session form ── */}
      {(showNew || prefill) && (
        <div className="card p-5 border border-primary-200 animate-fade-in space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">
            {prefill ? `Interview for ${prefill.role} at ${prefill.company}` : 'Start new session'}
          </h3>

          {/* ── Mode selector — BIG CARDS ── */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Choose interview mode</p>
            <div className="grid grid-cols-2 gap-3">

              {/* Text / Voice mode */}
              <button
                type="button"
                onClick={() => setMode('text')}
                className={`relative flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 transition-all text-left ${
                  mode === 'text'
                    ? 'border-primary-400 bg-primary-50'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {mode === 'text' && (
                  <span className="absolute top-2 right-2 w-4 h-4 bg-primary-400 rounded-full flex items-center justify-center">
                    <span className="text-white text-[9px] font-bold">✓</span>
                  </span>
                )}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${mode === 'text' ? 'bg-primary-400' : 'bg-gray-100'}`}>
                  <Mic size={20} className={mode === 'text' ? 'text-white' : 'text-gray-500'} />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${mode === 'text' ? 'text-primary-800' : 'text-gray-800'}`}>
                    Text / Voice
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-tight">
                    Type or speak answers. AI asks questions. Chat-style session.
                  </p>
                </div>
              </button>

              {/* Video mode */}
              <button
                type="button"
                onClick={() => setMode('video')}
                className={`relative flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 transition-all text-left ${
                  mode === 'video'
                    ? 'border-violet-400 bg-violet-50'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {mode === 'video' && (
                  <span className="absolute top-2 right-2 w-4 h-4 bg-violet-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-[9px] font-bold">✓</span>
                  </span>
                )}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${mode === 'video' ? 'bg-violet-500' : 'bg-gray-100'}`}>
                  <Video size={20} className={mode === 'video' ? 'text-white' : 'text-gray-500'} />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${mode === 'video' ? 'text-violet-800' : 'text-gray-800'}`}>
                    Video Interview
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-tight">
                    Camera on. AI tracks eye contact, filler words, confidence &amp; gives behavioral report.
                  </p>
                </div>

                {/* Feature pills */}
                <div className="flex flex-wrap gap-1 w-full mt-1">
                  {['Eye contact', 'Filler words', 'Confidence', 'AI report'].map(f => (
                    <span key={f} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      mode === 'video' ? 'bg-violet-200 text-violet-700' : 'bg-gray-100 text-gray-500'
                    }`}>{f}</span>
                  ))}
                </div>
              </button>
            </div>
          </div>

          {/* Interview type + job link */}
          <form onSubmit={handleStart} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Interview type</label>
                <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {INTERVIEW_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Linked job (optional)</label>
                <select className="input" value={form.jobId || (prefill?.jobId || '')} onChange={e => setForm(f => ({ ...f, jobId: e.target.value }))}>
                  <option value="">— General practice —</option>
                  {jobsData?.jobs?.map(j => (
                    <option key={j._id} value={j._id}>{j.role} at {j.company}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Video mode reminder */}
            {mode === 'video' && (
              <div className="flex items-start gap-2.5 p-3 bg-violet-50 border border-violet-100 rounded-lg">
                <Video size={14} className="text-violet-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-violet-700">
                  Your camera and microphone will be requested when the session starts. Make sure you're in a well-lit room and looking at the camera.
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowNew(false)} className="btn-secondary">
                Cancel
              </button>
              <button
                type="submit"
                disabled={startMutation.isPending}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50 ${
                  mode === 'video'
                    ? 'bg-violet-500 hover:bg-violet-600'
                    : 'bg-primary-400 hover:bg-primary-600'
                }`}
              >
                {startMutation.isPending
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : mode === 'video'
                  ? <><Video size={14} /> Start video interview</>
                  : <><Mic size={14} /> Start interview</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Active sessions ── */}
      {active.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">In progress</h3>
          <div className="space-y-2">
            {active.map(session => (
              <div key={session._id} className="card p-4 flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MessageSquare size={16} className="text-amber-600" />
                </div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/interview/${session._id}`)}>
                  <p className="text-sm font-medium text-gray-900 capitalize">{session.type} interview</p>
                  <p className="text-xs text-gray-400">
                    {session.job ? `${session.job.role} at ${session.job.company}` : 'General practice'} · {session.questionsAsked}/{session.totalQuestions} questions
                  </p>
                </div>
                {/* Both mode buttons always visible */}
                <button
                  onClick={() => navigate(`/interview/${session._id}`)}
                  className="flex items-center gap-1.5 text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg transition-all font-medium flex-shrink-0"
                >
                  <Mic size={12} /> Text
                </button>
                <button
                  onClick={() => navigate(`/interview/${session._id}/video`)}
                  className="flex items-center gap-1.5 text-xs bg-violet-100 text-violet-700 hover:bg-violet-200 px-2.5 py-1.5 rounded-lg transition-all font-medium flex-shrink-0"
                >
                  <Video size={12} /> Video
                </button>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full flex-shrink-0">Active</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Completed sessions ── */}
      {completed.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Completed</h3>
          <div className="space-y-2">
            {completed.map(session => (
              <div key={session._id}
                className="card p-4 flex items-center gap-3 hover:shadow-sm transition-shadow cursor-pointer group"
                onClick={() => navigate(`/interview/${session._id}`)}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${session.behaviorReport ? 'bg-violet-100' : 'bg-primary-50'}`}>
                  {session.behaviorReport
                    ? <Award size={16} className="text-violet-600" />
                    : <MessageSquare size={16} className="text-primary-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 capitalize">{session.type} interview</p>
                    {session.behaviorReport && (
                      <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-medium">Video + AI report</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    {session.job ? `${session.job.role} at ${session.job.company}` : 'General practice'} ·{' '}
                    {new Date(session.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {session.duration ? ` · ${session.duration} min` : ''}
                  </p>
                </div>
                {session.averageScore && (
                  <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-full flex-shrink-0">
                    <Star size={11} className="text-amber-400 fill-amber-400" />
                    <span className="text-xs font-semibold text-amber-700">{session.averageScore}/10</span>
                  </div>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(session._id); }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                >
                  <Trash2 size={13} />
                </button>
                <ChevronRight size={15} className="text-gray-300" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {interviews.length === 0 && !showNew && !isLoading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center mb-3">
            <MessageSquare size={24} className="text-primary-400" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">No interviews yet</h3>
          <p className="text-sm text-gray-400 mb-5">Choose text or video mode and start practicing</p>
          <div className="flex gap-3">
            <button onClick={() => { setMode('text'); setShowNew(true); }} className="btn-secondary flex items-center gap-2">
              <Mic size={14} /> Text interview
            </button>
            <button
              onClick={() => { setMode('video'); setShowNew(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium rounded-lg transition-all"
            >
              <Video size={14} /> Video interview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}