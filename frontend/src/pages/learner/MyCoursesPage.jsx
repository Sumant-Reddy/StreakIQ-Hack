import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Layout from '../../components/Layout';
import { learnerApi, courseApi } from '../../services/api';
import { BookOpen, Clock, ChevronRight, CheckCircle, Play, Search } from 'lucide-react';

export default function MyCoursesPage() {
  const { t } = useTranslation();
  const [enrollments, setEnrollments] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('enrolled');
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.all([
      learnerApi.dashboard(),
      courseApi.list({ limit: 50 }),
    ]).then(([dash, courses]) => {
      setEnrollments(dash.enrollments || []);
      setCatalog(courses.courses || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const enrollCourse = async (courseId) => {
    try {
      await courseApi.enroll(courseId);
      const dash = await learnerApi.dashboard();
      setEnrollments(dash.enrollments || []);
      setTab('enrolled');
    } catch (err) {
      alert(err.error || 'Enrollment failed');
    }
  };

  const enrolledIds = new Set(enrollments.map(e => e.courseId));

  const filtered = (tab === 'enrolled' ? enrollments : catalog.filter(c => !enrolledIds.has(c.id)))
    .filter(item => {
      const title = tab === 'enrolled' ? item.course?.title : item.title;
      return title?.toLowerCase().includes(search.toLowerCase());
    });

  return (
    <Layout title={t('courses.myCourses')}>
      <div className="max-w-5xl space-y-5">
        {/* Tabs + Search */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-2">
            <button onClick={() => setTab('enrolled')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'enrolled' ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30' : 'text-gray-400 hover:text-white'}`}>
              {t('courses.allEnrolledCourses')} {enrollments.length > 0 && <span className="ml-1 text-xs text-gray-500">({enrollments.length})</span>}
            </button>
            <button onClick={() => setTab('explore')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'explore' ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30' : 'text-gray-400 hover:text-white'}`}>
              {t('courses.exploreCourses')}
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('common.search')}
              className="bg-gray-800 border border-gray-700 text-white pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:border-brand-500 w-48" />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-400">{t('courses.noCourses')}</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tab === 'enrolled' ? enrollments
              .filter(e => e.course?.title?.toLowerCase().includes(search.toLowerCase()))
              .map(e => (
              <Link key={e.id} to={`/learn/course/${e.courseId}`}
                className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-4 transition-all group space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500/30 to-pink-500/30 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-brand-400" />
                  </div>
                  {e.completedAt
                    ? <CheckCircle className="w-5 h-5 text-green-400" />
                    : <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-brand-400 transition-colors" />
                  }
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white leading-snug">{e.course?.title}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">{e.course?.department}</p>
                </div>
                <div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-brand-500 to-pink-500 rounded-full transition-all" style={{ width: `${Math.min(100, e.progressPercent || 0)}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{Math.round(e.progressPercent || 0)}% {t('dashboard.complete')}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{e.course?.estimatedHours}h</span>
                  </div>
                </div>
                <div className={`text-xs font-medium px-2 py-1 rounded-md w-fit ${e.completedAt ? 'bg-green-500/10 text-green-400' : e.progressPercent > 0 ? 'bg-brand-500/10 text-brand-400' : 'bg-gray-700 text-gray-400'}`}>
                  {e.completedAt ? t('dashboard.completed') : e.progressPercent > 0 ? t('courses.continue') : t('courses.startLearning')}
                </div>
              </Link>
            )) : catalog
              .filter(c => !enrolledIds.has(c.id) && c.isPublished)
              .filter(c => c.title?.toLowerCase().includes(search.toLowerCase()))
              .map(c => (
              <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/30 to-blue-500/30 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white leading-snug">{c.title}</h4>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{c.description}</p>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{c.estimatedHours}h</span>
                  <span>{c.department}</span>
                </div>
                <button onClick={() => enrollCourse(c.id)}
                  className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium py-2 rounded-lg transition-all">
                  <Play className="w-3.5 h-3.5" />{t('courses.startLearning')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
