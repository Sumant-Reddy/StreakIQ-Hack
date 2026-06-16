import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import { learnerApi } from '../../services/api';
import { Award, CheckCircle, XCircle, Clock, BookOpen, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';

const STATUS_CONFIG = {
  READY: {
    label: 'Ready to Certify',
    cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    cardBorder: 'border-emerald-500/20',
    icon: CheckCircle,
  },
  NEARLY_READY: {
    label: 'Nearly Ready',
    cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    cardBorder: 'border-yellow-500/20',
    icon: Clock,
  },
  NOT_READY: {
    label: 'Not Ready',
    cls: 'text-red-400 bg-red-500/10 border-red-500/30',
    cardBorder: 'border-gray-700',
    icon: XCircle,
  },
};

function ReadinessBar({ score }) {
  const color = score >= 80 ? 'from-emerald-500 to-emerald-400' : score >= 50 ? 'from-yellow-500 to-yellow-400' : 'from-red-500 to-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${color} rounded-full transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-sm font-bold text-white w-10 text-right">{score}%</span>
    </div>
  );
}

export default function MyCertifications() {
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    learnerApi.certifications()
      .then(data => {
        setCerts(Array.isArray(data) ? data : []);
        // Auto-expand NEARLY_READY certs
        const autoExpand = {};
        data.forEach(c => { if (c.status === 'NEARLY_READY') autoExpand[c.id] = true; });
        setExpanded(autoExpand);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const ready = certs.filter(c => c.status === 'READY').length;
  const nearly = certs.filter(c => c.status === 'NEARLY_READY').length;
  const notReady = certs.filter(c => c.status === 'NOT_READY').length;

  return (
    <Layout title="My Certifications">
      <div className="max-w-4xl space-y-6">
        {/* Summary cards */}
        {!loading && certs.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <div className="card text-center py-5 border-emerald-500/20 bg-emerald-500/5">
              <div className="text-3xl font-bold text-emerald-400">{ready}</div>
              <div className="text-sm text-gray-400 mt-1">Ready to Certify</div>
            </div>
            <div className="card text-center py-5 border-yellow-500/20 bg-yellow-500/5">
              <div className="text-3xl font-bold text-yellow-400">{nearly}</div>
              <div className="text-sm text-gray-400 mt-1">Nearly Ready</div>
            </div>
            <div className="card text-center py-5 border-gray-700">
              <div className="text-3xl font-bold text-gray-400">{notReady}</div>
              <div className="text-sm text-gray-400 mt-1">In Progress</div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
          </div>
        ) : certs.length === 0 ? (
          <div className="card text-center py-16">
            <Award className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <div className="text-gray-400 font-medium">No certification tracks available yet</div>
            <div className="text-sm text-gray-500 mt-1">Your admin will add certification requirements soon</div>
            <Link to="/learn/courses" className="btn-primary mt-4 inline-block px-6">Browse Courses</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {certs
              .sort((a, b) => {
                const order = { READY: 0, NEARLY_READY: 1, NOT_READY: 2 };
                return order[a.status] - order[b.status];
              })
              .map(cert => {
                const cfg = STATUS_CONFIG[cert.status] || STATUS_CONFIG.NOT_READY;
                const Icon = cfg.icon;
                const isExpanded = expanded[cert.id];

                return (
                  <div key={cert.id} className={`card border ${cfg.cardBorder}`}>
                    {/* Header */}
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${cert.status === 'READY' ? 'bg-emerald-500/20' : cert.status === 'NEARLY_READY' ? 'bg-yellow-500/20' : 'bg-gray-700/50'}`}>
                        <Award className={`w-6 h-6 ${cert.status === 'READY' ? 'text-emerald-400' : cert.status === 'NEARLY_READY' ? 'text-yellow-400' : 'text-gray-500'}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-white">{cert.name}</h3>
                          <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.cls}`}>
                            <Icon className="w-3 h-3" /> {cfg.label}
                          </span>
                        </div>
                        {cert.description && <p className="text-sm text-gray-400 mt-0.5">{cert.description}</p>}

                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                            <span>Overall Readiness</span>
                            <span className="text-gray-400">{cert.courses.length} course{cert.courses.length !== 1 ? 's' : ''} required</span>
                          </div>
                          <ReadinessBar score={cert.readinessScore} />
                        </div>

                        {cert.status === 'READY' && (
                          <div className="mt-3">
                            <Link to={`/learn/certificate/${cert.id}`}
                              className="inline-flex items-center gap-1.5 text-xs bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 px-3 py-1.5 rounded-lg border border-yellow-500/30 transition-colors font-medium">
                              <Award className="w-3.5 h-3.5" /> View Certificate
                            </Link>
                          </div>
                        )}

                        <div className="flex gap-4 mt-2 text-xs text-gray-500">
                          <span>Need ≥{cert.minQuizScore}% on quizzes</span>
                          <span>Need ≥{cert.minCourseCompletion}% completion</span>
                        </div>
                      </div>

                      <button onClick={() => setExpanded(e => ({ ...e, [cert.id]: !e[cert.id] }))}
                        className="text-gray-400 hover:text-white p-1 shrink-0">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>

                    {/* Course breakdown */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-gray-800 space-y-3">
                        <div className="text-xs font-medium text-gray-400">Course Requirements</div>
                        {cert.courses.map(c => {
                          const allMet = c.completionMet && c.quizMet;
                          return (
                            <div key={c.id} className={`rounded-xl p-3.5 border ${allMet ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-gray-800/50 border-gray-700'}`}>
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <BookOpen className={`w-4 h-4 shrink-0 ${allMet ? 'text-emerald-400' : 'text-gray-500'}`} />
                                  <span className="text-sm font-medium text-white truncate">{c.title}</span>
                                </div>
                                {!c.enrolled ? (
                                  <Link to="/learn/courses" className="text-xs text-brand-400 hover:text-brand-300 shrink-0 flex items-center gap-1">
                                    Enroll <ChevronRight className="w-3 h-3" />
                                  </Link>
                                ) : allMet ? (
                                  <span className="text-xs text-emerald-400 shrink-0 flex items-center gap-1">
                                    <CheckCircle className="w-3.5 h-3.5" /> Done
                                  </span>
                                ) : null}
                              </div>

                              <div className="grid grid-cols-2 gap-3 mt-2.5">
                                {/* Completion */}
                                <div>
                                  <div className="flex justify-between text-xs mb-1">
                                    <span className="text-gray-500">Completion</span>
                                    <span className={c.completionMet ? 'text-emerald-400' : 'text-gray-400'}>
                                      {c.completion}% / {cert.minCourseCompletion}%
                                      {c.completionMet && ' ✓'}
                                    </span>
                                  </div>
                                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${c.completionMet ? 'bg-emerald-500' : 'bg-brand-500'}`}
                                      style={{ width: `${Math.min(100, c.completion)}%` }} />
                                  </div>
                                </div>

                                {/* Quiz */}
                                <div>
                                  <div className="flex justify-between text-xs mb-1">
                                    <span className="text-gray-500">Quiz Score</span>
                                    <span className={c.quizMet ? 'text-emerald-400' : c.quizScore ? 'text-yellow-400' : 'text-gray-500'}>
                                      {c.quizScore !== null ? `${c.quizScore}% / ${cert.minQuizScore}%` : `Not taken · need ${cert.minQuizScore}%`}
                                      {c.quizMet && ' ✓'}
                                    </span>
                                  </div>
                                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${c.quizMet ? 'bg-emerald-500' : 'bg-yellow-500'}`}
                                      style={{ width: `${Math.min(100, c.quizScore || 0)}%` }} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
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
