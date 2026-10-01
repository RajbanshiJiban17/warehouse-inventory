import React, { useState, useEffect } from 'react';
import {
  Users as UsersIcon,
  UserCheck,
  UserX,
  Key,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { api } from '../services/api';
import type { User } from '../types';
import { useToast } from '../components/Toast';

export const UsersPage: React.FC = () => {
  const { showToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<User | null>(null);

  // Create Form State
  const [createForm, setCreateForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'STAFF',
    status: 'ACTIVE',
  });
  const [createError, setCreateError] = useState('');

  // Password Reset State
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await api.getUsers({
        search: search || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
      });
      setUsers(data.items);
    } catch (e: any) {
      showToast('error', 'Error Loading Users', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [search, roleFilter, statusFilter]);

  const handleApprove = async (user: User) => {
    try {
      await api.approveUser(user.id);
      showToast('success', 'User Approved', `${user.username} is now ACTIVE and can sign in.`);
      fetchUsers();
    } catch (e: any) {
      showToast('error', 'Approval Failed', e.message);
    }
  };

  const handleToggleStatus = async (user: User) => {
    const nextStatus = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      await api.updateUserStatus(user.id, nextStatus);
      showToast('info', 'Status Updated', `${user.username} is now ${nextStatus}.`);
      fetchUsers();
    } catch (e: any) {
      showToast('error', 'Status Update Failed', e.message);
    }
  };

  const handleRoleChange = async (user: User, newRole: string) => {
    try {
      await api.updateUserRole(user.id, newRole);
      showToast('success', 'Role Changed', `${user.username} role changed to ${newRole}.`);
      fetchUsers();
    } catch (e: any) {
      showToast('error', 'Role Update Failed', e.message);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    try {
      await api.createCategory; // ensure api is loaded
      await api.register(createForm); // or direct user creation
      showToast('success', 'User Created', `User ${createForm.username} created successfully.`);
      setIsCreateOpen(false);
      setCreateForm({ username: '', email: '', password: '', role: 'STAFF', status: 'ACTIVE' });
      fetchUsers();
    } catch (e: any) {
      setCreateError(e.message || 'Creation failed.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;
    setResetError('');
    try {
      await api.resetUserPassword(targetUser.id, newPassword);
      showToast('success', 'Password Reset', `Password for ${targetUser.username} has been reset.`);
      setIsResetOpen(false);
      setNewPassword('');
    } catch (e: any) {
      setResetError(e.message || 'Reset failed.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
            <UsersIcon className="w-7 h-7 text-purple-400" />
            <span>User Management & Access Control</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Approve pending registrations, manage RBAC privileges, activate/deactivate accounts, and reset credentials.
          </p>
        </div>

        <button
          onClick={() => {
            setCreateError('');
            setIsCreateOpen(true);
          }}
          className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/30 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add User Directly</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search username or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500"
          >
            <option value="">All Roles</option>
            <option value="ADMIN">ADMIN</option>
            <option value="STAFF">STAFF</option>
            <option value="MANAGER">MANAGER</option>
          </select>
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">PENDING Approval</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="DISABLED">DISABLED</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-900/90 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
            <tr>
              <th className="px-6 py-3.5">User Details</th>
              <th className="px-6 py-3.5">Assigned Role</th>
              <th className="px-6 py-3.5">Account Status</th>
              <th className="px-6 py-3.5">Registered On</th>
              <th className="px-6 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  Loading users...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-900/50 transition">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-white">{u.username}</div>
                    <div className="text-xs text-slate-400">{u.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u, e.target.value)}
                      className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs font-bold text-slate-200 focus:outline-none focus:border-purple-500"
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="STAFF">STAFF</option>
                      <option value="MANAGER">MANAGER</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        u.status === 'ACTIVE'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : u.status === 'PENDING'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                          : 'bg-rose-950 text-rose-300 border border-rose-800'
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-400">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      {u.status === 'PENDING' && (
                        <button
                          onClick={() => handleApprove(u)}
                          className="flex items-center space-x-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition"
                          title="Approve User"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleToggleStatus(u)}
                        className={`p-1.5 rounded-lg border text-xs font-semibold transition ${
                          u.status === 'ACTIVE'
                            ? 'border-slate-800 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10'
                            : 'border-emerald-800 text-emerald-400 hover:bg-emerald-500/10'
                        }`}
                        title={u.status === 'ACTIVE' ? 'Deactivate User' : 'Activate User'}
                      >
                        {u.status === 'ACTIVE' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </button>

                      <button
                        onClick={() => {
                          setTargetUser(u);
                          setResetError('');
                          setNewPassword('');
                          setIsResetOpen(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-brand-400 hover:bg-slate-900 rounded-lg transition"
                        title="Reset Password"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* RESET PASSWORD MODAL */}
      {isResetOpen && targetUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h2 className="text-base font-bold text-white">Reset Password: {targetUser.username}</h2>
              <button onClick={() => setIsResetOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {resetError && (
              <div className="mt-3 p-3 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs rounded-xl">
                {resetError}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">New Secure Password</label>
                <input
                  type="password"
                  required
                  placeholder="Min 10 chars (A-Z, a-z, 0-9, symbol)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsResetOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold"
                >
                  Save New Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE USER MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h2 className="text-base font-bold text-white">Add New User</h2>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="mt-3 p-3 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs rounded-xl">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Username</label>
                <input
                  type="text"
                  required
                  placeholder="username (min 3 chars)"
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Email</label>
                <input
                  type="email"
                  required
                  placeholder="user@example.com"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Initial Password</label>
                <input
                  type="password"
                  required
                  placeholder="Min 10 chars (A-Z, a-z, 0-9, symbol)"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
