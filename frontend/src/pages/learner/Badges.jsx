import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { gamificationApi } from '../../services/api';
import Layout from '../../components/Layout';
import { Lock, Star, Award, Zap } from 'lucide-react';

const CATEGORY_COLORS = {
  onboarding:  { ring: '#10b981', glow: 'rgba(16,185,129,0.35)', bg: 'rgba(16,185,129,0.08)', label: 'Onboarding' },
  quiz:        { ring: '#f59e0b', glow: 'rgba(245,158,11,0.35)',  bg: 'rgba(245,158,11,0.08)',  label: 'Quiz' },
  achievement: { ring: '#8b5cf6', glow: 'rgba(139,92,246,0.35)', bg: 'rgba(139,92,246,0.08)', label: 'Achievement' },
  streak:      { ring: '#ef4444', glow: 'rgba(239,68,68,0.35)',   bg: 'rgba(239,68,68,0.08)',   label: 'Streak' },
  expertise:   { ring: '#06b6d4', glow: 'rgba(6,182,212,0.35)',   bg: 'rgba(6,182,212,0.08)',   label: 'Expertise' },
  engagement:  { ring: '#ec4899', glow: 'rgba(236,72,153,0.35)', bg: 'rgba(236,72,153,0.08)', label: 'Engagement' },
  skill:       { ring: '#f97316', glow: 'rgba(249,115,22,0.35)', bg: 'rgba(249,115,22,0.08)', label: 'Skill' },
  points:      { ring: '#eab308', glow: 'rgba(234,179,8,0.35)',   bg: 'rgba(234,179,8,0.08)',   label: 'Points' },
};

function BadgeCard({ badge }) {
  const color = CATEGORY_COLORS[badge.category] || CATEGORY_COLORS.achievement;
  const dateStr = badge.earnedAt
    ? new Date(badge.earnedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div
      className="relative rounded-2xl p-5 flex flex-col items-center text-center transition-all duration-300 border"
      style={badge.earned
        ? { background: color.bg, borderColor: color.ring, boxShadow: `0 0 24px ${color.glow}` }
        : { background: 'rgba(17,24,39,0.6)', borderColor: 'rgba(75,85,99,0.4)' }
      }
    >
      {/* Category pill */}
      <span className="absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full font-medium"
        style={badge.earned
          ? { background: color.bg, color: color.ring, border: `1px solid ${color.ring}` }
          : { background: 'rgba(75,85,99,0.2)', color: '#6b7280', border: '1px solid rgba(75,85,99,0.3)' }
        }
      >
        {color.label}
      </span>

      {/* Icon */}
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-3 transition-all"
        style={badge.earned
          ? { background: `linear-gradient(135deg, ${color.ring}33, ${color.ring}11)`, border: `2px solid ${color.ring}` }
          : { background: 'rgba(55,65,81,0.5)', border: '2px solid rgba(75,85,99,0.3)', filter: 'grayscale(100%)' }
        }
      >
        {badge.earned ? badge.iconUrl : <Lock className="w-6 h-6 text-gray-600" />}
      </div>

      <h3 className={`text-sm font-bold mb-1 ${badge.earned ? 'text-white' : 'text-gray-500'}`}>
        {badge.name}
      </h3>
      <p className={`text-xs leading-relaxed mb-3 ${badge.earned ? 'text-gray-300' : 'text-gray-600'}`}>
        {badge.description}
      </p>

      {badge.earned ? (
        <div className="flex items-center gap-1.5 mt-auto" style={{ color: color.ring }}>
          <Star className="w-3.5 h-3.5 fill-current" />
          <span className="text-xs font-medium">Earned {dateStr}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 mt-auto text-gray-600">
          <Lock className="w-3.5 h-3.5" />
          <span className="text-xs">Not yet earned</span>
        </div>
      )}
    </div>
  );
}

export default function Badges() {
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    gamificationApi.badges()
      .then(setBadges)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const earned = badges.filter(b => b.earned);
  const locked = badges.filter(b => !b.earned);

  const categories = ['all', ...new Set(badges.map(b => b.category))];

  const filtered = filter === 'all'
    ? badges
    : filter === 'earned'
    ? earned
    : filter === 'locked'
    ? locked
    : badges.filter(b => b.category === filter);

  return (
    <Layout title="My Badges">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
            <div className="text-3xl font-bold text-yellow-400">{earned.length}</div>
            <div className="text-xs text-gray-500 mt-1 uppercase tracking-wider">Earned</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
            <div className="text-3xl font-bold text-gray-500">{locked.length}</div>
            <div className="text-xs text-gray-500 mt-1 uppercase tracking-wider">To Unlock</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
            <div className="text-3xl font-bold text-purple-400">
              {badges.length > 0 ? Math.round((earned.length / badges.length) * 100) : 0}%
            </div>
            <div className="text-xs text-gray-500 mt-1 uppercase tracking-wider">Completion</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-400" />
              <span className="text-white font-semibold">Badge Collection</span>
            </div>
            <span className="text-gray-400 text-sm">{earned.length} / {badges.length}</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${badges.length > 0 ? (earned.length / badges.length) * 100 : 0}%`,
                background: 'linear-gradient(90deg, #f59e0b, #8b5cf6, #ec4899)',
              }}
            />
          </div>
          <p className="text-gray-500 text-xs mt-2">
            Keep learning to unlock all badges and showcase your expertise!
          </p>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'All' },
            { key: 'earned', label: `Earned (${earned.length})` },
            { key: 'locked', label: `Locked (${locked.length})` },
            ...categories.filter(c => c !== 'all').map(c => ({
              key: c,
              label: (CATEGORY_COLORS[c]?.label || c),
            })),
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
                filter === f.key
                  ? 'bg-purple-600 text-white border-purple-500'
                  : 'bg-gray-900 text-gray-400 border-gray-700 hover:border-gray-500 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Badges grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-600">No badges in this category</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {/* Earned first */}
            {filtered.filter(b => b.earned).map(b => <BadgeCard key={b.id} badge={b} />)}
            {filtered.filter(b => !b.earned).map(b => <BadgeCard key={b.id} badge={b} />)}
          </div>
        )}

        {/* CTA if no badges earned */}
        {!loading && earned.length === 0 && (
          <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-800/50 rounded-2xl p-6 text-center">
            <Zap className="w-10 h-10 text-purple-400 mx-auto mb-3" />
            <h3 className="text-white font-bold text-lg mb-2">Start earning badges!</h3>
            <p className="text-gray-400 text-sm mb-4">Complete courses, take quizzes, and interact with your AI companion to unlock your first badge.</p>
            <Link to="/learn/courses" className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors">
              Browse Courses
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
}
