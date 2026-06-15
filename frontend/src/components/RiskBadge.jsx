export default function RiskBadge({ level }) {
  const config = {
    LOW: { cls: 'badge-low', label: 'Low Risk' },
    MEDIUM: { cls: 'badge-medium', label: 'Medium Risk' },
    HIGH: { cls: 'badge-high', label: 'High Risk' },
    CRITICAL: { cls: 'badge-critical', label: 'Critical' },
  };
  const { cls, label } = config[level] || config.LOW;
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}
