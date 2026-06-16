import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Layout from '../../components/Layout';
import { gamificationApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Trophy, Medal, Star, Flame, Crown } from 'lucide-react';

export default function Leaderboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [badges, setBadges] = useState([]);
  const [period, setPeriod] = useState('all');
  const [loading, setLoading] = useState(true);

  const PERIOD_LABELS = {
    all: t('leaderboard.allTime'),
    weekly: t('leaderboard.weekly'),
    monthly: t('leaderboard.monthly'),
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      gamificationApi.leaderboard({ period }),
      gamificationApi.badges(),
    ]).then(([lb, b]) => {
      setData(lb);
      setBadges(b);
    }).finally(() => setLoading(false));
  }, [period]);

  const rankIcon = (rank) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="text-gray-500 font-bold text-sm">#{rank}</span>;
  };

  return (
    <Layout title={t('leaderboard.title')}>
      <div className="max-w-4xl space-y-6">
        {/* Period tabs */}
        <div className="flex gap-2">
          {Object.entries(PERIOD_LABELS).map(([p, label]) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${period === p ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" /></div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Rankings */}
            <div className="lg:col-span-2 card space-y-2">
              <div className="flex items-center justify-between pb-3 border-b border-gray-800">
                <h3 className="font-semibold text-white flex items-center gap-2"><Trophy className="w-4 h-4 text-yellow-400" /> Top Learners</h3>
                {data?.myRank && <span className="text-xs text-brand-400">{t('leaderboard.rank')}: #{data.myRank}</span>}
              </div>
              {data?.leaderboard?.map((entry) => {
                const isMe = entry.userId === user?.id;
                return (
                  <div key={entry.userId} className={`flex items-center gap-4 p-3 rounded-xl transition-colors ${isMe ? 'bg-brand-500/15 border border-brand-500/30' : 'hover:bg-gray-800/50'}`}>
                    <div className="w-8 flex items-center justify-center">{rankIcon(entry.rank)}</div>
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-pink-500 flex items-center justify-center text-white font-semibold text-sm">
                      {entry.name?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white flex items-center gap-2">
                        {entry.name} {isMe && <span className="text-xs text-brand-400">({t('leaderboard.you')})</span>}
                      </div>
                      <div className="text-xs text-gray-400">{entry.department}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-white">{entry.points?.toLocaleString()}</div>
                      <div className="text-xs text-gray-500">{t('leaderboard.points')}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Badges */}
            <div className="card space-y-3">
              <h3 className="font-semibold text-white flex items-center gap-2"><Star className="w-4 h-4 text-yellow-400" /> Badges</h3>
              <div className="space-y-2">
                {badges.map(b => (
                  <div key={b.id} className={`flex items-center gap-3 p-2.5 rounded-xl transition-colors ${b.earned ? 'bg-yellow-500/10 border border-yellow-500/20' : 'opacity-40 grayscale'}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${b.earned ? 'bg-yellow-500/20' : 'bg-gray-700'}`}>
                      {b.category === 'streak' ? '🔥' : b.category === 'quiz' ? '📝' : b.category === 'expertise' ? '💎' : b.category === 'skill' ? '🎯' : '⭐'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white truncate">{b.name}</div>
                      <div className="text-xs text-gray-500 truncate">{b.description}</div>
                    </div>
                    {b.earned && <Star className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
