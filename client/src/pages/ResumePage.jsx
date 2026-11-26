import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Upload, Zap, Download, Save, Sparkles, CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../utils/api';

export default function ResumePage() {
  const location = useLocation();
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [selectedJob, setSelectedJob] = useState('');
  const [bulletInput, setBulletInput] = useState('');
  const [improvedBullet, setImprovedBullet] = useState('');
  const [improvingBullet, setImprovingBullet] = useState(false);
  const [tailorContext, setTailorContext] = useState(null);
  const [tailoredResume, setTailoredResume] = useState('');
  const [tailorMeta, setTailorMeta] = useState(null);
  const [tailoring, setTailoring] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [savingTailored, setSavingTailored] = useState(false);
  const fileRef = useRef();

  const { data: statusData, refetch: refetchStatus } = useQuery({
    queryKey: ['resume-status'],
    queryFn: () => api.get('/resume').then(r => r.data),
  });
  const { data: jobsData } = useQuery({ queryKey: ['jobs'], queryFn: () => api.get('/jobs').then(r => r.data) });
  const { data: resumeContent, refetch: refetchContent } = useQuery({
    queryKey: ['resume-content'],
    queryFn: () => api.get('/resume/content').then(r => r.data),
  });

  useEffect(() => {
    if (location.state?.jobDescription) {
      setTailorContext(location.state);
      setTailoredResume('');
      setTailorMeta(null);
    }
  }, [location.state]);

  const uploadMutation = useMutation({
    mutationFn: (file) => {
      const fd = new FormData();
      fd.append('resume', file);
      return api.post('/resume/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => { toast.success('Resume uploaded!'); refetchStatus(); },
    onError: (e) => toast.error(e.response?.data?.error || 'Upload failed'),
  });

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const res = await api.post('/resume/analyze', { jobId: selectedJob || undefined });
      setAnalysis(res.data.analysis);
      toast.success('Analysis complete!');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleImproveBullet = async () => {
    if (!bulletInput.trim()) return;
    setImprovingBullet(true);
    try {
      const res = await api.post('/resume/improve', { bullet: bulletInput });
      setImprovedBullet(res.data.improved);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to improve bullet');
    } finally {
      setImprovingBullet(false);
    }
  };

  const handleTailorResume = async () => {
    setTailoring(true);
    try {
      const res = await api.post('/resume/tailor', {
        jobTitle: tailorContext.role,
        company: tailorContext.company,
        jobDescription: tailorContext.jobDescription,
        missingSkills: tailorContext.missingSkills,
      });
      setTailoredResume(res.data.updatedResume);
      setTailorMeta(res.data);
      toast.success('Tailored resume draft created. Review it before saving or downloading.');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Could not tailor the resume');
    } finally {
      setTailoring(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!tailoredResume.trim()) return;
    setDownloadingPdf(true);
    try {
      const response = await api.post('/resume/pdf', {
        resumeText: tailoredResume,
        title: `${tailorContext?.company || 'Resume'} - ${tailorContext?.role || 'Tailored Resume'}`,
      }, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(tailorContext?.company || 'resume').replace(/[^a-z0-9_-]/gi, '_')}_tailored_resume.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('PDF download started');
    } catch (e) {
      toast.error('Could not create the PDF download');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleSaveTailored = async () => {
    if (!tailoredResume.trim() || typeof resumeContent?.resumeText !== 'string') return;
    setSavingTailored(true);
    try {
      await api.put('/resume/content', {
        currentText: resumeContent.resumeText,
        updatedText: tailoredResume,
      });
      await Promise.all([refetchContent(), refetchStatus()]);
      toast.success('Tailored resume saved as your main resume');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Could not save the tailored resume');
    } finally {
      setSavingTailored(false);
    }
  };

  const ScoreIcon = ({ score }) => {
    if (score >= 75) return <CheckCircle2 size={14} className="text-primary-500" />;
    if (score >= 55) return <AlertTriangle size={14} className="text-amber-500" />;
    return <XCircle size={14} className="text-red-500" />;
  };

  const scoreColor = (s) => s >= 75 ? 'bg-primary-400' : s >= 55 ? 'bg-amber-400' : 'bg-red-400';

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="font-semibold text-gray-900">Resume AI</h1>
        <p className="text-xs text-gray-400 mt-0.5">Upload your resume and get AI-powered scoring and improvement tips</p>
      </div>

      {/* Upload card */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Your resume</h3>
          {statusData?.hasResume && (
            <span className="text-xs bg-primary-50 text-primary-700 px-2.5 py-1 rounded-full border border-primary-100">
              ✓ Uploaded ({Math.round(statusData.length / 1000)}k chars)
            </span>
          )}
        </div>

        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-primary-300 hover:bg-primary-50/30 transition-all"
        >
          <Upload size={24} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-600">
            {statusData?.hasResume ? 'Replace resume' : 'Upload resume'}
          </p>
          <p className="text-xs text-gray-400 mt-1">PDF or TXT · Max 5MB</p>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt"
            className="hidden"
            onChange={(e) => e.target.files[0] && uploadMutation.mutate(e.target.files[0])}
          />
        </div>

        {uploadMutation.isPending && (
          <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
            <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
            Uploading...
          </div>
        )}
      </div>

      {/* JD-tailored resume card */}
      {tailorContext && (
        <div className="card p-5 space-y-4 border-primary-200">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Sparkles size={15} className="text-primary-600" /> Tailor resume for {tailorContext.role}
              </h3>
              <p className="text-xs text-gray-500 mt-1">{tailorContext.company} · Review every change before saving or downloading.</p>
            </div>
            {!tailoredResume && (
              <button onClick={handleTailorResume} disabled={tailoring || !statusData?.hasResume} className="btn-primary text-xs whitespace-nowrap">
                {tailoring ? 'Creating draft...' : 'Create updated resume'}
              </button>
            )}
          </div>

          {!statusData?.hasResume && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-3">Upload your resume first, then return here to create the tailored version.</p>
          )}

          {tailorContext.missingSkills?.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
              <p className="text-xs font-semibold text-amber-900 mb-1">Gaps identified from the JD</p>
              <p className="text-xs text-amber-800">{tailorContext.missingSkills.join(' · ')}</p>
            </div>
          )}

          {tailoredResume && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Updated resume draft</label>
                <textarea className="input resize-y text-xs font-mono" rows={18} value={tailoredResume} onChange={(e) => setTailoredResume(e.target.value)} />
              </div>

              {tailorMeta?.gapsToLearn?.length > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                  <p className="text-xs font-semibold text-blue-900 mb-1">Skills to learn before claiming</p>
                  {tailorMeta.gapsToLearn.map((gap, index) => <p key={index} className="text-xs text-blue-800">· {gap}</p>)}
                </div>
              )}

              {tailorMeta?.changes?.length > 0 && (
                <div className="text-xs text-gray-600">
                  <p className="font-semibold text-gray-700 mb-1">Changes made</p>
                  {tailorMeta.changes.map((change, index) => <p key={index}>· {change}</p>)}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button onClick={handleSaveTailored} disabled={savingTailored} className="btn-primary text-xs">
                  <Save size={13} /> {savingTailored ? 'Saving...' : 'Save as main resume'}
                </button>
                <button onClick={handleDownloadPdf} disabled={downloadingPdf} className="btn-secondary text-xs">
                  <Download size={13} /> {downloadingPdf ? 'Preparing PDF...' : 'Download PDF'}
                </button>
                <button onClick={handleTailorResume} disabled={tailoring} className="btn-secondary text-xs">
                  <RefreshCw size={13} /> Regenerate draft
                </button>
              </div>
              <p className="text-[10px] text-gray-400">Unsupported skills are shown as learning gaps and are never added as false experience.</p>
            </>
          )}
        </div>
      )}

      {/* Analyze card */}
      {statusData?.hasResume && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Analyze resume</h3>
          <div className="flex gap-3 mb-4">
            <select
              className="input flex-1 text-sm"
              value={selectedJob}
              onChange={e => setSelectedJob(e.target.value)}
            >
              <option value="">General software engineering</option>
              {jobsData?.jobs?.filter(j => j.jobDescription).map(j => (
                <option key={j._id} value={j._id}>{j.role} at {j.company}</option>
              ))}
            </select>
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="btn-primary whitespace-nowrap"
            >
              {analyzing
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analyzing...</>
                : <><Zap size={14} /> Analyze</>}
            </button>
          </div>

          {analysis && (
            <div className="space-y-5 animate-fade-in">
              {/* Overall score */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <div className="text-4xl font-bold text-primary-600">{analysis.overallScore}</div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Overall score</p>
                  <p className="text-xs text-gray-500 mt-0.5">{analysis.summary}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${analysis.atsCompatible ? 'bg-primary-100 text-primary-700' : 'bg-red-100 text-red-700'}`}>
                      {analysis.atsCompatible ? '✓ ATS-compatible' : '✗ ATS issues detected'}
                    </span>
                    <span className="text-xs text-gray-400">Format score: {analysis.formattingScore}%</span>
                  </div>
                </div>
              </div>

              {/* Skill scores */}
              <div>
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">Skill match</p>
                <div className="space-y-2.5">
                  {analysis.skillScores?.map(s => (
                    <div key={s.skill}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <ScoreIcon score={s.score} />
                          <span className="text-xs text-gray-700">{s.skill}</span>
                          {!s.found && <span className="text-[10px] text-gray-400">(not found in resume)</span>}
                        </div>
                        <span className="text-xs font-medium text-gray-500">{s.score}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full">
                        <div className={`h-full rounded-full transition-all ${scoreColor(s.score)}`} style={{ width: `${s.score}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Strengths & improvements */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Strengths</p>
                  <ul className="space-y-1.5">
                    {analysis.strengths?.map((s, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                        <span className="text-primary-500 mt-0.5">✓</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Improvements</p>
                  <ul className="space-y-1.5">
                    {analysis.improvements?.map((s, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                        <span className="text-amber-500 mt-0.5">→</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Missing keywords */}
              {analysis.keywordsMissing?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Missing keywords</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.keywordsMissing.map(k => (
                      <span key={k} className="text-xs bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded-full">{k}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {analysis.suggestions?.length > 0 && (
                <div className="p-4 bg-primary-50 rounded-xl border border-primary-100">
                  <p className="text-xs font-semibold text-primary-800 mb-2">Quick wins</p>
                  <ul className="space-y-1">
                    {analysis.suggestions.map((s, i) => (
                      <li key={i} className="text-xs text-primary-700 flex items-start gap-1.5">
                        <span className="mt-0.5">{i + 1}.</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bullet improver */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Bullet point improver</h3>
        <p className="text-xs text-gray-400 mb-4">
          Paste a bullet for an evidence-preserving rewrite. Review and approve the suggestion before copying it into your resume; new metrics and claims are never added.
        </p>
        <textarea
          className="input resize-none text-sm mb-3"
          rows={2}
          placeholder='e.g. "Worked on the backend team and improved performance"'
          value={bulletInput}
          onChange={e => setBulletInput(e.target.value)}
        />
        <button
          onClick={handleImproveBullet}
          disabled={!bulletInput.trim() || improvingBullet}
          className="btn-primary"
        >
          {improvingBullet
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Improving...</>
            : <><RefreshCw size={14} /> Improve bullet</>}
        </button>

        {improvedBullet && (
          <div className="mt-3 p-3 bg-primary-50 border border-primary-100 rounded-xl animate-fade-in">
            <p className="text-xs text-primary-600 font-medium mb-1">Improved:</p>
            <p className="text-sm text-primary-900">{improvedBullet}</p>
            <button
              onClick={() => { navigator.clipboard.writeText(improvedBullet); toast.success('Copied!'); }}
              className="text-xs text-primary-600 hover:underline mt-2"
            >
              Copy to clipboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
