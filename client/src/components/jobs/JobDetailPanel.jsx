import { useState } from 'react';
import { X, ExternalLink, Trash2, Plus, Edit2, Check } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { STAGES, STAGE_COLORS, formatSalary, daysAgo, getCompanyColor } from '../../utils/constants';
import StageBadge from './StageBadge';

const TABS = ['Details', 'Timeline', 'Notes', 'Interview'];

export default function JobDetailPanel({ job, onClose }) {
  const [tab, setTab] = useState('Details');
  const [newNote, setNewNote] = useState('');
  const [stageChanging, setStageChanging] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const updateStage = useMutation({
    mutationFn: (stage) => api.patch(`/jobs/${job._id}/stage`, { stage }),
    onSuccess: () => { qc.invalidateQueries(['jobs']); toast.success('Stage updated'); },
    onError: () => toast.error('Failed to update stage'),
  });

  const deleteJob = useMutation({
    mutationFn: () => api.delete(`/jobs/${job._id}`),
    onSuccess: () => { qc.invalidateQueries(['jobs']); toast.success('Job deleted'); onClose(); },
  });

  const addNote = useMutation({
    mutationFn: (text) => api.post(`/jobs/${job._id}/notes`, { text }),
    onSuccess: (res) => { qc.invalidateQueries(['jobs']); setNewNote(''); toast.success('Note added'); },
  });

  const deleteNote = useMutation({
    mutationFn: (noteId) => api.delete(`/jobs/${job._id}/notes/${noteId}`),
    onSuccess: () => qc.invalidateQueries(['jobs']),
  });

  const salary = formatSalary(job.salaryMin, job.salaryMax, job.currency);
  const colorClass = getCompanyColor(job.company);
  const initials = job.company?.slice(0, 2).toUpperCase() || '??';

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-gray-100">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${colorClass}`}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900 truncate">{job.role}</h2>
            <p className="text-sm text-gray-500">{job.company}</p>
          </div>
          <div className="flex items-center gap-1">
            {job.jobUrl && (
              <a href={job.jobUrl} target="_blank" rel="noreferrer"
                className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all">
                <ExternalLink size={15} />
              </a>
            )}
            <button onClick={() => { if (confirm('Delete this job?')) deleteJob.mutate(); }}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
              <Trash2 size={15} />
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-all">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Stage selector */}
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2 flex-wrap">
            {STAGES.map((s) => {
              const c = STAGE_COLORS[s];
              const active = job.stage === s;
              return (
                <button
                  key={s}
                  onClick={() => updateStage.mutate(s)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all font-medium ${
                    active
                      ? `${c.bg} ${c.text} ${c.border}`
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                tab === t ? 'text-primary-700 border-b-2 border-primary-400' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'Details' && (
            <div className="space-y-3 text-sm">
              {[
                ['Stage', <StageBadge stage={job.stage} />],
                ['Applied', daysAgo(job.appliedDate)],
                salary && ['Salary', salary],
                job.location && ['Location', `${job.location}${job.remote ? ' (Remote)' : ''}`],
                ['Source', job.source],
                ['Priority', <span className="capitalize">{job.priority}</span>],
                job.contactName && ['Contact', job.contactName],
                job.contactEmail && ['Email', <a href={`mailto:${job.contactEmail}`} className="text-primary-600 hover:underline">{job.contactEmail}</a>],
              ].filter(Boolean).map(([label, value]) => (
                <div key={label} className="flex gap-3">
                  <span className="text-gray-400 w-20 flex-shrink-0 text-xs pt-0.5">{label}</span>
                  <span className="text-gray-900 flex-1">{value}</span>
                </div>
              ))}

              {job.tags?.length > 0 && (
                <div className="flex gap-3">
                  <span className="text-gray-400 w-20 flex-shrink-0 text-xs pt-1">Tags</span>
                  <div className="flex flex-wrap gap-1">
                    {job.tags.map((t) => (
                      <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {job.resumeMatchScore != null && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-700 mb-2">Resume match</p>
                  {job.matchedSkills?.map((s) => (
                    <div key={s.skill} className="mb-2">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{s.skill}</span>
                        <span>{s.score}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full">
                        <div className="h-full bg-primary-400 rounded-full" style={{ width: `${s.score}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => navigate('/interview', { state: { jobId: job._id, company: job.company, role: job.role } })}
                className="w-full mt-4 btn-primary justify-center"
              >
                Start AI mock interview
              </button>
            </div>
          )}

          {tab === 'Timeline' && (
            <div className="space-y-1">
              {job.timeline?.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No timeline events yet.</p>
              )}
              {[...( job.timeline || [])].reverse().map((ev, i) => (
                <div key={i} className="flex gap-3 pb-4">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-primary-400 mt-1.5 flex-shrink-0" />
                    {i < job.timeline.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
                  </div>
                  <div className="pb-2">
                    <p className="text-sm font-medium text-gray-900">{ev.event}</p>
                    {ev.note && <p className="text-xs text-gray-500 mt-0.5">{ev.note}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'Notes' && (
            <div>
              <div className="flex gap-2 mb-4">
                <input
                  className="input flex-1 text-sm"
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && newNote.trim()) addNote.mutate(newNote.trim()); }}
                />
                <button
                  onClick={() => newNote.trim() && addNote.mutate(newNote.trim())}
                  className="btn-primary px-3"
                  disabled={!newNote.trim() || addNote.isPending}
                >
                  <Plus size={15} />
                </button>
              </div>
              {job.notes?.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No notes yet. Add one above.</p>
              )}
              <div className="space-y-2">
                {[...(job.notes || [])].reverse().map((n) => (
                  <div key={n._id} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg group">
                    <p className="flex-1 text-sm text-gray-700">{n.text}</p>
                    <button
                      onClick={() => deleteNote.mutate(n._id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'Interview' && (
            <div className="text-center py-6">
              {job.interviewSessions?.length > 0 ? (
                <div className="space-y-3 text-left mb-6">
                  <p className="text-sm font-medium text-gray-700 mb-3">Past sessions</p>
                  {job.interviewSessions.map((s) => (
                    <div key={s._id} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900 capitalize">{s.type || 'Mixed'}</p>
                        <p className="text-xs text-gray-400">
                          {s.status === 'completed' ? `Score: ${s.averageScore || '—'}/10` : 'In progress'}
                        </p>
                      </div>
                      <button
                        onClick={() => navigate(`/interview/${s._id}`)}
                        className="text-xs text-primary-600 hover:underline"
                      >
                        {s.status === 'completed' ? 'Review' : 'Continue'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 mb-6">No interview sessions for this job yet.</p>
              )}
              <button
                onClick={() => navigate('/interview', { state: { jobId: job._id, company: job.company, role: job.role } })}
                className="btn-primary"
              >
                Start new session
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
