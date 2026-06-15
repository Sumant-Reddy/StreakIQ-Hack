import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import RiskBadge from '../../components/RiskBadge';
import { analyticsApi } from '../../services/api';
import api from '../../services/api';
import { Users, Search, Filter, UserPlus, TrendingUp } from 'lucide-react';

export default function UserManager() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/users', { params: { search, role: roleFilter } })
      .then(data => setUsers(data || []))
      .catch(() => {
        // Fallback: use analytics data
        analyticsApi.adminOverview()
          .then(data => setUsers(data.recentActivity?.map(a => a.user) || []))
          .catch(console.error);
      })
      .finally(() => setLoading(false));
  }, [search, roleFilter]);

  return (
    <Layout title="User Manager">
      <div className="max-w-5xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input className="input w-full pl-9" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input w-36" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="MANAGER">Manager</option>
            <option value="LEARNER">Learner</option>
          </select>
        </div>

        <div className="card">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800 mb-3">
            <h3 className="font-semibold text-white flex items-center gap-2"><Users className="w-4 h-4 text-brand-400" /> Users</h3>
            <span className="text-xs text-gray-400">{users.length} users</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48"><div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" /></div>
          ) : users.length > 0 ? (
            <div className="divide-y divide-gray-800">
              {users.map((u, i) => (
                <div key={u.id || i} className="flex items-center gap-4 py-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-pink-500 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                    {u.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">{u.name}</div>
                    <div className="text-xs text-gray-400">{u.department}</div>
                  </div>
                  <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{u.role || 'LEARNER'}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No users found. User list API requires additional endpoint setup.</p>
              <p className="text-xs mt-1 text-gray-600">Seed the database first: npm run prisma:seed</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
