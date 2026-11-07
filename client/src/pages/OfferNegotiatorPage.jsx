import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  DollarSign, Sparkles, TrendingUp, Scale, PhoneCall,
  Mail, Copy, Check, ShieldCheck, HelpCircle, ArrowRight
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../utils/api';

export default function OfferNegotiatorPage() {
  const [searchParams] = useSearchParams();
  const [company, setCompany] = useState(searchParams.get('company') || '');
  const [jobTitle, setJobTitle] = useState(searchParams.get('role') || searchParams.get('title') || '');
  const [baseSalary, setBaseSalary] = useState(130000);
  const [annualBonus, setAnnualBonus] = useState(13000);
  const [signOnBonus, setSignOnBonus] = useState(15000);
  const [equityTotal, setEquityTotal] = useState(60000);
  const [equityVestingYears, setEquityVestingYears] = useState(4);
  const [targetBase, setTargetBase] = useState(150000);
  const [strategy, setStrategy] = useState('competing_offer');
  const [competingNotes, setCompetingNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  // Load jobs that might be in Offer stage
  const { data: jobsData } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => api.get('/jobs').then((r) => r.data.jobs || []),
  });

  useEffect(() => {
    const qCompany = searchParams.get('company');
    const qRole = searchParams.get('role') || searchParams.get('title');
    if (qCompany) setCompany(qCompany);
    if (qRole) setJobTitle(qRole);
  }, [searchParams]);

  const handleSelectJob = (jobId) => {
    const job = (jobsData || []).find((j) => j._id === jobId);
    if (job) {
      setCompany(job.company || '');
      setJobTitle(job.role || job.title || '');
      if (job.salaryMin) setBaseSalary(job.salaryMin);
      else if (job.salaryMax) setBaseSalary(job.salaryMax);
      else if (job.salary) setBaseSalary(parseInt(job.salary.replace(/\D/g, '')) || 120000);
    }
  };

  const handleCalculateAndNegotiate = async (e) => {
    e.preventDefault();
    if (!company.trim() || !jobTitle.trim() || !baseSalary) {
      toast.error('Please enter company, title, and base salary');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/intel/negotiate', {
        company,
        jobTitle,
        baseSalary,
        annualBonus,
        signOnBonus,
        equityTotal,
        equityVestingYears,
        targetBase,
        strategy,
        notes: competingNotes,
      });
      setResult(res.data);
      toast.success('Generated negotiation playbook!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate negotiation strategy');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied!');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Quick calculations for display
  const annualizedEquity = equityVestingYears > 0 ? Math.round(equityTotal / equityVestingYears) : 0;
  const firstYearTC = Number(baseSalary) + Number(annualBonus) + Number(signOnBonus) + annualizedEquity;
  const recurringAnnualTC = Number(baseSalary) + Number(annualBonus) + annualizedEquity;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5 border-gray-200">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
            <DollarSign size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
              Offer Comparison & Salary Negotiation Strategist
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                AI Strategist
              </span>
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Calculate true Total Comp, avoid leaving money on the table, and generate diplomatic counter-offer scripts.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form & Inputs */}
        <div className="card p-5 border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3 border-gray-100">
            <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
              1. Offer Package Details
            </h2>
            {(jobsData || []).length > 0 && (
              <select
                onChange={(e) => handleSelectJob(e.target.value)}
                className="input !py-1 text-xs max-w-[160px]"
                defaultValue=""
              >
                <option value="" disabled>-- Load from job --</option>
                {jobsData.map((j) => (
                  <option key={j._id} value={j._id}>
                    {j.company} - {j.role || j.title} ({j.stage})
                  </option>
                ))}
              </select>
            )}
          </div>

          <form onSubmit={handleCalculateAndNegotiate} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Company</label>
              <input
                type="text"
                placeholder="e.g. Stripe"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="input"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Job Title</label>
              <input
                type="text"
                placeholder="e.g. Senior Software Engineer"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="input"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Base Salary ($)</label>
                <input
                  type="number"
                  value={baseSalary}
                  onChange={(e) => setBaseSalary(Number(e.target.value))}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Annual Bonus ($)</label>
                <input
                  type="number"
                  value={annualBonus}
                  onChange={(e) => setAnnualBonus(Number(e.target.value))}
                  className="input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Sign-on Bonus ($)</label>
                <input
                  type="number"
                  value={signOnBonus}
                  onChange={(e) => setSignOnBonus(Number(e.target.value))}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Total Equity ($)</label>
                <input
                  type="number"
                  value={equityTotal}
                  onChange={(e) => setEquityTotal(Number(e.target.value))}
                  className="input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Vesting Period (Yrs)</label>
                <input
                  type="number"
                  min="1"
                  max="6"
                  value={equityVestingYears}
                  onChange={(e) => setEquityVestingYears(Number(e.target.value))}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Target Base ($)</label>
                <input
                  type="number"
                  value={targetBase}
                  onChange={(e) => setTargetBase(Number(e.target.value))}
                  className="input"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Negotiation Strategy</label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                className="input"
              >
                <option value="competing_offer">I have a Competing Offer / Pipeline Leverage</option>
                <option value="market_rate">Market Rate & Specialized Experience Justification</option>
                <option value="non_salary_perks">Non-Salary Counter (Sign-on / Remote / Title)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Extra Context / Competing Notes</label>
              <textarea
                rows="2"
                placeholder="e.g. Other offer has $155k base from Fintech startup..."
                value={competingNotes}
                onChange={(e) => setCompetingNotes(e.target.value)}
                className="input resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5 flex items-center gap-2"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Sparkles size={16} />
                  Calculate & Generate Counter-Offer
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: TC Breakdown & Negotiation Playbook */}
        <div className="lg:col-span-2 space-y-5">
          {/* Visual Total Compensation Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-4 bg-gradient-to-br from-emerald-500 to-teal-700 text-white rounded-xl shadow-md space-y-1">
              <span className="text-xs uppercase tracking-wider text-emerald-100 font-semibold">
                Year 1 Total Compensation (TC)
              </span>
              <div className="text-3xl font-extrabold tracking-tight">
                ${firstYearTC.toLocaleString()}
              </div>
              <p className="text-[11px] text-emerald-100/90 pt-1">
                Base (${baseSalary.toLocaleString()}) + Bonus (${annualBonus.toLocaleString()}) + Sign-on (${signOnBonus.toLocaleString()}) + Equity/yr (${annualizedEquity.toLocaleString()})
              </p>
            </div>

            <div className="card p-4 bg-gray-900 text-white rounded-xl shadow-md space-y-1">
              <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold">
                Recurring Annual Compensation
              </span>
              <div className="text-3xl font-extrabold tracking-tight text-emerald-400">
                ${recurringAnnualTC.toLocaleString()}
              </div>
              <p className="text-[11px] text-gray-400 pt-1">
                Targeting <strong>${targetBase.toLocaleString()}</strong> base salary (+${(targetBase - baseSalary).toLocaleString()} increase)
              </p>
            </div>
          </div>

          {/* AI Strategy & Counter-Offer Scripts */}
          {result ? (
            <div className="space-y-4">
              {/* Strategic Assessment */}
              <div className="card p-4 border border-emerald-200 bg-emerald-50/50 rounded-xl space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-emerald-600" />
                  Negotiation Leverage Assessment
                </h3>
                <p className="text-xs text-emerald-900 leading-relaxed font-medium">
                  {result.strategicAssessment}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {result.leveragePoints?.map((point, i) => (
                    <span key={i} className="px-2.5 py-1 rounded bg-white text-emerald-800 text-xs font-semibold border border-emerald-200">
                      ✓ {point}
                    </span>
                  ))}
                </div>
              </div>

              {/* Counter-Offer Email Script */}
              <div className="card p-5 border border-gray-200 bg-white rounded-xl shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b pb-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 flex items-center gap-2">
                    <Mail size={15} className="text-primary-600" />
                    Diplomatic Counter-Offer Email Draft
                  </h3>
                  <button
                    onClick={() => handleCopy(`Subject: ${result.counterOfferEmail?.subject}\n\n${result.counterOfferEmail?.body}`, 'email')}
                    className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1 font-semibold"
                  >
                    {copiedKey === 'email' ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                    {copiedKey === 'email' ? 'Copied' : 'Copy Full Email'}
                  </button>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-xs text-gray-800 font-mono whitespace-pre-wrap leading-relaxed">
                  <span className="text-gray-400 font-sans">Subject:</span> <strong>{result.counterOfferEmail?.subject}</strong>
                  {'\n\n'}
                  {result.counterOfferEmail?.body}
                </div>
                <p className="text-[11px] text-gray-500 italic">
                  💡 Tip: {result.counterOfferEmail?.keyToneTips}
                </p>
              </div>

              {/* Recruiter Call Script */}
              <div className="card p-5 border border-gray-200 bg-white rounded-xl shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b pb-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 flex items-center gap-2">
                    <PhoneCall size={15} className="text-blue-600" />
                    Phone Call Script & Fallback Compromises
                  </h3>
                  <button
                    onClick={() => handleCopy(result.phoneScript?.opening, 'call')}
                    className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1 font-semibold"
                  >
                    {copiedKey === 'call' ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                    {copiedKey === 'call' ? 'Copied' : 'Copy Opening'}
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  <p className="font-semibold text-gray-900">What to say on the phone:</p>
                  <p className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg text-blue-950 italic">
                    "{result.phoneScript?.opening}"
                  </p>

                  <div className="pt-2">
                    <span className="font-semibold text-gray-800">If they push back or say base is fixed:</span>
                    <ul className="list-disc pl-4 text-gray-600 space-y-1 mt-1">
                      {result.phoneScript?.fallbackCompromises?.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card p-8 border border-dashed border-gray-200 text-center flex flex-col items-center justify-center gap-2 text-gray-400">
              <DollarSign size={32} className="text-gray-300" />
              <p className="text-sm font-medium text-gray-600">No calculation run yet</p>
              <p className="text-xs text-gray-400 max-w-sm">
                Fill out the offer details on the left and click "Calculate & Generate Counter-Offer" to get an analysis and scripts.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

