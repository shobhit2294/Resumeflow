import { MapPin, DollarSign, Calendar, ExternalLink } from 'lucide-react';
import { formatSalary, daysAgo, getCompanyColor } from '../../utils/constants';
import StageBadge from './StageBadge';

export default function JobCard({ job, onClick }) {
  const initials = job.company?.slice(0, 2).toUpperCase() || '??';
  const colorClass = getCompanyColor(job.company);
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.currency);

  const daysSinceApplied = job.appliedDate
    ? Math.max(0, Math.floor((Date.now() - new Date(job.appliedDate).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const isStalled = (job.stage === 'Applied' || job.stage === 'Screening') && daysSinceApplied >= 6;
  const isGhostRisk = isStalled && daysSinceApplied >= 12;

  return (
    <div
      onClick={onClick}
      className="card p-3.5 cursor-pointer hover:shadow-md hover:border-gray-200 transition-all animate-fade-in active:scale-[0.99]"
    >
      {/* Company */}
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${colorClass}`}>
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 truncate">{job.company}</p>
          {job.remote && (
            <span className="text-[10px] text-teal-600 bg-teal-50 px-1.5 py-0 rounded-full">Remote</span>
          )}
        </div>
        {job.priority === 'high' && (
          <span className="ml-auto text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">High</span>
        )}
      </div>

      <h3 className="text-sm font-semibold text-gray-900 mb-2 leading-tight">{job.role}</h3>

      {/* Meta row */}
      <div className="flex flex-wrap gap-1.5 mb-2.5">
        {salary && (
          <span className="inline-flex items-center gap-1 text-[11px] text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full border border-primary-100">
            {salary}
          </span>
        )}
        {job.location && (
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">
            <MapPin size={9} />
            {job.location}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
          <Calendar size={9} />
          {daysAgo(job.appliedDate)}
        </span>
        {isGhostRisk ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200" title={`No response for ${daysSinceApplied} days`}>
            ⚠️ Ghost Risk ({daysSinceApplied}d)
          </span>
        ) : isStalled ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200" title={`Ideal time to follow up (${daysSinceApplied} days)`}>
            🕒 Follow Up ({daysSinceApplied}d)
          </span>
        ) : null}
      </div>

      {/* Resume match bar */}
      {job.resumeMatchScore != null && (
        <div>
          <div className="flex justify-between text-[10px] text-gray-400 mb-1">
            <span>Resume match</span>
            <span className={job.resumeMatchScore >= 75 ? 'text-primary-600' : 'text-amber-600'}>
              {job.resumeMatchScore}%
            </span>
          </div>
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                job.resumeMatchScore >= 75 ? 'bg-primary-400' : 'bg-amber-400'
              }`}
              style={{ width: `${job.resumeMatchScore}%` }}
            />
          </div>
        </div>
      )}

      {/* Source tag */}
      <div className="flex items-center justify-between mt-2.5">
        <span className="text-[10px] text-gray-400">{job.source}</span>
        {job.interviewSessions?.length > 0 && (
          <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">
            {job.interviewSessions.length} interview{job.interviewSessions.length > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
