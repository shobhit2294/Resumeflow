import { useState, useEffect } from 'react';
import { X, Sparkles, Copy, Check, Target, Send, Linkedin, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../utils/api';

export default function ProofPitchModal({ job, onClose }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('full'); // 'full' | 'linkedin'
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchPitch = async () => {
      setLoading(true);
      try {
        const title = job.role || job.title || 'Role';
        const res = await api.post('/intel/proof-pitch', {
          jobTitle: title,
          company: job.company || 'Company',
          jobDescription: job.jobDescription || job.description || `${title} at ${job.company}. Requirements: ${(job.requirements || []).join(', ')}`,
        });
        setData(res.data);
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to generate proof pitch');
      } finally {
        setLoading(false);
      }
    };
    fetchPitch();
  }, [job]);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-gray-100 overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-gray-900 via-primary-950 to-gray-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center text-primary-400">
              <Target size={18} />
            </div>
            <div>
              <h2 className="font-semibold text-base leading-tight">3-Point Proof Pitch (Modern Cover Letter)</h2>
              <p className="text-xs text-gray-400 mt-0.5">{job.role || job.title} · {job.company}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-gray-500 font-medium">Matching JD pain-points with verified resume proof...</p>
            </div>
          ) : data ? (
            <div className="space-y-5">
              {/* Proof Points Cards */}
              <div>
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2.5">
                  Verified Proof Matches
                </p>
                <div className="space-y-2">
                  {data.painPointsAndProof?.map((item, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 border border-gray-200/80 rounded-xl text-xs space-y-1">
                      <div className="flex items-start gap-1.5 text-gray-800 font-medium">
                        <span className="w-4 h-4 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span>They Need: <strong className="text-gray-900">{item.companyNeed}</strong></span>
                      </div>
                      <div className="pl-5 text-gray-600">
                        <span>Your Proof: </span>
                        <span className="text-primary-800 font-medium">{item.candidateProof}</span>
                      </div>
                      {item.impact && (
                        <div className="pl-5 text-emerald-700 font-semibold text-[11px]">
                          ⚡ Impact: {item.impact}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Tabs for formats */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex border-b border-gray-200 bg-gray-50/80">
                  <button
                    onClick={() => setActiveTab('full')}
                    className={`flex-1 py-2.5 px-4 text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                      activeTab === 'full'
                        ? 'bg-white text-primary-700 border-b-2 border-primary-600 -mb-px'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    <FileText size={14} />
                    Full Outreach Email (150 words)
                  </button>
                  <button
                    onClick={() => setActiveTab('linkedin')}
                    className={`flex-1 py-2.5 px-4 text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                      activeTab === 'linkedin'
                        ? 'bg-white text-primary-700 border-b-2 border-primary-600 -mb-px'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    <Linkedin size={14} />
                    LinkedIn Connection DM
                  </button>
                </div>

                <div className="p-4 bg-white space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{data.headline || 'Ready to send'}</span>
                    <button
                      onClick={() => handleCopy(activeTab === 'full' ? data.fullPitch : data.shortLinkedInDM)}
                      className="text-primary-600 hover:text-primary-800 flex items-center gap-1 font-medium transition-colors"
                    >
                      {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                      {copied ? 'Copied' : 'Copy Message'}
                    </button>
                  </div>

                  <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-xs text-gray-800 font-mono whitespace-pre-wrap leading-relaxed">
                    {activeTab === 'full' ? data.fullPitch : data.shortLinkedInDM}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200/80 flex items-center justify-end">
          <button onClick={onClose} className="btn-secondary !py-1.5 text-xs">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

