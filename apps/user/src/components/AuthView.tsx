import React, { useState } from 'react';
import {
  ShieldCheck,
  Heart,
  Mail,
  Lock,
  User,
  Phone,
  Globe,
  MapPin,
  ArrowRight,
  Zap,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import { getApiBaseUrl, playNotificationChime } from '@shared/utils';
import { supabase } from '@shared/supabase';

interface AuthViewProps {
  onSuccess: (user: any) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sign In Form State
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');

  // Sign Up Form State
  const [fullName, setFullName] = useState<string>('');
  const [signupEmail, setSignupEmail] = useState<string>('');
  const [signupPhone, setSignupPhone] = useState<string>('');
  const [countryResidence, setCountryResidence] = useState<string>('United States (San Jose, CA)');
  const [signupPassword, setSignupPassword] = useState<string>('');
  const [includeParent, setIncludeParent] = useState<boolean>(true);
  const [parentName, setParentName] = useState<string>('');
  const [parentPhone, setParentPhone] = useState<string>('');
  const [parentLocality, setParentLocality] = useState<string>('Reddy Colony, Miryalaguda');
  const [parentAddress, setParentAddress] = useState<string>('');

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    if (!supabase) {
      setErrorMessage('Supabase client is not initialized. Please verify configuration.');
      playNotificationChime('alert');
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to start Google sign-in. Please try again.');
      playNotificationChime('alert');
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'CLIENT',
          email: loginEmail.trim(),
          password: loginPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid email or password.');
      }

      playNotificationChime('success');
      onSuccess(data.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to sign in. Please try again.');
      playNotificationChime('alert');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!fullName.trim() || !signupEmail.trim()) {
      setErrorMessage('Please enter your full name and email address.');
      return;
    }

    if (signupPassword && signupPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'CLIENT',
          fullName: fullName.trim(),
          email: signupEmail.trim(),
          phone: signupPhone.trim() || '+1 408 555 0192',
          password: signupPassword || 'FamilyHubs2026!',
          countryResidence,
          currency: 'USD',
          subscriptionTier: 'GOLD',
          parentName: includeParent && parentName ? parentName.trim() : null,
          parentPhone: includeParent && parentPhone ? parentPhone.trim() : null,
          parentLocality: includeParent ? parentLocality : null,
          parentAddress: includeParent && parentAddress ? parentAddress.trim() : null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create account.');
      }

      playNotificationChime('success');
      onSuccess(data.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Please try again.');
      playNotificationChime('alert');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between font-sans relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-800/80 py-4 px-6 md:px-12 flex items-center justify-between sticky top-0 bg-slate-900/90 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <img src="/logo_icon.png" alt="FamilyHubs" className="w-10 h-10 object-contain drop-shadow-sm" />
          <div>
            <span className="text-xl font-bold text-white tracking-tight">FamilyHubs</span>
            <span className="text-xs bg-indigo-500/20 text-indigo-300 font-semibold px-2.5 py-0.5 rounded-full ml-2 border border-indigo-500/30">
              NRI Care Portal
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-xl">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            Miryalaguda &amp; Nalgonda Network
          </span>
        </div>
      </header>

      {/* Main Content Card */}
      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 md:py-12 flex flex-col lg:flex-row items-center justify-center gap-10 z-10 w-full">
        {/* Left Column: Platform Value Props */}
        <div className="max-w-lg space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3.5 py-1.5 rounded-full text-xs font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            100% Escrow Protection • GPS Photo Check-in
          </div>

          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
            Loving, Reliable Care for Your Aging Parents in India.
          </h1>

          <p className="text-sm md:text-base text-slate-300 leading-relaxed">
            From doctor appointments and home repairs to urgent medicine runs in Miryalaguda—you pay via escrow from abroad, and funds are only disbursed after verified arrival proof.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 text-left">
              <div className="text-emerald-400 font-bold text-sm">🛡️ Zero Cash to Parents</div>
              <div className="text-xs text-slate-400 mt-1">Parents never deal with cash or doorstep haggling.</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 text-left">
              <div className="text-indigo-400 font-bold text-sm">📍 Live GPS Photo Check-In</div>
              <div className="text-xs text-slate-400 mt-1">Helpers check in within 150m of your parents' home.</div>
            </div>
          </div>
        </div>

        {/* Right Column: Auth Card with Sign In / Sign Up Tabs */}
        <div className="w-full max-w-md bg-slate-800/90 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-6 md:p-8 shadow-2xl">
          {/* Official Brand Logo */}
          <div className="text-center mb-6">
            <div className="inline-block bg-white p-3 rounded-2xl shadow-xl">
              <img src="/logo.png" alt="FamilyHubs - Care For Your Parent From Anywhere" className="w-48 h-auto object-contain mx-auto" />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex bg-slate-900/80 p-1 rounded-2xl mb-6 border border-slate-700">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMessage(null);
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                mode === 'signin'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMessage(null);
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                mode === 'signup'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Quick Google OAuth Sign-in / Sign-up */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs flex items-center justify-center gap-3 shadow-md hover:shadow-lg transition border border-slate-200 cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>{mode === 'signin' ? 'Sign in with Google' : 'Sign up with Google'}</span>
          </button>

          <div className="flex items-center my-4">
            <div className="flex-1 border-t border-slate-700/80"></div>
            <span className="px-3 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              or continue with email
            </span>
            <div className="flex-1 border-t border-slate-700/80"></div>
          </div>

          {/* ==================================== */}
          {/* SIGN IN FORM */}
          {/* ==================================== */}
          {mode === 'signin' && (
            <form onSubmit={(e) => handleSignIn(e)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    placeholder="you@gmail.com"
                    className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Sign In to NRI Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ==================================== */}
          {/* SIGN UP FORM */}
          {/* ==================================== */}
          {mode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-3.5 max-h-[460px] overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="e.g. Ananya Reddy"
                    className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email Address <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                    placeholder="ananya@gmail.com"
                    className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Your Phone
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={signupPhone}
                      onChange={(e) => setSignupPhone(e.target.value)}
                      placeholder="+1 408 555 0192"
                      className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Country
                  </label>
                  <div className="relative">
                    <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <select
                      value={countryResidence}
                      onChange={(e) => setCountryResidence(e.target.value)}
                      className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-8 pr-2 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="United States (San Jose, CA)">United States</option>
                      <option value="United Kingdom (London)">United Kingdom</option>
                      <option value="Canada (Toronto)">Canada</option>
                      <option value="Australia (Sydney)">Australia</option>
                      <option value="UAE (Dubai)">UAE (Dubai)</option>
                      <option value="Singapore">Singapore</option>
                      <option value="Germany (Munich)">Germany</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Create Password (min 6 chars) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-10 pr-10 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Optional Parent Residence Registration */}
              <div className="p-3 bg-slate-900/70 border border-slate-700/80 rounded-2xl space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-indigo-300">
                  <input
                    type="checkbox"
                    checked={includeParent}
                    onChange={(e) => setIncludeParent(e.target.checked)}
                    className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                  />
                  <span>Add My Parents' Residence in India</span>
                </label>

                {includeParent && (
                  <div className="space-y-2 pt-1">
                    <input
                      type="text"
                      value={parentName}
                      onChange={(e) => setParentName(e.target.value)}
                      placeholder="Parents' Name (e.g. Lakshmi & Ramana Reddy)"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={parentPhone}
                        onChange={(e) => setParentPhone(e.target.value)}
                        placeholder="Parent Phone (+91...)"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                      />
                      <select
                        value={parentLocality}
                        onChange={(e) => setParentLocality(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                      >
                        <option value="Reddy Colony, Miryalaguda">Reddy Colony, Miryalaguda</option>
                        <option value="Housing Board Colony, Miryalaguda">Housing Board, Miryalaguda</option>
                        <option value="Sagar Road, Miryalaguda">Sagar Road, Miryalaguda</option>
                        <option value="Old Nalgonda & Clock Tower">Old Nalgonda &amp; Clock Tower</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Create NRI Family Account</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          <div className="mt-4 text-center">
            <p className="text-[11px] text-slate-400">
              {mode === 'signin' ? (
                <>
                  Don't have an NRI account?{' '}
                  <button
                    onClick={() => {
                      setMode('signup');
                      setErrorMessage(null);
                    }}
                    className="text-indigo-400 font-bold hover:underline"
                  >
                    Sign Up Free
                  </button>
                </>
              ) : (
                <>
                  Already registered?{' '}
                  <button
                    onClick={() => {
                      setMode('signin');
                      setErrorMessage(null);
                    }}
                    className="text-indigo-400 font-bold hover:underline"
                  >
                    Sign In here
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 px-6 text-center text-xs text-slate-500">
        FamilyHubs NRI Eldercare Concierge • Escrow-Secured Services in Miryalaguda &amp; Nalgonda, Telangana
      </footer>
    </div>
  );
};
