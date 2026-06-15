export default function RetentionGauge({ score = 0, size = 120 }) {
  const radius = 45;
  const circumference = Math.PI * radius;
  const progress = Math.min(100, Math.max(0, score));
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444';
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'At Risk' : 'Critical';

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size / 2 + 20} viewBox={`0 0 100 60`}>
        <path d={`M 5 50 A 45 45 0 0 1 95 50`} fill="none" stroke="#1f2937" strokeWidth="10" strokeLinecap="round" />
        <path
          d={`M 5 50 A 45 45 0 0 1 95 50`}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 1s ease', filter: `drop-shadow(0 0 6px ${color})` }}
        />
        <text x="50" y="48" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">{Math.round(score)}</text>
      </svg>
      <div className="text-center">
        <div className="text-xs font-medium" style={{ color }}>{label}</div>
        <div className="text-xs text-gray-500">Retention Score</div>
      </div>
    </div>
  );
}
