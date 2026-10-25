import React, { useState, useEffect } from 'react';
import {
  Phone,
  Lock,
  User,
  Mail,
  MapPin,
  Briefcase,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Globe,
  Sparkles,
  HeartHandshake,
} from 'lucide-react';
import { getApiBaseUrl, playNotificationChime } from '@shared/utils';
import { supabase } from '@shared/supabase';

export type LanguageCode = 'en' | 'te' | 'hi' | 'ta' | 'kn';

interface PartnerAuthViewProps {
  lang: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  onSuccess: (partner: any) => void;
  pendingGoogleData?: {
    email: string;
    fullName: string;
    authProviderId?: string;
    isExisting?: boolean;
    user?: any;
  } | null;
}

export const PartnerAuthView: React.FC<PartnerAuthViewProps> = ({
  lang,
  onLanguageChange,
  onSuccess,
  pendingGoogleData,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(
    pendingGoogleData && !pendingGoogleData.isExisting ? 'signup' : 'signin'
  );
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sign In Form State
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');

  // Sign Up Form State
  const [fullName, setFullName] = useState<string>(pendingGoogleData?.fullName || '');
  const [signupPhone, setSignupPhone] = useState<string>('');
  const [signupEmail, setSignupEmail] = useState<string>(pendingGoogleData?.email || '');
  const [serviceCategory, setServiceCategory] = useState<string>('MEDICAL_TRANSPORT');
  const [operatingRegion, setOperatingRegion] = useState<string>('Pan-India Verified Network');
  const [signupPassword, setSignupPassword] = useState<string>('');

  useEffect(() => {
    if (!pendingGoogleData) return;

    if (pendingGoogleData.isExisting) {
      playNotificationChime('success');
      onSuccess(pendingGoogleData.user);
    } else {
      setMode('signup');
      if (pendingGoogleData.fullName && !fullName) setFullName(pendingGoogleData.fullName);
      if (pendingGoogleData.email && !signupEmail) setSignupEmail(pendingGoogleData.email);
    }
  }, [pendingGoogleData]);

  const dict = {
    en: {
      portalTitle: 'Field Care Companion Portal',
      subtitle: 'Pan-India verified caregiving & eldercare companion network',
      signInTab: 'Companion Sign In',
      signUpTab: 'Join Care Network',
      emailOrPhone: 'Registered Mobile or Email',
      password: 'Password',
      signInBtn: 'Sign In to Companion Console',
      fullNameLabel: 'Full Name (as per Aadhaar)',
      mobileLabel: 'Mobile / WhatsApp Number',
      emailLabel: 'Email Address',
      categoryLabel: 'Primary Service Skill',
      regionLabel: 'Operating Care Region',
      createPassword: 'Create Secure Password',
      registerBtn: 'Register as Field Companion',
      alreadyPartner: 'Already registered? Sign In',
      newPartner: 'New companion? Join our verified network',
      trustNotice: 'Guaranteed Escrow Payouts directly released to your UPI upon GPS photo check-in.',
    },
    te: {
      portalTitle: 'ఫీల్డ్ కేర్ భాగస్వామి పోర్టల్',
      subtitle: 'మిర్యాలగూడ & దేశవ్యాప్త ధృవీకరించబడిన వృద్ధాప్య సంరక్షణ నెట్‌వర్క్',
      signInTab: 'లాగిన్ చేయండి',
      signUpTab: 'కొత్త భాగస్వామిగా చేరండి',
      emailOrPhone: 'మొబైల్ లేదా ఈమెయిల్ చిరునామా',
      password: 'పాస్‌వర్డ్',
      signInBtn: 'పోర్టల్‌లోకి ప్రవేశించండి',
      fullNameLabel: 'పూర్తి పేరు (ఆధార్ ప్రకారం)',
      mobileLabel: 'మొబైల్ / వాట్సాప్ నంబర్',
      emailLabel: 'ఈమెయిల్ చిరునామా',
      categoryLabel: 'మీ సేవా నైపుణ్యం',
      regionLabel: 'పనిచేసే ప్రాంతం',
      createPassword: 'పాస్‌వర్డ్ సృష్టించండి',
      registerBtn: 'భాగస్వామిగా నమోదు చేసుకోండి',
      alreadyPartner: 'ఇప్పటికే ఖాతా ఉందా? లాగిన్ చేయండి',
      newPartner: 'కొత్తవారా? భాగస్వామిగా చేరండి',
      trustNotice: 'ఫోటో చెక్-ఇన్ ధృవీకరణ తర్వాత నేరుగా మీ బ్యాంక్/UPI ఖాతాలోకి తక్షణ చెల్లింపు.',
    },
    hi: {
      portalTitle: 'फील्ड केयर पार्टनर पोर्टल',
      subtitle: 'सत्यापित फील्ड केयरगिवर एवं एल्डरकेयर नेटवर्क',
      signInTab: 'लॉग इन करें',
      signUpTab: 'नया पार्टनर बनें',
      emailOrPhone: 'मोबाइल या ईमेल पता',
      password: 'पासवर्ड',
      signInBtn: 'पार्टनर पोर्टल में प्रवेश करें',
      fullNameLabel: 'पूरा नाम (आधार के अनुसार)',
      mobileLabel: 'मोबाइल / व्हाट्सएप नंबर',
      emailLabel: 'ईमेल पता',
      categoryLabel: 'मुख्य सेवा कौशल',
      regionLabel: 'कार्य क्षेत्र',
      createPassword: 'पासवर्ड बनाएं',
      registerBtn: 'पार्टनर के रूप में पंजीकरण करें',
      alreadyPartner: 'पहले से पंजीकृत हैं? लॉग इन करें',
      newPartner: 'नए पार्टनर? हमारे नेटवर्क से जुड़ें',
      trustNotice: 'फोटो सत्यापन के बाद सीधे बैंक/UPI में तत्काल एस्क्रो भुगतान।',
    },
    ta: {
      portalTitle: 'களப் பராமரிப்பு பங்குதாரர் போர்டல்',
      subtitle: 'சரிபார்க்கப்பட்ட கள பராமரிப்பாளர் நெட்வொர்க்',
      signInTab: 'உள்நுழைக',
      signUpTab: 'புதிய கூட்டாளராக இணையுங்கள்',
      emailOrPhone: 'மொபைல் அல்லது மின்னஞ்சல்',
      password: 'கடவுச்சொல்',
      signInBtn: 'போர்டலில் நுழையுங்கள்',
      fullNameLabel: 'முழு பெயர்',
      mobileLabel: 'மொபைல் எண்',
      emailLabel: 'மின்னஞ்சல்',
      categoryLabel: 'முதன்மை சேவை',
      regionLabel: 'பணிபுரியும் பகுதி',
      createPassword: 'கடவுச்சொல் உருவாக்கவும்',
      registerBtn: 'கூட்டாளராக பதிவு செய்யவும்',
      alreadyPartner: 'ஏற்கனவே பதிவுசெய்தவரா? உள்நுழையவும்',
      newPartner: 'புதியவரா? இணையுங்கள்',
      trustNotice: 'பணி முடிந்ததும் உடனடி வங்கி/UPI செலுத்துகை.',
    },
    kn: {
      portalTitle: 'ಫೀಲ್ಡ್ ಕೇರ್ ಪಾರ್ಟ್ನರ್ ಪೋರ್ಟಲ್',
      subtitle: 'ಪರಿಶೀಲಿತ ಹಿರಿಯರ ಆರೈಕೆ ಸಹಾಯಕ ನೆಟ್‌ವರ್ಕ್',
      signInTab: 'ಲಾಗಿನ್ ಮಾಡಿ',
      signUpTab: 'ಹೊಸ ಪಾಲುದಾರರಾಗಿ ಸೇರಿ',
      emailOrPhone: 'ಮೊಬೈಲ್ ಅಥವಾ ಇಮೇಲ್',
      password: 'ಪಾಸ್‌ವರ್ಡ್',
      signInBtn: 'ಪೋರ್ಟಲ್‌ಗೆ ಪ್ರವೇಶಿಸಿ',
      fullNameLabel: 'ಪೂರ್ಣ ಹೆಸರು',
      mobileLabel: 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ',
      emailLabel: 'ಇಮೇಲ್',
      categoryLabel: 'ಮುಖ್ಯ ಸೇವಾ ಕೌಶಲ್ಯ',
      regionLabel: 'ಕಾರ್ಯನಿರ್ವಹಿಸುವ ಪ್ರದೇಶ',
      createPassword: 'ಪಾಸ್‌ವರ್ಡ್ ರಚಿಸಿ',
      registerBtn: 'ಪಾಲುದಾರರಾಗಿ ನೋಂದಾಯಿಸಿ',
      alreadyPartner: 'ಈಗಾಗಲೇ ನೋಂದಾಯಿಸಿದ್ದೀರಾ? ಲಾಗಿನ್ ಮಾಡಿ',
      newPartner: 'ಹೊಸಬರೇ? ನಮ್ಮೊಂದಿಗೆ ಸೇರಿ',
      trustNotice: 'ಫೋಟೋ ಪರಿಶೀಲನೆಯ ನಂತರ ನೇರ ಬ್ಯಾಂಕ್/UPI ಪಾವತಿ.',
    },
  };

  const t = dict[lang] || dict.en;

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    if (!supabase) {
      setErrorMessage('Supabase client is not initialized.');
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
      setErrorMessage(err.message || 'Failed to start Google sign-in.');
      playNotificationChime('alert');
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!loginEmail.trim()) {
      setErrorMessage('Please enter your registered email address or phone.');
      playNotificationChime('alert');
      return;
    }
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'PARTNER',
          email: loginEmail.trim(),
          password: loginPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid credentials. Please verify your details.');
      }

      playNotificationChime('success');
      onSuccess(data.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to sign in. Please verify your credentials.');
      playNotificationChime('alert');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!fullName.trim() || !signupPhone.trim()) {
      setErrorMessage('Please enter your full name and mobile number.');
      return;
    }

    if (signupPassword && signupPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);

    const partnerEmail =
      signupEmail.trim() ||
      `partner_${signupPhone.replace(/[^0-9]/g, '')}@partner.familyhubs.com`;

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'PARTNER',
          fullName: fullName.trim(),
          phone: signupPhone.trim(),
          email: partnerEmail,
          password: signupPassword || 'FamilyHubs2026!',
          serviceCategory,
          operatingRegion,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to register partner account.');
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
    <div className="min-h-screen bg-[#FAF7F2] text-[#1C1917] flex flex-col justify-between font-body antialiased relative">
      {/* Editorial Decorative Subtle Patterns */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.035]"
        style={{
          backgroundImage: `radial-gradient(#C25E2E 0.75px, transparent 0.75px)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Top Header & Tactile Multilingual Language Bar */}
      <header className="border-b border-[#E7DFD5] py-3.5 px-4 sm:px-8 bg-[#FFFFFF]/90 backdrop-blur-md sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] border border-[#E7DFD5] flex items-center justify-center p-1.5 shadow-xs">
              <img src="/logo_icon.png" alt="FamilyHubs" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-bold text-[#1C1917] tracking-tight">FamilyHubs</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#FBECE5] text-[#C25E2E] border border-[#F5D5C6]">
                  Companion Console
                </span>
              </div>
              <p className="text-[11px] text-[#8C827A] hidden sm:block">Pan-India Verified Eldercare Network</p>
            </div>
          </div>

          {/* Multilingual Switcher */}
          <div className="flex items-center gap-1 bg-[#F5F1EB] p-1 rounded-xl border border-[#E7DFD5]">
            <Globe className="w-3.5 h-3.5 text-[#8C827A] ml-1.5 mr-0.5 hidden sm:block" />
            {[
              { code: 'te', label: 'తెలుగు' },
              { code: 'en', label: 'English' },
              { code: 'hi', label: 'हिंदी' },
              { code: 'ta', label: 'தமிழ்' },
              { code: 'kn', label: 'ಕನ್ನಡ' },
            ].map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => onLanguageChange(item.code as LanguageCode)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  lang === item.code
                    ? 'bg-[#FFFFFF] text-[#C25E2E] shadow-xs border border-[#E7DFD5]'
                    : 'text-[#574F49] hover:text-[#1C1917]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Form Center */}
      <main className="flex-1 max-w-xl mx-auto px-4 py-8 sm:py-12 flex flex-col items-center justify-center z-10 w-full">
        <div className="w-full bg-[#FFFFFF] border border-[#E7DFD5] rounded-3xl p-6 sm:p-9 shadow-sm space-y-6">
          {/* Filial Seal & Brand Banner */}
          <div className="text-center space-y-3">
            <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-3xl bg-[#FAF7F2] border border-[#E7DFD5] flex items-center justify-center p-3 mx-auto shadow-md">
              <img src="/logo_icon.png" alt="FamilyHubs" className="w-full h-full object-contain" />
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E8F3EE] border border-[#C8E5D7] text-[#1F5C42] text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-[#1F5C42]" />
              <span>Aadhaar Verified Field Partner Network</span>
            </div>
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#1C1917] tracking-tight">
                {t.portalTitle}
              </h1>
              <p className="text-xs sm:text-sm text-[#574F49] mt-1 max-w-md mx-auto">
                {t.subtitle}
              </p>
            </div>
          </div>

          {/* Segmented Mode Switcher */}
          <div className="flex bg-[#F5F1EB] p-1.5 rounded-2xl border border-[#E7DFD5]">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMessage(null);
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                mode === 'signin'
                  ? 'bg-[#FFFFFF] text-[#1C1917] shadow-xs border border-[#E7DFD5]'
                  : 'text-[#8C827A] hover:text-[#1C1917]'
              }`}
            >
              {t.signInTab}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMessage(null);
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                mode === 'signup'
                  ? 'bg-[#FFFFFF] text-[#1C1917] shadow-xs border border-[#E7DFD5]'
                  : 'text-[#8C827A] hover:text-[#1C1917]'
              }`}
            >
              {t.signUpTab}
            </button>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-[#FEE2E2] border border-[#FCA5A5] text-[#991B1B] text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-[#B91C1C] shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {/* Google OAuth Access */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl bg-[#FAF7F2] hover:bg-[#F5F1EB] text-[#1C1917] font-semibold text-xs sm:text-sm flex items-center justify-center gap-3 border border-[#E7DFD5] transition-all cursor-pointer shadow-xs disabled:opacity-50"
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
            <span>Continue with Google</span>
          </button>

          <div className="flex items-center my-2">
            <div className="flex-1 border-t border-[#E7DFD5]"></div>
            <span className="px-3 text-[10px] text-[#8C827A] font-bold uppercase tracking-wider">
              or phone / email
            </span>
            <div className="flex-1 border-t border-[#E7DFD5]"></div>
          </div>

          {/* ========================================== */}
          {/* SIGN IN FORM */}
          {/* ========================================== */}
          {mode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#574F49] mb-1.5">
                  {t.emailOrPhone}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    placeholder="partner@familyhubs.in or 9440154321"
                    className="w-full bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl pl-10 pr-4 py-3 text-sm text-[#1C1917] placeholder-[#8C827A] focus:outline-none focus:border-[#C25E2E] focus:ring-2 focus:ring-[#C25E2E]/10 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#574F49] mb-1.5">
                  {t.password}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl pl-10 pr-10 py-3 text-sm text-[#1C1917] placeholder-[#8C827A] focus:outline-none focus:border-[#C25E2E] focus:ring-2 focus:ring-[#C25E2E]/10 transition-all font-mono"
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
                className="w-full py-3.5 bg-[#C25E2E] hover:bg-[#A3481D] text-white font-semibold text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{t.signInBtn}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Instant 1-Click Demo Companion Access */}
              <button
                type="button"
                disabled={isLoading}
                onClick={() => {
                  setLoginEmail('partner@familyhubs.in');
                  setLoginPassword('FamilyHubs2026!');
                  const fakeEvent = { preventDefault: () => {} } as any;
                  setTimeout(() => handleSignIn(fakeEvent), 50);
                }}
                className="w-full py-2.5 px-3 bg-[#E8F3EE] hover:bg-[#D6EBDD] text-[#1F5C42] border border-[#C8E5D7] rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>⚡ 1-Click Demo Companion (Ramesh Babu - Verified Field Partner)</span>
              </button>
            </form>
          )}

          {/* ========================================== */}
          {/* SIGN UP FORM */}
          {/* ========================================== */}
          {mode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#574F49] mb-1">
                  {t.fullNameLabel} <span className="text-[#C25E2E]">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1C1917] placeholder-[#8C827A] focus:outline-none focus:border-[#C25E2E] focus:ring-2 focus:ring-[#C25E2E]/10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#574F49] mb-1">
                  {t.mobileLabel} <span className="text-[#C25E2E]">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={signupPhone}
                    onChange={(e) => setSignupPhone(e.target.value)}
                    required
                    placeholder="+91 98765 43210"
                    className="w-full bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1C1917] placeholder-[#8C827A] focus:outline-none focus:border-[#C25E2E] focus:ring-2 focus:ring-[#C25E2E]/10 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#574F49] mb-1">
                  {t.emailLabel} (Optional)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="partner@familyhubs.in"
                    className="w-full bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1C1917] placeholder-[#8C827A] focus:outline-none focus:border-[#C25E2E] focus:ring-2 focus:ring-[#C25E2E]/10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#574F49] mb-1">
                    {t.categoryLabel}
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={serviceCategory}
                      onChange={(e) => setServiceCategory(e.target.value)}
                      className="w-full bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl pl-10 pr-3 py-2.5 text-xs sm:text-sm text-[#1C1917] focus:outline-none focus:border-[#C25E2E] cursor-pointer appearance-none"
                    >
                      <option value="MEDICAL_TRANSPORT">Healthcare &amp; Escort</option>
                      <option value="HOME_MAINTENANCE">Electrical &amp; Plumbing</option>
                      <option value="ERRANDS">Groceries &amp; Errands</option>
                      <option value="EMERGENCY">Emergency Response</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#574F49] mb-1">
                    {t.regionLabel}
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={operatingRegion}
                      onChange={(e) => setOperatingRegion(e.target.value)}
                      className="w-full bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl pl-10 pr-3 py-2.5 text-xs sm:text-sm text-[#1C1917] focus:outline-none focus:border-[#C25E2E] cursor-pointer appearance-none"
                    >
                      <option value="Pan-India Verified Network">Pan-India (All India)</option>
                      <option value="Telangana & Andhra Hub">Telangana &amp; Andhra Pradesh</option>
                      <option value="Karnataka & Bengaluru Hub">Karnataka &amp; Bengaluru</option>
                      <option value="Maharashtra & Mumbai Hub">Maharashtra &amp; Mumbai</option>
                      <option value="Delhi NCR Hub">Delhi NCR &amp; North India</option>
                      <option value="Tamil Nadu & Southern Hub">Tamil Nadu &amp; South India</option>
                    </select>
                  </div>
                </div>
              </div>

              {!pendingGoogleData && (
                <div>
                  <label className="block text-xs font-semibold text-[#574F49] mb-1">
                    {t.createPassword} (min 6 chars) <span className="text-[#C25E2E]">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl pl-10 pr-10 py-2.5 text-sm text-[#1C1917] placeholder-[#8C827A] focus:outline-none focus:border-[#C25E2E] focus:ring-2 focus:ring-[#C25E2E]/10 font-mono"
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

              <div className="p-3 bg-[#E8F3EE] border border-[#C8E5D7] rounded-2xl text-xs text-[#1F5C42] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#1F5C42] shrink-0" />
                <span>{t.trustNotice}</span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-[#1F5C42] hover:bg-[#164632] text-white font-semibold text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{t.registerBtn}</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          <div className="text-center pt-2">
            <p className="text-xs text-[#574F49]">
              {mode === 'signin' ? (
                <>
                  {t.newPartner}{' '}
                  <button
                    onClick={() => {
                      setMode('signup');
                      setErrorMessage(null);
                    }}
                    className="text-[#C25E2E] font-bold hover:underline cursor-pointer"
                  >
                    {t.signUpTab}
                  </button>
                </>
              ) : (
                <>
                  {t.alreadyPartner}{' '}
                  <button
                    onClick={() => {
                      setMode('signin');
                      setErrorMessage(null);
                    }}
                    className="text-[#C25E2E] font-bold hover:underline cursor-pointer"
                  >
                    {t.signInTab}
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </main>

      {/* Dignified Footer */}
      <footer className="border-t border-[#E7DFD5] py-4 px-6 text-center text-xs text-[#8C827A] bg-[#FFFFFF]">
        FamilyHubs Field Partner Operations • Pan-India Eldercare Companion Network
      </footer>
    </div>
  );
};
