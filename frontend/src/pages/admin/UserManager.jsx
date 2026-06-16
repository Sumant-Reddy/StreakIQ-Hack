import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Layout from '../../components/Layout';
import { adminApi } from '../../services/api';
import {
  Users, UserPlus, Copy, Check, Mail, Shield, Building2,
  MapPin, Search, RefreshCw, X, ChevronDown,
} from 'lucide-react';

const ROLES = ['LEARNER', 'MANAGER', 'ADMIN'];
const STATUS_COLORS = {
  ACTIVE: 'text-green-400 bg-green-400/10 border-green-400/30',
  INVITED: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  DISABLED: 'text-red-400 bg-red-400/10 border-red-400/30',
};

export default function UserManager() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'LEARNER', department: '', designation: '', managerId: '', storeCode: '', region: '' });
  const [inviteResult, setInviteResult] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    loadData();
  }, [search, roleFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, invitesRes] = await Promise.all([
        adminApi.users({ search, role: roleFilter || undefined }),
        adminApi.invites(),
      ]);
      setUsers(usersRes.users || []);
      setInvites(invitesRes.invites || []);
      setManagers((usersRes.users || []).filter(u => u.role === 'MANAGER' || u.role === 'ADMIN'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviting(true);
    try {
      const result = await adminApi.invite({
        ...inviteForm,
        managerId: inviteForm.managerId ? Number(inviteForm.managerId) : undefined,
      });
      setInviteResult(result);
      loadData();
    } catch (err) {
      alert(err.error || 'Failed to create invite');
    } finally {
      setInviting(false);
    }
  };

  const copyLink = (link, id) => {
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleUser = async (user) => {
    try {
      await adminApi.updateUser(user.id, { isActive: !user.isActive });
      loadData();
    } catch (err) {
      alert('Update failed');
    }
  };

  return (
    <Layout title={t('admin.users')}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button onClick={() => setTab('users')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'users' ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30' : 'text-gray-400 hover:text-white'}`}>
              <Users className="w-4 h-4 inline mr-2" />{t('admin.users')}
            </button>
            <button onClick={() => setTab('invites')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${tab === 'invites' ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30' : 'text-gray-400 hover:text-white'}`}>
              <Mail className="w-4 h-4" />{t('admin.pendingInvites')}
              {invites.length > 0 && <span className="bg-yellow-500 text-black text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">{invites.length}</span>}
            </button>
          </div>
          <button onClick={() => { setShowInviteModal(true); setInviteResult(null); }}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">
            <UserPlus className="w-4 h-4" />{t('admin.inviteJC')}
          </button>
        </div>

        {tab === 'users' && (
          <>
            {/* Filters */}
            <div className="flex gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder={t('common.search')} className="w-full bg-gray-800 border border-gray-700 text-white pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:border-brand-500" />
              </div>
              <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-gray-300 px-3 py-2 rounded-lg text-sm focus:outline-none">
                <option value="">{t('common.all')} Roles</option>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <button onClick={loadData} className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white transition-all">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Users table */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">{t('admin.name')}</th>
                    <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">{t('admin.role')}</th>
                    <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">{t('admin.department')}</th>
                    <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">{t('admin.status')}</th>
                    <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">{t('admin.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} className="text-center text-gray-500 py-8 text-sm">{t('common.loading')}</td></tr>
                  ) : users.map(u => (
                    <tr key={u.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-all">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-pink-500 flex items-center justify-center text-white text-xs font-semibold">
                            {u.name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm text-white font-medium">{u.name}</div>
                            <div className="text-xs text-gray-500">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-gray-800 border border-gray-700 text-gray-300 px-2 py-1 rounded-md">{u.role}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">{u.department || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs border px-2 py-1 rounded-md ${STATUS_COLORS[u.status] || STATUS_COLORS.ACTIVE}`}>
                          {u.status || 'ACTIVE'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleUser(u)}
                          className={`text-xs px-3 py-1 rounded-md transition-all ${u.isActive ? 'text-red-400 hover:bg-red-500/10' : 'text-green-400 hover:bg-green-500/10'}`}>
                          {u.isActive ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'invites' && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {invites.length === 0 ? (
              <div className="text-center text-gray-500 py-12 text-sm">{t('admin.noInvites')}</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">{t('admin.name')}</th>
                    <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">{t('admin.role')}</th>
                    <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">{t('admin.department')}</th>
                    <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">{t('admin.expiresOn')}</th>
                    <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">{t('admin.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map(inv => {
                    const inviteLink = `${window.location.origin}/invite/${inv.inviteToken || ''}`;
                    return (
                      <tr key={inv.id} className="border-b border-gray-800/50">
                        <td className="px-4 py-3">
                          <div className="text-sm text-white font-medium">{inv.name}</div>
                          <div className="text-xs text-gray-500">{inv.email}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-300">{inv.role}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">{inv.department || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {inv.inviteExpiry ? new Date(inv.inviteExpiry).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => copyLink(inviteLink, inv.id)}
                            className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 transition-all">
                            {copiedId === inv.id ? <><Check className="w-3.5 h-3.5" />{t('admin.linkCopied')}</> : <><Copy className="w-3.5 h-3.5" />{t('admin.copyLink')}</>}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">{t('admin.inviteJC')}</h2>
              <button onClick={() => setShowInviteModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {inviteResult ? (
              <div className="p-6 space-y-4">
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                  <p className="text-green-400 font-medium text-sm mb-2">Invite created successfully!</p>
                  <p className="text-gray-400 text-xs mb-3">Share this link with the new JC:</p>
                  <div className="bg-gray-800 rounded-lg p-3 flex items-center gap-2">
                    <code className="text-xs text-brand-400 flex-1 break-all">{inviteResult.inviteLink}</code>
                    <button onClick={() => copyLink(inviteResult.inviteLink, 'result')}
                      className="text-gray-400 hover:text-white flex-shrink-0">
                      {copiedId === 'result' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button onClick={() => { setShowInviteModal(false); setInviteForm({ name: '', email: '', role: 'LEARNER', department: '', designation: '', managerId: '', storeCode: '', region: '' }); }}
                  className="w-full bg-brand-600 hover:bg-brand-500 text-white py-2 rounded-lg text-sm font-medium transition-all">
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">{t('admin.name')} *</label>
                    <input required value={inviteForm.name} onChange={e => setInviteForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-brand-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">{t('admin.email')} *</label>
                    <input required type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-brand-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">{t('admin.role')}</label>
                    <select value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 text-gray-300 px-3 py-2 rounded-lg text-sm focus:outline-none">
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">{t('admin.department')}</label>
                    <input value={inviteForm.department} onChange={e => setInviteForm(f => ({ ...f, department: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-brand-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">{t('admin.designation')}</label>
                    <input value={inviteForm.designation} onChange={e => setInviteForm(f => ({ ...f, designation: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-brand-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">{t('admin.manager')}</label>
                    <select value={inviteForm.managerId} onChange={e => setInviteForm(f => ({ ...f, managerId: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 text-gray-300 px-3 py-2 rounded-lg text-sm focus:outline-none">
                      <option value="">None</option>
                      {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">{t('admin.storeCode')}</label>
                    <input value={inviteForm.storeCode} onChange={e => setInviteForm(f => ({ ...f, storeCode: e.target.value }))}
                      placeholder="e.g. BLR-001"
                      className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-brand-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">{t('admin.region')}</label>
                    <input value={inviteForm.region} onChange={e => setInviteForm(f => ({ ...f, region: e.target.value }))}
                      placeholder="e.g. South India"
                      className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-brand-500" />
                  </div>
                </div>
                <button type="submit" disabled={inviting}
                  className="w-full bg-brand-600 hover:bg-brand-500 text-white py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50">
                  {inviting ? 'Creating invite...' : t('admin.inviteJC')}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
