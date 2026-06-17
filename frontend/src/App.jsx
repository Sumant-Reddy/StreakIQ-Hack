import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import Login from './pages/Login';
import InviteAccept from './pages/InviteAccept';
import AdminDashboard from './pages/admin/AdminDashboard';
import CourseManager from './pages/admin/CourseManager';
import UserManager from './pages/admin/UserManager';
import ManagerDashboard from './pages/manager/ManagerDashboard';
import TeamAudit from './pages/manager/TeamAudit';
import AICopilot from './pages/manager/AICopilot';
import CertificationReadiness from './pages/manager/CertificationReadiness';
import TeamRoleplay from './pages/manager/TeamRoleplay';
import LearnerDashboard from './pages/learner/LearnerDashboard';
import CoursePlayer from './pages/learner/CoursePlayer';
import QuizPage from './pages/learner/QuizPage';
import AICompanion from './pages/learner/AICompanion';
import MockRoleplay from './pages/learner/MockRoleplay';
import Leaderboard from './pages/learner/Leaderboard';
import LearningPath from './pages/learner/LearningPath';
import MyCoursesPage from './pages/learner/MyCoursesPage';
import DocmostManager from './pages/admin/DocmostManager';
import CertificationBuilder from './pages/admin/CertificationBuilder';
import MyCertifications from './pages/learner/MyCertifications';
import Certificate from './pages/learner/Certificate';
import Badges from './pages/learner/Badges';

function RoleRoute({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (role && !role.includes(user.role)) return <Navigate to="/" />;
  return children;
}

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (user.role === 'ADMIN') return <Navigate to="/admin" />;
  if (user.role === 'MANAGER') return <Navigate to="/manager" />;
  return <Navigate to="/learn" />;
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/invite/:token" element={<InviteAccept />} />
          <Route path="/" element={<HomeRedirect />} />

          <Route path="/admin" element={<RoleRoute role={['ADMIN']}><AdminDashboard /></RoleRoute>} />
          <Route path="/admin/courses" element={<RoleRoute role={['ADMIN']}><CourseManager /></RoleRoute>} />
          <Route path="/admin/users" element={<RoleRoute role={['ADMIN']}><UserManager /></RoleRoute>} />
          <Route path="/admin/docs" element={<RoleRoute><DocmostManager /></RoleRoute>} />

          <Route path="/manager" element={<RoleRoute role={['ADMIN','MANAGER']}><ManagerDashboard /></RoleRoute>} />
          <Route path="/manager/team/:userId" element={<RoleRoute role={['ADMIN','MANAGER']}><TeamAudit /></RoleRoute>} />
          <Route path="/manager/copilot" element={<RoleRoute role={['ADMIN','MANAGER']}><AICopilot /></RoleRoute>} />
          <Route path="/manager/certification" element={<RoleRoute role={['ADMIN','MANAGER']}><CertificationReadiness /></RoleRoute>} />
          <Route path="/manager/roleplay" element={<RoleRoute role={['ADMIN','MANAGER']}><TeamRoleplay /></RoleRoute>} />
          <Route path="/admin/certifications" element={<RoleRoute role={['ADMIN','MANAGER']}><CertificationBuilder /></RoleRoute>} />
          <Route path="/manage/docs" element={<RoleRoute><DocmostManager /></RoleRoute>} />

          <Route path="/learn" element={<RoleRoute><LearnerDashboard /></RoleRoute>} />
          <Route path="/learn/course/:id" element={<RoleRoute><CoursePlayer /></RoleRoute>} />
          <Route path="/learn/quiz/:id" element={<RoleRoute><QuizPage /></RoleRoute>} />
          <Route path="/learn/ai-companion" element={<RoleRoute><AICompanion /></RoleRoute>} />
          <Route path="/learn/roleplay" element={<RoleRoute><MockRoleplay /></RoleRoute>} />
          <Route path="/learn/leaderboard" element={<RoleRoute><Leaderboard /></RoleRoute>} />
          <Route path="/learn/path" element={<RoleRoute><LearningPath /></RoleRoute>} />
          <Route path="/learn/courses" element={<RoleRoute><MyCoursesPage /></RoleRoute>} />
          <Route path="/learn/certifications" element={<RoleRoute><MyCertifications /></RoleRoute>} />
          <Route path="/learn/certificate/:certId" element={<RoleRoute><Certificate /></RoleRoute>} />
          <Route path="/learn/badges" element={<RoleRoute><Badges /></RoleRoute>} />
        </Routes>
      </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}
