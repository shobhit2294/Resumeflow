import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from 'recharts';
import {
  TrendingUp, Target, Clock, DollarSign, Zap, AlertCircle,
  ShieldAlert, Sparkles, CheckCircle2, ArrowRight
} from 'lucide-react';
import api from '../utils/api';
import { STAGE_COLORS } from '../utils/constants';

const STAGE_CHART_COLORS = {
  Applied: '#85B7EB', Screening: '#EF9F27',
  Interview: '#5DCAA5', Offer: '#97C459', Rejected: '#F09595', Withdrawn: '#B4B2A9',
};

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: () => api.get('/analytics/overview').then((r) => r.data),
  });

  const { data: insightsData } = useQuery({
    queryKey: ['insights'],
    queryFn: () => api.get('/analytics/insights').then((r) => r.data),
  });

  const { data: benchmarkData } = useQuery({
    queryKey: ['funnel-benchmarks'],
    queryFn: () => api.get('/analytics/funnel-benchmarks').then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const d = data || {};
  const stageData = Object.entries(d.byStage || {}).map(([name, value]) => ({ name, value }));
  const sourceData = Object.entries(d.bySource || {}).map(([name, value]) => ({ name, value }));

  const stats = [
    { label: 'Total applied', value: d.total || 0, icon: Target, color: 'text-blue-600 bg-blue-50' },
    { label: 'Response rate', value: `${d.responseRate || 0}%`, icon: TrendingUp, color: 'text-primary-600 bg-primary-50' },
    { label: 'Offer rate', value: `${d.offerRate || 0}%`, icon: Zap, color: 'text-green-600 bg-green-50' },
    { label: 'Avg response', value: d.avgResponseTime ? `${d.avgResponseTime}d` : '—', icon: Clock, color: 'text-amber-600 bg-amber-50' },
    { label: 'Avg salary', value: d.avgSalary ? `$${Math.round(d.avgSalary / 1000)}k` : '—', icon: DollarSign, color: 'text-violet-600 bg-violet-50' },
    { label: 'AI interviews', value: d.totalInterviews || 0, icon: AlertCircle, color: 'text-rose-600 bg-rose-50' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="font-semibold text-gray-900">Analytics</h1>
        <p className="text-xs text-gray-400 mt-0.5">Your job search at a glance</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${color}`}>
              <Icon size={15} />
            </div>
            <p className="text-xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Application funnel */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Application funnel</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stageData} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {stageData.map((entry) => (
                  <Cell key={entry.name} fill={STAGE_CHART_COLORS[entry.name] || '#ccc'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Source breakdown */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Applications by source</h3>
          {sourceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={sourceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}
                  labelLine={false}
                >
                  {sourceData.map((_, i) => (
                    <Cell key={i} fill={['#85B7EB','#5DCAA5','#EF9F27','#F09595','#9FE1CB','#B5D4F4'][i % 6]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm text-gray-400">No data yet</div>
          )}
        </div>
      </div>

      {/* Weekly applications */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Applications per week (last 8 weeks)</h3>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={d.weeklyApplications || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="week" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Line type="monotone" dataKey="count" stroke="#1D9E75" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Funnel Conversion Benchmark & Bottleneck Diagnostic */}
      {benchmarkData && (
        <div className="card p-5 border border-gray-200/90 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 border-gray-100">
            <div>
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Target size={16} className="text-primary-600" />
                Funnel Conversion Diagnostic vs. Tech Industry Benchmarks
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Pinpoint exactly where your applications are dropping off: Resume vs. Phone Screen vs. Tech Loop
              </p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
              benchmarkData.bottleneck === 'healthy'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}>
              {benchmarkData.bottleneck === 'healthy' ? 'Pipeline Healthy' : 'Bottleneck Detected'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Stage 1: Applied -> Screening */}
            <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-gray-700">1. Applied → Screening</span>
                <span className="text-[10px] text-gray-400">Benchmark: {benchmarkData.benchmarks?.appliedToScreening}%</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">{benchmarkData.userRates?.appliedToScreening}%</span>
                <span className={`text-xs font-semibold ${
                  (benchmarkData.userRates?.appliedToScreening || 0) >= (benchmarkData.benchmarks?.appliedToScreening || 12)
                    ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {(benchmarkData.userRates?.appliedToScreening || 0) >= (benchmarkData.benchmarks?.appliedToScreening || 12) ? '✓ On Track' : '⚠️ Below Avg'}
                </span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full"
                  style={{ width: `${Math.min(100, (benchmarkData.userRates?.appliedToScreening || 0) * 3)}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-500">Measures resume match & ATS pass rate</p>
            </div>

            {/* Stage 2: Screening -> Interview */}
            <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-gray-700">2. Screening → Interview</span>
                <span className="text-[10px] text-gray-400">Benchmark: {benchmarkData.benchmarks?.screeningToInterview}%</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">{benchmarkData.userRates?.screeningToInterview}%</span>
                <span className={`text-xs font-semibold ${
                  (benchmarkData.userRates?.screeningToInterview || 0) >= (benchmarkData.benchmarks?.screeningToInterview || 45)
                    ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {(benchmarkData.userRates?.screeningToInterview || 0) >= (benchmarkData.benchmarks?.screeningToInterview || 45) ? '✓ On Track' : '⚠️ Below Avg'}
                </span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${Math.min(100, (benchmarkData.userRates?.screeningToInterview || 0))}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-500">Measures recruiter call & pitch alignment</p>
            </div>

            {/* Stage 3: Interview -> Offer */}
            <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-gray-700">3. Interview → Offer</span>
                <span className="text-[10px] text-gray-400">Benchmark: {benchmarkData.benchmarks?.interviewToOffer}%</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">{benchmarkData.userRates?.interviewToOffer}%</span>
                <span className={`text-xs font-semibold ${
                  (benchmarkData.userRates?.interviewToOffer || 0) >= (benchmarkData.benchmarks?.interviewToOffer || 22)
                    ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {(benchmarkData.userRates?.interviewToOffer || 0) >= (benchmarkData.benchmarks?.interviewToOffer || 22) ? '✓ On Track' : '⚠️ Below Avg'}
                </span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${Math.min(100, (benchmarkData.userRates?.interviewToOffer || 0) * 2)}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-500">Measures technical depth & system design</p>
            </div>
          </div>

          {/* Actionable Diagnosis Box */}
          <div className="p-4 bg-gradient-to-r from-primary-50/60 to-blue-50/60 border border-primary-200/80 rounded-xl text-xs space-y-1.5">
            <div className="font-bold text-primary-950 flex items-center gap-1.5">
              <Sparkles size={14} className="text-primary-600" />
              Strategic Prescription:
            </div>
            <p className="text-primary-900 leading-relaxed font-medium">
              {benchmarkData.diagnosis}
            </p>
            <p className="text-gray-700 pt-1">
              👉 <strong>Action Plan:</strong> {benchmarkData.recommendation}
            </p>
          </div>
        </div>
      )}

      {/* Insights */}
      {insightsData?.insights?.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">AI Insights</h3>
          <div className="space-y-3">
            {insightsData.insights.map((ins, i) => (
              <div key={i} className="flex gap-3 p-3 bg-primary-50 rounded-lg border border-primary-100">
                <Zap size={14} className="text-primary-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-primary-900">{ins.title}</p>
                  <p className="text-xs text-primary-700 mt-0.5">{ins.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
