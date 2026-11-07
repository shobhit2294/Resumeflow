import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Building2, Sparkles, BookOpen, Users, HelpCircle,
  DollarSign, AlertOctagon, CheckCircle2, ChevronRight,
  Maximize2, Minimize2, Copy, Check, Shield, Flame
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../utils/api';

export default function CompanyIntelPage() {
  const [searchParams] = useSearchParams();
  const [company, setCompany] = useState(searchParams.get('company') || '');
  const [jobTitle, setJobTitle] = useState(searchParams.get('role') || searchParams.get('title') || '');
  const [jobDescription, setJobDescription] = useState('');
  const [activeTab, setActiveTab] = useState('dossier'); // 'dossier' | 'cheatsheet'
  const [loading, setLoading] = useState(false);
  const [dossier, setDossier] = useState(null);
  const [cheatSheet, setCheatSheet] = useState(null);
  const [meetingMode, setMeetingMode] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  // Fetch user saved jobs for quick dropdown selection
  const { data: jobsData } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => api.get('/jobs').then((r) => r.data.jobs || []),
  });

  useEffect(() => {
    const qCompany = searchParams.get('company');
    const qRole = searchParams.get('role') || searchParams.get('title');
    if (qCompany) setCompany(qCompany);
    if (qRole) setJobTitle(qRole);
  }, [searchParams]);

  const handleSelectJob = (jobId) => {
    const selected = (jobsData || []).find((j) => j._id === jobId);
    if (selected) {
      setCompany(selected.company || '');
      setJobTitle(selected.role || selected.title || '');
      setJobDescription(selected.jobDescription || selected.description || (selected.requirements || []).join('\n'));
    }
  };

  const handleGenerate = async (e) => {
    if (e) e.preventDefault();
    if (!company.trim() || !jobTitle.trim()) {
      toast.error('Please enter both company name and job title');
      return;
    }

    setLoading(true);
    try {
      const [dossierRes, cheatSheetRes] = await Promise.all([
        api.post('/intel/company-dossier', { company, jobTitle, jobDescription }),
        api.post('/intel/cheat-sheet', { company, jobTitle, jobDescription }),
      ]);
      setDossier(dossierRes.data);
      setCheatSheet(cheatSheetRes.data);
      toast.success(`Generated Intel for ${company}!`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate company dossier');
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

  return (
    <div className={`p-6 max-w-7xl mx-auto space-y-6 ${meetingMode ? 'fixed inset-0 z-50 bg-gray-900 text-white overflow-y-auto p-8' : ''}`}>
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5 border-gray-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary-600 text-white flex items-center justify-center shadow-sm">
              <Building2 size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                Company Intel & Interview Teleprompter
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  Exclusive
                </span>
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Loop breakdown, culture signals, killer reverse-questions, and live meeting battlecard.
              </p>
            </div>
          </div>
        </div>

        {cheatSheet && (
          <button
            onClick={() => setMeetingMode(!meetingMode)}
            className={`btn flex items-center gap-1.5 text-xs font-semibold !py-2 !px-3.5 shadow-sm transition-all ${
              meetingMode ? 'bg-amber-400 text-gray-950 hover:bg-amber-300' : 'btn-primary'
            }`}
          >
            {meetingMode ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            {meetingMode ? 'Exit Meeting Mode' : 'Open Interview Teleprompter Mode'}
          </button>
        )}
      </div>

      {/* Input / Selector Form (hidden in Meeting Mode) */}
      {!meetingMode && (
        <div className="card p-5 bg-white border border-gray-200 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
              1. Choose from Tracked Pipeline or Enter Company
            </span>
            {(jobsData || []).length > 0 && (
              <select
                onChange={(e) => handleSelectJob(e.target.value)}
                className="input !py-1.5 text-xs max-w-xs"
                defaultValue=""
              >
                <option value="" disabled>-- Load from your job pipeline --</option>
                {jobsData.map((j) => (
                  <option key={j._id} value={j._id}>
                    {j.company} - {j.role || j.title} ({j.stage})
                  </option>
                ))}
              </select>
            )}
          </div>

          <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Company Name</label>
              <input
                type="text"
                placeholder="e.g. Google, Stripe, Datadog"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Target Role Title</label>
              <input
                type="text"
                placeholder="e.g. Senior Backend Engineer"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="input"
                required
              />
            </div>
            <div className="flex items-end">
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
                    Generate Intel Dossier
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Content Area */}
      {dossier && cheatSheet ? (
        <div className="space-y-6">
          {/* Tabs */}
          {!meetingMode && (
            <div className="flex border-b border-gray-200 gap-4">
              <button
                onClick={() => setActiveTab('dossier')}
                className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-all ${
                  activeTab === 'dossier'
                    ? 'border-b-2 border-primary-600 text-primary-700'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Building2 size={16} />
                Company Loop Dossier
              </button>
              <button
                onClick={() => setActiveTab('cheatsheet')}
                className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-all ${
                  activeTab === 'cheatsheet'
                    ? 'border-b-2 border-primary-600 text-primary-700'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Flame size={16} className="text-amber-500" />
                Day-of Interview Battlecard
              </button>
            </div>
          )}

          {/* TAB 1: DOSSIER */}
          {activeTab === 'dossier' && !meetingMode && (
            <div className="space-y-6">
              {/* Culture & Tech Focus */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="card p-5 md:col-span-2 border border-gray-200 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Shield size={16} className="text-primary-600" />
                    Engineering Culture & Ethos
                  </h3>
                  <p className="text-xs text-gray-700 leading-relaxed">
                    {dossier.companyProfile?.engineeringCulture}
                  </p>
                  <div className="pt-2 border-t border-gray-100">
                    <span className="text-xs font-semibold text-gray-800">What Decides An Offer: </span>
                    <span className="text-xs text-emerald-800 font-medium">
                      {dossier.companyProfile?.hiringBar}
                    </span>
                  </div>
                </div>

                <div className="card p-5 border border-gray-200 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Sparkles size={16} className="text-amber-500" />
                    Core Tech Stack Priorities
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {dossier.companyProfile?.techStackFocus?.map((tech, idx) => (
                      <span key={idx} className="px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                        {tech}
                      </span>
                    ))}
                  </div>
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-900">
                    <strong>Compensation Context:</strong> {dossier.salaryContext?.estimatedMarketRange}
                  </div>
                </div>
              </div>

              {/* Expected Loop Stages */}
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                  <BookOpen size={16} className="text-primary-600" />
                  Expected Interview Loop Architecture
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {dossier.interviewLoop?.map((round) => (
                    <div key={round.roundNumber} className="card p-4 border border-gray-200/90 shadow-sm space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-primary-100 text-primary-800">
                          Round {round.roundNumber} · {round.duration}
                        </span>
                        <span className="text-xs font-semibold text-gray-800">{round.roundName}</span>
                      </div>
                      <p className="text-xs text-gray-600">
                        <strong>Focus:</strong> {round.primaryFocus}
                      </p>
                      <div className="text-xs space-y-1">
                        <span className="font-medium text-gray-700">Typical Questions:</span>
                        <ul className="list-disc pl-4 text-gray-600 space-y-0.5">
                          {round.typicalQuestions?.map((q, i) => (
                            <li key={i}>{q}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-2 rounded bg-rose-50 border border-rose-100 text-[11px] text-rose-800 flex items-start gap-1.5">
                        <AlertOctagon size={14} className="flex-shrink-0 text-rose-600 mt-0.5" />
                        <span><strong>Trap to Avoid:</strong> {round.trapsToAvoid}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Culture Principles & Killer Reverse Questions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Culture */}
                <div className="card p-5 border border-gray-200 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Users size={16} className="text-blue-600" />
                    How to Demonstrate Cultural Fit
                  </h3>
                  <div className="space-y-2.5">
                    {dossier.cultureSignals?.map((item, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 border border-gray-200/80 rounded-xl text-xs space-y-1">
                        <span className="font-bold text-gray-900 block">{item.principle}</span>
                        <p className="text-gray-600">{item.whatItMeans}</p>
                        <p className="text-primary-800 font-medium">👉 Say this: {item.howToDemonstrate}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Killer Reverse Questions */}
                <div className="card p-5 border border-gray-200 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <HelpCircle size={16} className="text-amber-500" />
                    Killer Reverse-Questions to Ask Interviewer
                  </h3>
                  <div className="space-y-2.5">
                    {dossier.killerReverseQuestions?.map((item, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 border border-gray-200/80 rounded-xl text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-900">{item.question}</span>
                          <button
                            onClick={() => handleCopy(item.question, `rev-${idx}`)}
                            className="text-gray-400 hover:text-gray-700 ml-2"
                          >
                            {copiedKey === `rev-${idx}` ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                          </button>
                        </div>
                        <p className="text-gray-500 text-[11px]">
                          <strong>Target:</strong> {item.targetInterviewer} · <span className="text-emerald-700 font-medium">{item.whyItImpresses}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BATTLECARD & TELEPROMPTER */}
          {(activeTab === 'cheatsheet' || meetingMode) && (
            <div className={`space-y-6 ${meetingMode ? 'max-w-4xl mx-auto' : ''}`}>
              {/* 60s Elevator Pitch */}
              <div className={`card p-5 border shadow-sm space-y-2 ${meetingMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                    <Flame size={15} />
                    60-Second Opening Hook ("Tell me about yourself")
                  </h3>
                  <button
                    onClick={() => handleCopy(cheatSheet.elevatorPitch, 'pitch')}
                    className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1"
                  >
                    {copiedKey === 'pitch' ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                    {copiedKey === 'pitch' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className={`text-sm leading-relaxed ${meetingMode ? 'text-gray-100 font-medium text-base' : 'text-gray-800'}`}>
                  "{cheatSheet.elevatorPitch}"
                </p>
              </div>

              {/* Power Metrics to Drop */}
              <div className={`card p-4 border ${meetingMode ? 'bg-gray-800 border-gray-700' : 'bg-emerald-50/50 border-emerald-200'}`}>
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-2">
                  ⚡ Bulletproof Metrics to Drop in Answers
                </h4>
                <div className="flex flex-wrap gap-2">
                  {cheatSheet.powerMetricsToDrop?.map((metric, i) => (
                    <span key={i} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${meetingMode ? 'bg-gray-900 border-gray-600 text-emerald-400' : 'bg-white border-emerald-300 text-emerald-900'}`}>
                      {metric}
                    </span>
                  ))}
                </div>
              </div>

              {/* STAR Stories */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary-500">
                  Top 3 STAR Stories Mapped to this Role
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {cheatSheet.topStarStories?.map((story, i) => (
                    <div key={i} className={`card p-4 border shadow-sm space-y-2 ${meetingMode ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200'}`}>
                      <span className="text-xs font-bold text-amber-500 block">
                        Story {i + 1}: {story.title}
                      </span>
                      <p className="text-[11px] text-gray-400">
                        Proves: <strong className="text-gray-300">{story.mapsToRequirement}</strong>
                      </p>
                      <div className="text-xs space-y-1.5 pt-1 border-t border-gray-700/50">
                        <p><strong className="text-blue-400">Situation:</strong> {story.situation}</p>
                        <p><strong className="text-purple-400">Action:</strong> {story.action}</p>
                        <p><strong className="text-green-400">Result:</strong> {story.result}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tech Talking points */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cheatSheet.technicalTalkingPoints?.map((item, idx) => (
                  <div key={idx} className={`p-4 rounded-xl border ${meetingMode ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-gray-50 border-gray-200'}`}>
                    <h4 className="text-xs font-bold text-primary-400 mb-1">{item.topic}</h4>
                    <p className="text-xs text-gray-300 mb-1">{item.talkingPoint}</p>
                    <span className="text-[11px] text-rose-400 block font-medium">⚠️ Avoid: {item.caution}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

