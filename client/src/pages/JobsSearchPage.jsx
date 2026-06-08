import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, MapPin, Briefcase, DollarSign, ExternalLink,
  BookmarkPlus, Check, Filter, X, RefreshCw, Wifi,
  Globe, Clock, Tag, ChevronLeft, ChevronRight, Zap
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../utils/api';
import { formatSalary, getCompanyColor } from '../utils/constants';

const SOURCE_COLORS = {
  Remotive:  'bg-teal-100 text-teal-700',
  Adzuna:    'bg-blue-100 text-blue-700',
  JSearch:   'bg-violet-100 text-violet-700',
  Arbeitnow: 'bg-amber-100 text-amber-700',
};

const JOB_TYPES = ['', 'full-time', 'part-time', 'contract', 'internship', 'freelance'];

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function JobsSearchPage() {
  const [query, setQuery]       = useState('software engineer');
  const [location, setLocation] = useState('');
  const [remote, setRemote]     = useState(false);
  const [jobType, setJobType]   = useState('');
  const [source, setSource]     = useState('');
  const [page, setPage]         = useState(1);
  const [savedIds, setSavedIds] = useState(new Set());
  const [selected, setSelected] = useState(null);  // job detail panel
  const [searchInput, setSearchInput] = useState('software engineer');
  const [showFilters, setShowFilters] = useState(false);
  const qc = useQueryClient();

  // Load already-saved jobs to mark them
  const { data: pipelineData } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => api.get('/jobs').then(r => r.data),
  });

  useEffect(() => {
    if (pipelineData?.jobs) {
      const titles = new Set(pipelineData.jobs.map(j => `${j.role}|${j.company}`.toLowerCase()));
      setSavedIds(titles);
    }
  }, [pipelineData]);

  const isAlreadySaved = (job) =>
    savedIds.has(`${job.title}|${job.company}`.toLowerCase());

  // Fetch jobs
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['jobs-search', query, location, remote, jobType, source, page],
    queryFn: () => api.get('/jobs-search/search', {
      params: { q: query, location, remote: remote || undefined, jobType: jobType || undefined, source: source || undefined, page },
    }).then(r => r.data),
    enabled: !!query,
    keepPreviousData: true,
  });

  // Source availability
  const { data: sources } = useQuery({
    queryKey: ['job-sources'],
    queryFn: () => api.get('/jobs-search/sources').then(r => r.data),
  });

  // Save job mutation
  const saveMutation = useMutation({
    mutationFn: (job) => api.post('/jobs-search/save', {
      title:       job.title,
      company:     job.company,
      location:    job.location,
      remote:      job.remote,
      salaryMin:   job.salaryMin,
      salaryMax:   job.salaryMax,
      currency:    job.currency,
      description: job.description,
      url:         job.url,
      source:      job.source,
      tags:        job.tags,
    }),
    onSuccess: (res, job) => {
      setSavedIds(prev => new Set([...prev, `${job.title}|${job.company}`.toLowerCase()]));
      qc.invalidateQueries(['jobs']);
      toast.success(`"${job.title}" saved to pipeline!`);
    },
    onError: (err) => {
      if (err.response?.status === 409) toast.error('Already in your pipeline');
      else toast.error(err.response?.data?.error || 'Failed to save');
    },
  });

  const handleSearch = (e) => {
    e?.preventDefault();
    setQuery(searchInput);
    setPage(1);
    setSelected(null);
  };

  const jobs = data?.jobs || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  return (
    <div className="flex flex-col h-full">

      {/* ── Top search bar ── */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-10">
        <form onSubmit={handleSearch} className="flex gap-2 items-center">
          <div className="relative flex-1 max-w-lg">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9 h-9 text-sm"
              placeholder="Job title, skill, keyword..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
          </div>
          <div className="relative">
            <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-8 h-9 text-sm w-40"
              placeholder="Location"
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary h-9 px-4 text-sm">
            {isFetching ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Search size={14} /> Search</>}
          </button>
          <button type="button" onClick={() => setShowFilters(f => !f)}
            className={`btn-secondary h-9 px-3 ${showFilters ? 'bg-gray-100' : ''}`}>
            <Filter size={14} /> Filters
          </button>
        </form>

        {/* Filters row */}
        {showFilters && (
          <div className="flex gap-3 mt-3 flex-wrap animate-fade-in">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={remote} onChange={e => { setRemote(e.target.checked); setPage(1); }} className="rounded" />
              Remote only
            </label>
            <select className="input h-8 text-xs w-36" value={jobType} onChange={e => { setJobType(e.target.value); setPage(1); }}>
              <option value="">All types</option>
              {JOB_TYPES.filter(Boolean).map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
            </select>
            <select className="input h-8 text-xs w-36" value={source} onChange={e => { setSource(e.target.value); setPage(1); }}>
              <option value="">All sources</option>
              <option value="Remotive">Remotive</option>
              <option value="Arbeitnow">Arbeitnow</option>
              {sources?.adzuna  && <option value="Adzuna">Adzuna</option>}
              {sources?.jsearch && <option value="JSearch">JSearch</option>}
            </select>
            {(remote || jobType || source) && (
              <button onClick={() => { setRemote(false); setJobType(''); setSource(''); setPage(1); }}
                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                <X size={12} /> Clear filters
              </button>
            )}
          </div>
        )}

        {/* Source availability pills */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="text-[10px] text-gray-400">Sources:</span>
          {[
            { name: 'Remotive', ok: true },
            { name: 'Arbeitnow', ok: true },
            { name: 'Adzuna', ok: sources?.adzuna },
            { name: 'JSearch', ok: sources?.jsearch },
          ].map(s => (
            <span key={s.name} className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
              s.ok ? SOURCE_COLORS[s.name] || 'bg-gray-100 text-gray-500' : 'bg-gray-100 text-gray-400 line-through'
            }`}>
              {s.ok ? <Wifi size={8} /> : null} {s.name}
            </span>
          ))}
          {(!sources?.adzuna || !sources?.jsearch) && (
            <span className="text-[10px] text-gray-400">
              · Add API keys in <code className="bg-gray-100 px-1 rounded">.env</code> for more results
            </span>
          )}
        </div>
      </div>

      {/* ── Main content: list + detail panel ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Job list */}
        <div className={`flex flex-col overflow-y-auto ${selected ? 'w-96 flex-shrink-0' : 'flex-1'} border-r border-gray-100`}>

          {/* Result count */}
          {!isLoading && (
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                {total > 0 ? <><span className="font-semibold text-gray-900">{total}</span> jobs found</> : 'No jobs found'}
                {data?.sources && (
                  <span className="ml-2 text-gray-400">
                    (Remotive: {data.sources.remotive}, Arbeitnow: {data.sources.arbeitnow}
                    {data.sources.adzuna > 0 && `, Adzuna: ${data.sources.adzuna}`}
                    {data.sources.jsearch > 0 && `, JSearch: ${data.sources.jsearch}`})
                  </span>
                )}
              </p>
              <button onClick={() => refetch()} className="text-xs text-gray-400 hover:text-primary-600 flex items-center gap-1">
                <RefreshCw size={11} /> Refresh
              </button>
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Searching across job boards...</p>
            </div>
          )}

          {!isLoading && jobs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
              <Globe size={32} className="text-gray-300" />
              <p className="font-medium text-gray-700">No jobs found</p>
              <p className="text-sm text-gray-400">Try different keywords or remove filters</p>
            </div>
          )}

          <div className="divide-y divide-gray-50">
            {jobs.map((job, idx) => {
              const saved = isAlreadySaved(job);
              const colorClass = getCompanyColor(job.company);
              const initials = job.company?.slice(0, 2).toUpperCase() || '??';
              const isSelected = selected?.externalId === job.externalId;

              return (
                <div
                  key={job.externalId || idx}
                  onClick={() => setSelected(isSelected ? null : job)}
                  className={`p-4 cursor-pointer transition-all hover:bg-gray-50 ${isSelected ? 'bg-primary-50 border-l-2 border-primary-400' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Company logo */}
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${colorClass}`}>
                      {initials}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{job.title}</p>
                          <p className="text-xs text-gray-500">{job.company}</p>
                        </div>
                        {/* Save button */}
                        <button
                          onClick={(e) => { e.stopPropagation(); if (!saved) saveMutation.mutate(job); }}
                          disabled={saved || saveMutation.isPending}
                          className={`flex-shrink-0 flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg font-medium transition-all ${
                            saved
                              ? 'bg-primary-100 text-primary-700 cursor-default'
                              : 'bg-gray-100 text-gray-600 hover:bg-primary-100 hover:text-primary-700'
                          }`}
                        >
                          {saved ? <><Check size={11} /> Saved</> : <><BookmarkPlus size={11} /> Save</>}
                        </button>
                      </div>

                      {/* Meta */}
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {job.location && (
                          <span className="flex items-center gap-0.5 text-[11px] text-gray-400">
                            <MapPin size={9} /> {job.location.length > 25 ? job.location.slice(0, 25) + '…' : job.location}
                          </span>
                        )}
                        {job.remote && (
                          <span className="text-[11px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded-full">Remote</span>
                        )}
                        {(job.salaryMin || job.salaryMax) && (
                          <span className="flex items-center gap-0.5 text-[11px] text-primary-700 bg-primary-50 px-1.5 py-0.5 rounded-full">
                            {formatSalary(job.salaryMin, job.salaryMax, job.currency)}
                          </span>
                        )}
                        {job.jobType && job.jobType !== 'full-time' && (
                          <span className="text-[11px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full capitalize">{job.jobType}</span>
                        )}
                      </div>

                      {/* Source + time */}
                      <div className="flex items-center justify-between mt-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SOURCE_COLORS[job.source] || 'bg-gray-100 text-gray-500'}`}>
                          {job.source}
                        </span>
                        <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                          <Clock size={9} /> {timeAgo(job.postedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-white sticky bottom-0">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="btn-secondary h-8 px-3 text-xs disabled:opacity-40">
                <ChevronLeft size={13} /> Prev
              </button>
              <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="btn-secondary h-8 px-3 text-xs disabled:opacity-40">
                Next <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>

        {/* ── Job detail panel ── */}
        {selected && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4 animate-fade-in">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${getCompanyColor(selected.company)}`}>
                  {selected.company?.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">{selected.title}</h2>
                  <p className="text-sm text-gray-500">{selected.company}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={16} />
              </button>
            </div>

            {/* Meta grid */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                ['Location', selected.location || '—'],
                ['Type', selected.jobType || 'Full-time'],
                ['Remote', selected.remote ? 'Yes' : 'No'],
                ['Source', selected.source],
                ['Posted', timeAgo(selected.postedAt)],
                ['Salary', (selected.salaryMin || selected.salaryMax) ? formatSalary(selected.salaryMin, selected.salaryMax, selected.currency) : '—'],
              ].map(([label, val]) => (
                <div key={label} className="p-2.5 bg-gray-50 rounded-lg">
                  <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
                  <p className="text-xs font-medium text-gray-900">{val}</p>
                </div>
              ))}
            </div>

            {/* Tags/skills */}
            {selected.tags?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                  <Tag size={11} /> Skills / Tags
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.tags.map(t => (
                    <span key={t} className="text-xs bg-primary-50 text-primary-700 border border-primary-100 px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {selected.description && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Description</p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line bg-gray-50 rounded-xl p-3">
                  {selected.description}
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-2 sticky bottom-0 bg-white pb-2">
              <button
                onClick={() => { if (!isAlreadySaved(selected)) saveMutation.mutate(selected); }}
                disabled={isAlreadySaved(selected) || saveMutation.isPending}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isAlreadySaved(selected)
                    ? 'bg-primary-50 text-primary-700 cursor-default border border-primary-200'
                    : 'bg-primary-400 hover:bg-primary-600 text-white'
                }`}
              >
                {saveMutation.isPending ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : isAlreadySaved(selected) ? (
                  <><Check size={15} /> Saved to pipeline</>
                ) : (
                  <><BookmarkPlus size={15} /> Save to pipeline</>
                )}
              </button>
              {selected.url && (
                <a href={selected.url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all">
                  <ExternalLink size={14} /> Apply
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}