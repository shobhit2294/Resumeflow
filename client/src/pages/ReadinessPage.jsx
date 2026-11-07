import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Target, Zap, BookOpen, MessageSquare, CheckCircle2, XCircle,
  AlertTriangle, ChevronDown, ChevronUp, Trash2, Play, RotateCcw,
  TrendingUp, Award, Clock, Star, FileText
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../utils/api';
import useAuthStore from '../context/authStore';

// ── Score colour helper ────────────────────────────────────────
const scoreColor = (s) =>
  s >= 75 ? 'text-green-600' : s >= 55 ? 'text-amber-600' : 'text-red-600';
const scoreBg = (s) =>
  s >= 75 ? 'bg-green-50 border-green-200' : s >= 55 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
const barColor = (s) =>
  s >= 75 ? 'bg-green-400' : s >= 55 ? 'bg-amber-400' : 'bg-red-400';

const importanceColor = {
  critical:      'bg-red-100 text-red-700 border-red-200',
  high:          'bg-orange-100 text-orange-700 border-orange-200',
  medium:        'bg-blue-100 text-blue-700 border-blue-200',
  'nice-to-have':'bg-gray-100 text-gray-600 border-gray-200',
};

// ── Interview Practice Modal ───────────────────────────────────
function InterviewPractice({ questions, jobTitle, reportId, onEvaluationSaved, onClose }) {
  const [qIdx, setQIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  const [showRubric, setShowRubric] = useState(false);

  const q = questions[qIdx];

  const handleEvaluate = async () => {
    if (!answer.trim()) return;
    setEvaluating(true);
    setEvaluation(null);
    try {
      const res = await api.post('/readiness/evaluate-answer', {
        question: q.question,
        answer,
        rubric: q.rubric,
        jobTitle,
        reportId,
      });
      setEvaluation(res.data.evaluation);
      onEvaluationSaved(res.data.interviewEvaluations);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Evaluation failed');
    } finally {
      setEvaluating(false);
    }
  };

  const nextQuestion = () => {
    setQIdx(i => Math.min(i + 1, questions.length - 1));
    setAnswer('');
    setEvaluation(null);
    setShowRubric(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Interview Practice</h2>
            <p className="text-xs text-gray-400 mt-0.5">Question {qIdx + 1} of {questions.length}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Question */}
          <div className="p-4 bg-primary-50 rounded-xl border border-primary-100">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize
                ${q.difficulty === 'hard' ? 'bg-red-100 text-red-700 border-red-200' :
                  q.difficulty === 'medium' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                  'bg-green-100 text-green-700 border-green-200'}`}>
                {q.difficulty}
              </span>
              <span className="text-xs text-gray-500 capitalize">{q.category}</span>
            </div>
            <p className="text-sm font-medium text-gray-900">{q.question}</p>
          </div>

          {/* Rubric toggle */}
          <button
            onClick={() => setShowRubric(v => !v)}
            className="flex items-center gap-1.5 text-xs text-primary-600 hover:underline"
          >
            {showRubric ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {showRubric ? 'Hide' : 'Show'} scoring rubric
          </button>

          {showRubric && q.rubric && (
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2 text-xs">
              {Object.entries(q.rubric).map(([key, val]) => (
                <div key={key}>
                  <span className="font-semibold text-gray-700 capitalize">
                    {key.replace(/([A-Z])/g, ' $1')}:
                  </span>{' '}
                  <span className="text-gray-600">{val}</span>
                </div>
              ))}
            </div>
          )}

          {/* Answer textarea */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Your answer</label>
            <textarea
              className="input resize-none text-sm w-full"
              rows={5}
              placeholder="Type your answer here... (Tip: use the STAR method — Situation, Task, Action, Result)"
              value={answer}
              onChange={e => setAnswer(e.target.value)}
            />
          </div>

          {/* Evaluation result */}
          {evaluation && (
            <div className="space-y-4 animate-fade-in">
              {/* Score ring */}
              <div className={`p-4 rounded-xl border ${scoreBg(evaluation.overallScore * 10)}`}>
                <div className="flex items-center gap-4">
                  <div className={`text-3xl font-bold ${scoreColor(evaluation.overallScore * 10)}`}>
                    {evaluation.overallScore}/10
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">Overall Score</p>
                    <div className="flex gap-3 mt-1">
                      {Object.entries(evaluation.scores || {}).map(([key, val]) => (
                        <span key={key} className="text-xs text-gray-500">
                          <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>: {val}/10
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Score bars */}
              <div className="space-y-2">
                {Object.entries(evaluation.scores || {}).map(([key, val]) => (
                  <div key={key}>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                      <span className="font-medium">{val}/10</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div className={`h-full rounded-full ${barColor(val * 10)}`} style={{ width: `${val * 10}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Feedback */}
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                <p className="text-xs text-blue-800">{evaluation.feedback}</p>
              </div>

              {/* Strengths & improvements */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-1.5">Strengths</p>
                  <ul className="space-y-1">
                    {(evaluation.strengths || []).map((s, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                        <CheckCircle2 size={12} className="text-green-500 mt-0.5 flex-shrink-0" /> {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-1.5">Improvements</p>
                  <ul className="space-y-1">
                    {(evaluation.improvements || []).map((s, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                        <AlertTriangle size={12} className="text-amber-500 mt-0.5 flex-shrink-0" /> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between gap-3">
          <div className="flex gap-2">
            <button
              onClick={handleEvaluate}
              disabled={!answer.trim() || evaluating}
              className="btn-primary"
            >
              {evaluating
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Evaluating...</>
                : <><Star size={14} /> Evaluate Answer</>}
            </button>
            {evaluation && (
              <button onClick={() => { setAnswer(''); setEvaluation(null); }} className="btn-secondary">
                <RotateCcw size={14} /> Retry
              </button>
            )}
          </div>
          {qIdx < questions.length - 1 && (
            <button onClick={nextQuestion} className="text-sm text-primary-600 hover:underline">
              Next question →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function ReadinessPage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [form, setForm] = useState({ jobTitle: '', company: '', jobDescription: '', resumeText: '' });
  const [showResumeInput, setShowResumeInput] = useState(false);
  const [activeReport, setActiveReport] = useState(null);
  const [expandedSkill, setExpandedSkill] = useState(null);
  const [expandedPlan, setExpandedPlan] = useState(null);
  const [showInterview, setShowInterview] = useState(false);
  const [tab, setTab] = useState('skills');

  const { data: reportsData } = useQuery({
    queryKey: ['readiness-reports'],
    queryFn: () => api.get('/readiness/reports').then(r => r.data),
  });

  const analyzeMutation = useMutation({
    mutationFn: (payload) => api.post('/readiness/analyze', payload),
    onSuccess: (res) => {
      setActiveReport(res.data.report);
      qc.invalidateQueries(['readiness-reports']);
      toast.success('Analysis complete!');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Analysis failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/readiness/reports/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(['readiness-reports']);
      if (activeReport) setActiveReport(null);
      toast.success('Report deleted');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to delete'),
  });

  const loadReport = async (id) => {
    try {
      const res = await api.get(`/readiness/reports/${id}`);
      setActiveReport(res.data.report);
    } catch {
      toast.error('Failed to load report');
    }
  };

  const handleAnalyze = (e) => {
    e.preventDefault();
    if (!form.jobTitle.trim() || !form.jobDescription.trim()) {
      toast.error('Job title and description are required');
      return;
    }
    analyzeMutation.mutate(form);
  };

  const reports = reportsData?.reports || [];
  const r = activeReport;

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="font-semibold text-gray-900 flex items-center gap-2">
          <Target size={18} className="text-primary-500" /> Job Readiness Agent
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Paste a job description and get an evidence-backed readiness score, skill gap analysis, learning plan, and practice interview
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Analyze a Job</h3>
            <form onSubmit={handleAnalyze} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Job Title *</label>
                <input
                  className="input text-sm"
                  placeholder="e.g. Senior Frontend Engineer"
                  value={form.jobTitle}
                  onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Company</label>
                <input
                  className="input text-sm"
                  placeholder="e.g. Google (optional)"
                  value={form.company}
                  onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Job Description *</label>
                <textarea
                  className="input text-sm resize-none"
                  rows={7}
                  placeholder="Paste the full job description here..."
                  value={form.jobDescription}
                  onChange={e => setForm(f => ({ ...f, jobDescription: e.target.value }))}
                  required
                />
              </div>

              {/* Resume status / paste option */}
              {!user?.resumeText && !form.resumeText ? (
                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                    <AlertTriangle size={13} className="text-amber-600 flex-shrink-0" />
                    <span>No Resume on File</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Upload your resume in <Link to="/resume" className="underline font-bold text-primary-700">Resume AI</Link>, or paste your background below.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowResumeInput(!showResumeInput)}
                    className="text-[11px] font-semibold text-primary-700 hover:underline flex items-center gap-1 pt-0.5"
                  >
                    <FileText size={12} />
                    {showResumeInput ? 'Hide background input' : '+ Paste experience / resume directly'}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between text-[11px] text-gray-500 pt-0.5">
                  <span className="text-emerald-700 font-medium flex items-center gap-1">
                    <CheckCircle2 size={12} /> Resume on file
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowResumeInput(!showResumeInput)}
                    className="text-primary-600 hover:underline"
                  >
                    {showResumeInput ? 'Cancel custom resume' : 'Use different resume'}
                  </button>
                </div>
              )}

              {showResumeInput && (
                <div className="space-y-1 animate-fade-in">
                  <label className="block text-xs font-medium text-gray-700">
                    Custom Resume / Experience for this audit
                  </label>
                  <textarea
                    className="input text-xs resize-none"
                    rows={4}
                    placeholder="Paste your resume bullet points, work experience, or projects..."
                    value={form.resumeText}
                    onChange={e => setForm(f => ({ ...f, resumeText: e.target.value }))}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={analyzeMutation.isPending}
                className="btn-primary w-full justify-center"
              >
                {analyzeMutation.isPending
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analyzing (30–60s)...</>
                  : <><Zap size={14} /> Analyze Readiness</>}
              </button>
            </form>
          </div>

          {/* Past reports */}
          {reports.length > 0 && (
            <div className="card p-4">
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">Past Reports</h3>
              <div className="space-y-2">
                {reports.map(rep => (
                  <div
                    key={rep._id}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                      activeReport?._id === rep._id
                        ? 'border-primary-300 bg-primary-50'
                        : 'border-gray-100 hover:border-gray-200 bg-white'
                    }`}
                    onClick={() => loadReport(rep._id)}
                  >
                    <div className={`text-lg font-bold ${scoreColor(rep.overallScore)} flex-shrink-0 w-10 text-center`}>
                      {rep.overallScore}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{rep.jobTitle}</p>
                      <p className="text-[10px] text-gray-400">{rep.company || 'No company'}</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); deleteMutation.mutate(rep._id); }}
                      className="text-gray-300 hover:text-red-400 flex-shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Report panel */}
        <div className="lg:col-span-2">
          {!r && !analyzeMutation.isPending && (
            <div className="card p-8 text-center">
              <Target size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Paste a job description and click Analyze</p>
              <p className="text-xs text-gray-400 mt-1">The AI will extract skills, match your resume, find gaps, and create a learning plan</p>
            </div>
          )}

          {analyzeMutation.isPending && (
            <div className="card p-8 text-center">
              <div className="w-12 h-12 border-3 border-primary-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm font-medium text-gray-700">Running 5-step analysis...</p>
              <div className="mt-4 space-y-2 text-left max-w-xs mx-auto">
                {[
                  'Extracting skills from JD',
                  'Matching resume evidence',
                  'Computing weighted score',
                  'Creating learning plan',
                  'Generating interview questions',
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
                    <div className="w-4 h-4 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
                    {step}
                  </div>
                ))}
              </div>
            </div>
          )}

          {r && (
            <div className="space-y-4">
              {/* Score header */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-semibold text-gray-900">{r.jobTitle}</h2>
                    {r.company && <p className="text-xs text-gray-400">{r.company}</p>}
                  </div>
                  <button onClick={() => setShowInterview(true)} className="btn-primary text-xs">
                    <Play size={12} /> Practice Interview
                  </button>
                </div>

                {/* Overall score */}
                <div className={`flex items-center gap-6 p-4 rounded-xl border ${scoreBg(r.overallScore)}`}>
                  <div className={`text-5xl font-bold ${scoreColor(r.overallScore)}`}>
                    {r.overallScore}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">Overall Readiness Score</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {r.overallScore >= 75 ? 'Strong match — ready to apply' :
                       r.overallScore >= 55 ? 'Decent match — some gaps to address' :
                       'Significant gaps — focus on learning plan first'}
                    </p>
                    <div className="flex gap-4 mt-2">
                      <span className="text-xs text-gray-500">Skills <strong className={scoreColor(r.scoreBreakdown?.skillsScore)}>{r.scoreBreakdown?.skillsScore}</strong></span>
                      <span className="text-xs text-gray-500">Experience <strong className={scoreColor(r.scoreBreakdown?.experienceScore)}>{r.scoreBreakdown?.experienceScore}</strong></span>
                      <span className="text-xs text-gray-500">Education <strong className={scoreColor(r.scoreBreakdown?.educationScore)}>{r.scoreBreakdown?.educationScore}</strong></span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Within skills: required {r.scoreBreakdown?.requiredSkillsScore ?? 0} · preferred {r.scoreBreakdown?.preferredSkillsScore ?? 0} (80/20 when both are listed)
                    </p>
                  </div>
                </div>

                {/* Score weight bar */}
                <div className="mt-3">
                  <div className="flex text-[10px] text-gray-400 justify-between mb-1">
                    <span>Skills (60%)</span><span>Experience (25%)</span><span>Education (15%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 flex overflow-hidden">
                    <div className={`${barColor(r.scoreBreakdown?.skillsScore)} h-full`} style={{ width: '60%', opacity: (r.scoreBreakdown?.skillsScore || 0) / 100 + 0.3 }} />
                    <div className={`${barColor(r.scoreBreakdown?.experienceScore)} h-full`} style={{ width: '25%', opacity: (r.scoreBreakdown?.experienceScore || 0) / 100 + 0.3 }} />
                    <div className={`${barColor(r.scoreBreakdown?.educationScore)} h-full`} style={{ width: '15%', opacity: (r.scoreBreakdown?.educationScore || 0) / 100 + 0.3 }} />
                  </div>
                  {(r.interviewEvaluations || []).length > 0 && (
                    <p className="text-xs text-gray-500 mt-3">
                      Practice progress: <strong>{r.interviewEvaluations.length}</strong> answers evaluated · average{' '}
                      <strong>
                        {(r.interviewEvaluations.reduce((sum, item) => sum + item.overallScore, 0) / r.interviewEvaluations.length).toFixed(1)}/10
                      </strong>
                    </p>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-200">
                {[
                  { id: 'skills', label: 'Skill Match', icon: Target },
                  { id: 'gaps', label: 'Skill Gaps', icon: AlertTriangle },
                  { id: 'plan', label: 'Learning Plan', icon: BookOpen },
                  { id: 'experience', label: 'Experience & Education', icon: TrendingUp },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
                      tab === id
                        ? 'text-primary-700 border-primary-400'
                        : 'text-gray-500 border-transparent hover:text-gray-700'
                    }`}
                  >
                    <Icon size={12} /> {label}
                  </button>
                ))}
              </div>

              {/* Tab: Skill Match */}
              {tab === 'skills' && (
                <div className="card p-5 space-y-3">
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Required Skills</p>
                  {(r.requiredSkills || []).map((s) => (
                    <div key={s.skill} className="border border-gray-100 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setExpandedSkill(expandedSkill === s.skill ? null : s.skill)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
                      >
                        {s.found
                          ? <CheckCircle2 size={15} className="text-green-500 flex-shrink-0" />
                          : <XCircle size={15} className="text-red-400 flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{s.skill}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${importanceColor[s.importance] || importanceColor.medium}`}>
                              {s.importance}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-sm font-bold ${scoreColor(s.score)}`}>{s.score}%</span>
                          {expandedSkill === s.skill ? <ChevronUp size={12} className="text-gray-400" /> : <ChevronDown size={12} className="text-gray-400" />}
                        </div>
                      </button>
                      <div className="h-1 bg-gray-50">
                        <div className={`h-full ${barColor(s.score)} transition-all`} style={{ width: `${s.score}%` }} />
                      </div>
                      {expandedSkill === s.skill && (
                        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                          {s.evidence && (
                            <p className="text-xs text-gray-500 mb-1">
                              Keyword match: {s.keywordSimilarity ?? 0}% · Semantic similarity: {s.embeddingSimilarity ?? 0}%
                            </p>
                          )}
                          {s.evidence
                            ? <p className="text-xs text-gray-600">
                                <span className="font-semibold text-gray-800">Evidence: </span>
                                <span className="italic">"{s.evidence}"</span>
                              </p>
                            : <p className="text-xs text-gray-400 italic">Not found in your resume</p>}
                        </div>
                      )}
                    </div>
                  ))}

                  {(r.preferredSkills || []).length > 0 && (
                    <>
                      <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mt-4">Preferred Skills</p>
                      <div className="flex flex-wrap gap-2">
                        {r.preferredSkills.map(s => (
                          <span key={s.skill} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${
                            s.found ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'
                          }`}>
                            {s.found ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                            {s.skill}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Tab: Skill Gaps */}
              {tab === 'gaps' && (
                <div className="card p-5">
                  {(r.skillGaps || []).length === 0 ? (
                    <div className="text-center py-6">
                      <Award size={32} className="text-green-400 mx-auto mb-2" />
                      <p className="text-sm font-medium text-green-700">No significant skill gaps!</p>
                      <p className="text-xs text-gray-400 mt-1">Your resume matches the requirements well</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        {r.skillGaps.length} gap{r.skillGaps.length !== 1 ? 's' : ''} identified (ranked by importance)
                      </p>
                      {r.skillGaps.map((g, i) => (
                        <div key={g.skill} className="flex items-start gap-3 p-3 border border-gray-100 rounded-xl">
                          <span className="text-xs font-bold text-gray-400 w-5 flex-shrink-0 mt-0.5">{i + 1}</span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-medium text-gray-900">{g.skill}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${importanceColor[g.importance] || importanceColor.medium}`}>
                                {g.importance}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500">{g.reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Learning Plan */}
              {tab === 'plan' && (
                <div className="card p-5">
                  {(r.learningPlan || []).length === 0 ? (
                    <div className="text-center py-6">
                      <BookOpen size={32} className="text-gray-200 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No learning plan needed — great skill match!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {r.learningPlan.map((item, i) => (
                        <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
                          <button
                            onClick={() => setExpandedPlan(expandedPlan === i ? null : i)}
                            className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
                          >
                            <BookOpen size={15} className="text-primary-400 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{item.skill}</p>
                              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                <Clock size={10} /> {item.timeline}
                              </p>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                              item.priority === 'high' ? 'bg-red-50 text-red-600 border-red-200' :
                              item.priority === 'medium' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                              'bg-gray-50 text-gray-500 border-gray-200'
                            }`}>
                              {item.priority} priority
                            </span>
                            {expandedPlan === i ? <ChevronUp size={12} className="text-gray-400" /> : <ChevronDown size={12} className="text-gray-400" />}
                          </button>
                          {expandedPlan === i && (
                            <div className="px-4 pb-4 space-y-2">
                              {(item.resources || []).map((res, j) => (
                                <div key={j} className="flex items-start gap-3 p-2.5 bg-gray-50 rounded-lg">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 mt-0.5 ${
                                    res.type === 'video' ? 'bg-red-100 text-red-700' :
                                    res.type === 'documentation' ? 'bg-blue-100 text-blue-700' :
                                    res.type === 'course' ? 'bg-purple-100 text-purple-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>
                                    {res.type}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    {res.url && res.url.startsWith('http')
                                      ? <a href={res.url} target="_blank" rel="noreferrer"
                                          className="text-xs text-primary-600 hover:underline font-medium">
                                          {res.title}
                                        </a>
                                      : <p className="text-xs text-gray-700 font-medium">{res.title}</p>}
                                    {res.duration && <p className="text-[10px] text-gray-400 mt-0.5">{res.duration}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Experience & Education */}
              {tab === 'experience' && (
                <div className="card p-5 space-y-4">
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl space-y-2">
                    <p className="text-xs font-semibold text-blue-900">Parsed job requirements</p>
                    <p className="text-xs text-blue-800">
                      Experience: {r.jobProfile?.experienceRequired || 'Not specified'} · Education: {r.jobProfile?.educationRequired || 'Not specified'}
                    </p>
                    {(r.jobProfile?.responsibilities || []).length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">Responsibilities</p>
                        <ul className="list-disc pl-4 text-xs text-blue-800">
                          {r.jobProfile.responsibilities.map((item, index) => <li key={index}>{item}</li>)}
                        </ul>
                      </div>
                    )}
                    {(r.jobProfile?.qualifications || []).length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">Qualifications</p>
                        <ul className="list-disc pl-4 text-xs text-blue-800">
                          {r.jobProfile.qualifications.map((item, index) => <li key={index}>{item}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Experience */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Experience Match</p>
                      <span className={`text-sm font-bold ${scoreColor(r.experienceMatch?.score || 0)}`}>
                        {r.experienceMatch?.score || 0}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full mb-3">
                      <div className={`h-full rounded-full ${barColor(r.experienceMatch?.score || 0)}`}
                        style={{ width: `${r.experienceMatch?.score || 0}%` }} />
                    </div>
                    {r.experienceMatch?.evidence && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 font-medium mb-1">Found in resume:</p>
                        <p className="text-xs text-gray-700 italic">"{r.experienceMatch.evidence}"</p>
                      </div>
                    )}
                    {(r.experienceMatch?.gaps || []).length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-medium text-gray-600">Gaps:</p>
                        {r.experienceMatch.gaps.map((g, i) => (
                          <p key={i} className="text-xs text-amber-700 flex items-center gap-1">
                            <AlertTriangle size={10} /> {g}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Education */}
                  <div className="pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Education Match</p>
                      <span className={`text-sm font-bold ${scoreColor(r.educationMatch?.score || 0)}`}>
                        {r.educationMatch?.score || 0}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full mb-3">
                      <div className={`h-full rounded-full ${barColor(r.educationMatch?.score || 0)}`}
                        style={{ width: `${r.educationMatch?.score || 0}%` }} />
                    </div>
                    {r.educationMatch?.evidence && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 font-medium mb-1">Found in resume:</p>
                        <p className="text-xs text-gray-700 italic">"{r.educationMatch.evidence}"</p>
                      </div>
                    )}
                  </div>

                  {(r.resumeProfile?.projects || []).length > 0 && (
                    <div className="pt-4 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Verified resume projects</p>
                      <ul className="space-y-2">
                        {r.resumeProfile.projects.map((project, index) => (
                          <li key={index} className="p-3 bg-gray-50 rounded-lg text-xs text-gray-700 italic">"{project}"</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Interview Practice Modal */}
      {showInterview && r?.interviewQuestions?.length > 0 && (
        <InterviewPractice
          questions={r.interviewQuestions}
          jobTitle={r.jobTitle}
          reportId={r._id}
          onEvaluationSaved={(interviewEvaluations) => setActiveReport((current) => (
            current?._id === r._id ? { ...current, interviewEvaluations } : current
          ))}
          onClose={() => setShowInterview(false)}
        />
      )}
    </div>
  );
}
