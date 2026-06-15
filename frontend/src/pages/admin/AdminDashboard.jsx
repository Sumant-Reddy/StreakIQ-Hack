import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import StatCard from '../../components/StatCard';
import { analyticsApi } from '../../services/api';
import { Users, BookOpen, Trophy, TrendingUp, AlertTriangle, BarChart3, Plus, UserCheck } from 'lucide-react';

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsApi.adminOverview()
      .then(setAnalytics)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Layout title="Admin Dashboard"><div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" /></div></Layout>;

  const overview = analytics?.overview || {};

  return (
    <Layout title="Admin Dashboard">
      <div className="max-w-6xl space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Users" value={overview.users || 0} icon={Users} color="brand" />
          <StatCard label="Published Courses" value={overview.courses || 0} icon={BookOpen} color="blue" />
          <StatCard label="Total Enrollments" value={overview.enrollments || 0} icon={Trophy} color="green" />
          <StatCard label="Avg Retention" value={`${overview.avgRetention || 0}%`} icon={TrendingUp} color="yellow" />
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Add Course', icon: Plus, path: '/admin/courses', color: 'brand' },
            { label: 'Manage Users', icon: Users, path: '/admin/users', color: 'blue' },
            { label: 'Manager View', icon: UserCheck, path: '/manager', color: 'green' },
            { label: 'Analytics', icon: BarChart3, path: '/admin', color: 'yellow' },
          ].map(action => (
            <Link key={action.label} to={action.path}
              className={`card flex items-center gap-3 hover:border-${action.color}-500/40 hover:bg-gray-800/80 transition-all group`}>
              <div className={`w-9 h-9 rounded-lg bg-${action.color}-500/20 flex items-center justify-center`}>
                <action.icon className={`w-4 h-4 text-${action.color}-400`} />
              </div>
              <span className="text-sm font-medium text-white">{action.label}</span>
            </Link>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Role breakdown */}
          <div className="card">
            <h3 className="font-semibold text-white mb-4">User Roles</h3>
            {analytics?.roleBreakdown?.map(r => (
              <div key={r.role} className="flex items-center justify-between py-2.5 border-b border-gray-800 last:border-0">
                <span className="text-sm text-gray-400">{r.role}</span>
                <span className="font-bold text-white">{r._count.id}</span>
              </div>
            ))}
          </div>

          {/* Risk breakdown */}
          <div className="card">
            <h3 className="font-semibold text-white mb-4">Risk Distribution</h3>
            {analytics?.riskBreakdown?.map(r => (
              <div key={r.riskLevel} className="flex items-center justify-between py-2.5 border-b border-gray-800 last:border-0">
                <span className={`text-sm ${r.riskLevel === 'CRITICAL' ? 'text-red-400' : r.riskLevel === 'HIGH' ? 'text-orange-400' : r.riskLevel === 'MEDIUM' ? 'text-yellow-400' : 'text-emerald-400'}`}>{r.riskLevel}</span>
                <span className="font-bold text-white">{r._count.id}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div className="card">
          <h3 className="font-semibold text-white mb-4">Recent Quiz Activity</h3>
          <div className="space-y-2">
            {analytics?.recentActivity?.map(a => (
              <div key={a.id} className="flex items-center gap-4 py-2.5 border-b border-gray-800 last:border-0">
                <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400 font-semibold text-sm shrink-0">
                  {a.user?.name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{a.user?.name}</div>
                  <div className="text-xs text-gray-400 truncate">{a.quiz?.title}</div>
                </div>
                <div className="text-sm font-bold text-white">{Math.round((a.score / a.totalPoints) * 100)}%</div>
                <div className="text-xs text-gray-500">{new Date(a.completedAt).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
