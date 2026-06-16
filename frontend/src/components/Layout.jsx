import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, BookOpen, Brain, Trophy, Users, BarChart3,
  Settings, LogOut, Menu, X, Flame, Star, TrendingUp, Shield,
  ChevronRight, Zap, MessageSquare, UserCheck, Award, Target, Globe,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const NAV_LEARNER = (t) => [
  { label: t('nav.dashboard'), icon: LayoutDashboard, path: '/learn' },
  { label: t('nav.myCourses'), icon: BookOpen, path: '/learn/courses' },
  { label: t('nav.learningPath'), icon: Target, path: '/learn/path' },
  { label: t('nav.aiCompanion'), icon: Brain, path: '/learn/ai-companion' },
  { label: t('nav.mockRoleplay'), icon: MessageSquare, path: '/learn/roleplay' },
  { label: t('nav.leaderboard'), icon: Trophy, path: '/learn/leaderboard' },
];

const NAV_MANAGER = (t) => [
  { label: t('nav.dashboard'), icon: LayoutDashboard, path: '/manager' },
  { label: t('nav.copilot'), icon: Brain, path: '/manager/copilot' },
  { label: t('nav.certification'), icon: Award, path: '/manager/certification' },
];

const NAV_ADMIN = (t) => [
  { label: t('nav.overview'), icon: LayoutDashboard, path: '/admin' },
  { label: t('nav.courses'), icon: BookOpen, path: '/admin/courses' },
  { label: t('nav.users'), icon: Users, path: '/admin/users' },
  { label: t('nav.managerView'), icon: UserCheck, path: '/manager' },
];

export default function Layout({ children, title }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { t, i18n } = useTranslation();

  const changeLanguage = async (lang) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('yami_lang', lang);
    // persist to backend if user is logged in
    try {
      await fetch('/api/auth/me/language', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('yami_token')}`,
        },
        body: JSON.stringify({ language: lang.toUpperCase() }),
      });
    } catch (_) {}
  };

  const nav = user?.role === 'ADMIN' ? NAV_ADMIN(t) : user?.role === 'MANAGER' ? NAV_MANAGER(t) : NAV_LEARNER(t);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-64 flex flex-col bg-gray-900 border-r border-gray-800 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-800">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-pink-500 flex items-center justify-center shadow-lg shadow-brand-500/30">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-white text-sm">YAMI Learn</div>
            <div className="text-xs text-brand-400">AI Learning</div>
          </div>
          <button className="ml-auto lg:hidden text-gray-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User */}
        <div className="px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-pink-500 flex items-center justify-center text-white font-semibold text-sm">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{user?.name}</div>
              <div className="text-xs text-gray-400 truncate">{user?.role}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group ${active ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
              >
                <item.icon className={`w-4 h-4 ${active ? 'text-brand-400' : 'text-gray-500 group-hover:text-gray-300'}`} />
                {item.label}
                {active && <ChevronRight className="w-3.5 h-3.5 ml-auto text-brand-400" />}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-4 border-t border-gray-800">
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all w-full"
          >
            <LogOut className="w-4 h-4" />
            {t('auth.signOut')}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-4 px-5 py-4 bg-gray-900/50 border-b border-gray-800 backdrop-blur-sm">
          <button className="lg:hidden text-gray-400 hover:text-white" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-white">{title}</h1>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-orange-500/20 text-orange-400 border border-orange-500/30 px-3 py-1.5 rounded-full text-xs font-medium">
              <Flame className="w-3.5 h-3.5" />
              <span>YAMI</span>
            </div>
            <div className="relative group">
              <button className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg text-xs transition-all">
                <Globe className="w-3.5 h-3.5" />
                <span>{i18n.language === 'hi' ? 'हिंदी' : i18n.language === 'te' ? 'తెలుగు' : i18n.language === 'ta' ? 'தமிழ்' : i18n.language === 'kn' ? 'ಕನ್ನಡ' : 'English'}</span>
              </button>
              <div className="absolute right-0 top-full mt-1 w-36 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all">
                {[
                  { code: 'en', label: 'English' },
                  { code: 'hi', label: 'हिंदी' },
                  { code: 'te', label: 'తెలుగు' },
                  { code: 'ta', label: 'தமிழ்' },
                  { code: 'kn', label: 'ಕನ್ನಡ' },
                ].map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => changeLanguage(lang.code)}
                    className={`w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 hover:text-white transition-all first:rounded-t-lg last:rounded-b-lg ${i18n.language === lang.code ? 'text-brand-400' : ''}`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-5">
          {children}
        </main>
      </div>
    </div>
  );
}
