import { useState } from 'react';
import Layout from '../../components/Layout';
import { aiApi } from '../../services/api';
import { Brain, Send, Sparkles, User, BarChart3 } from 'lucide-react';

const QUICK_QUERIES = [
  'Show employees at risk of failing certification',
  'Who has the lowest retention score in my team?',
  'Which team members need communication training?',
  'Show top performers this month',
  'Who has been inactive for more than 7 days?',
  'Which skill has the biggest gap across the team?',
];

export default function AICopilot() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hello! I'm your AI Manager Copilot. Ask me anything about your team's learning performance, risk levels, certification readiness, or skill gaps.",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const query = async (text = input) => {
    if (!text.trim() || loading) return;
    const q = text.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setLoading(true);

    try {
      const result = await aiApi.copilotQuery({ query: q });
      setMessages(prev => [...prev, { role: 'assistant', content: result.insight, data: result.teamSummary }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I could not process your query. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="AI Manager Copilot">
      <div className="max-w-4xl mx-auto h-[calc(100vh-140px)] flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-3 bg-gradient-to-r from-brand-600/20 to-pink-600/20 border border-brand-500/30 rounded-xl p-4">
          <div className="w-10 h-10 rounded-xl bg-brand-500/30 flex items-center justify-center">
            <Brain className="w-5 h-5 text-brand-400" />
          </div>
          <div>
            <div className="font-semibold text-white">AI Manager Copilot</div>
            <div className="text-xs text-gray-400">Powered by YAMI AI — Ask anything about your team</div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto card space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'assistant' ? 'bg-gradient-to-br from-brand-500 to-pink-500' : 'bg-gray-700'}`}>
                {msg.role === 'assistant' ? <Brain className="w-4 h-4 text-white" /> : <User className="w-4 h-4 text-gray-300" />}
              </div>
              <div className={`max-w-[85%] space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'assistant' ? 'bg-gray-800 text-gray-100 rounded-tl-sm' : 'bg-brand-600 text-white rounded-tr-sm'}`}>
                  {msg.content}
                </div>
                {msg.data && (
                  <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-3 w-full">
                    <div className="flex items-center gap-1.5 text-xs text-brand-400 mb-2.5 font-medium">
                      <BarChart3 className="w-3.5 h-3.5" /> Team Data Summary
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-center">
                      <div className="bg-gray-700 rounded-lg p-2">
                        <div className="font-bold text-white">{msg.data.total}</div>
                        <div className="text-gray-400">Members</div>
                      </div>
                      <div className="bg-gray-700 rounded-lg p-2">
                        <div className="font-bold text-emerald-400">{msg.data.data?.filter(d => d.riskLevel === 'LOW').length || 0}</div>
                        <div className="text-gray-400">Low Risk</div>
                      </div>
                      <div className="bg-gray-700 rounded-lg p-2">
                        <div className="font-bold text-red-400">{msg.data.data?.filter(d => ['HIGH','CRITICAL'].includes(d.riskLevel)).length || 0}</div>
                        <div className="text-gray-400">At Risk</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-pink-500 flex items-center justify-center">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <div className="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1">{[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
              </div>
            </div>
          )}
        </div>

        {/* Quick queries */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {QUICK_QUERIES.map((q, i) => (
            <button key={i} onClick={() => query(q)}
              className="shrink-0 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full px-3 py-1.5 text-gray-300 transition-colors flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-brand-400" /> {q}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex gap-3">
          <input className="input flex-1" placeholder="Ask about your team..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && query()} />
          <button onClick={() => query()} disabled={loading || !input.trim()} className="btn-primary w-11 h-11 p-0 flex items-center justify-center shrink-0 disabled:opacity-50">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Layout>
  );
}
