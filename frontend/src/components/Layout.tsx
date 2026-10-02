import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Boxes,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Users,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  Warehouse,
  Settings,
  Server,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import { api, getApiBase, setCustomApiServer } from '../services/api';

export const Layout: React.FC = () => {
  const { user, isAdmin, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState('');
  const [healthStatus, setHealthStatus] = useState<'checking' | 'healthy' | 'error'>('checking');
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  // Change Password state
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }

    if (newPassword.length < 10) {
      setPasswordError('New password must be at least 10 characters long.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await api.changePassword({ currentPassword, newPassword });
      showToast('success', 'Password Changed', 'Your password was updated successfully.');
      setChangePasswordOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password. Please check your current password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const checkBackendHealth = async () => {
    setHealthStatus('checking');
    try {
      await api.checkHealth();
      setHealthStatus('healthy');
    } catch {
      setHealthStatus('error');
    }
  };

  useEffect(() => {
    checkBackendHealth();
  }, []);

  const handleOpenSettings = async () => {
    if (window.electronAPI) {
      const currentUrl = await window.electronAPI.getServerUrl();
      setServerUrlInput(currentUrl);
    } else {
      setServerUrlInput(getApiBase());
    }
    setSettingsOpen(true);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverUrlInput.trim()) return;
    setCustomApiServer(serverUrlInput.trim());
    if (window.electronAPI) {
      await window.electronAPI.setServerUrl(serverUrlInput.trim());
    }
    showToast('success', 'Server Updated', `Connecting to ${serverUrlInput.trim()}`);
    setSettingsOpen(false);
    checkBackendHealth();
  };

  const handleLogout = async () => {
    try {
      await logout();
      showToast('info', 'Logged Out', 'You have been safely signed out.');
      navigate('/login');
    } catch {
      navigate('/login');
    }
  };

  const navLinks = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/items', label: 'Item Master', icon: Boxes },
    { to: '/stock-in', label: 'Item In (Receive)', icon: ArrowDownLeft, highlight: 'emerald' },
    { to: '/stock-out', label: 'Item Out (Issue)', icon: ArrowUpRight, highlight: 'amber' },
    { to: '/reports', label: 'Reports & Ledger', icon: BarChart3 },
    ...(isAdmin
      ? [
          { to: '/users', label: 'User Management', icon: Users },
          { to: '/audit-logs', label: 'Audit Trail', icon: ShieldCheck },
        ]
      : []),
  ];

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden font-sans">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-950 border-r border-slate-800/80 p-4 justify-between z-20">
        <div>
          {/* Logo */}
          <div className="flex items-center space-x-3 px-2 py-4 mb-6 border-b border-slate-800/60">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
              <Warehouse className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-white text-base leading-tight">Warehouse INV</h1>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-400">Stock Core</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
                      isActive
                        ? 'bg-brand-600/90 text-white shadow-md shadow-brand-600/30'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                    }`
                  }
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span>{link.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="pt-4 border-t border-slate-800/60">
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800/70 mb-2">
            <div className="truncate mr-2">
              <p className="text-xs font-semibold text-white truncate">{user?.username}</p>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    user?.role === 'ADMIN' ? 'bg-purple-400' : 'bg-brand-400'
                  }`}
                />
                <span className="text-[10px] uppercase font-bold text-slate-400">{user?.role}</span>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setChangePasswordOpen(true)}
                title="Change Password"
                className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition"
              >
                <KeyRound className="w-4 h-4" />
              </button>
              <button
                onClick={handleLogout}
                title="Logout"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-900">
        {/* Top Navbar */}
        <header className="h-16 bg-slate-950/80 backdrop-blur border-b border-slate-800/80 px-6 flex items-center justify-between z-10">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-slate-400 hover:text-white p-1"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <span className="hidden sm:inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              System Online • Auto Qty Sync Active
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <div className="text-right">
              <span className="text-xs text-slate-400">Signed in as </span>
              <span className="text-xs font-semibold text-slate-200">{user?.username}</span>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                user?.role === 'ADMIN'
                  ? 'bg-purple-950 text-purple-300 border border-purple-700/50'
                  : 'bg-blue-950 text-blue-300 border border-blue-700/50'
              }`}
            >
              {user?.role}
            </span>

            {isElectron && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                Desktop App
              </span>
            )}

            <button
              onClick={() => setChangePasswordOpen(true)}
              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition flex items-center space-x-1.5"
              title="Change Password"
            >
              <KeyRound className="w-4 h-4" />
              <span className="hidden xl:inline text-xs font-medium">Password</span>
            </button>

            <button
              onClick={handleOpenSettings}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title="Server Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-950 border-b border-slate-800 p-4 space-y-2">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === '/'}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium text-sm transition ${
                      isActive ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-5 h-5" />
                  <span>{link.label}</span>
                </NavLink>
              );
            })}
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium text-sm text-rose-400 hover:bg-rose-500/10"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
          </div>
        )}

        {/* Page Content Scrollable Body */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* SERVER SETTINGS MODAL */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Server className="w-5 h-5 text-brand-400" />
                <h2 className="text-base font-bold text-white">
                  {isElectron ? 'Desktop Server Settings' : 'API Connection Settings'}
                </h2>
              </div>
              <button onClick={() => setSettingsOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-xs text-slate-400">Backend Status</span>
                <div className="flex items-center space-x-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      healthStatus === 'healthy'
                        ? 'bg-emerald-500 animate-pulse'
                        : healthStatus === 'checking'
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                  />
                  <span
                    className={`text-xs font-semibold ${
                      healthStatus === 'healthy'
                        ? 'text-emerald-400'
                        : healthStatus === 'checking'
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {healthStatus === 'healthy' ? 'Connected' : healthStatus === 'checking' ? 'Checking...' : 'Disconnected'}
                  </span>
                </div>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Backend Server URL
                  </label>
                  <input
                    type="url"
                    required
                    value={serverUrlInput}
                    onChange={(e) => setServerUrlInput(e.target.value)}
                    placeholder="http://localhost:8000"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Enter the URL of your FastAPI backend instance.
                  </p>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={checkBackendHealth}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
                  >
                    Test Ping
                  </button>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => setSettingsOpen(false)}
                      className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-600/30"
                    >
                      Save & Reconnect
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {changePasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-up">
            <div className="p-6">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Change Account Password</h3>
                    <p className="text-xs text-slate-400">Update your security credentials</p>
                  </div>
                </div>
                <button
                  onClick={() => setChangePasswordOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {passwordError && (
                <div className="p-3 mb-4 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-200 text-xs leading-relaxed">
                  {passwordError}
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 10 chars (Uppercase, lowercase, digit, special char)"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Must be at least 10 chars with uppercase, lowercase, number & symbol.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setChangePasswordOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-600/30 transition"
                  >
                    {isChangingPassword ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
