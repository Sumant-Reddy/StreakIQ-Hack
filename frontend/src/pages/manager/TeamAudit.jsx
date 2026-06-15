import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import RetentionGauge from '../../components/RetentionGauge';
import RiskBadge from '../../components/RiskBadge';
import { managerApi, aiApi } from '../../services/api';
import { BookOpen, CheckCircle, Clock, Brain, AlertTriangle, Trophy, ChevronLeft, Zap, Target } from 'lucide-react';

export default function TeamAudit() {
  const { userId } = useParams();
  const [audit, setAudit] = useState(null);
  const [risk, setRisk] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([managerApi.audit(userId), aiApi.riskAnalysis(userId)])
      .then(([a, r]) => { setAudit(a); setRisk(r); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <Layout title="Employee Audit"><div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" /></div></Layout>;
  if (!audit) return <Layout title="Employee Audit"><div className="text-gray-400 text-center mt-20">Employee not found</div></Layout>;

  return (
    <Layout title={`Audit: ${audit.name}`}>
      <div className="max-w-4xl space-y-5">
        <Link to="/manager" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back to Team
        </Link>

        {/* Employee header */}
        <div className="card">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-pink-500 flex items-center justify-center text-white font-bold text-2xl">
              {audit.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white">{audit.name}</h2>
              <div className="text-gray-400 text-sm">{audit.designation} · {audit.department}</div>
              <div className="flex items-center gap-3 mt-3">
                <RiskBadge level={audit.riskProfile?.riskLevel || 'LOW'} />
                {audit.streak?.currentStreak > 0 && (
                  <span className="flex items-center gap-1 text-xs text-orange-400 bg-orange-500/20 border border-orange-500/30 px-2 py-0.5 rounded-full">
                    🔥 {audit.streak.currentStreak} day streak
                  </span>
                )}
              </div>
            </div>
            <RetentionGauge score={audit.retentionScore?.score || 0} />
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          {/* Learning metrics */}
          <div className="card space-y-4">
            <h3 className="font-semibold text-white">Learning Metrics</h3>
            {[
              { label: 'Courses Assigned', value: audit.coursesAssigned, icon: BookOpen, color: 'text-brand-400' },
              { label: 'Courses Completed', value: audit.coursesCompleted, icon: CheckCircle, color: 'text-emerald-400' },
              { label: 'Quiz Attempts', value: audit.quizAttempts, icon: Trophy, color: 'text-yellow-400' },
              { label: 'Avg Quiz Score', value: `${audit.avgQuizScore || 0}%`, icon: Target, color: 'text-pink-400' },
              { label: 'Learning Hours', value: `${audit.learningHours || 0}h`, icon: Clock, color: 'text-blue-400' },
              { label: 'Points Earned', value: (audit.points?.totalPoints || 0).toLocaleString(), icon: Zap, color: 'text-orange-400' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                <div className="flex items-center gap-2.5 text-sm text-gray-400">
                  <Icon className={`w-4 h-4 ${color}`} />
                  {label}
                </div>
                <span className="font-semibold text-white">{value}</span>
              </div>
            ))}
          </div>

          {/* AI metrics */}
          <div className="space-y-4">
            {/* Risk analysis */}
            <div className={`card space-y-3 ${(risk?.riskLevel === 'HIGH' || risk?.riskLevel === 'CRITICAL') ? 'border-red-500/30 bg-red-500/5' : ''}`}>
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-brand-400" />
                <h3 className="font-semibold text-white">AI Risk Analysis</h3>
              </div>
              {risk && (
                <>
                  <div className="flex items-center gap-3">
                    <RiskBadge level={risk.riskLevel} />
                    <span className="text-sm text-gray-400">{risk.daysInactive} days inactive</span>
                  </div>
                  <div className="space-y-2">
                    {risk.breakdown && Object.entries({
                      'Quiz Accuracy': risk.breakdown.quizAccuracy,
                      'Watch Completion': risk.breakdown.watchCompletion,
                      'Revision Frequency': risk.breakdown.revisionFreq,
                      'Streak Bonus': risk.breakdown.streakBonus,
                    }).map(([key, val]) => (
                      <div key={key}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-400">{key}</span>
                          <span className="text-white">{Math.round(val || 0)}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500 rounded-full" style={{ width: `${Math.min(100, val || 0)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Recommendation */}
            {risk?.recommendation && (
              <div className="card border-brand-500/20 bg-brand-500/5 space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-brand-400" />
                  <h3 className="text-sm font-semibold text-brand-300">AI Recommendation</h3>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">{risk.recommendation}</p>
              </div>
            )}

            {/* Interventions */}
            {audit.interventions?.length > 0 && (
              <div className="card space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  <h3 className="text-sm font-semibold text-white">Active Interventions</h3>
                </div>
                {audit.interventions.map(iv => (
                  <div key={iv.id} className="text-xs bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                    <span className="font-medium text-yellow-400">{iv.type.replace('_', ' ')}</span>
                    <span className="text-gray-400 ml-2">— {iv.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent quizzes */}
        {audit.quizAttempts?.length > 0 && (
          <div className="card">
            <h3 className="font-semibold text-white mb-4">Recent Quiz Performance</h3>
            <div className="space-y-2">
              {audit.quizAttempts.slice(0, 8).map(a => {
                const pct = Math.round((a.score / a.totalPoints) * 100);
                return (
                  <div key={a.id} className="flex items-center gap-4 py-2.5 border-b border-gray-800 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">{a.quiz?.title}</div>
                      <div className="text-xs text-gray-500">{new Date(a.completedAt).toLocaleDateString()}</div>
                    </div>
                    <div className={`text-sm font-bold ${pct >= 70 ? 'text-emerald-400' : 'text-red-400'}`}>{pct}%</div>
                    <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${pct >= 70 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
