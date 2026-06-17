import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import StatCard from '../../components/StatCard';
import { analyticsApi } from '../../services/api';
import { Users, BookOpen, Trophy, TrendingUp, Plus, UserCheck, BarChart3, Activity, Grid } from 'lucide-react';

// ── Activity Heatmap ─────────────────────────────────────────────────────────
function ActivityHeatmap({ cells }) {
  if (!cells || cells.length === 0) return (
    <div className="flex items-center justify-center h-32 text-gray-500 text-sm">No activity data yet</div>
  );

  const maxCount = Math.max(...cells.map(c => c.total), 1);

  const getColor = (count) => {
    if (count === 0) return 'bg-gray-800 border-gray-700';
    const pct = count / maxCount;
    if (pct < 0.25) return 'bg-brand-900/60 border-brand-800/40';
    if (pct < 0.5)  return 'bg-brand-700/60 border-brand-600/40';
    if (pct < 0.75) return 'bg-brand-500/70 border-brand-500/50';
    return 'bg-brand-400 border-brand-300/50';
  };

  // Group by week columns
  const weeks = [];
  let week = [];
  cells.forEach((cell, i) => {
    week.push(cell);
    if (week.length === 7) { weeks.push(week); week = []; }
  });
  if (week.length > 0) weeks.push(week);

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthLabels = [];
  let lastMonth = null;
  weeks.forEach((wk, wi) => {
    const month = wk[0]?.date ? new Date(wk[0].date + 'T00:00:00').toLocaleString('default', { month: 'short' }) : '';
    if (month !== lastMonth) { monthLabels.push({ wi, label: month }); lastMonth = month; }
    else monthLabels.push({ wi, label: '' });
  });

  return (
    <div className="overflow-x-auto">
      {/* Month labels */}
      <div className="flex gap-1 mb-1 ml-8">
        {monthLabels.map(({ wi, label }) => (
          <div key={wi} className="w-3 text-center" style={{ width: '13px' }}>
            <span className="text-xs text-gray-500">{label}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        {/* Day labels */}
        <div className="flex flex-col gap-1 mr-1 shrink-0">
          {days.map(d => (
            <div key={d} className="h-3 flex items-center">
              <span className="text-xs text-gray-600 w-7 text-right">{d}</span>
            </div>
          ))}
        </div>
        {/* Grid */}
        <div className="flex gap-1">
          {weeks.map((wk, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {Array.from({ length: 7 }).map((_, di) => {
                const cell = wk.find(c => new Date(c.date + 'T00:00:00').getDay() === di);
                return (
                  <div key={di} title={cell ? `${cell.date}: ${cell.total} events (${cell.quiz} quiz, ${cell.watch} watch, ${cell.enroll} enroll)` : ''}
                    className={`w-3 h-3 rounded-sm border ${cell ? getColor(cell.total) : 'bg-gray-900 border-gray-800'} cursor-default`} />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {/* Legend */}
      <div className="flex items-center gap-2 mt-3 justify-end">
        <span className="text-xs text-gray-500">Less</span>
        {['bg-gray-800', 'bg-brand-900/60', 'bg-brand-700/60', 'bg-brand-500/70', 'bg-brand-400'].map(cls => (
          <div key={cls} className={`w-3 h-3 rounded-sm ${cls}`} />
        ))}
        <span className="text-xs text-gray-500">More</span>
      </div>
    </div>
  );
}

// ── Skill Heatmap ────────────────────────────────────────────────────────────
function SkillHeatmap({ data }) {
  if (!data || !data.rows?.length) return (
    <div className="flex items-center justify-center h-24 text-gray-500 text-sm">No quiz data yet</div>
  );

  const scoreColor = (score) => {
    if (score === null) return 'bg-gray-800 text-gray-600';
    if (score >= 80) return 'bg-emerald-500/25 text-emerald-300';
    if (score >= 60) return 'bg-yellow-500/25 text-yellow-300';
    if (score >= 40) return 'bg-orange-500/25 text-orange-300';
    return 'bg-red-500/25 text-red-300';
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left text-gray-500 font-normal py-1.5 pr-3">Dept</th>
            {data.tags.map(tag => (
              <th key={tag} className="text-gray-500 font-normal py-1.5 px-1 text-center capitalize" style={{ minWidth: '64px' }}>{tag}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map(row => (
            <tr key={row.department}>
              <td className="text-gray-400 font-medium pr-3 py-1.5 whitespace-nowrap">{row.department}</td>
              {row.scores.map((score, i) => (
                <td key={i} className="py-1 px-1">
                  <div className={`rounded px-1.5 py-1 text-center font-medium ${scoreColor(score)}`}>
                    {score !== null ? `${score}%` : '–'}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [tab, setTab] = useState('overview');
  const [analytics, setAnalytics] = useState(null);
  const [heatmap, setHeatmap] = useState([]);
  const [skillHeatmap, setSkillHeatmap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [heatmapWeeks, setHeatmapWeeks] = useState(12);

  useEffect(() => {
    analyticsApi.adminOverview()
      .then(setAnalytics)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (tab === 'analytics') {
      Promise.all([
        analyticsApi.heatmap(heatmapWeeks),
        analyticsApi.skillHeatmap(),
      ]).then(([h, s]) => { setHeatmap(h); setSkillHeatmap(s); }).catch(console.error);
    }
  }, [tab, heatmapWeeks]);

  if (loading) return (
    <Layout title="Admin Dashboard">
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    </Layout>
  );

  const overview = analytics?.overview || {};

  return (
    <Layout title="Admin Dashboard">
      <div className="max-w-6xl space-y-6">
        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-gray-800/60 rounded-xl w-fit border border-gray-700">
          {[
            { key: 'overview', label: 'Overview', icon: BarChart3 },
            { key: 'analytics', label: 'Analytics', icon: Activity },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === key ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Users" value={overview.users || 0} icon={Users} color="brand" />
              <StatCard label="Published Courses" value={overview.courses || 0} icon={BookOpen} color="blue" />
              <StatCard label="Total Enrollments" value={overview.enrollments || 0} icon={Trophy} color="green" />
              <StatCard label="Avg Retention" value={`${overview.avgRetention || 0}%`} icon={TrendingUp} color="yellow" />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Add Course', icon: Plus, path: '/admin/courses', color: 'brand' },
                { label: 'Manage Users', icon: Users, path: '/admin/users', color: 'blue' },
                { label: 'Manager View', icon: UserCheck, path: '/manager', color: 'green' },
                { label: 'Analytics', icon: BarChart3, path: '/admin', color: 'yellow' },
              ].map(action => (
                <Link key={action.label} to={action.path}
                  className="card flex items-center gap-3 hover:border-gray-500 hover:bg-gray-800/80 transition-all">
                  <div className={`w-9 h-9 rounded-lg bg-${action.color}-500/20 flex items-center justify-center`}>
                    <action.icon className={`w-4 h-4 text-${action.color}-400`} />
                  </div>
                  <span className="text-sm font-medium text-white">{action.label}</span>
                </Link>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="card">
                <h3 className="font-semibold text-white mb-4">User Roles</h3>
                {analytics?.roleBreakdown?.map(r => (
                  <div key={r.role} className="flex items-center justify-between py-2.5 border-b border-gray-800 last:border-0">
                    <span className="text-sm text-gray-400">{r.role}</span>
                    <span className="font-bold text-white">{r._count.id}</span>
                  </div>
                ))}
              </div>
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
          </>
        )}

        {/* ── ANALYTICS TAB ── */}
        {tab === 'analytics' && (
          <div className="space-y-6">
            {/* Activity heatmap */}
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-brand-400" />
                    Platform Activity
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">Quiz attempts + watch sessions + enrollments per day</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Show</span>
                  {[4, 8, 12, 24].map(w => (
                    <button key={w} onClick={() => setHeatmapWeeks(w)}
                      className={`text-xs px-2 py-1 rounded ${heatmapWeeks === w ? 'bg-brand-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}`}>
                      {w}w
                    </button>
                  ))}
                </div>
              </div>
              <ActivityHeatmap cells={heatmap} />
            </div>

            {/* Skill heatmap */}
            <div className="card space-y-4">
              <div>
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Grid className="w-4 h-4 text-brand-400" />
                  Skill Coverage by Department
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Average quiz score per department × course topic</p>
              </div>
              <SkillHeatmap data={skillHeatmap} />
              {skillHeatmap && (
                <div className="flex gap-4 text-xs mt-2">
                  {[
                    { cls: 'bg-emerald-500/25 text-emerald-300', label: '≥80% Strong' },
                    { cls: 'bg-yellow-500/25 text-yellow-300', label: '60–79% Good' },
                    { cls: 'bg-orange-500/25 text-orange-300', label: '40–59% Needs work' },
                    { cls: 'bg-red-500/25 text-red-300', label: '<40% At risk' },
                  ].map(({ cls, label }) => (
                    <div key={label} className={`px-2 py-0.5 rounded ${cls}`}>{label}</div>
                  ))}
                </div>
              )}
            </div>

            {/* Summary stats for analytics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Users" value={overview.users || 0} icon={Users} color="brand" />
              <StatCard label="Quiz Attempts" value={overview.quizAttempts || 0} icon={Trophy} color="green" />
              <StatCard label="Enrollments" value={overview.enrollments || 0} icon={BookOpen} color="blue" />
              <StatCard label="Avg Retention" value={`${overview.avgRetention || 0}%`} icon={TrendingUp} color="yellow" />
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
