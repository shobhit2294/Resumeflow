import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, FileText, RefreshCw, Save, ShieldCheck, Sparkles, Target } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';

export default function JobResumeCoach({ job }) {
  const [analysis, setAnalysis] = useState(job.resumeMatchAnalysis || null);
  const [draft, setDraft] = useState('');
  const [selectedEvidence, setSelectedEvidence] = useState('');
  const [suggestedBullet, setSuggestedBullet] = useState('');
  const [resumeChangedSinceMatch, setResumeChangedSinceMatch] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: resumeData, isLoading: loadingResume } = useQuery({
    queryKey: ['resume-content'],
    queryFn: () => api.get('/resume/content').then((response) => response.data),
  });

  useEffect(() => {
    setDraft(resumeData?.resumeText || '');
  }, [resumeData?.resumeText]);

  useEffect(() => {
    setAnalysis(job.resumeMatchAnalysis || null);
  }, [job._id, job.resumeMatchAnalysis]);

  const matchMutation = useMutation({
    mutationFn: () => api.post('/resume/match-job', { jobId: job._id }),
    onSuccess: (response) => {
      setAnalysis(response.data.analysis);
      setResumeChangedSinceMatch(false);
      setSelectedEvidence('');
      setSuggestedBullet('');
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', job._id] });
      toast.success('Resume compared with this job');
    },
    onError: (error) => toast.error(error.response?.data?.error || 'Resume comparison failed'),
  });

  const improveMutation = useMutation({
    mutationFn: () => api.post('/resume/improve', {
      bullet: selectedEvidence,
      role: job.role,
      company: job.company,
    }),
    onSuccess: (response) => setSuggestedBullet(response.data.improved),
    onError: (error) => toast.error(error.response?.data?.error || 'Could not prepare a rewrite'),
  });

  const saveMutation = useMutation({
    mutationFn: () => api.put('/resume/content', {
      currentText: resumeData?.resumeText || '',
      updatedText: draft,
    }),
    onSuccess: () => {
      queryClient.setQueryData(['resume-content'], { resumeText: draft });
      queryClient.invalidateQueries({ queryKey: ['resume-status'] });
      setResumeChangedSinceMatch(true);
      setSuggestedBullet('');
      toast.success('Your approved resume edits were saved');
    },
    onError: (error) => toast.error(error.response?.data?.error || 'Could not save resume edits'),
  });

  const applySuggestionToDraft = () => {
    if (!selectedEvidence || !draft.includes(selectedEvidence)) {
      toast.error('The original evidence is no longer in the draft. Reload your resume before applying this suggestion.');
      return;
    }
    setDraft(draft.replace(selectedEvidence, suggestedBullet));
    setSuggestedBullet('');
    toast.success('Rewrite added to your draft. Save only when you approve it.');
  };

  const evidenceOptions = [
    ...(analysis?.requiredSkills || []),
    ...(analysis?.preferredSkills || []),
  ].filter((skill) => skill.found && skill.evidence);

  return (
    <section className="card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Target size={15} className="text-primary-500" /> Resume match for this job
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">Run on demand; scores use your saved resume and this job description.</p>
        </div>
        <button
          type="button"
          className="btn-primary text-xs"
          disabled={matchMutation.isPending || !job.jobDescription || !resumeData?.resumeText}
          onClick={() => matchMutation.mutate()}
        >
          {matchMutation.isPending
            ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Matching...</>
            : <><RefreshCw size={12} /> {analysis ? 'Recheck match' : 'Compare resume'}</>}
        </button>
      </div>

      {!job.jobDescription && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 p-3 rounded-lg">
          Add the job description to this application before comparing your resume.
        </p>
      )}
      {!loadingResume && !resumeData?.resumeText && (
        <div className="flex items-center justify-between gap-3 text-xs text-amber-800 bg-amber-50 border border-amber-100 p-3 rounded-lg">
          <span>Upload a resume before comparing it with this job.</span>
          <button type="button" className="font-semibold underline" onClick={() => navigate('/resume')}>Upload resume</button>
        </div>
      )}
      {loadingResume && <p className="text-xs text-gray-400">Checking your saved resume...</p>}
      {resumeChangedSinceMatch && (
        <p className="text-xs text-blue-800 bg-blue-50 border border-blue-100 p-3 rounded-lg">
          Your resume changed after this comparison. Recheck the match to refresh its evidence and score.
        </p>
      )}

      {analysis && (
        <>
          <div className="p-3 rounded-xl bg-primary-50 border border-primary-100 flex items-center gap-3">
            <span className="text-2xl font-bold text-primary-700">{analysis.overallScore}%</span>
            <div className="text-xs text-gray-700">
              <p className="font-semibold">Evidence-based role match</p>
              <p>Skills {analysis.scoreBreakdown.skillsScore}% · Experience {analysis.scoreBreakdown.experienceScore}% · Education {analysis.scoreBreakdown.educationScore}%</p>
            </div>
          </div>

          <div className="space-y-2">
            {(analysis.requiredSkills || []).map((skill) => (
              <div key={skill.skill} className="border border-gray-100 rounded-lg p-2.5">
                <div className="flex items-center gap-2">
                  {skill.found
                    ? <CheckCircle2 size={13} className="text-green-600" />
                    : <AlertTriangle size={13} className="text-amber-600" />}
                  <span className="flex-1 text-xs font-medium text-gray-800">{skill.skill}</span>
                  <span className="text-xs font-semibold text-gray-600">{skill.score}%</span>
                </div>
                {skill.evidence
                  ? <p className="text-[11px] italic text-gray-500 mt-1 pl-5">“{skill.evidence}”</p>
                  : <p className="text-[11px] text-amber-700 mt-1 pl-5">No supporting resume evidence. Learn the skill before claiming it.</p>}
              </div>
            ))}
            {(analysis.preferredSkills || []).length > 0 && (
              <p className="text-[11px] text-gray-500">
                Preferred skills: {analysis.preferredSkills.map((skill) => `${skill.skill} ${skill.found ? 'matched' : 'missing'}`).join(' · ')}
              </p>
            )}
          </div>

          {(analysis.jobProfile?.experienceRequired || analysis.jobProfile?.educationRequired
            || analysis.experienceMatch?.evidence || analysis.educationMatch?.evidence
            || analysis.experienceMatch?.gaps?.length > 0) && (
            <div className="text-[11px] text-gray-600 space-y-1">
              {analysis.jobProfile?.experienceRequired && <p><strong>Experience requirement:</strong> {analysis.jobProfile.experienceRequired}</p>}
              {analysis.experienceMatch?.evidence && <p><strong>Experience evidence:</strong> “{analysis.experienceMatch.evidence}”</p>}
              {analysis.jobProfile?.educationRequired && <p><strong>Education requirement:</strong> {analysis.jobProfile.educationRequired}</p>}
              {analysis.educationMatch?.evidence && <p><strong>Education evidence:</strong> “{analysis.educationMatch.evidence}”</p>}
              {(analysis.experienceMatch?.gaps || []).map((gap, index) => <p key={index} className="text-amber-700"><strong>Experience gap:</strong> {gap}</p>)}
            </div>
          )}

          {analysis.projects?.length > 0 && (
            <div className="text-[11px] text-gray-600 space-y-1">
              <p className="font-semibold">Relevant project evidence</p>
              {analysis.projects.map((project, index) => <p key={index}>“{project}”</p>)}
            </div>
          )}

          {evidenceOptions.length > 0 && (
            <div className="border-t border-gray-100 pt-3 space-y-2">
              <label className="block text-xs font-medium text-gray-700">Select a verified resume point to tailor</label>
              <select
                className="input text-xs"
                value={selectedEvidence}
                disabled={resumeChangedSinceMatch}
                onChange={(event) => { setSelectedEvidence(event.target.value); setSuggestedBullet(''); }}
              >
                <option value="">Choose an existing evidence quote</option>
                {evidenceOptions.map((skill) => (
                  <option key={skill.skill} value={skill.evidence}>{skill.skill}: {skill.evidence.slice(0, 100)}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn-secondary text-xs"
                disabled={!selectedEvidence || improveMutation.isPending || resumeChangedSinceMatch}
                onClick={() => improveMutation.mutate()}
              >
                <Sparkles size={12} /> {improveMutation.isPending ? 'Preparing suggestion...' : 'Suggest a factual rewrite'}
              </button>
              {suggestedBullet && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 space-y-2">
                  <p className="text-[10px] text-blue-800 flex items-center gap-1"><ShieldCheck size={12} /> Review: suggested wording may omit context. Confirm every claim is true.</p>
                  <p className="text-xs text-gray-500 line-through">{selectedEvidence}</p>
                  <p className="text-xs text-gray-900">{suggestedBullet}</p>
                  <button type="button" className="btn-primary text-xs" onClick={applySuggestionToDraft}>Approve into draft</button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {analysis && !loadingResume && resumeData?.resumeText && (
        <div className="border-t border-gray-100 pt-3 space-y-2">
          <label className="text-xs font-medium text-gray-700 flex items-center gap-1"><FileText size={12} /> Resume draft (saved text stays unchanged until you save)</label>
          <textarea
            className="input resize-y text-xs font-mono"
            rows={9}
            maxLength={100000}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button
            type="button"
            className="btn-primary text-xs"
            disabled={saveMutation.isPending || draft === resumeData.resumeText || !draft.trim()}
            onClick={() => {
              if (window.confirm('Save these approved edits to your resume?')) saveMutation.mutate();
            }}
          >
            <Save size={12} /> {saveMutation.isPending ? 'Saving...' : 'Save approved resume edits'}
          </button>
          <p className="text-[10px] text-gray-400">Only exact resume evidence is used as the source quote. Review the rewritten line and save explicitly to update your resume.</p>
        </div>
      )}
    </section>
  );
}
