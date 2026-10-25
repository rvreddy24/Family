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
  Building,
  Check,
  ChevronDown,
  Quote,
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

  // Sign Up Form State
  const [fullName, setFullName] = useState<string>(pendingGoogleData?.fullName || '');
  const [signupEmail, setSignupEmail] = useState<string>(pendingGoogleData?.email || '');
  const [signupPhone, setSignupPhone] = useState<string>('');
  const [countryResidence, setCountryResidence] = useState<string>('United States');
  const [signupPassword, setSignupPassword] = useState<string>('');

  // Handle Google Auth state passed in from App.tsx
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
      setErrorMessage('Please enter your registered email address and password.');
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
      setErrorMessage(err.message || 'Failed to sign in. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // Sign Up Flow
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

      onSuccess(data.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Please try again.');
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

  const scrollToAuth = (targetMode: 'signin' | 'signup') => {
    setMode(targetMode);
    const element = document.getElementById('auth-form-card');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1C1917] font-body antialiased selection:bg-[#C25E2E] selection:text-white">
      {/* Editorial Decorative Subtle Patterns */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.03] z-0"
        style={{
          backgroundImage: `radial-gradient(#C25E2E 0.75px, transparent 0.75px)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#FFFFFF]/90 backdrop-blur-md border-b border-[#E7DFD5] shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] border border-[#E7DFD5] flex items-center justify-center p-1.5 shadow-xs">
              <img src="./logo_icon.png" alt="FamilyHubs" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-xl font-bold text-[#1C1917] tracking-tight">FamilyHubs</span>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#FBECE5] text-[#C25E2E] border border-[#F5D5C6]">
                  The Filial Sanctuary
                </span>
              </div>
              <p className="text-[11px] text-[#8C827A] hidden sm:block">Pan-India Managed Concierge Care for Aging Parents</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => scrollToAuth('signin')}
              className="text-xs font-semibold text-[#574F49] hover:text-[#1C1917] px-3 py-2 rounded-lg transition cursor-pointer"
            >
              Sign In
            </button>
            <button
              onClick={() => scrollToAuth('signup')}
              className="bg-[#C25E2E] hover:bg-[#A3481D] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <span>Get Started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Welcome Section */}
      <section className="relative z-10 pt-10 pb-16 sm:pt-16 sm:pb-24 border-b border-[#E7DFD5]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Narrative Column */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#E8F3EE] border border-[#C8E5D7] text-[#1F5C42] text-xs font-semibold">
                <ShieldCheck className="w-4 h-4 text-[#1F5C42]" />
                <span>100% Escrow-Protected Eldercare Network</span>
              </div>

              <h1 className="font-display text-3xl sm:text-5xl lg:text-[3.25rem] font-bold text-[#1C1917] leading-[1.12] tracking-tight">
                Distance fades when devoted care is verified at home.
              </h1>

              <p className="text-base sm:text-lg text-[#574F49] leading-relaxed max-w-xl">
                The premier managed concierge for adult children living abroad. From routine medical appointments and doorstep pharmacy refills to 24/7 emergency hospital escorts — verified with live GPS &amp; forensic photo check-in.
              </p>

              {/* Core Filial Assurance Pillars */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
                <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E7DFD5] shadow-xs space-y-1">
                  <div className="font-mono text-xl font-bold text-[#C25E2E]">&lt; 150m</div>
                  <div className="text-xs font-semibold text-[#1C1917]">GPS Geofence</div>
                  <p className="text-[11px] text-[#8C827A] leading-normal">
                    Companions must lock location at parent's doorstep.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E7DFD5] shadow-xs space-y-1">
                  <div className="font-mono text-xl font-bold text-[#1F5C42]">100%</div>
                  <div className="text-xs font-semibold text-[#1C1917]">Escrow Protected</div>
                  <p className="text-[11px] text-[#8C827A] leading-normal">
                    Funds released only after you approve photo proof.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E7DFD5] shadow-xs space-y-1">
                  <div className="font-mono text-xl font-bold text-[#B45309]">24 / 7</div>
                  <div className="text-xs font-semibold text-[#1C1917]">Emergency Relay</div>
                  <p className="text-[11px] text-[#8C827A] leading-normal">
                    Rapid ambulance and hospital accompaniment.
                  </p>
                </div>
              </div>

              {/* Sibling Care Circle Tagline */}
              <div className="flex items-center gap-3 pt-2 text-xs text-[#574F49]">
                <div className="flex -space-x-2">
                  <div className="w-7 h-7 rounded-full bg-[#FBECE5] text-[#C25E2E] border-2 border-white flex items-center justify-center font-bold text-[10px]">US</div>
                  <div className="w-7 h-7 rounded-full bg-[#E8F3EE] text-[#1F5C42] border-2 border-white flex items-center justify-center font-bold text-[10px]">UK</div>
                  <div className="w-7 h-7 rounded-full bg-[#FEF3C7] text-[#B45309] border-2 border-white flex items-center justify-center font-bold text-[10px]">CA</div>
                  <div className="w-7 h-7 rounded-full bg-[#FAF7F2] text-[#1C1917] border-2 border-white flex items-center justify-center font-bold text-[10px]">AE</div>
                </div>
                <span>Synchronized care circle updates for siblings worldwide.</span>
              </div>
            </div>

            {/* Right Authentication Card */}
            <div id="auth-form-card" className="lg:col-span-5 w-full">
              <div className="bg-[#FFFFFF] border border-[#E7DFD5] rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
                {/* Mode Selector */}
                <div className="flex bg-[#F5F1EB] p-1.5 rounded-2xl border border-[#E7DFD5]">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin');
                      setErrorMessage(null);
                    }}
                    className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                      mode === 'signin'
                        ? 'bg-[#FFFFFF] text-[#1C1917] shadow-xs border border-[#E7DFD5]'
                        : 'text-[#8C827A] hover:text-[#1C1917]'
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
                    className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                      mode === 'signup'
                        ? 'bg-[#FFFFFF] text-[#1C1917] shadow-xs border border-[#E7DFD5]'
                        : 'text-[#8C827A] hover:text-[#1C1917]'
                    }`}
                  >
                    Join as Family
                  </button>
                </div>

                {/* Error Banner */}
                {errorMessage && (
                  <div className="p-3.5 rounded-2xl bg-[#FEE2E2] border border-[#FCA5A5] text-[#991B1B] text-xs flex items-start gap-2.5 animate-fadeIn">
                    <AlertCircle className="w-4 h-4 text-[#B91C1C] shrink-0 mt-0.5" />
                    <span className="font-medium leading-relaxed">{errorMessage}</span>
                  </div>
                )}

                {/* Google OAuth One-Tap */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl bg-[#FAF7F2] hover:bg-[#F5F1EB] text-[#1C1917] font-semibold text-xs sm:text-sm flex items-center justify-center gap-3 transition-all border border-[#E7DFD5] shadow-xs cursor-pointer disabled:opacity-50"
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

                <div className="flex items-center my-2">
                  <div className="flex-1 border-t border-[#E7DFD5]"></div>
                  <span className="px-3 text-[10px] text-[#8C827A] font-bold uppercase tracking-wider">
                    or with email
                  </span>
                  <div className="flex-1 border-t border-[#E7DFD5]"></div>
                </div>

                {/* SIGN IN FORM */}
                {mode === 'signin' && (
                  <form onSubmit={handlePasswordSignIn} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#574F49] mb-1.5">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          required
                          placeholder="rajesh.reddy@gmail.com"
                          className="w-full bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1C1917] placeholder-[#8C827A] focus:outline-none focus:border-[#C25E2E] focus:ring-2 focus:ring-[#C25E2E]/10 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#574F49] mb-1.5">
                        Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          required
                          placeholder="••••••••"
                          className="w-full bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl pl-10 pr-10 py-2.5 text-sm text-[#1C1917] placeholder-[#8C827A] focus:outline-none focus:border-[#C25E2E] focus:ring-2 focus:ring-[#C25E2E]/10 transition-all font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8C827A] hover:text-[#1C1917] cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3.5 bg-[#C25E2E] hover:bg-[#A3481D] text-white font-semibold text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {isLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>Sign In to Family Portal</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* SIGN UP FORM */}
                {mode === 'signup' && (
                  <form onSubmit={handleStartSignup} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-[#574F49] mb-1">
                        Full Name <span className="text-[#C25E2E]">*</span>
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          required
                          placeholder="e.g. Rajesh Reddy"
                          className="w-full bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1C1917] placeholder-[#8C827A] focus:outline-none focus:border-[#C25E2E]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#574F49] mb-1">
                        Email Address <span className="text-[#C25E2E]">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                          required
                          placeholder="rajesh@gmail.com"
                          className="w-full bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1C1917] placeholder-[#8C827A] focus:outline-none focus:border-[#C25E2E]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#574F49] mb-1">
                          Mobile Phone <span className="text-[#C25E2E]">*</span>
                        </label>
                        <div className="relative">
                          <Phone className="w-3.5 h-3.5 text-[#8C827A] absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="tel"
                            value={signupPhone}
                            onChange={(e) => setSignupPhone(e.target.value)}
                            required
                            placeholder="+1 408 555 0192"
                            className="w-full bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl pl-9 pr-3 py-2 text-xs text-[#1C1917] font-mono focus:outline-none focus:border-[#C25E2E]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#574F49] mb-1">
                          Country of Residence
                        </label>
                        <div className="relative">
                          <Globe className="w-3.5 h-3.5 text-[#8C827A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <select
                            value={countryResidence}
                            onChange={(e) => setCountryResidence(e.target.value)}
                            className="w-full bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl pl-9 pr-2 py-2 text-xs text-[#1C1917] focus:outline-none focus:border-[#C25E2E] appearance-none cursor-pointer"
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
                        <label className="block text-xs font-semibold text-[#574F49] mb-1">
                          Create Password (min 6 chars) <span className="text-[#C25E2E]">*</span>
                        </label>
                        <div className="relative">
                          <Lock className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={signupPassword}
                            onChange={(e) => setSignupPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                            className="w-full bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl pl-10 pr-10 py-2 text-xs text-[#1C1917] font-mono focus:outline-none focus:border-[#C25E2E]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8C827A] hover:text-[#1C1917] cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3.5 bg-[#C25E2E] hover:bg-[#A3481D] text-white font-semibold text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-1"
                    >
                      {isLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Create Account &amp; Protect Parents</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The 3-Step Filial Journey Section */}
      <section className="relative z-10 py-16 bg-[#FFFFFF] border-b border-[#E7DFD5]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
            <span className="text-xs font-semibold tracking-wider uppercase text-[#C25E2E]">
              How FamilyHubs Works
            </span>
            <h2 className="font-display text-2xl sm:text-4xl font-bold text-[#1C1917] tracking-tight">
              Absolute filial trust, verified at every milestone.
            </h2>
            <p className="text-sm text-[#574F49]">
              Engineered for NRI families who cannot be there in person, but refuse to compromise on quality and safety.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="p-6 rounded-3xl bg-[#FAF7F2] border border-[#E7DFD5] space-y-3 relative">
              <div className="w-10 h-10 rounded-xl bg-[#FBECE5] text-[#C25E2E] flex items-center justify-center font-display font-bold text-lg border border-[#F5D5C6]">
                1
              </div>
              <h3 className="font-display text-lg font-bold text-[#1C1917]">
                Concierge Booking &amp; Escrow
              </h3>
              <p className="text-xs text-[#574F49] leading-relaxed">
                Choose doctor visits, medicine runs, power backup repairs, or pooja samagri. Your booking fee is locked safely in 100% bank escrow.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-3xl bg-[#FAF7F2] border border-[#E7DFD5] space-y-3 relative">
              <div className="w-10 h-10 rounded-xl bg-[#E8F3EE] text-[#1F5C42] flex items-center justify-center font-display font-bold text-lg border border-[#C8E5D7]">
                2
              </div>
              <h3 className="font-display text-lg font-bold text-[#1C1917]">
                Doorstep Forensic Check-In
              </h3>
              <p className="text-xs text-[#574F49] leading-relaxed">
                A vetted local companion arrives at your parents' residence. Hardware GPS lock (&lt;150m) and timestamped photo proof are captured live.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-3xl bg-[#FAF7F2] border border-[#E7DFD5] space-y-3 relative">
              <div className="w-10 h-10 rounded-xl bg-[#FEF3C7] text-[#B45309] flex items-center justify-center font-display font-bold text-lg border border-[#FDE68A]">
                3
              </div>
              <h3 className="font-display text-lg font-bold text-[#1C1917]">
                Inspect &amp; Escrow Release
              </h3>
              <p className="text-xs text-[#574F49] leading-relaxed">
                You inspect the photo proof, vitals log, and pharmacist bill in the family vault. Only after you are satisfied is payout released.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Voice of NRI Children Reassurance Section */}
      <section className="relative z-10 py-16 bg-[#FAF7F2] border-b border-[#E7DFD5]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto space-y-2 mb-10">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#1C1917]">
              Loved by NRI families across the world
            </h2>
            <p className="text-xs sm:text-sm text-[#574F49]">
              Real adult children sharing peace of mind for parents in India.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="p-6 rounded-2xl bg-[#FFFFFF] border border-[#E7DFD5] shadow-xs space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <Quote className="w-6 h-6 text-[#C25E2E]/40" />
                <p className="text-xs text-[#574F49] leading-relaxed italic">
                  "Living in Dallas, when my mother felt unwell in Miryalaguda, FamilyHubs dispatched a trusted companion within 20 minutes. I saw the doctor's check-in photo and BP reading live on my phone."
                </p>
              </div>
              <div className="pt-2 border-t border-[#E7DFD5]/60 text-xs">
                <div className="font-bold text-[#1C1917]">Rajesh Reddy</div>
                <div className="text-[11px] text-[#8C827A]">Dallas, Texas • Mother in Miryalaguda</div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-[#FFFFFF] border border-[#E7DFD5] shadow-xs space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <Quote className="w-6 h-6 text-[#1F5C42]/40" />
                <p className="text-xs text-[#574F49] leading-relaxed italic">
                  "The inverter blew up in the summer heat at my father's house. FamilyHubs sent a certified electrician who fixed it and posted the battery voltage test. The escrow protection is completely genius."
                </p>
              </div>
              <div className="pt-2 border-t border-[#E7DFD5]/60 text-xs">
                <div className="font-bold text-[#1C1917]">Sneha Sharma</div>
                <div className="text-[11px] text-[#8C827A]">London, UK • Father in Nalgonda</div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-[#FFFFFF] border border-[#E7DFD5] shadow-xs space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <Quote className="w-6 h-6 text-[#B45309]/40" />
                <p className="text-xs text-[#574F49] leading-relaxed italic">
                  "My sister in Toronto and I in Singapore both get notified on WhatsApp whenever father's monthly diabetes medicine is hand-delivered. We have complete visibility from 4,000 miles away."
                </p>
              </div>
              <div className="pt-2 border-t border-[#E7DFD5]/60 text-xs">
                <div className="font-bold text-[#1C1917]">Karthik Venkat</div>
                <div className="text-[11px] text-[#8C827A]">Singapore • Parents in Bengaluru</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dignified Footer */}
      <footer className="relative z-10 bg-[#FFFFFF] py-8 px-6 md:px-12 text-center text-xs text-[#8C827A] space-y-2">
        <div className="flex items-center justify-center gap-2">
          <img src="./logo_icon.png" alt="FamilyHubs" className="w-5 h-5 object-contain opacity-75" />
          <span className="font-display font-bold text-[#1C1917]">FamilyHubs</span>
          <span>• Pan-India Eldercare Concierge Platform</span>
        </div>
        <p className="text-[11px] text-[#8C827A]">
          Escrow Security • Haversine Doorstep Geofence • Police Clearance Verification • 24/7 Emergency Hospital Dispatch
        </p>
        <p className="text-[11px] text-[#8C827A] pt-1">
          &copy; {new Date().getFullYear()} FamilyHubs Technologies. All rights reserved.
        </p>
      </footer>
    </div>
  );
};
