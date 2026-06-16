import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Layout from '../../components/Layout';
import { learnerApi, aiApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Target, BookOpen, CheckCircle, Circle, Zap, ChevronRight } from 'lucide-react';

export default function LearningPath() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [paths, setPaths] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([learnerApi.learningPath(), aiApi.recommendations(user.id)])
      .then(([p, r]) => { setPaths(p); setRecommendations(r); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user.id]);

  return (
    <Layout title={t('learningPath.myLearningPath')}>
      <div className="max-w-4xl space-y-6">
        <div className="bg-gradient-to-r from-emerald-600/20 to-brand-600/20 border border-emerald-500/30 rounded-xl p-5 flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/30 flex items-center justify-center shrink-0">
            <Target className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="font-bold text-white">{t('learningPath.aiPersonalizedPath')}</h2>
            <p className="text-sm text-gray-400 mt-1">{t('learningPath.pathDescription')}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" /></div>
        ) : (
          <>
            {paths.length > 0 ? (
              paths.map(up => (
                <div key={up.id} className="card space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-white">{up.learningPath.title}</h3>
                    <div className="text-xs text-gray-400">{Math.round(up.progressPercent)}{t('learningPath.percentComplete')}</div>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-brand-500 rounded-full" style={{ width: `${up.progressPercent}%` }} />
                  </div>
                  <div className="space-y-2">
                    {up.learningPath.courses?.map((lpc, i) => (
                      <Link key={lpc.id} to={`/learn/course/${lpc.courseId}`}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800 border border-gray-700 group transition-colors">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center">
                          {i < 2 ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <Circle className="w-5 h-5 text-gray-600" />}
                        </div>
                        <BookOpen className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-white flex-1">{lpc.course?.title}</span>
                        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-brand-400 transition-colors" />
                      </Link>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="card text-center py-10">
                <Target className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <h3 className="font-medium text-white mb-1">{t('learningPath.noPathAssigned')}</h3>
                <p className="text-sm text-gray-400">{t('learningPath.noPathDescription')}</p>
              </div>
            )}

            {recommendations.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-white flex items-center gap-2"><Zap className="w-4 h-4 text-brand-400" /> {t('dashboard.aiRecommendations')}</h3>
                {recommendations.map((r, i) => (
                  <Link key={i} to={`/learn/course/${r.courseId}`}
                    className="flex items-center gap-4 card hover:border-brand-500/40 hover:bg-gray-800/80 transition-all group">
                    <div className="w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5 text-brand-400" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white group-hover:text-brand-300 transition-colors">{r.course?.title}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{r.reason}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-brand-400 transition-colors" />
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
