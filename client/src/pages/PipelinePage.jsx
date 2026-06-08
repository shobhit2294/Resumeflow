import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Filter, LayoutGrid, List } from 'lucide-react';
import api from '../utils/api';
import { STAGES, STAGE_COLORS } from '../utils/constants';
import JobCard from '../components/jobs/JobCard';
import JobDetailPanel from '../components/jobs/JobDetailPanel';
import AddJobModal from '../components/jobs/AddJobModal';
import StageBadge from '../components/jobs/StageBadge';

export default function PipelinePage() {
  const [selectedJob, setSelectedJob] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addStage, setAddStage] = useState('Applied');
  const [viewMode, setViewMode] = useState('kanban');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['jobs', search, stageFilter],
    queryFn: () => api.get('/jobs', { params: { search, stage: stageFilter || undefined } }).then((r) => r.data),
  });

  const jobs = data?.jobs || [];

  const jobsByStage = STAGES.reduce((acc, stage) => {
    acc[stage] = jobs.filter((j) => j.stage === stage);
    return acc;
  }, {});

  const openAddModal = (stage = 'Applied') => {
    setAddStage(stage);
    setShowAddModal(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Topbar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-white sticky top-0 z-10">
        <div>
          <h1 className="font-semibold text-gray-900">Job Pipeline</h1>
          <p className="text-xs text-gray-400">{jobs.length} application{jobs.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="flex-1 max-w-xs ml-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-8 h-8 text-xs"
              placeholder="Search jobs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <select
          className="input h-8 text-xs w-36"
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
        >
          <option value="">All stages</option>
          {STAGES.map((s) => <option key={s}>{s}</option>)}
        </select>

        <div className="flex border border-gray-200 rounded-lg overflow-hidden ml-auto">
          <button onClick={() => setViewMode('kanban')}
            className={`p-1.5 ${viewMode === 'kanban' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
            <LayoutGrid size={15} />
          </button>
          <button onClick={() => setViewMode('list')}
            className={`p-1.5 ${viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
            <List size={15} />
          </button>
        </div>

        <button onClick={() => openAddModal()} className="btn-primary h-8 text-xs">
          <Plus size={14} /> Add job
        </button>
      </div>

      {/* Stats row */}
      <div className="flex gap-3 px-6 py-3 bg-white border-b border-gray-100 overflow-x-auto">
        {STAGES.slice(0, 5).map((stage) => {
          const c = STAGE_COLORS[stage];
          return (
            <div key={stage} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${c.border} ${c.bg} flex-shrink-0`}>
              <span className={`text-xs font-medium ${c.text}`}>{stage}</span>
              <span className={`text-xs font-bold ${c.text}`}>{jobsByStage[stage]?.length || 0}</span>
            </div>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {jobs.length === 0 && !search && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mb-4">
              <Plus size={28} className="text-primary-400" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">No jobs yet</h3>
            <p className="text-sm text-gray-400 mb-4">Add your first job application to get started</p>
            <button onClick={() => openAddModal()} className="btn-primary">
              <Plus size={15} /> Add your first job
            </button>
          </div>
        )}

        {viewMode === 'kanban' && jobs.length > 0 && (
          <div className="flex gap-4 h-full overflow-x-auto pb-4">
            {STAGES.map((stage) => {
              const c = STAGE_COLORS[stage];
              const stageJobs = jobsByStage[stage] || [];
              return (
                <div key={stage} className="flex-shrink-0 w-64 flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${c.dot}`} />
                      <span className="text-xs font-semibold text-gray-700">{stage}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                        {stageJobs.length}
                      </span>
                      <button
                        onClick={() => openAddModal(stage)}
                        className="text-gray-400 hover:text-primary-600 hover:bg-primary-50 p-0.5 rounded transition-all"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
                    {stageJobs.map((job) => (
                      <JobCard key={job._id} job={job} onClick={() => setSelectedJob(job)} />
                    ))}
                    {stageJobs.length === 0 && (
                      <div
                        onClick={() => openAddModal(stage)}
                        className="border border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-primary-300 hover:bg-primary-50/30 transition-all"
                      >
                        <p className="text-xs text-gray-400">+ Add</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {viewMode === 'list' && jobs.length > 0 && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Company / Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Stage</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 hidden md:table-cell">Applied</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 hidden lg:table-cell">Salary</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 hidden lg:table-cell">Match</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 hidden md:table-cell">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {jobs.map((job) => {
                  const initials = job.company?.slice(0, 2).toUpperCase();
                  const colorClass = getCompanyColor?.(job.company) || 'bg-gray-100 text-gray-600';
                  return (
                    <tr
                      key={job._id}
                      onClick={() => setSelectedJob(job)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${colorClass}`}>
                            {initials}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{job.role}</p>
                            <p className="text-xs text-gray-400">{job.company}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><StageBadge stage={job.stage} size="xs" /></td>
                      <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">
                        {new Date(job.appliedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 hidden lg:table-cell">
                        {job.salaryMin ? `$${Math.round(job.salaryMin / 1000)}k` : '—'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {job.resumeMatchScore != null ? (
                          <span className={`text-xs font-medium ${job.resumeMatchScore >= 75 ? 'text-primary-600' : 'text-amber-600'}`}>
                            {job.resumeMatchScore}%
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 hidden md:table-cell">{job.source}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedJob && (
        <JobDetailPanel
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
        />
      )}

      {showAddModal && (
        <AddJobModal initialStage={addStage} onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}
