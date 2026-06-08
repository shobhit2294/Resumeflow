import { STAGE_COLORS } from '../../utils/constants';

export default function StageBadge({ stage, size = 'sm' }) {
  const colors = STAGE_COLORS[stage] || STAGE_COLORS['Applied'];
  return (
    <span className={`badge ${colors.bg} ${colors.text} ${size === 'xs' ? 'text-[10px] px-2 py-0' : ''}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${colors.dot}`} />
      {stage}
    </span>
  );
}
