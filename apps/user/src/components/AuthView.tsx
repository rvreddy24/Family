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
  KeyRound,
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
}

export const AuthView: React.FC<AuthViewProps> = ({ onSuccess, pendingGoogleData }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(
    pendingGoogleData && !pendingGoogleData.isExisting ? 'signup' : 'signin'
  );
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sign In Form State
  const [loginEmail, setLoginEmail] = useState<string>(pendingGoogleData?.email || '');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginOtp, setLoginOtp] = useState<string>('');
  const [otpSentForLogin, setOtpSentForLogin] = useState<boolean>(false);

  // Sign Up Form State - Only User details (NO parents during signup)
  const [fullName, setFullName] = useState<string>(pendingGoogleData?.fullName || '');
  const [signupEmail, setSignupEmail] = useState<string>(pendingGoogleData?.email || '');
  const [signupPhone, setSignupPhone] = useState<string>('');
  const [countryResidence, setCountryResidence] = useState<string>('United States');
  const [signupPassword, setSignupPassword] = useState<string>('');
  const [signupOtp, setSignupOtp] = useState<string>('');
  const [otpSentForSignup, setOtpSentForSignup] = useState<boolean>(false);

  // OTP cooldown & notice state
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [otpNotice, setOtpNotice] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Handle Google Auth state passed in from App.tsx
  useEffect(() => {
    if (!pendingGoogleData) return;

    if (pendingGoogleData.isExisting) {
      // Existing Google user -> direct sign in!
      onSuccess(pendingGoogleData.user);
    } else {
      // New Google user -> direct to quick signup
      setMode('signup');
      if (pendingGoogleData.fullName) setFullName(pendingGoogleData.fullName);
      if (pendingGoogleData.email) setSignupEmail(pendingGoogleData.email);
      setOtpNotice(
        `Google account verified (${pendingGoogleData.email}). Please enter your mobile phone number to activate your account.`
      );
    }
  }, [pendingGoogleData]);

  // --- OTP DISPATCH HANDLERS ---
  const handleSendLoginOtp = async (targetEmailParam?: string): Promise<boolean> => {
    const targetEmail = (targetEmailParam || loginEmail).trim();
    if (!targetEmail) {
      setErrorMessage('Please enter your email address first.');
      return false;
    }
    setIsLoading(true);
    setErrorMessage(null);
    setOtpNotice(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          role: 'CLIENT',
          action: 'LOGIN',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to dispatch verification code.');
      }
      setOtpSentForLogin(true);
      setResendCooldown(30);
      const noticeMsg = data.message || `A 6-digit verification code has been dispatched to ${targetEmail}.`;
      setOtpNotice(noticeMsg);
      return true;
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch verification code.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendSignupOtp = async (): Promise<boolean> => {
    if (!fullName.trim() || !signupEmail.trim()) {
      setErrorMessage('Please enter your full name and email address.');
      return false;
    }
    if (!signupPhone.trim()) {
      setErrorMessage('Please enter your mobile phone number.');
      return false;
    }
    if (!pendingGoogleData && (!signupPassword || signupPassword.length < 6)) {
      setErrorMessage('Password must be at least 6 characters.');
      return false;
    }
    setIsLoading(true);
    setErrorMessage(null);
    setOtpNotice(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: signupEmail.trim(),
          role: 'CLIENT',
          action: 'SIGNUP',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send verification code.');
      }
      setOtpSentForSignup(true);
      setResendCooldown(30);
      const noticeMsg = data.message || `A 6-digit verification code has been dispatched to ${signupEmail.trim()}.`;
      setOtpNotice(noticeMsg);
      return true;
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch verification code.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // --- SIGN IN FLOW: Password first, then OTP verification challenge ---
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

      // Login successful -> activate session immediately
      onSuccess(data.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to sign in. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // Complete Login with OTP (if requested)
  const handleVerifyLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginOtp.trim()) {
      setErrorMessage('Please enter the 6-digit verification code sent to your email.');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail.trim(),
          otp: loginOtp.trim(),
          role: 'CLIENT',
          action: 'LOGIN',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid or expired verification code.');
      }
      onSuccess(data.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'OTP verification failed. Please check the code.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- SIGN UP FLOW: Direct Registration & Account Activation ---
  const handleStartSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !signupEmail.trim()) {
      setErrorMessage('Please enter your full name and email address.');
      return;
    }
    if (!signupPhone.trim()) {
      setErrorMessage('Please enter your mobile phone number.');
      return;
    }
    if (!pendingGoogleData && (!signupPassword || signupPassword.length < 6)) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    setOtpNotice(null);

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
        throw new Error(data.error || 'Failed to register account.');
      }

      // Registration successful -> immediately activate and sign in
      onSuccess(data.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Complete Signup with OTP
  const handleVerifySignupOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupEmail.trim() || !signupOtp.trim()) {
      setErrorMessage('Please enter the 6-digit verification code sent to your email.');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: signupEmail.trim(),
          otp: signupOtp.trim(),
          role: 'CLIENT',
          action: 'SIGNUP',
          fullName: fullName.trim(),
          phone: signupPhone.trim(),
          countryResidence,
          currency: 'USD',
          subscriptionTier: 'GOLD',
          password: signupPassword || 'FamilyHubs2026!',
          // Note: Parent details are configured in the Parents tab after registration
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid or expired verification code.');
      }
      onSuccess(data.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Google OAuth redirect
  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    if (!supabase) {
      setErrorMessage('Supabase client is not initialized.');
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
      setErrorMessage(err.message || 'Failed to start Google authentication.');
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

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="hidden sm:inline">Bank-Grade 256-bit SSL</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 md:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center z-10">
        {/* Left Column: Brand Hero */}
        <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
            <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
            <span>Pan-India NRI Concierge Network</span>
          </div>

          <h1 className="text-3xl md:text-5xl font-black text-white leading-tight tracking-tight">
            Loving, Reliable Care for Your Aging Parents Across India.
          </h1>

          <p className="text-sm md:text-base text-slate-300 leading-relaxed max-w-xl">
            Live health checks, emergency hospital escort, doorstep medicine delivery, and home maintenance managed in real-time with photo &amp; GPS verification.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-left">
            <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
              <div className="text-emerald-400 font-bold text-sm">🛡️ Escrow Protected</div>
              <div className="text-xs text-slate-400 mt-1">Funds released only after GPS verified photo check-in.</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
              <div className="text-indigo-400 font-bold text-sm">📍 Verified Field Network</div>
              <div className="text-xs text-slate-400 mt-1">Vetted local concierges check in within 150m of parents' home.</div>
            </div>
          </div>
        </div>

        {/* Right Column: Authentication Card */}
        <div className="lg:col-span-6 max-w-md w-full mx-auto">
          <div className="bg-slate-800/90 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-6 md:p-8 shadow-2xl space-y-5">
            {/* Mode Switcher */}
            <div className="flex bg-slate-900/80 p-1 rounded-2xl border border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMessage(null);
                  setOtpNotice(null);
                  setOtpSentForLogin(false);
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
                  setOtpNotice(null);
                  setOtpSentForSignup(false);
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
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Info / OTP Banner */}
            {otpNotice && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{otpNotice}</span>
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
              <span>{mode === 'signin' ? 'Continue with Google' : 'Sign up with Google'}</span>
            </button>

            <div className="flex items-center my-3">
              <div className="flex-1 border-t border-slate-700/80"></div>
              <span className="px-3 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                or with email
              </span>
              <div className="flex-1 border-t border-slate-700/80"></div>
            </div>

            {/* ========================================================= */}
            {/* SIGN IN FORM (Password first, then 6-digit Email OTP)    */}
            {/* ========================================================= */}
            {mode === 'signin' && (
              <div className="space-y-4">
                {!otpSentForLogin ? (
                  <form onSubmit={handlePasswordSignIn} className="space-y-4">
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
                          className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
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
                          className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
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
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {isLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>Sign In</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyLoginOtp} className="space-y-4">
                    <div className="p-3 rounded-xl bg-slate-900/90 border border-indigo-500/40 text-xs space-y-1">
                      <div className="text-slate-400">Account verified:</div>
                      <div className="text-white font-semibold font-mono">{loginEmail}</div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-xs font-semibold text-slate-300">
                          Enter 6-Digit Email Code
                        </label>
                        <button
                          type="button"
                          onClick={() => { handleSendLoginOtp(); }}
                          disabled={isLoading || resendCooldown > 0}
                          className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50 cursor-pointer"
                        >
                          {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}
                        </button>
                      </div>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          maxLength={6}
                          value={loginOtp}
                          onChange={(e) => setLoginOtp(e.target.value.replace(/\D/g, ''))}
                          required
                          placeholder="123456"
                          autoFocus
                          className="w-full bg-slate-950 border border-indigo-500/60 rounded-xl pl-10 pr-4 py-2.5 text-base tracking-widest font-mono text-center text-white placeholder-slate-600 focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading || loginOtp.length < 6}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {isLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Verify Code &amp; Sign In</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setOtpSentForLogin(false)}
                      className="w-full text-center text-xs text-slate-400 hover:text-slate-300 cursor-pointer"
                    >
                      ← Back to password sign-in
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* ========================================================= */}
            {/* SIGN UP FORM (User Details ONLY - No parents section)    */}
            {/* ========================================================= */}
            {mode === 'signup' && (
              <div className="space-y-4">
                {!otpSentForSignup ? (
                  <form onSubmit={handleStartSignup} className="space-y-3">
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
                          placeholder="Rajesh Reddy"
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
                          placeholder="you@gmail.com"
                          className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Mobile Phone <span className="text-rose-400">*</span>
                        </label>
                        <div className="relative">
                          <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="tel"
                            value={signupPhone}
                            onChange={(e) => setSignupPhone(e.target.value)}
                            required
                            placeholder="+1 408 555 0192"
                            className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Country of Residence
                        </label>
                        <div className="relative">
                          <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <select
                            value={countryResidence}
                            onChange={(e) => setCountryResidence(e.target.value)}
                            className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-8 pr-2 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                          >
                            <option value="United States">United States</option>
                            <option value="United Kingdom">United Kingdom</option>
                            <option value="Canada">Canada</option>
                            <option value="Australia">Australia</option>
                            <option value="UAE (Dubai)">UAE (Dubai)</option>
                            <option value="Singapore">Singapore</option>
                            <option value="Germany">Germany</option>
                            <option value="India">India</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {!pendingGoogleData && (
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
                    )}

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer mt-2"
                    >
                      {isLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Create &amp; Activate Account</span>
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifySignupOtp} className="space-y-4">
                    <div className="p-3 rounded-xl bg-slate-900/90 border border-indigo-500/40 text-xs space-y-1">
                      <div className="text-slate-400">Verifying registration for:</div>
                      <div className="text-white font-semibold font-mono">{signupEmail}</div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-xs font-semibold text-slate-300">
                          Enter 6-Digit Verification Code
                        </label>
                        <button
                          type="button"
                          onClick={() => { handleSendSignupOtp(); }}
                          disabled={isLoading || resendCooldown > 0}
                          className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50 cursor-pointer"
                        >
                          {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}
                        </button>
                      </div>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          maxLength={6}
                          value={signupOtp}
                          onChange={(e) => setSignupOtp(e.target.value.replace(/\D/g, ''))}
                          required
                          placeholder="123456"
                          autoFocus
                          className="w-full bg-slate-950 border border-indigo-500/60 rounded-xl pl-10 pr-4 py-2.5 text-base tracking-widest font-mono text-center text-white placeholder-slate-600 focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading || signupOtp.length < 6}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {isLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Verify &amp; Activate Account</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setOtpSentForSignup(false)}
                      className="w-full text-center text-xs text-slate-400 hover:text-slate-300 cursor-pointer"
                    >
                      ← Back to edit registration details
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 px-6 md:px-12 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} FamilyHubs Technologies Pvt. Ltd. All rights reserved. Pan-India Care Operations.
      </footer>
    </div>
  );
};
