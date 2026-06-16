import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Layout from '../../components/Layout';
import { aiApi } from '../../services/api';
import { Brain, Send, Sparkles, User, BarChart3 } from 'lucide-react';

export default function AICopilot() {
  const { t } = useTranslation();

  const QUICK_QUERIES = [
    t('manager.quickQuery1'),
    t('manager.quickQuery2'),
    t('manager.quickQuery3'),
    t('manager.quickQuery4'),
    t('manager.quickQuery5'),
    t('manager.quickQuery6'),
  ];

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: t('manager.greeting'),
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
      setMessages(prev => [...prev, { role: 'assistant', content: t('manager.errorMessage') }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title={t('manager.copilotQuery')}>
      <div className="max-w-4xl mx-auto h-[calc(100vh-140px)] flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-3 bg-gradient-to-r from-brand-600/20 to-pink-600/20 border border-brand-500/30 rounded-xl p-4">
          <div className="w-10 h-10 rounded-xl bg-brand-500/30 flex items-center justify-center">
            <Brain className="w-5 h-5 text-brand-400" />
          </div>
          <div>
            <div className="font-semibold text-white">{t('manager.copilotQuery')}</div>
            <div className="text-xs text-gray-400">{t('manager.poweredBy')}</div>
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
                      <BarChart3 className="w-3.5 h-3.5" /> {t('manager.teamDataSummary')}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-center">
                      <div className="bg-gray-700 rounded-lg p-2">
                        <div className="font-bold text-white">{msg.data.total}</div>
                        <div className="text-gray-400">{t('manager.members')}</div>
                      </div>
                      <div className="bg-gray-700 rounded-lg p-2">
                        <div className="font-bold text-emerald-400">{msg.data.data?.filter(d => d.riskLevel === 'LOW').length || 0}</div>
                        <div className="text-gray-400">{t('manager.lowRisk')}</div>
                      </div>
                      <div className="bg-gray-700 rounded-lg p-2">
                        <div className="font-bold text-red-400">{msg.data.data?.filter(d => ['HIGH','CRITICAL'].includes(d.riskLevel)).length || 0}</div>
                        <div className="text-gray-400">{t('manager.atRiskLabel')}</div>
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
          <input className="input flex-1" placeholder={t('manager.placeholder')} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && query()} />
          <button onClick={() => query()} disabled={loading || !input.trim()} className="btn-primary w-11 h-11 p-0 flex items-center justify-center shrink-0 disabled:opacity-50">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Layout>
  );
}
