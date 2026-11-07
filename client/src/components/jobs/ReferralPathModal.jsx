import { useState } from 'react';
import {
  X, Sparkles, Send, Copy, Check, Users, MessageSquare,
  Coffee, Briefcase, ChevronRight, HelpCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../utils/api';

export default function ReferralPathModal({ job, onClose }) {
  const [contactType, setContactType] = useState('alumni');
  const [mutualContext, setMutualContext] = useState('');
  const [targetPersonName, setTargetPersonName] = useState('Alex');
  const [activeTab, setActiveTab] = useState('coffee'); // 'coffee' | 'referral' | 'manager'
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  const role = job.role || job.title || 'Software Engineer';
  const company = job.company || 'Company';

  const handleGenerate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/intel/referral-pitch', {
        company,
        role,
        contactType,
        mutualContext: mutualContext || `Targeting ${role} at ${company}`,
        targetPersonName: targetPersonName || 'there',
      });
      setData(res.data);
      toast.success('Generated tailored referral outreach!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate referral outreach');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-gray-100 overflow-hidden my-8 animate-fade-in">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-gray-900 via-primary-950 to-gray-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center text-primary-400">
              <Users size={18} />
            </div>
            <div>
              <h2 className="font-semibold text-base leading-tight">Warm Referral & Backchannel Pathmaker</h2>
              <p className="text-xs text-gray-400 mt-0.5">{role} at {company} (35%+ higher interview rate)</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Context Form */}
          <form onSubmit={handleGenerate} className="card p-4 border border-gray-200/90 bg-gray-50/70 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Target Contact Type</label>
                <select
                  value={contactType}
                  onChange={(e) => setContactType(e.target.value)}
                  className="input text-xs"
                >
                  <option value="alumni">College / Bootcamp Alumni</option>
                  <option value="former_colleague">Ex-Colleague / Past Company</option>
                  <option value="second_degree">2nd Degree LinkedIn Connection</option>
                  <option value="cold_manager">Direct Engineering Manager</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Their First Name</label>
                <input
                  type="text"
                  value={targetPersonName}
                  onChange={(e) => setTargetPersonName(e.target.value)}
                  placeholder="e.g. Alex"
                  className="input text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Mutual Background / Context (Optional)
              </label>
              <input
                type="text"
                value={mutualContext}
                onChange={(e) => setMutualContext(e.target.value)}
                placeholder="e.g. Both graduated from Georgia Tech / Both worked at VMware..."
                className="input text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2 text-xs flex items-center gap-1.5"
            >
              {loading ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Sparkles size={14} />
                  Generate High-Conversion Outreach
                </>
              )}
            </button>
          </form>

          {/* Results */}
          {data && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2">
                <HelpCircle size={15} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Tactical Advice: </strong>
                  {data.targetStrategyTip}
                </div>
              </div>

              {/* Tabs */}
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="flex border-b border-gray-200 bg-gray-50/80">
                  <button
                    onClick={() => setActiveTab('coffee')}
                    className={`flex-1 py-2 px-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      activeTab === 'coffee'
                        ? 'bg-white text-primary-700 border-b-2 border-primary-600 -mb-px'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    <Coffee size={13} />
                    1. 10-Min Coffee Chat
                  </button>
                  <button
                    onClick={() => setActiveTab('referral')}
                    className={`flex-1 py-2 px-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      activeTab === 'referral'
                        ? 'bg-white text-primary-700 border-b-2 border-primary-600 -mb-px'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    <Briefcase size={13} />
                    2. Direct Referral Ask
                  </button>
                  <button
                    onClick={() => setActiveTab('manager')}
                    className={`flex-1 py-2 px-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      activeTab === 'manager'
                        ? 'bg-white text-primary-700 border-b-2 border-primary-600 -mb-px'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    <Users size={13} />
                    3. Manager Value Pitch
                  </button>
                </div>

                <div className="p-4 bg-white space-y-3">
                  {activeTab === 'coffee' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Low-friction chat request</span>
                        <button
                          onClick={() => handleCopy(`Subject: ${data.coffeeChatRequest?.subject}\n\n${data.coffeeChatRequest?.message}`, 'coffee')}
                          className="text-primary-600 hover:text-primary-800 flex items-center gap-1 font-medium text-xs"
                        >
                          {copiedKey === 'coffee' ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                          {copiedKey === 'coffee' ? 'Copied' : 'Copy Message'}
                        </button>
                      </div>
                      <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-xs text-gray-800 font-mono whitespace-pre-wrap leading-relaxed">
                        <span className="text-gray-400 font-sans">Subject:</span> <strong>{data.coffeeChatRequest?.subject}</strong>
                        {'\n\n'}
                        {data.coffeeChatRequest?.message}
                      </div>
                    </div>
                  )}

                  {activeTab === 'referral' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Includes 2 copy-paste bullets for their internal form</span>
                        <button
                          onClick={() => handleCopy(`Subject: ${data.directReferralAsk?.subject}\n\n${data.directReferralAsk?.message}`, 'referral')}
                          className="text-primary-600 hover:text-primary-800 flex items-center gap-1 font-medium text-xs"
                        >
                          {copiedKey === 'referral' ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                          {copiedKey === 'referral' ? 'Copied' : 'Copy Message'}
                        </button>
                      </div>
                      <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-xs text-gray-800 font-mono whitespace-pre-wrap leading-relaxed">
                        <span className="text-gray-400 font-sans">Subject:</span> <strong>{data.directReferralAsk?.subject}</strong>
                        {'\n\n'}
                        {data.directReferralAsk?.message}
                      </div>
                    </div>
                  )}

                  {activeTab === 'manager' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Bypasses HR with a direct value hook</span>
                        <button
                          onClick={() => handleCopy(`Subject: ${data.hiringManagerDM?.subject}\n\n${data.hiringManagerDM?.message}`, 'manager')}
                          className="text-primary-600 hover:text-primary-800 flex items-center gap-1 font-medium text-xs"
                        >
                          {copiedKey === 'manager' ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                          {copiedKey === 'manager' ? 'Copied' : 'Copy Message'}
                        </button>
                      </div>
                      <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-xs text-gray-800 font-mono whitespace-pre-wrap leading-relaxed">
                        <span className="text-gray-400 font-sans">Subject:</span> <strong>{data.hiringManagerDM?.subject}</strong>
                        {'\n\n'}
                        {data.hiringManagerDM?.message}
                      </div>
                    </div>
                  )}

                  {/* 4-Day Follow-Up Nudge */}
                  {data.followUpNudge && (
                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
                      <span><strong>4-Day Polite Bump:</strong> "{data.followUpNudge}"</span>
                      <button
                        onClick={() => handleCopy(data.followUpNudge, 'nudge')}
                        className="text-primary-600 hover:text-primary-800 ml-2 font-medium"
                      >
                        {copiedKey === 'nudge' ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200/80 flex items-center justify-end">
          <button onClick={onClose} className="btn-secondary !py-1.5 text-xs">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

