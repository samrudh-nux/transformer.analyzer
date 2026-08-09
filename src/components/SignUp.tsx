import React, { useState } from 'react';
import { Mail, Lock, ArrowRight } from 'lucide-react';
// @ts-ignore - JS file import
import { supabase } from '../supabaseClient';

interface SignUpProps {
  onSignUpSuccess?: (email: string) => void;
}

export const SignUp: React.FC<SignUpProps> = ({ onSignUpSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
      } else if (data) {
        // Do NOT auto-login or redirect to '/'
        // Store email and sign-up success flag in search params & localStorage for seamless retrieval
        try {
          const searchParams = new URLSearchParams(window.location.search);
          searchParams.set('email', email);
          searchParams.set('signup', 'success');
          const newUrl = `${window.location.pathname}?${searchParams.toString()}`;
          window.history.pushState({ path: newUrl }, '', newUrl);

          localStorage.setItem('signedUpEmail', email);
          localStorage.setItem('justSignedUp', 'true');
        } catch (e) {
          // ignore storage / URL state errors in restricted environments
        }

        if (onSignUpSuccess) {
          onSignUpSuccess(email);
        } else {
          // Notify any listener to update Sign In view
          window.dispatchEvent(new Event('popstate'));
        }
      }
    } catch (err: any) {
      setError(err?.message || 'An error occurred during sign up.');
    } finally {
      setLoading(false);
    }
  };

  return (
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
        <span>{loading ? 'Creating account...' : 'Sign up'}</span>
        <ArrowRight className="w-4 h-4" />
      </button>

      {error && (
        <p className="text-xs text-rose-600 font-sans mt-2 text-center">
          {error}
        </p>
      )}
    </form>
  );
};
