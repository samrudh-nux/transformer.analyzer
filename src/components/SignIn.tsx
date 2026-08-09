import React, { useState, useEffect } from 'react';
import { Mail, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';
// @ts-ignore - JS file import
import { supabase } from '../supabaseClient';

interface SignInProps {
  initialEmail?: string;
  signUpSuccess?: boolean;
  onSignInSuccess?: () => void;
}

export const SignIn: React.FC<SignInProps> = ({ initialEmail, signUpSuccess, onSignInSuccess }) => {
  const [email, setEmail] = useState(() => {
    if (initialEmail) return initialEmail;
    const params = new URLSearchParams(window.location.search);
    return params.get('email') || localStorage.getItem('signedUpEmail') || '';
  });
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const isSuccess =
      signUpSuccess ||
      params.get('signup') === 'success' ||
      localStorage.getItem('justSignedUp') === 'true';
    return isSuccess
      ? 'Your account has been created. Please check your email and verify your address before logging in.'
      : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  useEffect(() => {
    if (signUpSuccess) {
      setSuccessMessage(
        'Your account has been created. Please check your email and verify your address before logging in.'
      );
    }
  }, [signUpSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
      } else if (data) {
        try {
          localStorage.removeItem('justSignedUp');
        } catch (e) {
          // ignore storage error
        }
        if (onSignInSuccess) {
          onSignInSuccess();
        }
      }
    } catch (err: any) {
      setError(err?.message || 'An error occurred during sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-sans flex items-start space-x-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1 font-sans">
            Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Mail className="w-4 h-4" />
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="engineer@robotics.org"
              required
              className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1 font-sans">
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-all flex items-center justify-center space-x-2 active:scale-[0.99] disabled:opacity-50"
        >
          <span>{loading ? 'Signing in...' : 'Sign in'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        {error && (
          <p className="text-xs text-rose-600 font-sans mt-2 text-center">
            {error}
          </p>
        )}
      </form>
    </div>
  );
};
