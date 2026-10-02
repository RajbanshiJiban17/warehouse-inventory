import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Warehouse, Lock, Mail, User, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

export const Register: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await register(username, email, password);
      showToast('success', 'Admin Account Created', 'Your account has been granted full Administrator access. You can now log in.');
      navigate('/login');
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed. Please check your inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-brand-500 selection:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white shadow-xl shadow-brand-500/20 mb-4">
          <Warehouse className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-extrabold text-white tracking-tight">Create Account</h2>
        <p className="mt-2 text-sm text-slate-400">Warehouse Staff & Admin Registration</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 py-8 px-6 shadow-2xl rounded-2xl sm:px-10">
          {/* Admin Notice Banner */}
          <div className="mb-6 p-3.5 rounded-xl bg-brand-950/50 border border-brand-800/60 text-brand-200 text-xs flex items-start space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              All registered accounts are automatically granted full <strong>ADMIN</strong> privileges with immediate active access.
            </span>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {errorMsg && (
              <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-200 text-sm flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                <div className="leading-snug">{errorMsg}</div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="john_doe"
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@warehouse.com"
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 10 chars (A-Z, a-z, 0-9, symbol)"
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition text-sm"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Must be at least 10 chars with uppercase, lowercase, number, and special character.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center items-center space-x-2 py-3 px-4 border border-transparent rounded-xl shadow-lg shadow-brand-600/30 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 focus:outline-none transition disabled:opacity-50"
              >
                <span>{isSubmitting ? 'Registering...' : 'Complete Registration'}</span>
                {!isSubmitting && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </form>

          <div className="mt-6 border-t border-slate-800/80 pt-4 text-center">
            <p className="text-xs text-slate-400">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-brand-400 hover:text-brand-300 transition">
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
