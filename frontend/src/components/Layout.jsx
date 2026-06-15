import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, BookOpen, Brain, Trophy, Users, BarChart3,
  Settings, LogOut, Menu, X, Flame, Star, TrendingUp, Shield,
  ChevronRight, Zap, MessageSquare, UserCheck, Award, Target,
} from 'lucide-react';

const NAV_LEARNER = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/learn' },
  { label: 'My Courses', icon: BookOpen, path: '/learn/course' },
  { label: 'Learning Path', icon: Target, path: '/learn/path' },
  { label: 'AI Companion', icon: Brain, path: '/learn/ai-companion' },
  { label: 'Mock Roleplay', icon: MessageSquare, path: '/learn/roleplay' },
  { label: 'Leaderboard', icon: Trophy, path: '/learn/leaderboard' },
];

const NAV_MANAGER = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/manager' },
  { label: 'AI Copilot', icon: Brain, path: '/manager/copilot' },
  { label: 'Certification', icon: Award, path: '/manager/certification' },
];

const NAV_ADMIN = [
  { label: 'Overview', icon: LayoutDashboard, path: '/admin' },
  { label: 'Courses', icon: BookOpen, path: '/admin/courses' },
  { label: 'Users', icon: Users, path: '/admin/users' },
  { label: 'Manager View', icon: UserCheck, path: '/manager' },
];

export default function Layout({ children, title }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const nav = user?.role === 'ADMIN' ? NAV_ADMIN : user?.role === 'MANAGER' ? NAV_MANAGER : NAV_LEARNER;

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
            <div className="text-xs text-brand-400">AI Learning OS</div>
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
            Sign Out
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
              <span>YAMI OS</span>
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
