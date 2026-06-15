import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import { courseApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Brain, Send, BookOpen, Sparkles, User, MessageSquare } from 'lucide-react';
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

const SUGGESTIONS = [
  'What are the 4Cs of diamond grading?',
  'How do I handle a price-objecting customer?',
  'Explain the difference between VS1 and VS2 clarity',
  'What makes a diamond cut excellent?',
  'How to upsell from gold to platinum?',
];

export default function AICompanion() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm YAMI, your AI learning companion. Ask me anything about your courses — diamond knowledge, selling techniques, customer handling, or any CaratLane training topic." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [socket, setSocket] = useState(null);
  const sessionId = useRef(uuidv4());
  const bottomRef = useRef();

  useEffect(() => {
    courseApi.list({ limit: 20 }).then(d => setCourses(d.courses || [])).catch(() => {});

    const token = localStorage.getItem('yami_token');
    const sock = io('/', { auth: { token }, transports: ['websocket'] });
    setSocket(sock);

    sock.on('ai:response', ({ message }) => {
      setMessages(prev => [...prev, { role: 'assistant', content: message }]);
      setLoading(false);
    });

    sock.on('ai:error', ({ message }) => {
      setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, I encountered an error: ${message}` }]);
      setLoading(false);
    });

    return () => sock.disconnect();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (text = input) => {
    if (!text.trim() || loading) return;
    const msg = text.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);

    if (socket?.connected) {
      socket.emit('ai:message', {
        sessionId: sessionId.current,
        message: msg,
        courseId: selectedCourse ? Number(selectedCourse) : null,
        courseTitle: courses.find(c => c.id === Number(selectedCourse))?.title || '',
      });
    } else {
      setTimeout(() => {
        setMessages(prev => [...prev, { role: 'assistant', content: 'I\'m currently offline. Please ensure the backend is connected.' }]);
        setLoading(false);
      }, 1000);
    }
  };

  return (
    <Layout title="AI Learning Companion">
      <div className="max-w-4xl mx-auto h-[calc(100vh-140px)] flex flex-col gap-4">
        {/* Course selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-brand-500/10 border border-brand-500/30 rounded-lg px-3 py-2">
            <Brain className="w-4 h-4 text-brand-400" />
            <span className="text-sm font-medium text-brand-300">YAMI AI Companion</span>
          </div>
          <select className="input flex-1 text-sm" value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)}>
            <option value="">General knowledge (no specific course)</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 card">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'assistant' ? 'bg-gradient-to-br from-brand-500 to-pink-500' : 'bg-gray-700'}`}>
                {msg.role === 'assistant' ? <Brain className="w-4 h-4 text-white" /> : <User className="w-4 h-4 text-gray-300" />}
              </div>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'assistant' ? 'bg-gray-800 text-gray-100 rounded-tl-sm' : 'bg-brand-600 text-white rounded-tr-sm'}`}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-pink-500 flex items-center justify-center">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <div className="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-2 h-2 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {SUGGESTIONS.map((s, i) => (
            <button key={i} onClick={() => sendMessage(s)}
              className="shrink-0 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full px-3 py-1.5 text-gray-300 transition-colors flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-brand-400" /> {s}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex gap-3">
          <input
            className="input flex-1"
            placeholder="Ask anything about your courses..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          />
          <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
            className="btn-primary w-11 h-11 flex items-center justify-center p-0 shrink-0 disabled:opacity-50">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Layout>
  );
}
