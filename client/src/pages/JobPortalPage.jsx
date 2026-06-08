import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Search, MapPin, Clock, BookmarkPlus, Check, ExternalLink,
  Star, Code, MessageSquare, FileText, ChevronRight, X,
  Play, Send, RefreshCw, Award, AlertCircle, CheckCircle2,
  TrendingUp, Zap, Filter, Globe, Video, Mic
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../utils/api';
import { formatSalary, getCompanyColor } from '../utils/constants';

// ── helpers ──────────────────────────────────────────────────
function timeAgo(d) {
  if (!d) return '';
  const days = Math.floor((Date.now() - new Date(d)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7)  return `${days}d ago`;
  if (days < 30) return `${Math.floor(days/7)}w ago`;
  return `${Math.floor(days/30)}mo ago`;
}

const DIFF_COLOR = { easy: 'text-green-600 bg-green-50', medium: 'text-amber-600 bg-amber-50', hard: 'text-red-600 bg-red-50' };
const VERDICT_COLOR = { 'Strong match': 'text-green-700 bg-green-100', 'Good match': 'text-primary-700 bg-primary-50', 'Partial match': 'text-amber-700 bg-amber-50', 'Weak match': 'text-red-600 bg-red-50' };

// ── TTS ───────────────────────────────────────────────────────
const synth = window.speechSynthesis;
function speak(text, cb) {
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/\[Score:.*?\]/gi,'').replace(/INTERVIEW_COMPLETE/g,'').trim());
  u.rate = 0.95;
  const v = synth.getVoices().find(v => v.lang.startsWith('en'));
  if (v) u.voice = v;
  if (cb) u.onend = cb;
  synth.speak(u);
}

// ════════════════════════════════════════════════════════════
export default function JobPortalPage() {
  const [q, setQ]               = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [remote, setRemote]     = useState(false);
  const [page, setPage]         = useState(1);
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState('details'); // details | apply | coding | interview
  const [showFilters, setShowFilters] = useState(false);
  const qc = useQueryClient();

  // ── Fetch portal jobs ──────────────────────────────────────
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['portal-jobs', q, remote, page],
    queryFn: () => api.get('/portal/jobs', { params: { q: q||undefined, remote: remote||undefined, page } }).then(r => r.data),
    keepPreviousData: true,
  });

  // ── My applications ────────────────────────────────────────
  const { data: myApps } = useQuery({
    queryKey: ['my-applications'],
    queryFn: () => api.get('/portal/applications').then(r => r.data),
  });

  const appliedJobIds = new Set((myApps?.applications || []).map(a => String(a.jobId)));

  const jobs = data?.jobs || [];

  // ── Apply mutation ─────────────────────────────────────────
  const applyMutation = useMutation({
    mutationFn: (jobId) => api.post(`/portal/jobs/${jobId}/apply`),
    onSuccess: (_, jobId) => {
      qc.invalidateQueries(['my-applications']);
      toast.success('Application submitted!');
      setActiveTab('apply');
    },
    onError: (err) => {
      if (err.response?.status === 409) { toast('Already applied!'); setActiveTab('apply'); }
      else toast.error(err.response?.data?.error || 'Failed');
    },
  });

  const handleSearch = (e) => { e?.preventDefault(); setQ(searchInput); setPage(1); };

  return (
    <div className="flex flex-col h-full">

      {/* ── Hero search bar ── */}
      <div className="bg-gradient-to-r from-primary-800 to-primary-600 px-6 py-6">
        <h1 className="text-white font-semibold text-lg mb-1">Job Portal</h1>
        <p className="text-primary-100 text-xs mb-4">Real jobs from top remote companies — apply, practice, and get hired</p>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="w-full pl-9 pr-3 py-2 rounded-lg text-sm border-0 outline-none focus:ring-2 focus:ring-white/30"
              placeholder="Software engineer, React, Python..."
              value={searchInput} onChange={e => setSearchInput(e.target.value)} />
          </div>
          <button type="submit" className="bg-white text-primary-700 font-medium text-sm px-4 py-2 rounded-lg hover:bg-primary-50 transition-all flex items-center gap-1.5">
            {isFetching ? <span className="w-4 h-4 border-2 border-primary-300 border-t-primary-700 rounded-full animate-spin"/> : <><Search size={14}/> Search</>}
          </button>
          <button type="button" onClick={() => setShowFilters(f=>!f)} className={`px-3 py-2 rounded-lg text-sm transition-all ${showFilters ? 'bg-white/20 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
            <Filter size={14}/>
          </button>
        </form>
        {showFilters && (
          <div className="flex gap-3 mt-2">
            <label className="flex items-center gap-1.5 text-xs text-white cursor-pointer">
              <input type="checkbox" checked={remote} onChange={e => {setRemote(e.target.checked);setPage(1);}} className="rounded"/>
              Remote only
            </label>
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Job list */}
        <div className={`flex flex-col border-r border-gray-100 overflow-y-auto ${selected ? 'w-80 flex-shrink-0' : 'flex-1'}`}>
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              <span className="font-semibold text-gray-900">{data?.total || 0}</span> jobs
            </p>
            <button onClick={() => api.get('/portal/refresh').then(() => { qc.invalidateQueries(['portal-jobs']); toast.success('Jobs refreshed!'); })}
              className="text-xs text-gray-400 hover:text-primary-600 flex items-center gap-1">
              <RefreshCw size={10}/> Refresh
            </button>
          </div>

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin"/>
              <p className="text-sm text-gray-400">Loading jobs...</p>
            </div>
          )}

          <div className="divide-y divide-gray-50">
            {jobs.map(job => {
              const isApplied  = appliedJobIds.has(String(job._id));
              const colorClass = getCompanyColor(job.company);
              const isSelected = selected?._id === job._id;

              return (
                <div key={job._id} onClick={() => { setSelected(job); setActiveTab('details'); }}
                  className={`p-4 cursor-pointer transition-all hover:bg-gray-50 ${isSelected ? 'bg-primary-50 border-l-2 border-primary-400' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${colorClass}`}>
                      {job.company?.slice(0,2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{job.title}</p>
                        {isApplied && <span className="text-[10px] bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium">Applied</span>}
                      </div>
                      <p className="text-xs text-gray-500">{job.company}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {job.remote && <span className="text-[10px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded-full">Remote</span>}
                        {job.location && <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><MapPin size={8}/>{job.location.slice(0,20)}</span>}
                        <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><Clock size={8}/>{timeAgo(job.postedAt)}</span>
                      </div>
                      <div className="flex gap-1 mt-1.5">
                        {job.hasMockInterview && <span className="text-[10px] bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Mic size={8}/> Interview</span>}
                        {job.hasCodingRound  && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Code size={8}/> Coding</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {(data?.totalPages || 0) > 1 && (
            <div className="flex justify-between items-center px-4 py-3 border-t bg-white sticky bottom-0">
              <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1} className="btn-secondary h-7 px-3 text-xs disabled:opacity-40">← Prev</button>
              <span className="text-xs text-gray-500">{page} / {data?.totalPages}</span>
              <button onClick={() => setPage(p=>Math.min(data?.totalPages||1,p+1))} disabled={page===data?.totalPages} className="btn-secondary h-7 px-3 text-xs disabled:opacity-40">Next →</button>
            </div>
          )}
        </div>

        {/* ── Detail panel ── */}
        {selected && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-100 bg-white sticky top-0 z-10">
              {[
                { key: 'details',   label: 'Job Details', icon: FileText },
                { key: 'apply',     label: 'Apply & Score', icon: Star },
                { key: 'interview', label: 'Mock Interview', icon: Mic },
                { key: 'coding',    label: 'Coding Round', icon: Code },
              ].map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-all ${activeTab === t.key ? 'border-primary-400 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  <t.icon size={13}/>{t.label}
                </button>
              ))}
              <button onClick={() => setSelected(null)} className="ml-auto px-3 text-gray-400 hover:text-gray-600">
                <X size={15}/>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {activeTab === 'details'   && <JobDetails   job={selected} isApplied={appliedJobIds.has(String(selected._id))} onApply={() => applyMutation.mutate(selected._id)} applyLoading={applyMutation.isPending} />}
              {activeTab === 'apply'     && <ApplyTab     job={selected} isApplied={appliedJobIds.has(String(selected._id))} onApply={() => applyMutation.mutate(selected._id)} />}
              {activeTab === 'interview' && <MockInterviewTab job={selected} />}
              {activeTab === 'coding'    && <CodingRoundTab  job={selected} />}
            </div>
          </div>
        )}

        {!selected && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-gray-50 text-center p-6">
            <div className="w-16 h-16 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-center">
              <Globe size={28} className="text-gray-300"/>
            </div>
            <p className="font-medium text-gray-600">Select a job to view details</p>
            <p className="text-sm text-gray-400 max-w-xs">Each job comes with resume scoring, mock interview, and coding round practice</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TAB: Job Details
// ════════════════════════════════════════════════════════════
function JobDetails({ job, isApplied, onApply, applyLoading }) {
  return (
    <div className="p-5 space-y-4 max-w-2xl">
      <div className="flex items-start gap-4">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-base font-bold ${getCompanyColor(job.company)}`}>
          {job.company?.slice(0,2).toUpperCase()}
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-gray-900 text-lg">{job.title}</h2>
          <p className="text-gray-500">{job.company}</p>
          <div className="flex flex-wrap gap-2 mt-2 text-xs">
            {job.location && <span className="flex items-center gap-1 text-gray-500"><MapPin size={11}/>{job.location}</span>}
            {job.remote   && <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">Remote</span>}
            {job.jobType  && <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{job.jobType}</span>}
            {(job.salaryMin||job.salaryMax) && <span className="bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">{formatSalary(job.salaryMin, job.salaryMax, job.currency)}</span>}
            <span className="bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full">{timeAgo(job.postedAt)}</span>
          </div>
        </div>
      </div>

      {job.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {job.tags.map(t => <span key={t} className="text-xs bg-primary-50 text-primary-700 border border-primary-100 px-2 py-0.5 rounded-full">{t}</span>)}
        </div>
      )}

      {/* Features */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: Star,    label: 'Resume scoring', sub: 'AI matches your CV', color: 'bg-amber-50 text-amber-600 border-amber-100' },
          { icon: Mic,     label: 'Mock interview',  sub: 'Tailored to this job', color: 'bg-violet-50 text-violet-600 border-violet-100' },
          { icon: Code,    label: 'Coding round',    sub: 'Job-specific problems', color: 'bg-blue-50 text-blue-600 border-blue-100' },
        ].map(f => (
          <div key={f.label} className={`p-3 rounded-xl border ${f.color} flex flex-col gap-1`}>
            <f.icon size={16}/>
            <p className="text-xs font-semibold">{f.label}</p>
            <p className="text-[10px] opacity-70">{f.sub}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Description</p>
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line bg-gray-50 rounded-xl p-4">
          {job.description || 'No description provided.'}
        </p>
      </div>

      <div className="flex gap-2 pt-2">
        <button onClick={onApply} disabled={isApplied || applyLoading}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${isApplied ? 'bg-primary-50 text-primary-700 cursor-default border border-primary-200' : 'bg-primary-400 hover:bg-primary-600 text-white'}`}>
          {applyLoading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : isApplied ? <><Check size={15}/> Applied</> : <><BookmarkPlus size={15}/> Apply now</>}
        </button>
        {job.url && <a href={job.url} target="_blank" rel="noreferrer" className="btn-secondary px-4 flex items-center gap-1.5 text-sm"><ExternalLink size={14}/> Original</a>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TAB: Apply + Resume Score
// ════════════════════════════════════════════════════════════
function ApplyTab({ job, isApplied, onApply }) {
  const [analysis, setAnalysis] = useState(null);
  const [scoring, setScoring]   = useState(false);

  const scoreResume = async () => {
    setScoring(true);
    try {
      const res = await api.post(`/portal/jobs/${job._id}/score-resume`);
      setAnalysis(res.data.analysis);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Scoring failed');
    } finally { setScoring(false); }
  };

  return (
    <div className="p-5 space-y-4 max-w-2xl">
      {!isApplied ? (
        <div className="card p-5 text-center space-y-3">
          <BookmarkPlus size={32} className="text-primary-400 mx-auto"/>
          <p className="font-semibold text-gray-900">Ready to apply?</p>
          <p className="text-sm text-gray-500">Apply to this position and unlock resume scoring, mock interview, and coding round.</p>
          <button onClick={onApply} className="btn-primary w-full justify-center">Apply now</button>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 bg-primary-50 border border-primary-100 rounded-xl">
          <CheckCircle2 size={16} className="text-primary-600"/>
          <p className="text-sm font-medium text-primary-800">Application submitted!</p>
        </div>
      )}

      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900">Resume match score</p>
            <p className="text-xs text-gray-400">AI analyzes your resume against this job</p>
          </div>
          <button onClick={scoreResume} disabled={scoring} className="btn-primary h-8 px-3 text-xs">
            {scoring ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <><Zap size={12}/> Score</>}
          </button>
        </div>

        {!analysis && !scoring && (
          <div className="py-6 text-center text-sm text-gray-400">
            Click "Score" to analyze your resume against this job
          </div>
        )}

        {scoring && (
          <div className="flex items-center justify-center gap-2 py-6">
            <div className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin"/>
            <p className="text-sm text-gray-500">Analyzing your resume...</p>
          </div>
        )}

        {analysis && (
          <div className="space-y-4 animate-fade-in">
            {/* Overall */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold ${analysis.overallMatch >= 70 ? 'bg-green-100 text-green-700' : analysis.overallMatch >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                {analysis.overallMatch}
              </div>
              <div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${VERDICT_COLOR[analysis.verdict] || 'bg-gray-100 text-gray-600'}`}>{analysis.verdict}</span>
                <p className="text-sm text-gray-600 mt-1">{analysis.summary}</p>
                {analysis.shouldApply !== undefined && (
                  <p className={`text-xs font-medium mt-1 ${analysis.shouldApply ? 'text-green-600' : 'text-amber-600'}`}>
                    {analysis.shouldApply ? '✓ Recommended to apply' : '⚠ Consider improving resume first'}
                  </p>
                )}
              </div>
            </div>

            {/* Skill match */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Skill match</p>
              <div className="space-y-2">
                {analysis.skillMatch?.map(s => (
                  <div key={s.skill} className="flex items-center gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.found ? 'bg-green-500' : 'bg-red-400'}`}/>
                    <span className="text-xs text-gray-700 w-28 truncate">{s.skill}</span>
                    {s.required && <span className="text-[10px] text-red-500">required</span>}
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full">
                      <div className={`h-full rounded-full ${s.found ? 'bg-green-500' : 'bg-red-300'}`} style={{ width: `${s.score}%` }}/>
                    </div>
                    <span className="text-[11px] text-gray-400 w-8 text-right">{s.score}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Missing */}
            {analysis.missingSkills?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Missing skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.missingSkills.map(s => <span key={s} className="text-xs bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded-full">{s}</span>)}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {analysis.suggestions?.length > 0 && (
              <div className="p-3 bg-primary-50 border border-primary-100 rounded-xl">
                <p className="text-xs font-semibold text-primary-800 mb-2">Quick improvements</p>
                {analysis.suggestions.map((s,i) => (
                  <p key={i} className="text-xs text-primary-700 flex gap-1.5 mb-1"><span>{i+1}.</span>{s}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TAB: Mock Interview
// ════════════════════════════════════════════════════════════
function MockInterviewTab({ job }) {
  const [session, setSession]   = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [sending, setSending]   = useState(false);
  const [done, setDone]         = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interviewType, setInterviewType] = useState('mixed');
  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);

  const startInterview = async () => {
    try {
      const res = await api.post(`/portal/jobs/${job._id}/start-mock-interview`, { type: interviewType });
      setSession(res.data.interview);
      setMessages(res.data.interview.messages || []);
      if (res.data.interview.messages?.[0]) {
        setAiSpeaking(true);
        speak(res.data.interview.messages[0].content, () => setAiSpeaking(false));
      }
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to start'); }
  };

  const sendMessage = async (textOverride) => {
    const text = (textOverride || input).trim();
    if (!text || sending || done) return;
    setInput(''); setTranscript('');
    synth.cancel(); setSending(true);
    setMessages(p => [...p, { role:'user', content: text, _id:'tmp'+Date.now() }]);
    try {
      const res = await api.post(`/interview/${session._id}/message`, { content: text });
      setMessages(p => [
        ...p.filter(m => !String(m._id).startsWith('tmp')),
        { role:'user', content: text },
        res.data.message,
      ]);
      if (res.data.interview.status === 'completed') setDone(true);
      setAiSpeaking(true);
      speak(res.data.message.content, () => {
        setAiSpeaking(false);
        if (!res.data.interview.status === 'completed') startListening();
      });
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); setMessages(p => p.filter(m => !String(m._id).startsWith('tmp'))); }
    finally { setSending(false); }
  };

  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const startListening = () => {
    if (!SpeechRec) return;
    const r = new SpeechRec();
    r.continuous = false; r.interimResults = true; r.lang = 'en-US';
    r.onstart = () => setListening(true);
    r.onend   = () => setListening(false);
    r.onresult = (e) => {
      let f='', i='';
      for (let x=e.resultIndex;x<e.results.length;x++) {
        if (e.results[x].isFinal) f+=e.results[x][0].transcript;
        else i+=e.results[x][0].transcript;
      }
      setTranscript(f||i);
      if (f) setInput(f);
    };
    r.onerror = () => setListening(false);
    recognitionRef.current = r;
    r.start();
  };
  const stopListening = () => { recognitionRef.current?.abort(); setListening(false); setTranscript(''); };

  if (!session) return (
    <div className="p-5 space-y-4 max-w-xl">
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center"><Mic size={18} className="text-violet-600"/></div>
          <div>
            <p className="font-semibold text-gray-900">Mock Interview</p>
            <p className="text-xs text-gray-400">AI interviews you specifically for {job.title} at {job.company}</p>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">Interview type</p>
          <div className="grid grid-cols-2 gap-2">
            {[['mixed','Mixed (Recommended)'],['behavioral','Behavioral'],['technical','Technical'],['system-design','System Design']].map(([v,l]) => (
              <button key={v} type="button" onClick={() => setInterviewType(v)}
                className={`p-2.5 rounded-lg border text-xs font-medium transition-all text-left ${interviewType===v ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800 space-y-1">
          <p className="font-medium">What to expect</p>
          <p>• 8 questions tailored to {job.title}</p>
          <p>• Each answer scored 1-10 in real time</p>
          <p>• Speak or type your answers</p>
          <p>• Final report with strengths and improvements</p>
        </div>
        <button onClick={startInterview} className="w-full py-3 bg-violet-500 hover:bg-violet-600 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all">
          <Play size={15}/> Start interview
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 bg-violet-50 border-b border-violet-100 flex items-center justify-between text-xs">
        <span className="text-violet-700 font-medium">{job.title} @ {job.company}</span>
        {done && <span className="text-green-600 flex items-center gap-1"><CheckCircle2 size={12}/> Complete</span>}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m,i) => {
          const isAI = m.role==='assistant';
          const score = m.content?.match(/\[Score:\s*(\d+(?:\.\d+)?)/i);
          const display = m.content?.replace(/\[Score:.*?\]/gi,'').replace(/INTERVIEW_COMPLETE/g,'').trim();
          return (
            <div key={m._id||i} className={`flex gap-2.5 ${isAI?'':'flex-row-reverse'} animate-fade-in`}>
              {isAI && <div className="w-7 h-7 bg-violet-100 rounded-full flex items-center justify-center text-[10px] font-bold text-violet-700 flex-shrink-0">AI</div>}
              <div className={`max-w-[80%] ${!isAI?'items-end flex flex-col':''}`}>
                <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${isAI?'bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm':'bg-violet-500 text-white rounded-tr-sm'}`}>{display}</div>
                {score && <div className="flex items-center gap-1 mt-1 ml-1"><Star size={10} className="text-amber-400 fill-amber-400"/><span className="text-[10px] text-gray-400">{score[1]}/10</span></div>}
              </div>
            </div>
          );
        })}
        {sending && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 bg-violet-100 rounded-full flex items-center justify-center text-[10px] font-bold text-violet-700">AI</div>
            <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm flex gap-1">
              {[0,150,300].map(d=><div key={d} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:d+'ms'}}/>)}
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>
      {!done && (
        <div className="px-4 py-3 bg-white border-t border-gray-100">
          {transcript && <div className="mb-2 px-3 py-2 bg-violet-50 rounded-lg text-sm text-violet-800">{transcript}</div>}
          <div className="flex gap-2 items-end">
            <button onClick={listening ? stopListening : startListening} disabled={aiSpeaking||sending}
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${listening?'bg-red-500 text-white animate-pulse':aiSpeaking||sending?'bg-gray-100 text-gray-300 cursor-not-allowed':'bg-violet-100 text-violet-700 hover:bg-violet-200'}`}>
              {listening?<MicOff size={15}/>:<Mic size={15}/>}
            </button>
            <textarea className="input flex-1 resize-none min-h-[40px] max-h-28 text-sm" rows={1}
              placeholder={aiSpeaking?'AI is speaking...':listening?'Listening...':'Type or speak your answer...'}
              value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}}}
              disabled={aiSpeaking}/>
            <button onClick={()=>sendMessage()} disabled={!input.trim()||sending||aiSpeaking} className="btn-primary h-10 px-3">
              <Send size={14}/>
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">STAR method: Situation → Task → Action → Result</p>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TAB: Coding Round
// ════════════════════════════════════════════════════════════
function CodingRoundTab({ job }) {
  const [questions, setQuestions] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [activeQ, setActiveQ]     = useState(0);
  const [code, setCode]           = useState('// Write your solution here\n\n');
  const [language, setLanguage]   = useState('javascript');
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [timeLeft, setTimeLeft]   = useState(null);
  const timerRef = useRef(null);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const res = await api.post(`/portal/jobs/${job._id}/coding-round`, { action: 'get-questions' });
      setQuestions(res.data.questions);
      setActiveQ(0);
      const q = res.data.questions[0];
      if (q?.timeLimit) {
        setTimeLeft(q.timeLimit * 60);
        startTimer(q.timeLimit * 60);
      }
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to load'); }
    finally { setLoading(false); }
  };

  const startTimer = (secs) => {
    clearInterval(timerRef.current);
    setTimeLeft(secs);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); toast.error('Time up!'); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  const evaluate = async () => {
    if (!code.trim() || code.trim() === '// Write your solution here') { toast.error('Write your solution first'); return; }
    clearInterval(timerRef.current);
    setEvaluating(true);
    try {
      const q = questions[activeQ];
      const res = await api.post(`/portal/jobs/${job._id}/coding-round`, { action: 'evaluate', language, code, questionId: q.id });
      setEvaluation(res.data.evaluation);
    } catch (err) { toast.error(err.response?.data?.error || 'Evaluation failed'); }
    finally { setEvaluating(false); }
  };

  const switchQuestion = (idx) => {
    setActiveQ(idx); setEvaluation(null);
    setCode('// Write your solution here\n\n');
    clearInterval(timerRef.current);
    const q = questions[idx];
    if (q?.timeLimit) startTimer(q.timeLimit * 60);
  };

  const formatTime = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  if (!questions) return (
    <div className="p-5 space-y-4 max-w-xl">
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center"><Code size={18} className="text-blue-600"/></div>
          <div>
            <p className="font-semibold text-gray-900">Coding Round</p>
            <p className="text-xs text-gray-400">3 problems tailored to {job.title} requirements</p>
          </div>
        </div>
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800 space-y-1">
          <p className="font-medium">What to expect</p>
          <p>• 3 coding problems matching the job's tech stack</p>
          <p>• Time limit per question</p>
          <p>• AI evaluates correctness, efficiency, code quality</p>
          <p>• Complexity analysis and test results</p>
        </div>
        <div className="flex gap-2">
          <select className="input text-sm flex-1" value={language} onChange={e => setLanguage(e.target.value)}>
            {['javascript','python','java','cpp','typescript','go'].map(l => <option key={l} value={l} className="capitalize">{l}</option>)}
          </select>
          <button onClick={loadQuestions} disabled={loading} className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl flex items-center justify-center gap-2 text-sm transition-all">
            {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <><Play size={14}/> Start</>}
          </button>
        </div>
      </div>
    </div>
  );

  const q = questions[activeQ];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: problem */}
      <div className="w-96 flex-shrink-0 overflow-y-auto border-r border-gray-100 p-4 space-y-3">
        {/* Question tabs */}
        <div className="flex gap-1.5">
          {questions.map((qq,i) => (
            <button key={i} onClick={() => switchQuestion(i)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeQ===i?'bg-blue-500 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              Q{i+1}
              {qq.difficulty && <span className={`ml-1 text-[9px] ${activeQ===i?'text-blue-100':'opacity-50'}`}>({qq.difficulty})</span>}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1 text-xs">
            {timeLeft !== null && (
              <span className={`font-mono font-semibold px-2 py-1 rounded-lg ${timeLeft < 300 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                {formatTime(timeLeft)}
              </span>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-gray-900 text-sm">{q.title}</h3>
            {q.difficulty && <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${DIFF_COLOR[q.difficulty]}`}>{q.difficulty}</span>}
          </div>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{q.description}</p>
        </div>

        {q.examples?.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Examples</p>
            {q.examples.map((ex,i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-3 text-xs space-y-1">
                <p><span className="font-medium text-gray-600">Input:</span> <code className="bg-white px-1.5 py-0.5 rounded border border-gray-200">{ex.input}</code></p>
                <p><span className="font-medium text-gray-600">Output:</span> <code className="bg-white px-1.5 py-0.5 rounded border border-gray-200">{ex.output}</code></p>
                {ex.explanation && <p className="text-gray-500">{ex.explanation}</p>}
              </div>
            ))}
          </div>
        )}

        {q.constraints?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Constraints</p>
            {q.constraints.map((c,i) => <p key={i} className="text-xs text-gray-600 flex gap-1.5"><span className="text-gray-400">•</span>{c}</p>)}
          </div>
        )}

        {q.hints?.length > 0 && (
          <details className="group">
            <summary className="text-xs font-medium text-amber-600 cursor-pointer hover:text-amber-700">💡 Hint</summary>
            <div className="mt-1.5 p-2.5 bg-amber-50 rounded-lg text-xs text-amber-800">{q.hints[0]}</div>
          </details>
        )}

        {/* Evaluation result */}
        {evaluation && (
          <div className="space-y-3 animate-fade-in">
            <div className={`p-3 rounded-xl border ${evaluation.verdict==='Pass'?'bg-green-50 border-green-100':evaluation.verdict==='Partial'?'bg-amber-50 border-amber-100':'bg-red-50 border-red-100'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`font-semibold text-sm ${evaluation.verdict==='Pass'?'text-green-700':evaluation.verdict==='Partial'?'text-amber-700':'text-red-700'}`}>{evaluation.verdict}</span>
                <span className={`text-xl font-bold ${evaluation.verdict==='Pass'?'text-green-600':evaluation.verdict==='Partial'?'text-amber-600':'text-red-600'}`}>{evaluation.score}/100</span>
              </div>
              <p className="text-xs text-gray-600">{evaluation.feedback}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[['Correctness',evaluation.correctness],['Efficiency',evaluation.efficiency],['Code Quality',evaluation.codeQuality]].map(([l,v]) => (
                <div key={l} className="bg-gray-50 rounded-lg p-2">
                  <p className="text-gray-400 mb-0.5">{l}</p>
                  <div className="h-1.5 bg-gray-200 rounded-full"><div className={`h-full rounded-full ${v>=70?'bg-green-500':v>=50?'bg-amber-400':'bg-red-400'}`} style={{width:`${v}%`}}/></div>
                  <p className="font-semibold text-gray-700 mt-0.5">{v}%</p>
                </div>
              ))}
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-gray-400 mb-0.5">Complexity</p>
                <p className="font-mono text-xs text-gray-700">Time: {evaluation.timeComplexity}</p>
                <p className="font-mono text-xs text-gray-500">Space: {evaluation.spaceComplexity}</p>
              </div>
            </div>
            {evaluation.testResults?.length > 0 && (
              <div className="space-y-1">
                {evaluation.testResults.map((t,i) => (
                  <div key={i} className={`flex items-center gap-2 p-2 rounded-lg text-xs ${t.passed?'bg-green-50':'bg-red-50'}`}>
                    {t.passed?<CheckCircle2 size={12} className="text-green-500"/>:<XCircle size={12} className="text-red-400"/>}
                    <span className={t.passed?'text-green-700':'text-red-700'}>{t.test}</span>
                    {t.reason && <span className="text-gray-500 ml-auto truncate">{t.reason}</span>}
                  </div>
                ))}
              </div>
            )}
            {evaluation.improvements?.length > 0 && (
              <div className="p-2.5 bg-primary-50 rounded-lg">
                {evaluation.improvements.map((imp,i) => <p key={i} className="text-xs text-primary-700">→ {imp}</p>)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: code editor */}
      <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
          <select className="bg-gray-700 text-gray-200 text-xs px-2 py-1 rounded border-0 outline-none" value={language} onChange={e => setLanguage(e.target.value)}>
            {['javascript','python','java','cpp','typescript','go'].map(l => <option key={l} value={l} className="capitalize">{l}</option>)}
          </select>
          <button onClick={evaluate} disabled={evaluating}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-lg transition-all disabled:opacity-50">
            {evaluating ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <><Play size={12}/> Run & Evaluate</>}
          </button>
        </div>
        <textarea
          className="flex-1 p-4 bg-gray-900 text-gray-100 font-mono text-sm resize-none outline-none leading-relaxed"
          value={code}
          onChange={e => setCode(e.target.value)}
          spellCheck={false}
          placeholder="// Write your solution here..."
          style={{ tabSize: 2 }}
          onKeyDown={e => {
            if (e.key === 'Tab') { e.preventDefault(); const s=e.target.selectionStart; setCode(c => c.substring(0,s)+'  '+c.substring(s)); setTimeout(() => { e.target.selectionStart = e.target.selectionEnd = s+2; }, 0); }
          }}
        />
        <div className="px-4 py-1.5 bg-gray-800 text-[10px] text-gray-500 flex gap-4">
          <span>Tab = 2 spaces indent</span>
          <span>Click "Run & Evaluate" when ready</span>
        </div>
      </div>
    </div>
  );
}

// missing import fix
function MicOff({ size }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>; }
function XCircle({ size, className }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>; }