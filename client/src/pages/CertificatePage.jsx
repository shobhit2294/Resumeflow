import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Award, ChevronRight, Download, Check, Star, Clock, BookOpen, Code, Shield, Cloud, Smartphone, Database, TrendingUp, Link } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../utils/api';
import useAuthStore from '../context/authStore';

const FIELD_ICONS = {
  'Web Development':       <Code size={22}/>,
  'Data Science & AI':     <TrendingUp size={22}/>,
  'Cloud & DevOps':        <Cloud size={22}/>,
  'Mobile Development':    <Smartphone size={22}/>,
  'Cybersecurity':         <Shield size={22}/>,
  'Data Engineering':      <Database size={22}/>,
  'Product Management':    <BookOpen size={22}/>,
  'Blockchain':            <Link size={22}/>,
};

const DURATION_OPTIONS = [
  { months: 1,  label: '1 Month',   sub: 'Intensive', color: 'from-blue-500 to-blue-600' },
  { months: 2,  label: '2 Months',  sub: 'Professional', color: 'from-teal-500 to-teal-600' },
  { months: 3,  label: '3 Months',  sub: 'Comprehensive', color: 'from-violet-500 to-violet-600' },
  { months: 6,  label: '6 Months',  sub: 'Expert', color: 'from-amber-500 to-amber-600' },
  { months: 12, label: '1 Year',    sub: 'Mastery', color: 'from-red-500 to-red-600' },
];

const FIELD_GRADIENTS = [
  'from-blue-500 to-blue-700',
  'from-violet-500 to-purple-700',
  'from-emerald-500 to-teal-700',
  'from-red-500 to-rose-700',
  'from-slate-600 to-slate-800',
  'from-amber-500 to-orange-600',
  'from-cyan-500 to-teal-600',
  'from-indigo-500 to-blue-700',
];

export default function CertificatePage() {
  const [step, setStep]             = useState(1); // 1=field, 2=track, 3=duration, 4=preview
  const [selectedField, setSelectedField] = useState(null);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [selectedDuration, setSelectedDuration] = useState(null);
  const [recipientName, setRecipientName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated]   = useState(false);
  const { user } = useAuthStore();

  const { data: fieldsData } = useQuery({
    queryKey: ['cert-fields'],
    queryFn: () => api.get('/certificate/fields').then(r => r.data),
  });

  const { data: tracksData } = useQuery({
    queryKey: ['cert-tracks', selectedField?.field],
    queryFn: () => api.get(`/certificate/tracks/${encodeURIComponent(selectedField.field)}`).then(r => r.data),
    enabled: !!selectedField,
  });

  const fields = fieldsData?.fields || [];
  const tracks = tracksData?.tracks || {};

  const generateCertificate = async () => {
    setGenerating(true);
    try {
      const response = await fetch('/api/certificate/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          field:         selectedField.field,
          track:         selectedTrack,
          duration:      selectedDuration,
          recipientName: recipientName || user?.name,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to generate');
      }

      const blob = await response.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `certificate-${selectedTrack.replace(/\s+/g, '-').toLowerCase()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setGenerated(true);
      toast.success('Certificate downloaded!');
    } catch (err) {
      toast.error(err.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const reset = () => {
    setStep(1); setSelectedField(null); setSelectedTrack(null);
    setSelectedDuration(null); setGenerated(false); setRecipientName('');
  };

  // Step labels
  const STEPS = ['Choose Field', 'Choose Track', 'Duration', 'Generate'];

  return (
    <div className="min-h-full bg-gradient-to-br from-gray-50 via-white to-primary-50/30 p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl mb-4 shadow-lg shadow-primary-100">
            <Award size={30} className="text-white"/>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Certificate Portal</h1>
          <p className="text-gray-500 mt-1.5">Generate a professional completion certificate for any tech field</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-0 mb-8">
          {STEPS.map((label, i) => {
            const stepNum = i + 1;
            const isDone = step > stepNum;
            const isActive = step === stepNum;
            return (
              <div key={label} className="flex items-center">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isDone ? 'bg-primary-100 text-primary-700' :
                  isActive ? 'bg-primary-400 text-white shadow-sm' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  {isDone ? <Check size={12}/> : <span>{stepNum}</span>}
                  <span className="hidden sm:inline">{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <ChevronRight size={14} className={`mx-1 ${step > stepNum ? 'text-primary-400' : 'text-gray-300'}`}/>
                )}
              </div>
            );
          })}
        </div>

        {/* ── STEP 1: Choose Field ── */}
        {step === 1 && (
          <div className="animate-fade-in">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 text-center">Choose your field</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {fields.map((f, idx) => (
                <button key={f.field} onClick={() => { setSelectedField(f); setStep(2); }}
                  className="group relative overflow-hidden rounded-2xl p-5 text-left transition-all hover:scale-105 hover:shadow-lg active:scale-100 border border-white/20"
                  style={{ background: `linear-gradient(135deg, rgb(${f.color?.[0]},${f.color?.[1]},${f.color?.[2]}), rgb(${Math.max(0,f.color?.[0]-30)},${Math.max(0,f.color?.[1]-30)},${Math.max(0,f.color?.[2]-30)}))` }}
                >
                  <div className="text-white/90 mb-3 text-2xl">{f.icon}</div>
                  <p className="text-white font-semibold text-sm leading-tight">{f.field}</p>
                  <p className="text-white/60 text-xs mt-1">{f.tracks.length} tracks</p>
                  <ChevronRight size={14} className="absolute bottom-4 right-4 text-white/40 group-hover:text-white/80 transition-all group-hover:translate-x-1"/>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 2: Choose Track ── */}
        {step === 2 && selectedField && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setStep(1)} className="text-sm text-gray-400 hover:text-gray-600">← Back</button>
              <span className="text-gray-300">/</span>
              <span className="text-sm font-medium text-gray-700">{selectedField.field}</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Choose your track</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(tracks).map(([track, data]) => (
                <button key={track} onClick={() => { setSelectedTrack(track); setStep(3); }}
                  className="group card p-4 text-left hover:shadow-md hover:border-primary-200 transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 text-sm">{track}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {data.skills.map(s => (
                          <span key={s} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{s}</span>
                        ))}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-400 flex-shrink-0 mt-0.5 transition-all group-hover:translate-x-0.5"/>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 3: Duration ── */}
        {step === 3 && selectedTrack && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setStep(2)} className="text-sm text-gray-400 hover:text-gray-600">← Back</button>
              <span className="text-gray-300">/</span>
              <span className="text-sm font-medium text-gray-700">{selectedTrack}</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Choose program duration</h2>
            <p className="text-sm text-gray-400 mb-5">The certificate will show the completion date based on duration</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              {DURATION_OPTIONS.map(d => (
                <button key={d.months} onClick={() => setSelectedDuration(d.months)}
                  className={`relative rounded-2xl p-4 text-center transition-all hover:scale-105 ${
                    selectedDuration === d.months ? 'ring-2 ring-primary-400 shadow-lg scale-105' : 'bg-white border border-gray-200 hover:border-gray-300'
                  }`}>
                  <div className={`w-10 h-10 mx-auto rounded-xl mb-2 flex items-center justify-center bg-gradient-to-br ${d.color}`}>
                    <Clock size={18} className="text-white"/>
                  </div>
                  <p className={`font-bold text-sm ${selectedDuration === d.months ? 'text-primary-700' : 'text-gray-900'}`}>{d.label}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{d.sub}</p>
                  {selectedDuration === d.months && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-primary-400 rounded-full flex items-center justify-center">
                      <Check size={11} className="text-white"/>
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Name input */}
            <div className="card p-4 mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Certificate recipient name <span className="text-gray-400">(defaults to your profile name)</span>
              </label>
              <input className="input text-sm" placeholder={user?.name || 'Your full name'}
                value={recipientName} onChange={e => setRecipientName(e.target.value)}/>
            </div>

            <button onClick={() => setStep(4)} disabled={!selectedDuration}
              className="btn-primary w-full justify-center py-3 text-sm disabled:opacity-40">
              Preview certificate <ChevronRight size={15}/>
            </button>
          </div>
        )}

        {/* ── STEP 4: Preview + Generate ── */}
        {step === 4 && (
          <div className="animate-fade-in space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => setStep(3)} className="text-sm text-gray-400 hover:text-gray-600">← Back</button>
            </div>

            {/* Certificate preview card */}
            <div className="relative overflow-hidden rounded-2xl shadow-2xl"
              style={{ background: `linear-gradient(135deg, rgb(${selectedField.color?.[0]},${selectedField.color?.[1]},${selectedField.color?.[2]}), rgb(${Math.max(0,selectedField.color?.[0]-40)},${Math.max(0,selectedField.color?.[1]-40)},${Math.max(0,selectedField.color?.[2]-40)}))` }}>

              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10" style={{ background:'rgba(255,255,255,0.3)', transform:'translate(30%,-30%)' }}/>
              <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-10" style={{ background:'rgba(255,255,255,0.2)', transform:'translate(-30%,30%)' }}/>

              <div className="relative p-10 text-center">
                {/* Icon */}
                <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-4 text-3xl">
                  {selectedField.icon}
                </div>

                <p className="text-white/70 text-xs tracking-widest uppercase mb-1">ResumeFlow Academy</p>
                <h2 className="text-white text-3xl font-bold mb-1">Certificate of Completion</h2>
                <p className="text-white/70 text-sm mb-4">This is to certify that</p>

                <p className="text-white text-4xl font-bold mb-1">{recipientName || user?.name || 'Your Name'}</p>
                <div className="w-48 h-px bg-white/30 mx-auto mb-4"/>

                <p className="text-white/80 text-sm mb-1">has successfully completed</p>
                <p className="text-white text-xl font-semibold mb-1">{selectedTrack}</p>
                <p className="text-white/70 text-sm mb-6">
                  {DURATION_OPTIONS.find(d => d.months === selectedDuration)?.label} {DURATION_OPTIONS.find(d=>d.months===selectedDuration)?.sub} Program in {selectedField.field}
                </p>

                {/* Skills row */}
                <div className="flex flex-wrap gap-2 justify-center mb-6">
                  {(tracks[selectedTrack]?.skills || []).map(s => (
                    <span key={s} className="bg-white/20 text-white text-xs px-3 py-1 rounded-full font-medium border border-white/20">{s}</span>
                  ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-white/20">
                  <div className="text-left">
                    <p className="text-white/50 text-[10px]">Issue Date</p>
                    <p className="text-white text-xs font-medium">{new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</p>
                  </div>
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center border-2 border-white/40">
                    <Award size={20} className="text-white"/>
                  </div>
                  <div className="text-right">
                    <p className="text-white/50 text-[10px]">Program</p>
                    <p className="text-white text-xs font-medium">{DURATION_OPTIONS.find(d=>d.months===selectedDuration)?.label}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Details summary */}
            <div className="card p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {[
                ['Field', selectedField.field],
                ['Track', selectedTrack],
                ['Duration', `${DURATION_OPTIONS.find(d=>d.months===selectedDuration)?.label} Program`],
                ['Recipient', recipientName || user?.name || '—'],
              ].map(([l, v]) => (
                <div key={l}>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">{l}</p>
                  <p className="font-medium text-gray-900 text-xs">{v}</p>
                </div>
              ))}
            </div>

            {/* Info box */}
            <div className="flex items-start gap-3 p-4 bg-primary-50 border border-primary-100 rounded-xl">
              <Award size={18} className="text-primary-600 flex-shrink-0 mt-0.5"/>
              <div className="text-sm text-primary-800">
                <p className="font-medium mb-0.5">Your certificate includes</p>
                <p className="text-primary-700 text-xs">A unique certificate ID, QR code for verification, skill badges, issue date, completion date, and official signatures — all in a professional A4 landscape PDF.</p>
              </div>
            </div>

            {generated ? (
              <div className="flex flex-col items-center gap-3 p-6 bg-green-50 border border-green-100 rounded-2xl text-center">
                <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center">
                  <Check size={28} className="text-green-600"/>
                </div>
                <p className="font-semibold text-green-800">Certificate downloaded!</p>
                <p className="text-sm text-green-600">Check your downloads folder</p>
                <div className="flex gap-3 mt-2">
                  <button onClick={generateCertificate} className="btn-secondary text-sm flex items-center gap-1.5">
                    <Download size={14}/> Download again
                  </button>
                  <button onClick={reset} className="btn-primary text-sm">Generate another</button>
                </div>
              </div>
            ) : (
              <button onClick={generateCertificate} disabled={generating}
                className="w-full py-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg shadow-primary-100 disabled:opacity-60 text-base">
                {generating ? (
                  <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Generating your certificate...</>
                ) : (
                  <><Download size={18}/> Download Certificate (PDF)</>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}