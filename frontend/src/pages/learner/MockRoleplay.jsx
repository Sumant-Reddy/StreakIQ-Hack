import { useState, useEffect, useRef } from 'react';
import Layout from '../../components/Layout';
import { MessageSquare, Send, Star, Trophy, ChevronRight, User, ShoppingBag, BarChart3, X } from 'lucide-react';
import { io } from 'socket.io-client';

const SCENARIOS = [
  {
    id: 'anniversary',
    title: 'Anniversary Gift Seeker',
    persona: 'middle-aged',
    desc: 'Customer looking for a diamond ring for 10th wedding anniversary, budget ~₹50,000',
    difficulty: 'EASY',
    color: 'emerald',
  },
  {
    id: 'engagement',
    title: 'First-time Engagement Ring Buyer',
    persona: 'young professional',
    desc: 'Nervous buyer, first purchase, needs education on diamonds, budget flexible',
    difficulty: 'MEDIUM',
    color: 'brand',
  },
  {
    id: 'upgrade',
    title: 'Solitaire Upgrade Customer',
    persona: 'knowledgeable',
    desc: 'Experienced buyer wanting to upgrade from 0.5ct to 1ct, compares online prices',
    difficulty: 'HARD',
    color: 'orange',
  },
  {
    id: 'gifting',
    title: 'Corporate Gifting Client',
    persona: 'corporate executive',
    desc: 'Looking for 5 gift sets for employees, under ₹10,000 each, wants engraving',
    difficulty: 'MEDIUM',
    color: 'blue',
  },
];

const SCORE_LABELS = {
  productScore: 'Product Knowledge',
  confidenceScore: 'Confidence',
  communicationScore: 'Communication',
  upsellScore: 'Upselling Ability',
};

export default function MockRoleplay() {
  const [phase, setPhase] = useState('select'); // select | roleplay | scored
  const [scenario, setScenario] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [socket, setSocket] = useState(null);
  const [scores, setScores] = useState(null);
  const bottomRef = useRef();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startRoleplay = (s) => {
    setScenario(s);
    setMessages([]);
    setPhase('roleplay');

    const token = localStorage.getItem('yami_token');
    const sock = io('/', { auth: { token }, transports: ['websocket'] });
    setSocket(sock);

    sock.on('roleplay:message', ({ role, content }) => {
      setMessages(prev => [...prev, { role, content }]);
      setLoading(false);
    });

    sock.on('roleplay:scored', (scores) => {
      setScores(scores);
      setPhase('scored');
      sock.disconnect();
    });

    sock.emit('roleplay:start', { scenario: s.desc, customerPersona: s.persona });
    setLoading(true);
  };

  const sendMessage = () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'consultant', content: msg }]);
    setLoading(true);
    socket?.emit('roleplay:respond', { message: msg });
  };

  const endSession = () => {
    setLoading(true);
    socket?.emit('roleplay:end');
  };

  const reset = () => {
    setPhase('select');
    setScenario(null);
    setMessages([]);
    setScores(null);
    socket?.disconnect();
  };

  const difficultyColor = { EASY: 'emerald', MEDIUM: 'yellow', HARD: 'red' };

  if (phase === 'select') return (
    <Layout title="AI Mock Customer Roleplay">
      <div className="max-w-4xl space-y-6">
        <div className="bg-gradient-to-r from-brand-600/20 to-pink-600/20 border border-brand-500/30 rounded-xl p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-500/30 flex items-center justify-center shrink-0">
              <MessageSquare className="w-6 h-6 text-brand-400" />
            </div>
            <div>
              <h2 className="font-bold text-white">AI Customer Roleplay</h2>
              <p className="text-sm text-gray-400 mt-1">Practice real customer conversations with AI. Get scored on Product Knowledge, Confidence, Communication, and Upselling Ability.</p>
            </div>
          </div>
        </div>

        <h3 className="font-semibold text-white">Choose a Scenario</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {SCENARIOS.map(s => {
            const dc = difficultyColor[s.difficulty];
            return (
              <button key={s.id} onClick={() => startRoleplay(s)}
                className="card text-left hover:border-brand-500/50 hover:bg-gray-800/80 transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500/30 to-pink-500/30 flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5 text-brand-400" />
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium bg-${dc}-500/20 text-${dc}-400 border border-${dc}-500/30`}>{s.difficulty}</span>
                </div>
                <h4 className="font-semibold text-white group-hover:text-brand-300 transition-colors">{s.title}</h4>
                <p className="text-sm text-gray-400 mt-1 leading-relaxed">{s.desc}</p>
                <div className="flex items-center gap-1.5 mt-3 text-brand-400 text-xs font-medium">
                  Start Roleplay <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </Layout>
  );

  if (phase === 'scored' && scores) return (
    <Layout title="Roleplay Results">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="card text-center py-8 border-brand-500/30 bg-brand-500/5">
          <Trophy className="w-14 h-14 text-yellow-400 mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-white">Session Complete!</h2>
          <p className="text-gray-400 text-sm mt-1">Here's your performance breakdown</p>
          <div className="text-5xl font-bold text-white mt-5">{Math.round(scores.overallScore || 0)}%</div>
          <div className="text-sm text-gray-400 mt-1">Overall Score</div>
        </div>

        <div className="card space-y-4">
          <h3 className="font-semibold text-white">Score Breakdown</h3>
          {Object.entries(SCORE_LABELS).map(([key, label]) => {
            const val = Math.round(scores[key] || 0);
            return (
              <div key={key}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-400">{label}</span>
                  <span className="font-medium text-white">{val}%</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${val}%`,
                    background: val >= 80 ? '#10b981' : val >= 60 ? '#f59e0b' : '#ef4444',
                  }} />
                </div>
              </div>
            );
          })}
        </div>

        {scores.feedback && (
          <div className="card space-y-3">
            <h3 className="font-semibold text-white">AI Feedback</h3>
            <p className="text-sm text-gray-300 leading-relaxed">{scores.feedback}</p>
            {scores.strengths?.length > 0 && (
              <div>
                <div className="text-xs text-emerald-400 font-medium mb-2">Strengths</div>
                {scores.strengths.map((s, i) => <div key={i} className="text-sm text-gray-300 flex items-center gap-2"><span className="text-emerald-400">✓</span> {s}</div>)}
              </div>
            )}
            {scores.improvements?.length > 0 && (
              <div>
                <div className="text-xs text-orange-400 font-medium mb-2 mt-3">Areas to Improve</div>
                {scores.improvements.map((s, i) => <div key={i} className="text-sm text-gray-300 flex items-center gap-2"><span className="text-orange-400">→</span> {s}</div>)}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={reset} className="btn-secondary flex-1">New Scenario</button>
          <button onClick={() => startRoleplay(scenario)} className="btn-primary flex-1">Retry Same</button>
        </div>
      </div>
    </Layout>
  );

  return (
    <Layout title={`Roleplay: ${scenario?.title}`}>
      <div className="max-w-3xl mx-auto h-[calc(100vh-160px)] flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="bg-brand-500/10 border border-brand-500/30 rounded-xl px-4 py-2.5 flex-1">
            <div className="text-xs text-brand-400 font-medium">Scenario</div>
            <div className="text-sm text-white">{scenario?.desc}</div>
          </div>
          <button onClick={endSession} disabled={loading} className="btn-secondary flex items-center gap-2 shrink-0">
            <BarChart3 className="w-4 h-4" /> End & Score
          </button>
          <button onClick={reset} className="p-2.5 text-gray-400 hover:text-white bg-gray-800 rounded-lg border border-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chat */}
        <div className="flex-1 overflow-y-auto card space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Waiting for customer greeting...</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'consultant' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${m.role === 'customer' ? 'bg-gradient-to-br from-pink-500 to-orange-500 text-white' : 'bg-gray-700 text-gray-300'}`}>
                {m.role === 'customer' ? 'C' : 'JC'}
              </div>
              <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === 'customer' ? 'bg-gray-800 text-gray-100 rounded-tl-sm' : 'bg-brand-600 text-white rounded-tr-sm'}`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center text-xs font-bold text-white">C</div>
              <div className="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1">{[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-pink-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex gap-3">
          <input className="input flex-1" placeholder="Type your response as a jewelry consultant..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()} disabled={loading} />
          <button onClick={sendMessage} disabled={loading || !input.trim()} className="btn-primary w-11 h-11 p-0 flex items-center justify-center shrink-0 disabled:opacity-50">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Layout>
  );
}
