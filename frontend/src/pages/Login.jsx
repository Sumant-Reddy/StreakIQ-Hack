import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Zap, Eye, EyeOff, Brain, BarChart3, Trophy } from 'lucide-react';

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@catratlane.com', password: 'admin123', color: 'brand' },
  { label: 'Manager', email: 'manager@catratlane.com', password: 'manager123', color: 'yellow' },
  { label: 'Learner (JC)', email: 'rahul@catratlane.com', password: 'learner123', color: 'green' },
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(user.role === 'ADMIN' ? '/admin' : user.role === 'MANAGER' ? '/manager' : '/learn');
    } catch (err) {
      setError(err.error || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (acc) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setError('');
  };

  return (
    <div className="min-h-screen gradient-bg flex">
      {/* Left: Branding */}
      <div className="hidden lg:flex flex-col justify-center px-16 w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-brand-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-pink-500 flex items-center justify-center shadow-xl shadow-brand-500/30">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">YAMI Learn</div>
              <div className="text-sm text-brand-400">AI Learning Operating System</div>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Transform How<br />CaratLane Learns
          </h1>
          <p className="text-gray-400 text-lg mb-10 leading-relaxed">
            AI-powered knowledge retention, skill tracking, and personalized learning paths for every jewelry consultant.
          </p>
          <div className="space-y-4">
            {[
              { icon: Brain, label: 'AI Quiz Generator', desc: 'Auto-generate quizzes from any course material' },
              { icon: BarChart3, label: 'Retention Score Engine', desc: '5-factor knowledge retention tracking' },
              { icon: Trophy, label: 'AI Mock Customer Roleplay', desc: 'Practice with AI customers, get scored instantly' },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="w-10 h-10 rounded-lg bg-brand-500/20 flex items-center justify-center">
                  <f.icon className="w-5 h-5 text-brand-400" />
                </div>
                <div>
                  <div className="font-medium text-white text-sm">{f.label}</div>
                  <div className="text-xs text-gray-400">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Login form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-pink-500 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div className="text-xl font-bold text-white">YAMI Learn AI</div>
          </div>

          <div className="card">
            <h2 className="text-xl font-bold text-white mb-1">Welcome back</h2>
            <p className="text-sm text-gray-400 mb-6">Sign in to your learning dashboard</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Email</label>
                <input className="input w-full" type="email" placeholder="you@catratlane.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Password</label>
                <div className="relative">
                  <input className="input w-full pr-10" type={showPw ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300" onClick={() => setShowPw(!showPw)}>
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}
              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-2.5">
                {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-gray-800">
              <p className="text-xs text-gray-500 mb-3 text-center">Quick Demo Access</p>
              <div className="grid grid-cols-3 gap-2">
                {DEMO_ACCOUNTS.map(acc => (
                  <button key={acc.label} onClick={() => fillDemo(acc)}
                    className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg py-2 px-2 text-gray-300 transition-colors">
                    {acc.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
