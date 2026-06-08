import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from 'recharts';
import { TrendingUp, Target, Clock, DollarSign, Zap, AlertCircle } from 'lucide-react';
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
