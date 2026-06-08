export const STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Rejected', 'Withdrawn'];

export const STAGE_COLORS = {
  Applied:   { bg: 'bg-blue-100',   text: 'text-blue-800',   dot: 'bg-blue-400',   border: 'border-blue-200' },
  Screening: { bg: 'bg-amber-100',  text: 'text-amber-800',  dot: 'bg-amber-400',  border: 'border-amber-200' },
  Interview: { bg: 'bg-teal-100',   text: 'text-teal-800',   dot: 'bg-teal-500',   border: 'border-teal-200' },
  Offer:     { bg: 'bg-green-100',  text: 'text-green-800',  dot: 'bg-green-500',  border: 'border-green-200' },
  Rejected:  { bg: 'bg-red-100',    text: 'text-red-800',    dot: 'bg-red-400',    border: 'border-red-200' },
  Withdrawn: { bg: 'bg-gray-100',   text: 'text-gray-600',   dot: 'bg-gray-400',   border: 'border-gray-200' },
};

export const PRIORITY_COLORS = {
  low:    { bg: 'bg-gray-100',   text: 'text-gray-600' },
  medium: { bg: 'bg-amber-100',  text: 'text-amber-700' },
  high:   { bg: 'bg-red-100',    text: 'text-red-700' },
};

export const SOURCES = ['LinkedIn', 'Indeed', 'Company site', 'Referral', 'AngelList', 'Glassdoor', 'Other'];

export const REMINDER_TYPES = [
  { value: 'follow-up',     label: 'Follow Up' },
  { value: 'interview',     label: 'Interview' },
  { value: 'offer-deadline',label: 'Offer Deadline' },
  { value: 'prep',          label: 'Prep / Study' },
  { value: 'other',         label: 'Other' },
];

export const INTERVIEW_TYPES = [
  { value: 'mixed',         label: 'Mixed (Recommended)' },
  { value: 'behavioral',    label: 'Behavioral' },
  { value: 'technical',     label: 'Technical' },
  { value: 'system-design', label: 'System Design' },
];

export const COMPANY_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-sky-100 text-sky-700',
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
  'bg-teal-100 text-teal-700',
  'bg-indigo-100 text-indigo-700',
  'bg-pink-100 text-pink-700',
  'bg-lime-100 text-lime-700',
];

export const getCompanyColor = (name = '') => {
  const idx = name.charCodeAt(0) % COMPANY_COLORS.length;
  return COMPANY_COLORS[idx];
};

export const formatSalary = (min, max, currency = 'USD') => {
  if (!min && !max) return null;
  const fmt = (n) => n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
  const symbol = currency === 'USD' ? '$' : currency === 'INR' ? '₹' : currency;
  if (min && max) return `${symbol}${fmt(min)}–${fmt(max)}`;
  if (min) return `${symbol}${fmt(min)}+`;
  return `Up to ${symbol}${fmt(max)}`;
};

export const daysAgo = (date) => {
  const d = Math.floor((Date.now() - new Date(date)) / (1000 * 60 * 60 * 24));
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  return `${d}d ago`;
};

export const daysUntil = (date) => {
  const d = Math.ceil((new Date(date) - Date.now()) / (1000 * 60 * 60 * 24));
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return 'Due today';
  if (d === 1) return 'Tomorrow';
  return `In ${d} days`;
};
