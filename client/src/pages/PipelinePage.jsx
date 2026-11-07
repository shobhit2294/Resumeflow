import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, LayoutGrid, List, Download, Upload, FileSpreadsheet } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../utils/api';
import { STAGES, STAGE_COLORS, getCompanyColor } from '../utils/constants';
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
  const [showDataMenu, setShowDataMenu] = useState(false);
  const fileInputRef = useRef(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['jobs', search, stageFilter],
    queryFn: () => api.get('/jobs', { params: { search, stage: stageFilter || undefined } }).then((r) => r.data),
  });

  const jobs = data?.jobs || [];

  const handleExportCSV = () => {
    if (jobs.length === 0) {
      toast.error('No jobs to export');
      return;
    }
    const headers = ['Company', 'Role', 'Stage', 'Applied Date', 'Salary Min', 'Salary Max', 'Currency', 'Location', 'Remote', 'Source', 'Priority', 'Contact Name', 'Contact Email'];
    const rows = jobs.map((j) => [
      `"${(j.company || '').replace(/"/g, '""')}"`,
      `"${(j.role || '').replace(/"/g, '""')}"`,
      `"${j.stage || 'Applied'}"`,
      `"${j.appliedDate ? new Date(j.appliedDate).toISOString().split('T')[0] : ''}"`,
      j.salaryMin || '',
      j.salaryMax || '',
      j.currency || 'USD',
      `"${(j.location || '').replace(/"/g, '""')}"`,
      j.remote ? 'Yes' : 'No',
      `"${j.source || ''}"`,
      j.priority || 'medium',
      `"${(j.contactName || '').replace(/"/g, '""')}"`,
      `"${(j.contactEmail || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `resumeflow_pipeline_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exported applications to CSV!');
    setShowDataMenu(false);
  };

  const handleExportJSON = () => {
    if (jobs.length === 0) {
      toast.error('No jobs to export');
      return;
    }
    const blob = new Blob([JSON.stringify(jobs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `resumeflow_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exported backup to JSON!');
    setShowDataMenu(false);
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let imported = [];
      if (file.name.endsWith('.json')) {
        imported = JSON.parse(text);
        if (!Array.isArray(imported)) {
          toast.error('Invalid JSON format: expected an array of jobs');
          return;
        }
      } else if (file.name.endsWith('.csv')) {
        const lines = text.split('\n').filter((l) => l.trim().length > 0);
        if (lines.length <= 1) {
          toast.error('CSV file has no data rows');
          return;
        }
        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''));
        const compIdx = headers.findIndex((h) => h.includes('company'));
        const roleIdx = headers.findIndex((h) => h.includes('role') || h.includes('title') || h.includes('position'));
        const stageIdx = headers.findIndex((h) => h.includes('stage') || h.includes('status'));

        imported = lines.slice(1).map((line) => {
          const cells = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
          return {
            company: compIdx !== -1 ? cells[compIdx] : cells[0] || 'Company',
            role: roleIdx !== -1 ? cells[roleIdx] : cells[1] || 'Role',
            stage: stageIdx !== -1 ? cells[stageIdx] : 'Applied',
          };
        }).filter((j) => j.company && j.role);
      }

      const res = await api.post('/jobs/bulk-import', { jobs: imported });
      toast.success(res.data.message || 'Imported jobs successfully!');
      qc.invalidateQueries(['jobs']);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to import file');
    } finally {
      setShowDataMenu(false);
      e.target.value = '';
    }
  };

  const stalledJobsCount = jobs.filter((j) => {
    if (j.stage !== 'Applied' && j.stage !== 'Screening') return false;
    const days = j.appliedDate
      ? Math.max(0, Math.floor((Date.now() - new Date(j.appliedDate).getTime()) / (1000 * 60 * 60 * 24)))
      : 0;
    return days >= 6;
  }).length;

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

        {/* Data Import/Export Menu */}
        <div className="relative">
          <button
            onClick={() => setShowDataMenu(!showDataMenu)}
            className="btn-secondary h-8 text-xs flex items-center gap-1.5"
            title="Import or Export Pipeline Data"
          >
            <Download size={13} />
            <span>Data</span>
          </button>

          {showDataMenu && (
            <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-30 animate-fade-in text-xs">
              <button
                onClick={handleExportCSV}
                className="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700 font-medium"
              >
                <FileSpreadsheet size={14} className="text-emerald-600" />
                Export to CSV
              </button>
              <button
                onClick={handleExportJSON}
                className="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700 font-medium"
              >
                <Download size={14} className="text-primary-600" />
                Export to JSON Backup
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700 font-medium"
              >
                <Upload size={14} className="text-blue-600" />
                Import from CSV / JSON
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>

        <button onClick={() => openAddModal()} className="btn-primary h-8 text-xs">
          <Plus size={14} /> Add job
        </button>
      </div>

      {/* Stats row */}
      <div className="flex gap-3 px-6 py-3 bg-white border-b border-gray-100 overflow-x-auto items-center">
        {STAGES.slice(0, 5).map((stage) => {
          const c = STAGE_COLORS[stage];
          return (
            <div key={stage} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${c.border} ${c.bg} flex-shrink-0`}>
              <span className={`text-xs font-medium ${c.text}`}>{stage}</span>
              <span className={`text-xs font-bold ${c.text}`}>{jobsByStage[stage]?.length || 0}</span>
            </div>
          );
        })}
        {stalledJobsCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs font-medium flex-shrink-0 ml-auto">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Ghosting Radar: <strong>{stalledJobsCount}</strong> need follow-up</span>
          </div>
        )}
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
