import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Layout from '../../components/Layout';
import StatCard from '../../components/StatCard';
import RetentionGauge from '../../components/RetentionGauge';
import RiskBadge from '../../components/RiskBadge';
import { learnerApi, aiApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  BookOpen, Flame, Trophy, Brain, Target, Clock, Star,
  ChevronRight, TrendingUp, MessageSquare, Zap, AlertTriangle,
} from 'lucide-react';

export default function LearnerDashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([learnerApi.dashboard(), aiApi.recommendations(user.id)])
      .then(([dash, recs]) => { setData(dash); setRecommendations(recs); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user.id]);

  if (loading) return (
    <Layout title={t('dashboard.myLearningDashboard')}>
      <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" /></div>
    </Layout>
  );

  const retention = data?.retention?.score || 0;
  const streak = data?.streak?.currentStreak || 0;
  const points = data?.points?.totalPoints || 0;
  const risk = data?.risk?.riskLevel || 'LOW';

  return (
    <Layout title={t('dashboard.myLearningDashboard')}>
      <div className="space-y-6 max-w-6xl">
        {/* Welcome + Risk alert */}
        {(risk === 'HIGH' || risk === 'CRITICAL') && (
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium text-red-300 text-sm">{t('dashboard.knowledgeRiskDetected')}</div>
              <div className="text-xs text-gray-400 mt-0.5">{data?.risk?.recommendation || t('dashboard.noActiveCourses')}</div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label={t('dashboard.retentionScore')} value={`${Math.round(retention)}%`} sub="Updated today" icon={TrendingUp} color="brand" />
          <StatCard label={t('dashboard.learningStreak')} value={`${streak} ${t('dashboard.days')}`} sub={`${t('dashboard.best')}: ${data?.streak?.longestStreak || 0}`} icon={Flame} color="orange" />
          <StatCard label={t('dashboard.totalPoints')} value={points.toLocaleString()} sub={`+${data?.points?.weeklyPoints || 0} ${t('dashboard.thisWeek')}`} icon={Trophy} color="yellow" />
          <StatCard label={t('dashboard.coursesDone')} value={data?.coursesCompleted || 0} sub={`${data?.coursesInProgress || 0} ${t('dashboard.inProgress')}`} icon={BookOpen} color="green" />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Retention gauge + risk */}
          <div className="card space-y-4">
            <h3 className="font-semibold text-white">{t('dashboard.learningIntelligence')}</h3>
            <div className="flex items-center gap-6">
              <RetentionGauge score={retention} />
              <div className="space-y-3 flex-1">
                {data?.retention && [
                  { label: t('dashboard.quizAccuracy'), val: data.retention.quizAccuracy },
                  { label: t('dashboard.watchRate'), val: data.retention.watchCompletion },
                  { label: t('dashboard.aiEngagement'), val: data.retention.aiInteraction },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">{item.label}</span>
                      <span className="text-white font-medium">{Math.round(item.val || 0)}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-brand-500 to-pink-500 rounded-full" style={{ width: `${Math.min(100, item.val || 0)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-800">
              <span className="text-xs text-gray-400">{t('dashboard.knowledgeRisk')}</span>
              <RiskBadge level={risk} />
            </div>
          </div>

          {/* Center: Active courses */}
          <div className="card space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">{t('dashboard.continueLearning')}</h3>
              <Link to="/learn/courses" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                {t('dashboard.allCourses')} <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="space-y-3">
              {data?.enrollments?.slice(0, 3).map(e => (
                <Link key={e.id} to={`/learn/course/${e.courseId}`}
                  className="flex items-center gap-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 rounded-xl p-3.5 transition-colors group">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500/30 to-pink-500/30 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-brand-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{e.course?.title}</div>
                    <div className="mt-1.5 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-brand-500 to-pink-500 rounded-full" style={{ width: `${e.progressPercent || 0}%` }} />
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{Math.round(e.progressPercent || 0)}% {t('dashboard.complete')}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-brand-400 transition-colors" />
                </Link>
              ))}
              {(!data?.enrollments || data.enrollments.length === 0) && (
                <div className="text-center py-6 text-gray-500 text-sm">
                  {t('dashboard.noActiveCourses')}. <Link to="/learn/courses" className="text-brand-400">{t('dashboard.browseCourses')}</Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div>
          <h3 className="font-semibold text-white mb-4">{t('dashboard.quickActions')}</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: t('nav.aiCompanion'), desc: t('dashboard.askQuestions'), icon: Brain, path: '/learn/ai-companion', color: 'from-brand-500/20 to-brand-600/10 border-brand-500/30' },
              { label: t('nav.mockRoleplay'), desc: t('dashboard.practiceWithAI'), icon: MessageSquare, path: '/learn/roleplay', color: 'from-pink-500/20 to-pink-600/10 border-pink-500/30' },
              { label: t('nav.learningPath'), desc: t('dashboard.personalizedCurriculum'), icon: Target, path: '/learn/path', color: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30' },
              { label: t('nav.leaderboard'), desc: t('dashboard.checkYourRanking'), icon: Trophy, path: '/learn/leaderboard', color: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30' },
            ].map(action => (
              <Link key={action.label} to={action.path}
                className={`bg-gradient-to-br ${action.color} border rounded-xl p-4 hover:scale-[1.02] transition-all group`}>
                <action.icon className="w-6 h-6 text-white mb-2" />
                <div className="font-medium text-white text-sm">{action.label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{action.desc}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* AI Recommendations */}
        {recommendations.length > 0 && (
          <div>
            <h3 className="font-semibold text-white mb-4">{t('dashboard.aiRecommendations')}</h3>
            <div className="grid lg:grid-cols-3 gap-3">
              {recommendations.slice(0, 3).map((rec, i) => (
                <div key={i} className="card border-brand-500/20 bg-brand-500/5">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center shrink-0">
                      <Zap className="w-4 h-4 text-brand-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{rec.course?.title}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{rec.reason}</div>
                    </div>
                  </div>
                  {rec.courseId && (
                    <Link to={`/learn/course/${rec.courseId}`} className="btn-primary text-xs py-1.5 mt-3 w-full text-center block">
                      Start Now
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
