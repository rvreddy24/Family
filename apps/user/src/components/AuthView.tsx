import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Heart,
  Mail,
  Lock,
  User,
  Phone,
  Globe,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  MapPin,
  Clock,
  Activity,
  Users,
  Check,
  Sun,
  Moon,
} from 'lucide-react';
import { getApiBaseUrl } from '@shared/utils';
import { supabase } from '@shared/supabase';

interface AuthViewProps {
  onSuccess: (user: any) => void;
  pendingGoogleData?: {
    email: string;
    fullName: string;
    authProviderId?: string;
    isExisting?: boolean;
    user?: any;
  } | null;
  isDark?: boolean;
  onToggleTheme?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({
  onSuccess,
  pendingGoogleData,
  isDark,
  onToggleTheme,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(
    pendingGoogleData && !pendingGoogleData.isExisting ? 'signup' : 'signin'
  );
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sign In Form State
  const [loginEmail, setLoginEmail] = useState<string>(pendingGoogleData?.email || '');
  const [loginPassword, setLoginPassword] = useState<string>('');

  // Sign Up Form State
  const [fullName, setFullName] = useState<string>(pendingGoogleData?.fullName || '');
  const [signupEmail, setSignupEmail] = useState<string>(pendingGoogleData?.email || '');
  const [signupPhone, setSignupPhone] = useState<string>('');
  const [countryResidence, setCountryResidence] = useState<string>('United States');
  const [signupPassword, setSignupPassword] = useState<string>('');

  useEffect(() => {
    if (!pendingGoogleData) return;

    if (pendingGoogleData.isExisting) {
      onSuccess(pendingGoogleData.user);
    } else {
      setMode('signup');
      if (pendingGoogleData.fullName) setFullName(pendingGoogleData.fullName);
      if (pendingGoogleData.email) setSignupEmail(pendingGoogleData.email);
    }
  }, [pendingGoogleData]);

  // Sign In Flow
  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      setErrorMessage('Please enter your email and password.');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);

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

      onSuccess(data.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to sign in.');
    } finally {
      setIsLoading(false);
    }
  };

  // Sign Up Flow
  const handleStartSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !signupEmail.trim() || !signupPhone.trim()) {
      setErrorMessage('Please complete all required fields.');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'CLIENT',
          email: signupEmail.trim(),
          password: signupPassword || 'FamilyHubs2026!',
          fullName: fullName.trim(),
          phone: signupPhone.trim(),
          countryResidence,
          currency: 'USD',
          subscriptionTier: 'GOLD',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Registration failed.');
      }

      onSuccess(data.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to start Google sign-in.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-slate-100 font-body transition-colors duration-200">
      {/* ================= HEADER ================= */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#090D16]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Heart className="w-4 h-4 fill-white" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              FamilyHubs
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Dark / Light Mode Switch */}
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
              </button>
            )}

            <button
              onClick={() => setMode('signin')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer ${
                mode === 'signin'
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('signup')}
              className="filial-btn-primary text-xs py-1.5 px-3.5 cursor-pointer"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* ================= HERO CONTENT ================= */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Mission & Trust */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>100% Escrow-Protected Eldercare</span>
            </div>

            <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.15]">
              Devoted care for aging parents in India, verified at home.
            </h1>

            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
              From routine doctor home visits and prescription deliveries to emergency hospital accompaniment — all verified with live GPS and tamper-evident photo proof.
            </p>

            {/* 3 Core Trust Pillars */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
              <div className="p-4 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
                <div className="font-mono text-xl font-bold text-blue-600 dark:text-blue-400">&lt; 150m</div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">GPS Geofence</div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Companions must lock location right at your parents' door.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
                <div className="font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400">100%</div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">Escrow Secured</div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Funds released only after you inspect the arrival photo proof.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
                <div className="font-mono text-xl font-bold text-amber-600 dark:text-amber-400">24 / 7</div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">Emergency Relay</div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Immediate hospital escort and ambulance coordination.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Authentication Form */}
          <div className="lg:col-span-5 w-full">
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm space-y-4">
              {/* Tab Selector */}
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setErrorMessage(null);
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    mode === 'signin'
                      ? 'bg-white dark:bg-[#1E293B] text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Family Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setErrorMessage(null);
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    mode === 'signup'
                      ? 'bg-white dark:bg-[#1E293B] text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Join as Family
                </button>
              </div>

              {/* Error Banner */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Google Sign In */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-50 dark:bg-[#1E293B] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-semibold text-xs flex items-center justify-center gap-2.5 transition border border-slate-200 dark:border-slate-700 cursor-pointer disabled:opacity-50"
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
                <span>{mode === 'signin' ? 'Continue with Google' : 'Sign up with Google'}</span>
              </button>

              <div className="flex items-center my-1.5">
                <div className="flex-1 border-t border-slate-200 dark:border-slate-800"></div>
                <span className="px-3 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  or with email
                </span>
                <div className="flex-1 border-t border-slate-200 dark:border-slate-800"></div>
              </div>

              {/* Sign In Form */}
              {mode === 'signin' && (
                <form onSubmit={handlePasswordSignIn} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                        placeholder="rajesh.reddy@gmail.com"
                        className="w-full filial-input pl-9"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        className="w-full filial-input pl-9 pr-9 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 filial-btn-primary text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? 'Signing in...' : 'Sign In to Family Portal ➔'}
                  </button>

                  {/* 1-Click Demo Login */}
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => {
                      setLoginEmail('rajesh.reddy@gmail.com');
                      setLoginPassword('FamilyHubs2026!');
                      const fakeEvent = { preventDefault: () => {} } as any;
                      setTimeout(() => handlePasswordSignIn(fakeEvent), 50);
                    }}
                    className="w-full py-2 px-3 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>⚡ One-Click Demo Access (Rajesh Reddy - NRI Son)</span>
                  </button>
                </form>
              )}

              {/* Sign Up Form */}
              {mode === 'signup' && (
                <form onSubmit={handleStartSignup} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      placeholder="e.g. Rajesh Reddy"
                      className="w-full filial-input"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      required
                      placeholder="rajesh@example.com"
                      className="w-full filial-input"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Mobile Number
                    </label>
                    <input
                      type="tel"
                      value={signupPhone}
                      onChange={(e) => setSignupPhone(e.target.value)}
                      required
                      placeholder="+1 408 555 0192"
                      className="w-full filial-input font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      required
                      placeholder="At least 6 characters"
                      className="w-full filial-input font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 filial-btn-primary text-xs font-semibold cursor-pointer disabled:opacity-50 mt-1"
                  >
                    {isLoading ? 'Creating Account...' : 'Create Family Account ➔'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
