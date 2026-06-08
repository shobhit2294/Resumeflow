import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Search, ChevronRight, MapPin, Calendar, Clock,
  CheckCircle2, XCircle, AlertCircle, Briefcase,
  DollarSign, MessageSquare, ArrowRight, Plus,
  FileText, Phone, Star, TrendingUp, Filter
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../utils/api';
import { formatSalary, daysAgo, getCompanyColor, STAGE_COLORS } from '../utils/constants';
import StageBadge from '../components/jobs/StageBadge';

// ── Stage pipeline config ─────────────────────────────────────
const PIPELINE = [
  { key: 'Applied',   label: 'Applied',    icon: FileText,     color: 'blue' },
  { key: 'Screening', label: 'Screening',  icon: Phone,        color: 'amber' },
  { key: 'Interview', label: 'Interview',  icon: MessageSquare,color: 'teal' },
  { key: 'Offer',     label: 'Offer',      icon: Star,         color: 'green' },
];
const TERMINAL = ['Rejected', 'Withdrawn'];

const STAGE_ICON_BG = {
  Applied:   'bg-blue-100 text-blue-600',
  Screening: 'bg-amber-100 text-amber-600',
  Interview: 'bg-teal-100 text-teal-700',
  Offer:     'bg-green-100 text-green-700',
  Rejected:  'bg-red-100 text-red-500',
  Withdrawn: 'bg-gray-100 text-gray-500',
  note:          'bg-gray-100 text-gray-500',
  custom:        'bg-gray-100 text-gray-500',
};

const TIMELINE_TYPE_ICON = {
  stage_change: ArrowRight,
  note:         FileText,
  interview:    MessageSquare,
  offer:        Star,
  rejection:    XCircle,
  custom:       AlertCircle,
};

// ── Stage update form fields per stage ────────────────────────
const STAGE_FIELDS = {
  Interview: [
    { key: 'interviewDate', label: 'Interview date', type: 'datetime-local' },
    { key: 'interviewType', label: 'Interview type', type: 'select',
      options: ['Phone', 'Video', 'On-site', 'Technical', 'HR', 'Final round'] },
  ],
  Offer: [
    { key: 'offerAmount',   label: 'Offer amount ($)', type: 'number' },
    { key: 'offerDeadline', label: 'Decision deadline', type: 'date' },
  ],
  Rejected: [
    { key: 'rejectionReason', label: 'Rejection reason (optional)', type: 'text' },
  ],
};

// ── Days since last update ────────────────────────────────────
function daysSince(job) {
  const lastEvent = job.timeline?.slice(-1)[0];
  if (!lastEvent) return null;
  return Math.floor((Date.now() - new Date(lastEvent.date)) / 86400000);
}

// ══════════════════════════════════════════════════════════════
export default function ApplicationTrackerPage() {
  const [selectedJob, setSelectedJob] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [showUpdatePanel, setShowUpdatePanel] = useState(false);
  const [updateStage, setUpdateStage] = useState('');
  const [updateNote, setUpdateNote] = useState('');
  const [extraFields, setExtraFields] = useState({});
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['jobs', search, filterStage],
    queryFn: () => api.get('/jobs', {
      params: { search: search || undefined, stage: filterStage || undefined, sortBy: 'updatedAt', order: 'desc' },
    }).then(r => r.data),
  });

  // Refetch full job detail when selected
  const { data: jobDetail } = useQuery({
    queryKey: ['job', selectedJob?._id],
    queryFn: () => api.get(`/jobs/${selectedJob._id}`).then(r => r.data.job),
    enabled: !!selectedJob?._id,
  });

  const job = jobDetail || selectedJob;

  // Stage update mutation
  const updateStageMutation = useMutation({
    mutationFn: ({ id, payload }) => api.patch(`/jobs/${id}/stage`, payload),
    onSuccess: (res) => {
      qc.invalidateQueries(['jobs']);
      qc.invalidateQueries(['job', selectedJob?._id]);
      setSelectedJob(res.data.job);
      setShowUpdatePanel(false);
      setUpdateNote('');
      setExtraFields({});
      toast.success(res.data.transition?.message || 'Stage updated!');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Update failed'),
  });

  const handleStageUpdate = (e) => {
    e.preventDefault();
    if (!updateStage) return;
    updateStageMutation.mutate({
      id: selectedJob._id,
      payload: { stage: updateStage, note: updateNote, ...extraFields },
    });
  };

  const jobs = data?.jobs || [];

  // Stats
  const stats = {
    total:      jobs.length,
    active:     jobs.filter(j => !TERMINAL.includes(j.stage)).length,
    interviews: jobs.filter(j => j.stage === 'Interview').length,
    offers:     jobs.filter(j => j.stage === 'Offer').length,
    rejected:   jobs.filter(j => j.stage === 'Rejected').length,
  };

  // ── Progress bar position for a job ────────────────────────
  const progressPct = (stage) => {
    const idx = PIPELINE.findIndex(s => s.key === stage);
    if (idx === -1) return stage === 'Rejected' ? 100 : 0;
    return Math.round(((idx + 1) / PIPELINE.length) * 100);
  };

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── LEFT: Job list ── */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r border-gray-100 bg-white overflow-hidden">

        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-semibold text-gray-900">Applications</h1>
            <button onClick={() => navigate('/')} className="btn-primary h-7 px-2.5 text-xs">
              <Plus size={12} /> Add
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-2">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-8 h-8 text-xs" placeholder="Search company, role..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {/* Stage filter pills */}
          <div className="flex gap-1 flex-wrap">
            {['', 'Applied', 'Screening', 'Interview', 'Offer', 'Rejected'].map(s => (
              <button key={s} onClick={() => setFilterStage(s)}
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-all ${
                  filterStage === s
                    ? 'bg-primary-400 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}>
                {s || 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 divide-x divide-gray-100 border-b border-gray-100 bg-gray-50">
          {[
            { label: 'Total', val: stats.total },
            { label: 'Active', val: stats.active },
            { label: 'Interviews', val: stats.interviews },
            { label: 'Offers', val: stats.offers },
          ].map(s => (
            <div key={s.label} className="p-2 text-center">
              <p className="text-sm font-bold text-gray-900">{s.val}</p>
              <p className="text-[9px] text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Job list */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {isLoading && (
            <div className="flex justify-center py-10">
              <div className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!isLoading && jobs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Briefcase size={28} className="text-gray-300 mb-2" />
              <p className="text-sm font-medium text-gray-600">No applications yet</p>
              <p className="text-xs text-gray-400 mt-1">Add jobs from the pipeline or Find Jobs page</p>
            </div>
          )}

          {jobs.map(j => {
            const colorClass = getCompanyColor(j.company);
            const initials = j.company?.slice(0, 2).toUpperCase();
            const stale = daysSince(j);
            const isSelected = selectedJob?._id === j._id;

            return (
              <div key={j._id} onClick={() => { setSelectedJob(j); setShowUpdatePanel(false); }}
                className={`p-3 cursor-pointer transition-all hover:bg-gray-50 ${isSelected ? 'bg-primary-50 border-l-2 border-primary-400' : ''}`}>

                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${colorClass}`}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">{j.role}</p>
                    <p className="text-[10px] text-gray-500 truncate">{j.company}</p>
                  </div>
                  <StageBadge stage={j.stage} size="xs" />
                </div>

                {/* Mini progress bar */}
                {!TERMINAL.includes(j.stage) && (
                  <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-primary-400 rounded-full transition-all"
                      style={{ width: `${progressPct(j.stage)}%` }} />
                  </div>
                )}

                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10px] text-gray-400">{daysAgo(j.appliedDate)}</span>
                  {stale !== null && stale > 7 && !TERMINAL.includes(j.stage) && (
                    <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                      {stale}d no update
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── RIGHT: Detail + tracker ── */}
      {!selectedJob ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center bg-gray-50">
          <div className="w-16 h-16 bg-white rounded-2xl border border-gray-100 flex items-center justify-center shadow-sm">
            <TrendingUp size={28} className="text-gray-300" />
          </div>
          <p className="font-medium text-gray-600">Select an application</p>
          <p className="text-sm text-gray-400">Click any job to view and update its progress</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto bg-gray-50">
          <div className="max-w-2xl mx-auto p-5 space-y-4">

            {/* ── Job header ── */}
            <div className="card p-5">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${getCompanyColor(job.company)}`}>
                  {job.company?.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-gray-900">{job.role}</h2>
                  <p className="text-sm text-gray-500">{job.company}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {job.location && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <MapPin size={10} /> {job.location}
                      </span>
                    )}
                    {(job.salaryMin || job.salaryMax) && (
                      <span className="flex items-center gap-1 text-xs text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full">
                        <DollarSign size={10} />
                        {formatSalary(job.salaryMin, job.salaryMax, job.currency)}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Calendar size={10} /> Applied {daysAgo(job.appliedDate)}
                    </span>
                  </div>
                </div>
                <StageBadge stage={job.stage} />
              </div>
            </div>

            {/* ── Visual pipeline stepper ── */}
            <div className="card p-5">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Application progress</h3>

              <div className="relative">
                {/* Connector line */}
                <div className="absolute top-5 left-5 right-5 h-0.5 bg-gray-100" style={{ zIndex: 0 }}>
                  <div className="h-full bg-primary-400 transition-all duration-500"
                    style={{ width: TERMINAL.includes(job.stage) ? '100%' : `${progressPct(job.stage)}%` }} />
                </div>

                <div className="flex justify-between relative" style={{ zIndex: 1 }}>
                  {PIPELINE.map((step, idx) => {
                    const stageIdx  = PIPELINE.findIndex(s => s.key === job.stage);
                    const isDone    = idx < stageIdx || (idx === stageIdx);
                    const isCurrent = step.key === job.stage;
                    const Icon      = step.icon;
                    const isRejected = job.stage === 'Rejected';

                    return (
                      <div key={step.key} className="flex flex-col items-center gap-1.5 w-16">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                          isRejected && idx <= stageIdx
                            ? 'bg-red-50 border-red-300 text-red-400'
                            : isDone
                            ? 'bg-primary-400 border-primary-400 text-white shadow-md shadow-primary-100'
                            : 'bg-white border-gray-200 text-gray-300'
                        }`}>
                          {isDone && !isCurrent && !isRejected
                            ? <CheckCircle2 size={16} />
                            : <Icon size={15} />}
                        </div>
                        <span className={`text-[10px] font-medium text-center leading-tight ${
                          isCurrent ? 'text-primary-700' : isDone ? 'text-gray-600' : 'text-gray-300'
                        }`}>{step.label}</span>
                        {/* Date if reached */}
                        {isDone && (() => {
                          const ev = job.timeline?.find(t => t.stage === step.key && t.type === 'stage_change');
                          return ev ? (
                            <span className="text-[9px] text-gray-400">
                              {new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          ) : null;
                        })()}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rejected / Withdrawn badge */}
              {TERMINAL.includes(job.stage) && (
                <div className={`mt-4 flex items-center gap-2 p-3 rounded-xl ${
                  job.stage === 'Rejected' ? 'bg-red-50 border border-red-100' : 'bg-gray-50 border border-gray-200'
                }`}>
                  <XCircle size={16} className={job.stage === 'Rejected' ? 'text-red-500' : 'text-gray-400'} />
                  <div>
                    <p className={`text-sm font-medium ${job.stage === 'Rejected' ? 'text-red-700' : 'text-gray-600'}`}>
                      {job.stage === 'Rejected' ? 'Application rejected' : 'Application withdrawn'}
                    </p>
                    {job.rejectionReason && (
                      <p className="text-xs text-gray-500 mt-0.5">{job.rejectionReason}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Offer details */}
              {job.stage === 'Offer' && job.offerAmount && (
                <div className="mt-4 p-3 bg-green-50 border border-green-100 rounded-xl flex items-center gap-3">
                  <Star size={18} className="text-green-500 fill-green-200 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-green-800">
                      Offer: ${job.offerAmount.toLocaleString()}
                    </p>
                    {job.offerDeadline && (
                      <p className="text-xs text-green-600">
                        Deadline: {new Date(job.offerDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Interview details */}
              {job.stage === 'Interview' && job.interviewDate && (
                <div className="mt-4 p-3 bg-teal-50 border border-teal-100 rounded-xl flex items-center gap-3">
                  <MessageSquare size={16} className="text-teal-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-teal-800">
                      {job.interviewType || 'Interview'} scheduled
                    </p>
                    <p className="text-xs text-teal-600">
                      {new Date(job.interviewDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )}

              {/* Update stage button */}
              {!TERMINAL.includes(job.stage) && (
                <button
                  onClick={() => setShowUpdatePanel(v => !v)}
                  className={`mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    showUpdatePanel
                      ? 'bg-gray-100 text-gray-600'
                      : 'bg-primary-400 hover:bg-primary-600 text-white shadow-sm shadow-primary-100'
                  }`}
                >
                  <ArrowRight size={15} />
                  {showUpdatePanel ? 'Cancel update' : 'Update application status'}
                </button>
              )}
            </div>

            {/* ── Update panel ── */}
            {showUpdatePanel && !TERMINAL.includes(job.stage) && (
              <div className="card p-5 border-2 border-primary-200 animate-fade-in">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Update status</h3>
                <form onSubmit={handleStageUpdate} className="space-y-3">

                  {/* Stage buttons */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Move to stage</p>
                    <div className="flex flex-wrap gap-2">
                      {[...PIPELINE.filter(s => s.key !== job.stage), ...TERMINAL.map(t => ({ key: t, label: t }))].map(s => (
                        <button type="button" key={s.key}
                          onClick={() => { setUpdateStage(s.key); setExtraFields({}); }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            updateStage === s.key
                              ? TERMINAL.includes(s.key)
                                ? 'bg-red-100 border-red-300 text-red-700'
                                : 'bg-primary-100 border-primary-300 text-primary-700'
                              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Stage-specific extra fields */}
                  {updateStage && STAGE_FIELDS[updateStage]?.map(field => (
                    <div key={field.key}>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">{field.label}</label>
                      {field.type === 'select' ? (
                        <select className="input text-sm"
                          value={extraFields[field.key] || ''}
                          onChange={e => setExtraFields(f => ({ ...f, [field.key]: e.target.value }))}>
                          <option value="">Select...</option>
                          {field.options.map(o => <option key={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input type={field.type} className="input text-sm"
                          value={extraFields[field.key] || ''}
                          onChange={e => setExtraFields(f => ({ ...f, [field.key]: e.target.value }))} />
                      )}
                    </div>
                  ))}

                  {/* Note */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Add a note <span className="text-gray-400">(optional)</span>
                    </label>
                    <textarea className="input resize-none text-sm" rows={2}
                      placeholder="e.g. Had a great call with the recruiter, next step is..."
                      value={updateNote} onChange={e => setUpdateNote(e.target.value)} />
                  </div>

                  <button type="submit" disabled={!updateStage || updateStageMutation.isPending}
                    className="btn-primary w-full justify-center">
                    {updateStageMutation.isPending
                      ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <><CheckCircle2 size={14} /> Confirm update</>}
                  </button>
                </form>
              </div>
            )}

            {/* ── Timeline ── */}
            <div className="card p-5">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Activity timeline</h3>
              {(!job.timeline || job.timeline.length === 0) ? (
                <p className="text-sm text-gray-400 text-center py-4">No activity yet</p>
              ) : (
                <div className="space-y-1">
                  {[...(job.timeline || [])].reverse().map((ev, i, arr) => {
                    const TIcon = TIMELINE_TYPE_ICON[ev.type] || AlertCircle;
                    const bgClass = STAGE_ICON_BG[ev.stage] || STAGE_ICON_BG[ev.type] || 'bg-gray-100 text-gray-500';
                    const isLast = i === arr.length - 1;

                    return (
                      <div key={i} className="flex gap-3">
                        {/* Dot + line */}
                        <div className="flex flex-col items-center">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${bgClass}`}>
                            <TIcon size={12} />
                          </div>
                          {!isLast && <div className="w-px flex-1 bg-gray-100 my-1" />}
                        </div>

                        <div className="pb-3 flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm text-gray-800 font-medium leading-tight">{ev.event}</p>
                            <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5">
                              {new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          {ev.note && <p className="text-xs text-gray-500 mt-0.5">{ev.note}</p>}
                          {ev.addedBy === 'system' && (
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full mt-1 inline-block">auto</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Notes ── */}
            {job.notes?.length > 0 && (
              <div className="card p-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Notes</h3>
                <div className="space-y-2">
                  {job.notes.map(n => (
                    <div key={n._id} className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
                      {n.text}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Quick actions ── */}
            <div className="flex gap-2 pb-4">
              <button onClick={() => navigate('/')} className="btn-secondary flex-1 justify-center text-xs">
                Open in Pipeline
              </button>
              {job.jobUrl && (
                <a href={job.jobUrl} target="_blank" rel="noreferrer" className="btn-secondary flex-1 justify-center text-xs">
                  View job posting
                </a>
              )}
              <button
                onClick={() => navigate('/interview', { state: { jobId: job._id, role: job.role, company: job.company } })}
                className="btn-primary flex-1 justify-center text-xs">
                Practice interview
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}