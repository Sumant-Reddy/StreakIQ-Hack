import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { quizApi } from '../../services/api';
import { CheckCircle, XCircle, Clock, Trophy, ChevronRight, AlertCircle } from 'lucide-react';

export default function QuizPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const timerRef = useRef();
  const startTime = useRef(Date.now());

  useEffect(() => {
    quizApi.get(id).then(q => {
      setQuiz(q);
      if (q.timeLimit) setTimeLeft(q.timeLimit);
    }).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (timeLeft === null || result) return;
    if (timeLeft <= 0) { handleSubmit(); return; }
    timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [timeLeft, result]);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    clearTimeout(timerRef.current);
    const timeTaken = Math.round((Date.now() - startTime.current) / 1000);
    try {
      const res = await quizApi.attempt(id, { answers, timeTaken });
      setResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  if (loading) return <Layout title="Quiz"><div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" /></div></Layout>;
  if (!quiz) return <Layout title="Quiz"><div className="text-gray-400 text-center mt-20">Quiz not found</div></Layout>;

  if (result) {
    return (
      <Layout title="Quiz Results">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className={`card text-center py-8 ${result.passed ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${result.passed ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
              {result.passed ? <Trophy className="w-10 h-10 text-emerald-400" /> : <AlertCircle className="w-10 h-10 text-red-400" />}
            </div>
            <h2 className="text-2xl font-bold text-white">{result.passed ? 'Congratulations!' : 'Keep Practicing'}</h2>
            <p className="text-gray-400 mt-1">{result.passed ? 'You passed the assessment!' : 'Review the material and try again'}</p>
            <div className="flex items-center justify-center gap-8 mt-6">
              <div>
                <div className="text-3xl font-bold text-white">{result.percentage}%</div>
                <div className="text-xs text-gray-400">Score</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white">{result.score}/{result.totalPoints}</div>
                <div className="text-xs text-gray-400">Points</div>
              </div>
            </div>
              {result.previousBestPct !== null && result.previousBestPct !== undefined && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <div className="text-xs text-gray-400 text-center mb-2">vs. Your Previous Best</div>
                  <div className="flex items-center justify-center gap-4 text-sm">
                    <span className="text-gray-400">Before: {result.previousBestPct}%</span>
                    <span className={result.percentage > result.previousBestPct ? 'text-emerald-400 font-bold' : 'text-red-400'}>
                      {result.percentage > result.previousBestPct ? '▲' : result.percentage < result.previousBestPct ? '▼' : '='} {Math.abs(result.percentage - result.previousBestPct)}%
                    </span>
                    <span className="text-white">Now: {result.percentage}%</span>
                  </div>
                </div>
              )}
              {result.pointsEarned !== undefined && (
                <div className="mt-3 text-center">
                  {result.pointsEarned > 0 ? (
                    <div className="text-emerald-400 text-sm font-medium">+{result.pointsEarned} points earned!</div>
                  ) : (
                    <div className="text-gray-400 text-xs">No new points — score not improved from previous attempt</div>
                  )}
                </div>
              )}
          </div>

          <div className="card space-y-3">
            <h3 className="font-semibold text-white">Question Review</h3>
            {result.breakdown?.map((item, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-xl ${item.correct ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                {item.correct ? <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />}
                <div>
                  <div className="text-sm text-white">{item.question}</div>
                  {item.explanation && <div className="text-xs text-gray-400 mt-1">{item.explanation}</div>}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={() => navigate(-1)} className="btn-secondary flex-1">Back to Course</button>
            <button onClick={() => { setResult(null); setAnswers({}); setCurrentQ(0); startTime.current = Date.now(); }} className="btn-primary flex-1">Retry Quiz</button>
          </div>
        </div>
      </Layout>
    );
  }

  const q = quiz.questions?.[currentQ];
  const options = typeof q?.options === 'string' ? JSON.parse(q.options) : (q?.options || []);

  return (
    <Layout title={quiz.title}>
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-400">Question {currentQ + 1} of {quiz.questions?.length}</div>
            <div className="w-48 h-1.5 bg-gray-800 rounded-full mt-1">
              <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${((currentQ + 1) / quiz.questions?.length) * 100}%` }} />
            </div>
              {quiz.attemptCount > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  Attempt #{quiz.attemptCount + 1} · Best: {quiz.bestPercentage}%
                </div>
              )}
          </div>
          {timeLeft !== null && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-mono font-bold ${timeLeft < 60 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-gray-800 text-white border border-gray-700'}`}>
              <Clock className="w-4 h-4" /> {formatTime(timeLeft)}
            </div>
          )}
        </div>

        {/* Question */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${q?.difficulty === 'EASY' ? 'bg-emerald-500/20 text-emerald-400' : q?.difficulty === 'HARD' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{q?.difficulty}</span>
            <span className="text-xs text-gray-500">{q?.type?.replace('_', ' ')}</span>
            <span className="text-xs text-gray-500 ml-auto">{q?.points} pts</span>
          </div>
          <p className="text-white font-medium leading-relaxed">{q?.text}</p>

          <div className="mt-5 space-y-2.5">
            {options.map((opt, i) => {
              const selected = answers[q?.id] === opt;
              return (
                <button key={i} onClick={() => setAnswers(a => ({ ...a, [q.id]: opt }))}
                  className={`w-full text-left px-4 py-3.5 rounded-xl border text-sm transition-all ${selected ? 'border-brand-500 bg-brand-500/20 text-brand-300' : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600 hover:bg-gray-800'}`}>
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mr-3 ${selected ? 'bg-brand-500 text-white' : 'bg-gray-700 text-gray-400'}`}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          <button onClick={() => setCurrentQ(q => Math.max(0, q - 1))} disabled={currentQ === 0} className="btn-secondary px-6">Previous</button>
          {currentQ < quiz.questions?.length - 1 ? (
            <button onClick={() => setCurrentQ(q => q + 1)} disabled={!answers[q?.id]} className="btn-primary flex-1 flex items-center justify-center gap-1.5">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting || Object.keys(answers).length < quiz.questions?.length}
              className="btn-primary flex-1 flex items-center justify-center gap-2">
              {submitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              Submit Quiz
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 text-center">{Object.keys(answers).length} / {quiz.questions?.length} answered</p>
      </div>
    </Layout>
  );
}
