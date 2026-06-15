import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import StatCard from '../../components/StatCard';
import RiskBadge from '../../components/RiskBadge';
import RetentionGauge from '../../components/RetentionGauge';
import { managerApi } from '../../services/api';
import { Users, TrendingUp, AlertTriangle, Award, Brain, BarChart3, ChevronRight, Flame, Map } from 'lucide-react';

export default function ManagerDashboard() {
  const [summary, setSummary] = useState(null);
  const [team, setTeam] = useState([]);
  const [heatmap, setHeatmap] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([managerApi.summary(), managerApi.team(), managerApi.skillHeatmap()])
      .then(([s, t, h]) => { setSummary(s); setTeam(t); setHeatmap(h); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const getCellColor = (score) => {
    if (score >= 80) return 'bg-emerald-500/80 text-emerald-100';
    if (score >= 60) return 'bg-yellow-500/80 text-yellow-100';
    if (score >= 40) return 'bg-orange-500/80 text-orange-100';
    return 'bg-red-500/80 text-red-100';
  };

  if (loading) return <Layout title="Manager Dashboard"><div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" /></div></Layout>;

  return (
    <Layout title="Manager Dashboard">
      <div className="max-w-7xl space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Learners" value={summary?.totalLearners || 0} icon={Users} color="brand" />
          <StatCard label="Avg Retention" value={`${summary?.avgRetentionScore || 0}%`} icon={TrendingUp} color="green" />
          <StatCard label="At Risk" value={summary?.atRisk || 0} sub="High + Critical" icon={AlertTriangle} color="red" />
          <StatCard label="Active Streaks" value={summary?.activeStreaks || 0} icon={Flame} color="orange" />
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link to="/manager/copilot" className="flex items-center gap-4 card hover:border-brand-500/40 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center">
              <Brain className="w-5 h-5 text-brand-400" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-white group-hover:text-brand-300">AI Copilot</div>
              <div className="text-xs text-gray-400">Ask about team performance</div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-brand-400 transition-colors" />
          </Link>
          <Link to="/manager/certification" className="flex items-center gap-4 card hover:border-brand-500/40 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
              <Award className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-white group-hover:text-yellow-300">Certification Readiness</div>
              <div className="text-xs text-gray-400">Who's ready to certify?</div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-yellow-400 transition-colors" />
          </Link>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Team table */}
          <div className="lg:col-span-3 card">
            <h3 className="font-semibold text-white mb-4">Team Performance</h3>
            <div className="space-y-2">
              {team.map(u => (
                <Link key={u.id} to={`/manager/team/${u.id}`}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-800 border border-transparent hover:border-gray-700 transition-all group">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-pink-500 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                    {u.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{u.name}</div>
                    <div className="text-xs text-gray-400">{u.designation || u.department}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-bold text-white">{Math.round(u.retentionScore?.score || 0)}%</div>
                    <div className="text-xs text-gray-500">Retention</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <RiskBadge level={u.riskProfile?.riskLevel || 'LOW'} />
                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-brand-400 transition-colors" />
                  </div>
                </Link>
              ))}
              {team.length === 0 && <div className="text-center py-8 text-gray-500 text-sm">No team members found</div>}
            </div>
          </div>

          {/* Risk breakdown */}
          <div className="lg:col-span-2 card space-y-4">
            <h3 className="font-semibold text-white">Risk Distribution</h3>
            <div className="space-y-3">
              {[
                { label: 'Critical', key: 'CRITICAL', color: 'bg-red-500' },
                { label: 'High Risk', key: 'HIGH', color: 'bg-orange-500' },
                { label: 'Medium Risk', key: 'MEDIUM', color: 'bg-yellow-500' },
                { label: 'Low Risk', key: 'LOW', color: 'bg-emerald-500' },
              ].map(({ label, key, color }) => {
                const count = summary?.riskBreakdown?.[key] || 0;
                const total = summary?.totalLearners || 1;
                return (
                  <div key={key}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-gray-400">{label}</span>
                      <span className="text-white font-medium">{count} learners</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${(count / total) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-gray-800">
              <div className="text-xs text-gray-400 mb-3">Quiz Performance</div>
              <div className="flex items-center justify-between">
                <div className="text-center">
                  <div className="text-xl font-bold text-white">{summary?.quizAttempts || 0}</div>
                  <div className="text-xs text-gray-500">Total Attempts</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-white">{summary?.avgQuizScore || 0}</div>
                  <div className="text-xs text-gray-500">Avg Score</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Skill Heatmap */}
        {heatmap && heatmap.team?.length > 0 && (
          <div className="card">
            <div className="flex items-center gap-2 mb-5">
              <Map className="w-4 h-4 text-brand-400" />
              <h3 className="font-semibold text-white">Team Skill Heatmap</h3>
              <div className="ml-auto flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />80%+</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-yellow-500 inline-block" />60-79%</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />&lt;60%</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left text-gray-400 font-medium py-2 pr-4">Consultant</th>
                    {heatmap.skills?.map(s => <th key={s} className="text-center text-gray-400 font-medium py-2 px-2 whitespace-nowrap">{s}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {heatmap.team?.map(member => (
                    <tr key={member.id}>
                      <td className="py-2 pr-4">
                        <div className="font-medium text-white">{member.name}</div>
                        <div className="text-gray-500">{member.department}</div>
                      </td>
                      {heatmap.skills?.map(skill => {
                        const score = Math.round(member.skills?.[skill] || 0);
                        return (
                          <td key={skill} className="text-center py-2 px-1">
                            <span className={`inline-flex items-center justify-center w-10 h-7 rounded text-xs font-bold ${getCellColor(score)}`}>
                              {score}%
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
