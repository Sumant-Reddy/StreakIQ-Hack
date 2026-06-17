import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import { managerApi } from '../../services/api';
import {
  MessageSquare, ChevronDown, ChevronUp, Award, TrendingUp,
  User, Calendar, Star, ArrowLeft, Filter, Trophy
} from 'lucide-react';

const ScoreBar = ({ label, value, color = 'brand' }) => {
  const colors = {
    brand: 'bg-brand-500',
    green: 'bg-emerald-500',
    yellow: 'bg-yellow-500',
    orange: 'bg-orange-500',
    pink: 'bg-pink-500',
  };
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="font-semibold text-white">{value ?? '—'}</span>
      </div>
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${colors[color] || colors.brand} rounded-full transition-all duration-500`}
          style={{ width: value != null ? `${Math.min(value, 100)}%` : '0%' }}
        />
      </div>
    </div>
  );
};

const ScoreChip = ({ value }) => {
  if (value == null) return <span className="text-gray-600 text-xs">—</span>;
  const color = value >= 80 ? 'text-emerald-400' : value >= 60 ? 'text-yellow-400' : 'text-red-400';
  return <span className={`font-bold text-sm ${color}`}>{Math.round(value)}</span>;
};

const SCENARIO_LABELS = {
  anniversary: 'Anniversary Gift',
  engagement: 'Engagement Ring',
  upgrade: 'Diamond Upgrade',
  gifting: 'Corporate Gifting',
};

function scenarioLabel(s) {
  const lower = s?.toLowerCase() || '';
  for (const [k, v] of Object.entries(SCENARIO_LABELS)) {
    if (lower.includes(k)) return v;
  }
  return s || 'Custom';
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function TeamRoleplay() {
  const [sessions, setSessions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([managerApi.teamRoleplay(), managerApi.teamRoleplaySummary()])
      .then(([s, sum]) => { setSessions(s); setSummary(sum); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const scenarios = [...new Set(sessions.map(s => scenarioLabel(s.scenario)))];

  const filtered = filter === 'all'
    ? sessions
    : sessions.filter(s => scenarioLabel(s.scenario) === filter);

  if (loading) {
    return (
      <Layout title="Roleplay Sessions">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Roleplay Sessions">
      <div className="max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/manager" className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Team Roleplay Performance</h1>
            <p className="text-sm text-gray-400">{sessions.length} sessions across your team</p>
          </div>
        </div>

        {/* Summary stats */}
        {summary && summary.total > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: 'Total Sessions', value: summary.total, icon: MessageSquare, color: 'text-brand-400' },
              { label: 'Avg Overall', value: `${summary.avgOverall}%`, icon: Star, color: 'text-yellow-400' },
              { label: 'Avg Product', value: `${summary.avgProduct}%`, icon: Award, color: 'text-emerald-400' },
              { label: 'Avg Comms', value: `${summary.avgComm}%`, icon: TrendingUp, color: 'text-blue-400' },
              { label: 'Avg Upsell', value: `${summary.avgUpsell}%`, icon: TrendingUp, color: 'text-orange-400' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="card py-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <span className="text-xs text-gray-400">{label}</span>
                </div>
                <div className="text-2xl font-bold text-white">{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Top performer + scenario breakdown */}
        {summary && summary.total > 0 && (
          <div className="grid lg:grid-cols-2 gap-4">
            {summary.topPerformer && (
              <div className="card flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center shrink-0">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Top Performer</div>
                  <div className="font-semibold text-white">{summary.topPerformer.name}</div>
                  <div className="text-xs text-yellow-400">{summary.topPerformer.avgScore}% avg overall score</div>
                </div>
              </div>
            )}
            <div className="card">
              <div className="text-xs text-gray-400 mb-3">Sessions by Scenario</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(summary.scenarioCounts || {}).map(([sc, count]) => (
                  <div key={sc} className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-800 rounded-lg text-xs">
                    <span className="text-gray-300">{scenarioLabel(sc)}</span>
                    <span className="text-brand-400 font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Filter bar */}
        {sessions.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-gray-500" />
            {['all', ...scenarios].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filter === f ? 'bg-brand-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}>
                {f === 'all' ? 'All Scenarios' : f}
              </button>
            ))}
          </div>
        )}

        {/* Sessions list */}
        {filtered.length === 0 ? (
          <div className="card text-center py-16">
            <MessageSquare className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <div className="text-gray-400">No roleplay sessions yet</div>
            <div className="text-xs text-gray-600 mt-1">Sessions appear here after learners complete a roleplay</div>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(session => {
              const isOpen = expanded === session.id;
              const transcript = Array.isArray(session.transcript) ? session.transcript : [];
              return (
                <div key={session.id} className="card overflow-hidden">
                  {/* Session header row */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : session.id)}
                    className="w-full flex items-center gap-4 text-left"
                  >
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-pink-500 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                      {session.user?.name?.[0]?.toUpperCase() || '?'}
                    </div>

                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white text-sm">{session.user?.name || 'Unknown'}</span>
                        <span className="px-2 py-0.5 rounded-full bg-gray-800 text-xs text-gray-400">
                          {scenarioLabel(session.scenario)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />{formatDate(session.completedAt)}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />{transcript.length} turns
                        </span>
                        {session.user?.department && (
                          <span className="text-xs text-gray-500">{session.user.department}</span>
                        )}
                      </div>
                    </div>

                    {/* Score chips */}
                    <div className="hidden md:grid grid-cols-4 gap-4 text-center shrink-0">
                      {[
                        { label: 'Product', val: session.productScore },
                        { label: 'Comms', val: session.communicationScore },
                        { label: 'Upsell', val: session.upsellScore },
                        { label: 'Overall', val: session.overallScore },
                      ].map(({ label, val }) => (
                        <div key={label}>
                          <ScoreChip value={val} />
                          <div className="text-xs text-gray-600 mt-0.5">{label}</div>
                        </div>
                      ))}
                    </div>

                    <div className="text-gray-600 shrink-0">
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>

                  {/* Mobile score row */}
                  <div className="md:hidden grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-gray-800 text-center">
                    {[
                      { label: 'Product', val: session.productScore },
                      { label: 'Comms', val: session.communicationScore },
                      { label: 'Upsell', val: session.upsellScore },
                      { label: 'Overall', val: session.overallScore },
                    ].map(({ label, val }) => (
                      <div key={label}>
                        <ScoreChip value={val} />
                        <div className="text-xs text-gray-600 mt-0.5">{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="mt-4 pt-4 border-t border-gray-800 grid lg:grid-cols-5 gap-6">
                      {/* Score bars */}
                      <div className="lg:col-span-2 space-y-3">
                        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Score Breakdown</div>
                        <ScoreBar label="Product Knowledge" value={session.productScore} color="brand" />
                        <ScoreBar label="Confidence" value={session.confidenceScore} color="green" />
                        <ScoreBar label="Communication" value={session.communicationScore} color="yellow" />
                        <ScoreBar label="Upselling" value={session.upsellScore} color="orange" />
                        <div className="pt-2 border-t border-gray-800">
                          <ScoreBar label="Overall Score" value={session.overallScore} color="pink" />
                        </div>

                        {/* Feedback */}
                        {session.feedback && (
                          <div className="mt-3 p-3 bg-gray-800/60 rounded-xl">
                            <div className="text-xs font-medium text-gray-400 mb-1.5">AI Feedback</div>
                            <p className="text-xs text-gray-300 leading-relaxed">{session.feedback}</p>
                          </div>
                        )}

                        {/* Strengths & Improvements */}
                        {(session.strengths?.length > 0 || session.improvements?.length > 0) && (
                          <div className="grid grid-cols-2 gap-3">
                            {session.strengths?.length > 0 && (
                              <div>
                                <div className="text-xs font-medium text-emerald-400 mb-1.5">Strengths</div>
                                <ul className="space-y-1">
                                  {session.strengths.map((s, i) => (
                                    <li key={i} className="text-xs text-gray-300 flex items-start gap-1.5">
                                      <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>{s}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {session.improvements?.length > 0 && (
                              <div>
                                <div className="text-xs font-medium text-orange-400 mb-1.5">Improve</div>
                                <ul className="space-y-1">
                                  {session.improvements.map((s, i) => (
                                    <li key={i} className="text-xs text-gray-300 flex items-start gap-1.5">
                                      <span className="text-orange-500 mt-0.5 shrink-0">↑</span>{s}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Transcript */}
                      <div className="lg:col-span-3">
                        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
                          Conversation Transcript ({transcript.length} turns)
                        </div>
                        <div className="space-y-2 max-h-96 overflow-y-auto pr-1 scrollbar-thin">
                          {transcript.map((turn, i) => (
                            <div key={i} className={`flex gap-2 ${turn.role === 'consultant' ? 'justify-end' : 'justify-start'}`}>
                              {turn.role === 'customer' && (
                                <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center shrink-0 mt-0.5">
                                  <User className="w-3 h-3 text-gray-400" />
                                </div>
                              )}
                              <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                                turn.role === 'consultant'
                                  ? 'bg-brand-500/20 text-brand-100 border border-brand-500/30'
                                  : 'bg-gray-800 text-gray-200 border border-gray-700'
                              }`}>
                                <div className={`text-[10px] font-medium mb-1 ${
                                  turn.role === 'consultant' ? 'text-brand-400' : 'text-gray-500'
                                }`}>
                                  {turn.role === 'consultant' ? session.user?.name || 'Consultant' : 'Customer'}
                                </div>
                                {turn.content}
                              </div>
                              {turn.role === 'consultant' && (
                                <div className="w-6 h-6 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center shrink-0 mt-0.5">
                                  <User className="w-3 h-3 text-brand-400" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
