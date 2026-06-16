import { useState, useEffect, useRef } from 'react';
import Layout from '../../components/Layout';
import { MessageSquare, Send, Trophy, ChevronRight, ShoppingBag, BarChart3, X, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useSocket } from '../../contexts/SocketContext';

const SCENARIOS = [
  {
    id: 'anniversary',
    title: 'Anniversary Gift Seeker',
    persona: 'middle-aged',
    desc: 'Customer looking for a diamond ring for 10th wedding anniversary, budget ~₹50,000',
    difficulty: 'EASY',
    theme: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
  },
  {
    id: 'engagement',
    title: 'First-time Engagement Ring Buyer',
    persona: 'young professional',
    desc: 'Nervous buyer, first purchase, needs education on diamonds, budget flexible',
    difficulty: 'MEDIUM',
    theme: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
  },
  {
    id: 'upgrade',
    title: 'Solitaire Upgrade Customer',
    persona: 'knowledgeable',
    desc: 'Experienced buyer wanting to upgrade from 0.5ct to 1ct, compares online prices',
    difficulty: 'HARD',
    theme: 'bg-red-500/20 text-red-400 border-red-500/30'
  },
  {
    id: 'gifting',
    title: 'Corporate Gifting Client',
    persona: 'corporate executive',
    desc: 'Looking for 5 gift sets for employees, under ₹10,000 each, wants engraving',
    difficulty: 'MEDIUM',
    theme: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
  },
];

const SCORE_LABELS = {
  productScore: 'Product Knowledge',
  confidenceScore: 'Confidence',
  communicationScore: 'Communication',
  upsellScore: 'Upselling Ability',
};

const BUILT_IN_RESPONSES = {
  anniversary: [
    "Good morning! I'm looking for a special diamond ring for my 10th anniversary. Budget around ₹50,000. What do you recommend?",
    "That sounds beautiful! Can you tell me more about the diamond quality?",
    "Does this come with a certificate of authenticity?",
    "What warranty do you offer on this piece?",
  ],
  engagement: [
    "Hi! This is my first time buying an engagement ring. I don't know much about diamonds — where do I start?",
    "What's the difference between diamond cuts? I keep hearing about 'round brilliant' online.",
    "My budget is around ₹80,000 to ₹1.2 lakh. What would you suggest?",
    "Does CaratLane offer try-at-home service?",
  ],
  upgrade: [
    "I have a 0.5ct solitaire and want to upgrade to 1ct. I've seen similar stones cheaper online. Can you justify the price difference?",
    "The site I found offers 1ct SI1 G-color for ₹1.8 lakh. What makes CaratLane's worth more?",
    "What about cut grade? That site doesn't mention it.",
    "What's the best 1ct stone in the ₹2–2.5 lakh range?",
  ],
  gifting: [
    "I need 5 gift sets for employees, budget ₹10,000 each, with personalized engraving. Is that possible?",
    "What pieces work well as gender-neutral corporate gifts?",
    "Can you offer a bulk/corporate discount? We do this quarterly.",
    "What's the lead time for engraving and bulk dispatch?",
  ],
};

function offlineScore(messages) {
  const consultantMessages = messages.filter(m => m.role === 'consultant');
  if (consultantMessages.length === 0) {
    return { productScore: 50, confidenceScore: 50, communicationScore: 50, upsellScore: 50, overallScore: 50, feedback: 'Practice session completed offline.', strengths: [], improvements: ['Connect to the live service for detailed AI feedback.'] };
  }
  const totalWords = consultantMessages.reduce((sum, m) => sum + m.content.split(/\s+/).length, 0);
  const avgWords = totalWords / consultantMessages.length;
  const allText = consultantMessages.map(m => m.content.toLowerCase()).join(' ');
  const productKeywords = ['diamond', 'carat', 'clarity', 'cut', 'color', 'certificate', 'igi', 'gia', 'solitaire', 'setting', 'quality', 'si', 'vs', 'vvs'];
  const upsellKeywords = ['also', 'additionally', 'complement', 'pair', 'matching', 'warranty', 'care', 'plan', 'upgrade', 'premium'];
  const productHits = productKeywords.filter(k => allText.includes(k)).length;
  const upsellHits = upsellKeywords.filter(k => allText.includes(k)).length;
  const productScore = Math.min(95, 50 + productHits * 5);
  const upsellScore = Math.min(90, 45 + upsellHits * 7);
  const communicationScore = Math.min(90, Math.max(40, 40 + Math.round(avgWords * 1.2)));
  const confidenceScore = Math.min(88, 50 + consultantMessages.length * 4);
  const overallScore = Math.round((productScore + upsellScore + communicationScore + confidenceScore) / 4);
  const strengths = [];
  const improvements = [];
  if (productScore >= 70) strengths.push('Good product knowledge demonstrated.');
  else improvements.push('Mention more product specifics like cut, clarity, and certification.');
  if (upsellScore >= 65) strengths.push('Attempted upselling and cross-selling.');
  else improvements.push('Try introducing complementary products or care plans.');
  if (communicationScore >= 65) strengths.push('Clear and detailed responses.');
  else improvements.push('Expand your answers with more detail and context.');
  return { productScore, confidenceScore, communicationScore, upsellScore, overallScore, feedback: 'Offline mock scoring based on response length and keyword usage. Connect to live service for AI-powered feedback.', strengths, improvements };
}

export default function MockRoleplay() {
  const { socket, connected, connecting, reconnect } = useSocket();
  const [phase, setPhase] = useState('select'); // select | roleplay | scored
  const [scenario, setScenario] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [scores, setScores] = useState(null);
  const [offlineMode, setOfflineMode] = useState(false);
  const [offlineIndex, setOfflineIndex] = useState(0);
  const bottomRef = useRef();
  const pendingScenarioRef = useRef(null);
  const offlineTimerRef = useRef(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle centralized socket listeners safely — re-run when socket ref changes
  useEffect(() => {
    if (!socket) return;

    socket.on('roleplay:message', ({ role, content }) => {
      setMessages(prev => [...prev, { role, content }]);
      setLoading(false);
    });

    socket.on('roleplay:scored', (scoredData) => {
      setScores(scoredData);
      setPhase('scored');
      setLoading(false);
    });

    return () => {
      socket.off('roleplay:message');
      socket.off('roleplay:scored');
    };
  }, [socket]);

  // Fire pending scenario emit once socket becomes connected
  useEffect(() => {
    if (connected && pendingScenarioRef.current) {
      const s = pendingScenarioRef.current;
      pendingScenarioRef.current = null;
      // Cancel offline fallback timer if socket connected in time
      if (offlineTimerRef.current) {
        clearTimeout(offlineTimerRef.current);
        offlineTimerRef.current = null;
      }
      socket.emit('roleplay:start', { scenario: s.desc, customerPersona: s.persona });
    }
  }, [connected, socket]);

  const startRoleplay = (s) => {
    setScenario(s);
    setMessages([]);
    setPhase('roleplay');
    setOfflineMode(false);
    setOfflineIndex(0);

    // Clear any existing offline timer
    if (offlineTimerRef.current) {
      clearTimeout(offlineTimerRef.current);
      offlineTimerRef.current = null;
    }

    if (connected && socket) {
      setLoading(true);
      socket.emit('roleplay:start', { scenario: s.desc, customerPersona: s.persona });
    } else if (connecting) {
      // Store pending scenario; the useEffect above will emit once connected
      pendingScenarioRef.current = s;
      setLoading(true);
      // After 5 seconds, if still not connected, fall back to offline mode
      offlineTimerRef.current = setTimeout(() => {
        if (pendingScenarioRef.current) {
          pendingScenarioRef.current = null;
          activateOfflineMode(s);
        }
      }, 5000);
    } else {
      // Not connected and not connecting — activate offline mode immediately
      activateOfflineMode(s);
    }
  };

  const activateOfflineMode = (s) => {
    setOfflineMode(true);
    setOfflineIndex(1); // next response index starts at 1 (0 already shown as opening)
    const opening = BUILT_IN_RESPONSES[s.id]?.[0] ?? "Hello, I'm looking for something special today.";
    setMessages([{ role: 'customer', content: opening }]);
    setLoading(false);
  };

  // Clean up offline timer on unmount
  useEffect(() => {
    return () => {
      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
    };
  }, []);

  const sendMessage = () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'consultant', content: msg }]);

    if (offlineMode) {
      // Cycle through built-in responses locally
      const responses = BUILT_IN_RESPONSES[scenario?.id] ?? [];
      const nextIdx = offlineIndex;
      if (nextIdx < responses.length) {
        setLoading(true);
        setTimeout(() => {
          setMessages(prev => [...prev, { role: 'customer', content: responses[nextIdx] }]);
          setOfflineIndex(nextIdx + 1);
          setLoading(false);
        }, 800 + Math.random() * 600);
      }
      // If we've run out of responses, just let the consultant keep typing (no more customer lines)
    } else {
      setLoading(true);
      socket?.emit('roleplay:respond', { message: msg });
    }
  };

  const endSession = () => {
    if (offlineMode) {
      // Score locally without socket
      const result = offlineScore(messages);
      setScores(result);
      setPhase('scored');
      return;
    }
    setLoading(true);
    socket?.emit('roleplay:end');
  };

  const reset = () => {
    pendingScenarioRef.current = null;
    if (offlineTimerRef.current) {
      clearTimeout(offlineTimerRef.current);
      offlineTimerRef.current = null;
    }
    setPhase('select');
    setScenario(null);
    setMessages([]);
    setScores(null);
    setLoading(false);
    setOfflineMode(false);
    setOfflineIndex(0);
  };

  // Connection status indicator component (used in roleplay view header)
  const ConnectionBadge = () => {
    if (offlineMode) {
      return (
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-orange-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
            Practice Offline
          </span>
        </div>
      );
    }
    if (connected) {
      return (
        <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
          Live
        </span>
      );
    }
    if (connecting) {
      return (
        <span className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block animate-pulse" />
          Connecting...
        </span>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs text-red-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
          Offline
        </span>
        <button
          onClick={reconnect}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded px-2 py-0.5 transition-colors"
        >
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      </div>
    );
  };

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
          {SCENARIOS.map(s => (
            <button key={s.id} onClick={() => startRoleplay(s)}
              className="card text-left hover:border-brand-500/50 hover:bg-gray-800/80 transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500/30 to-pink-500/30 flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-brand-400" />
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${s.theme}`}>
                  {s.difficulty}
                </span>
              </div>
              <h4 className="font-semibold text-white group-hover:text-brand-300 transition-colors">{s.title}</h4>
              <p className="text-sm text-gray-400 mt-1 leading-relaxed">{s.desc}</p>
              <div className="flex items-center gap-1.5 mt-3 text-brand-400 text-xs font-medium">
                Start Roleplay <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </button>
          ))}
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
          {offlineMode && <p className="text-xs text-orange-400 mt-1">(Offline mock scoring)</p>}
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
            <div className="flex items-center justify-between mb-0.5">
              <div className="text-xs text-brand-400 font-medium">Scenario</div>
              <ConnectionBadge />
            </div>
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
              {connecting && !offlineMode ? (
                <p className="text-sm text-amber-400">Connecting to AI service...</p>
              ) : (
                <p className="text-sm">Waiting for customer greeting...</p>
              )}
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
          <input
            className="input flex-1"
            placeholder={offlineMode ? "Type your response (offline practice mode)..." : "Type your response as a jewelry consultant..."}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            disabled={loading}
          />
          <button onClick={sendMessage} disabled={loading || !input.trim()} className="btn-primary w-11 h-11 p-0 flex items-center justify-center shrink-0 disabled:opacity-50">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Layout>
  );
}
