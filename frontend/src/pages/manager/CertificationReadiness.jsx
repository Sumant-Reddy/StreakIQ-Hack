import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { managerApi } from '../../services/api';
import { Award, CheckCircle, XCircle, Clock, TrendingUp, Users } from 'lucide-react';

const STATUS_CONFIG = {
  READY: { label: 'Ready', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle },
  NEARLY_READY: { label: 'Nearly Ready', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Clock },
  NOT_READY: { label: 'Not Ready', cls: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
};

export default function CertificationReadiness() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    managerApi.certificationReadiness()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const ready = data.filter(d => d.status === 'READY').length;
  const nearly = data.filter(d => d.status === 'NEARLY_READY').length;
  const notReady = data.filter(d => d.status === 'NOT_READY').length;

  return (
    <Layout title="Certification Readiness">
      <div className="max-w-4xl space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card text-center py-5 border-emerald-500/30 bg-emerald-500/5">
            <div className="text-3xl font-bold text-emerald-400">{ready}</div>
            <div className="text-sm text-gray-400 mt-1">Ready to Certify</div>
          </div>
          <div className="card text-center py-5 border-yellow-500/30 bg-yellow-500/5">
            <div className="text-3xl font-bold text-yellow-400">{nearly}</div>
            <div className="text-sm text-gray-400 mt-1">Nearly Ready</div>
          </div>
          <div className="card text-center py-5 border-red-500/30 bg-red-500/5">
            <div className="text-3xl font-bold text-red-400">{notReady}</div>
            <div className="text-sm text-gray-400 mt-1">Not Ready</div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" /></div>
        ) : (
          <div className="card">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2"><Award className="w-4 h-4 text-yellow-400" /> Individual Readiness</h3>
            <div className="space-y-3">
              {data.sort((a, b) => b.readinessScore - a.readinessScore).map(member => {
                const cfg = STATUS_CONFIG[member.status] || STATUS_CONFIG.NOT_READY;
                const Icon = cfg.icon;
                return (
                  <div key={member.id} className="flex items-center gap-4 p-3.5 rounded-xl bg-gray-800/50 border border-gray-700">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-pink-500 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                      {member.name?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white">{member.name}</div>
                      <div className="text-xs text-gray-400">{member.department}</div>
                      <div className="flex gap-4 mt-1.5 text-xs text-gray-500">
                        <span>Quiz: {member.avgQuizScore}%</span>
                        <span>Retention: {member.retentionScore}%</span>
                        <span>Completion: {member.completionRate}%</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-white">{member.readinessScore}%</div>
                      <div className="text-xs text-gray-500">Readiness</div>
                    </div>
                    <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.cls}`}>
                      <Icon className="w-3.5 h-3.5" /> {cfg.label}
                    </span>
                  </div>
                );
              })}
              {data.length === 0 && <div className="text-center py-8 text-gray-500 text-sm">No team members found</div>}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
