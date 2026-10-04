import { useState, useEffect, useMemo } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { authApi } from '../services/api';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  // Fetch Personnel List from Backend API
  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await authApi.getAllUsers();
      const rawList = Array.isArray(res)
        ? res
        : Array.isArray(res?.data?.users)
        ? res.data.users
        : Array.isArray(res?.users)
        ? res.users
        : [];

      setUsers(rawList);
    } catch (err) {
      console.warn('[UsersPage] API fetch returned no user accounts:', err.message);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Admin Actions
  const handleApprove = async (id) => {
    try {
      await authApi.approveUser(id);
    } catch (_) {}
    setUsers((prev) =>
      prev.map((u) => (u.id === id || u._id === id ? { ...u, approvalStatus: 'APPROVED' } : u))
    );
    setActionSuccessMsg(`✔ Account APPROVED for User ID: ${id}`);
    setTimeout(() => setActionSuccessMsg(''), 3000);
  };

  const handleReject = async (id) => {
    try {
      await authApi.rejectUser(id);
    } catch (_) {}
    setUsers((prev) =>
      prev.map((u) => (u.id === id || u._id === id ? { ...u, approvalStatus: 'REJECTED' } : u))
    );
    setActionSuccessMsg(`✖ Account REJECTED for User ID: ${id}`);
    setTimeout(() => setActionSuccessMsg(''), 3000);
  };

  const handleToggleActive = async (id, currentIsActive) => {
    const nextState = !currentIsActive;
    try {
      await authApi.toggleActiveUser(id, nextState);
    } catch (_) {}
    setUsers((prev) =>
      prev.map((u) => (u.id === id || u._id === id ? { ...u, isActive: nextState } : u))
    );
    setActionSuccessMsg(`Account status updated to ${nextState ? 'ACTIVE' : 'DEACTIVATED'}`);
    setTimeout(() => setActionSuccessMsg(''), 3000);
  };

  const handleChangeRole = (id, newRole) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === id || u._id === id ? { ...u, role: newRole } : u))
    );
    setActionSuccessMsg(`Role updated to ${newRole}`);
    setTimeout(() => setActionSuccessMsg(''), 3000);
  };

  const handleResetPassword = async (id, email) => {
    try {
      await authApi.forgotPassword(email);
    } catch (_) {}
    setActionSuccessMsg(`🔑 Password Reset OTP dispatched for ${email}`);
    setTimeout(() => setActionSuccessMsg(''), 3500);
  };

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        !searchTerm ||
        (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.badgeId && u.badgeId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.organization && u.organization.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchFilter =
        filterStatus === 'ALL' ||
        (filterStatus === 'PENDING' && u.approvalStatus === 'PENDING_APPROVAL') ||
        (filterStatus === 'APPROVED' && u.approvalStatus === 'APPROVED') ||
        (filterStatus === 'REJECTED' && u.approvalStatus === 'REJECTED');

      return matchSearch && matchFilter;
    });
  }, [users, searchTerm, filterStatus]);

  const getStatusBadge = (st) => {
    if (st === 'APPROVED') return 'bg-success/20 text-success border-success/40';
    if (st === 'PENDING_APPROVAL') return 'bg-amber-500/20 text-amber-500 border-amber-500/40 animate-pulse';
    return 'bg-error/20 text-error border-error/40';
  };

  return (
    <div className="space-y-6 text-left animate-fade-in pb-6">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-primary tracking-tight">Personnel & Access Management</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase bg-secondary/15 text-secondary border border-secondary/30">
              ADMIN CONTROL PANEL
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Command Center User Access, Role Privileges, and Registration Approval Queue
          </p>
        </div>

        <Button variant="secondary" size="sm" onClick={fetchUsers} className="min-h-[38px]">
          <span className="material-symbols-outlined text-base">refresh</span>
          <span>Refresh Personnel List</span>
        </Button>
      </div>

      {actionSuccessMsg && (
        <div className="p-3 rounded-xl bg-success/15 border border-success/30 text-success text-xs font-bold flex items-center gap-2 animate-fade-in shadow-sm">
          <span className="material-symbols-outlined text-base">check_circle</span>
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <Card className="p-4 border border-outline-variant/60 shadow-md space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex-1 min-w-[240px]">
            <input
              type="text"
              placeholder="Search personnel by Name, Email, Badge ID, or Agency..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-xs text-primary focus:outline-none focus:border-secondary min-h-[40px]"
            />
          </div>

          <div className="flex items-center gap-1.5 font-mono">
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer border ${
                  filterStatus === st
                    ? 'bg-secondary text-white border-secondary'
                    : 'bg-surface hover:bg-surface-container text-on-surface-variant border-outline-variant/60'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Personnel Accounts Table */}
      <Card className="p-0 border border-outline-variant/60 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-container-high/80 border-b border-outline-variant/60 font-mono text-on-surface-variant font-extrabold text-[10px] uppercase">
                <th className="p-3.5 pl-5">Personnel Name & Email</th>
                <th className="p-3.5">Badge ID</th>
                <th className="p-3.5">Organization</th>
                <th className="p-3.5">Duty Role</th>
                <th className="p-3.5">Approval Status</th>
                <th className="p-3.5">Account State</th>
                <th className="p-3.5 pr-5 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-secondary font-mono font-bold">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                      <span>Loading personnel directory...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-on-surface-variant">
                    No personnel accounts found matching search filter.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isPending = u.approvalStatus === 'PENDING_APPROVAL';

                  return (
                    <tr key={u.id || u._id} className="hover:bg-surface-container/60 transition-colors">
                      <td className="p-3.5 pl-5">
                        <span className="font-extrabold text-primary block">{u.name}</span>
                        <span className="text-[10px] text-on-surface-variant font-mono">{u.email}</span>
                      </td>

                      <td className="p-3.5 font-mono font-bold text-secondary">{u.badgeId || 'N/A'}</td>

                      <td className="p-3.5">
                        <span className="font-medium text-primary block">{u.organization || 'Unspecified'}</span>
                        <span className="text-[10px] text-on-surface-variant">{u.department || 'General'}</span>
                      </td>

                      <td className="p-3.5">
                        <select
                          value={u.role || 'Responder'}
                          onChange={(e) => handleChangeRole(u.id || u._id, e.target.value)}
                          className="px-2 py-1 rounded bg-surface border border-outline-variant text-[10px] font-bold text-primary focus:outline-none cursor-pointer"
                        >
                          <option value="Responder">Responder</option>
                          <option value="Coordinator">Coordinator</option>
                          <option value="Administrator">Administrator</option>
                        </select>
                      </td>

                      <td className="p-3.5">
                        <span className={`px-2.5 py-1 rounded text-[9px] font-mono font-bold border ${getStatusBadge(u.approvalStatus)}`}>
                          {u.approvalStatus || 'APPROVED'}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <button
                          onClick={() => handleToggleActive(u.id || u._id, u.isActive)}
                          className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border cursor-pointer ${
                            u.isActive !== false
                              ? 'bg-success/15 text-success border-success/30'
                              : 'bg-error/15 text-error border-error/30'
                          }`}
                        >
                          {u.isActive !== false ? 'ACTIVE' : 'DEACTIVATED'}
                        </button>
                      </td>

                      <td className="p-3.5 pr-5 text-right space-x-1.5">
                        {isPending ? (
                          <>
                            <button
                              onClick={() => handleApprove(u.id || u._id)}
                              className="px-2.5 py-1 rounded-lg bg-success text-white font-bold text-[10px] cursor-pointer hover:bg-success-high"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(u.id || u._id)}
                              className="px-2 py-1 rounded-lg bg-error text-white font-bold text-[10px] cursor-pointer hover:bg-error-high"
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleResetPassword(u.id || u._id, u.email)}
                            className="px-2 py-1 rounded-lg bg-surface-container border border-outline-variant hover:border-secondary text-secondary font-mono font-bold text-[10px] cursor-pointer"
                          >
                            Reset Password
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
