import React, { useState } from 'react';
import {
  Zap,
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
  Sparkles,
  Globe,
} from 'lucide-react';
import { getApiBaseUrl, playNotificationChime } from '@shared/utils';

export type LanguageCode = 'en' | 'te' | 'hi' | 'ta' | 'kn';

interface PartnerAuthViewProps {
  lang: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  onSuccess: (partner: any) => void;
}

export const PartnerAuthView: React.FC<PartnerAuthViewProps> = ({
  lang,
  onLanguageChange,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sign In Form State
  const [loginEmail, setLoginEmail] = useState<string>('demo.partner@familyhubs.com');
  const [loginPassword, setLoginPassword] = useState<string>('DemoPassword123!');

  // Sign Up Form State
  const [fullName, setFullName] = useState<string>('');
  const [signupPhone, setSignupPhone] = useState<string>('');
  const [signupEmail, setSignupEmail] = useState<string>('');
  const [serviceCategory, setServiceCategory] = useState<string>('MEDICAL_TRANSPORT');
  const [operatingRegion, setOperatingRegion] = useState<string>('Miryalaguda Town & Rural Hub');
  const [signupPassword, setSignupPassword] = useState<string>('');

  const dict = {
    en: {
      portalTitle: 'FamilyHubs Partner Portal',
      subtitle: 'Miryalaguda & Nalgonda Verified Field Network',
      signInTab: 'Partner Sign In',
      signUpTab: 'Join as New Partner',
      emailOrPhone: 'Mobile or Email Address',
      password: 'Password',
      signInBtn: 'Sign In to Partner Portal',
      quickDemo: '⚡ 1-Click Demo Partner (demo.partner@familyhubs.com)',
      fullNameLabel: 'Full Name (as per Aadhaar)',
      mobileLabel: 'Mobile / WhatsApp Number',
      emailLabel: 'Email Address',
      categoryLabel: 'Primary Service Skill',
      regionLabel: 'Operating Area',
      createPassword: 'Create Password',
      registerBtn: 'Register as Field Partner',
      alreadyPartner: 'Already registered? Sign In',
      newPartner: 'New partner? Join our verified network',
      trustNotice: 'Instant Escrow Payouts directly to your bank/UPI upon photo check-in.',
    },
    te: {
      portalTitle: 'ఫ్యామిలీహబ్స్ భాగస్వామి పోర్టల్',
      subtitle: 'మిర్యాalguda & నల్గొండ ధృవీకరించబడిన ఫీల్డ్ నెట్‌వర్క్',
      signInTab: 'లాగిన్ చేయండి',
      signUpTab: 'కొత్త భాగస్వామిగా చేరండి',
      emailOrPhone: 'మొబైల్ లేదా ఈమెయిల్ చిరునామా',
      password: 'పాస్‌వర్డ్',
      signInBtn: 'పోర్టల్‌లోకి ప్రవేశించండి',
      quickDemo: '⚡ 1-క్లిక్ డెమో భాగస్వామి (demo.partner@familyhubs.com)',
      fullNameLabel: 'పూర్తి పేరు (ఆధార్ ప్రకారం)',
      mobileLabel: 'మొబైల్ / వాట్సాప్ నంబర్',
      emailLabel: 'ఈమెయిల్ చిరునామా',
      categoryLabel: 'మీ సేవా నైపుణ్యం',
      regionLabel: 'పనిచేసే ప్రాంతం',
      createPassword: 'పాస్‌వర్డ్ సృష్టించండి',
      registerBtn: 'భాగస్వామిగా నమోదు చేసుకోండి',
      alreadyPartner: 'ఇప్పటికే ఖాతా ఉందా? లాగిన్ చేయండి',
      newPartner: 'కొత్తవారా? భాగస్వామిగా చేరండి',
      trustNotice: 'ఫోటో చెక్-ఇన్ ధృవీకరణ తర్వాత నేరుగా మీ బ్యాంక్/UPI ఖాతాలోకి చెల్లింపు.',
    },
    hi: {
      portalTitle: 'फैमिलीहब्स पार्टनर पोर्टल',
      subtitle: 'मिर्यालगुडा और नलगोंडा सत्यापित फील्ड नेटवर्क',
      signInTab: 'लॉग इन करें',
      signUpTab: 'नया पार्टनर बनें',
      emailOrPhone: 'मोबाइल या ईमेल पता',
      password: 'पासवर्ड',
      signInBtn: 'पार्टनर पोर्टल में प्रवेश करें',
      quickDemo: '⚡ 1-क्लिक डेमो पार्टनर (demo.partner@familyhubs.com)',
      fullNameLabel: 'पूरा नाम (आधार के अनुसार)',
      mobileLabel: 'मोबाइल / व्हाट्सएप नंबर',
      emailLabel: 'ईमेल पता',
      categoryLabel: 'मुख्य सेवा कौशल',
      regionLabel: 'कार्य क्षेत्र',
      createPassword: 'पासवर्ड बनाएं',
      registerBtn: 'पार्टनर के रूप में पंजीकरण करें',
      alreadyPartner: 'पहले से पंजीकृत हैं? लॉग इन करें',
      newPartner: 'नए पार्टनर? हमारे नेटवर्क से जुड़ें',
      trustNotice: 'फोटो सत्यापन के बाद सीधे बैंक/UPI में तत्काल भुगतान।',
    },
    ta: {
      portalTitle: 'குடும்ப மையங்கள் களப் பங்குதாரர் போர்டல்',
      subtitle: 'மிர்யாலகுடா & நல்கொண்டா சரிபார்க்கப்பட்ட கள நெட்வொர்க்',
      signInTab: 'உள்நுழைக',
      signUpTab: 'புதிய கூட்டாளராக இணையுங்கள்',
      emailOrPhone: 'மொபைல் அல்லது மின்னஞ்சல்',
      password: 'கடவுச்சொல்',
      signInBtn: 'போர்டலில் நுழையுங்கள்',
      quickDemo: '⚡ 1-கிளிக் டெமோ கூட்டாளர் (demo.partner@familyhubs.com)',
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
      portalTitle: 'ಫ್ಯಾಮಿಲಿಹಬ್ಸ್ ಫೀಲ್ಡ್ ಪಾರ್ಟ್ನರ್ ಪೋರ್ಟಲ್',
      subtitle: 'ಮಿರ್ಯಾಲಗುಡಾ & ನಲ್ಗೊಂಡ ಪರಿಶೀಲಿತ ನೆಟ್‌ವರ್ಕ್',
      signInTab: 'ಲಾಗಿನ್ ಮಾಡಿ',
      signUpTab: 'ಹೊಸ ಪಾಲುದಾರರಾಗಿ ಸೇರಿ',
      emailOrPhone: 'ಮೊಬೈಲ್ ಅಥವಾ ಇಮೇಲ್',
      password: 'ಪಾಸ್‌ವರ್ಡ್',
      signInBtn: 'ಪೋರ್ಟಲ್‌ಗೆ ಪ್ರವೇಶಿಸಿ',
      quickDemo: '⚡ 1-ಕ್ಲಿಕ್ ಡೆಮೊ ಪಾಲುದಾರ (demo.partner@familyhubs.com)',
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

  const handleSignIn = async (e?: React.FormEvent, isDemo = false) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    const emailToUse = isDemo ? 'demo.partner@familyhubs.com' : loginEmail;
    const passwordToUse = isDemo ? 'DemoPassword123!' : loginPassword;

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'PARTNER',
          email: emailToUse,
          password: passwordToUse,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid mobile, email, or password.');
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
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between font-sans relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header & Language Bar */}
      <header className="border-b border-slate-800/80 py-4 px-6 md:px-12 flex items-center justify-between sticky top-0 bg-slate-900/90 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
            <Zap className="w-5 h-5 fill-white" />
          </div>
          <div>
            <span className="text-xl font-bold text-white tracking-tight">FamilyHubs</span>
            <span className="text-xs bg-amber-500/20 text-amber-300 font-semibold px-2.5 py-0.5 rounded-full ml-2 border border-amber-500/30">
              Partner Hub
            </span>
          </div>
        </div>

        {/* Language Switcher Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-2xl border border-slate-700">
          <Globe className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5 hidden sm:block" />
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
              className={`px-2.5 py-1 text-xs font-bold rounded-xl transition ${
                lang === item.code
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content Card */}
      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 md:py-12 flex flex-col items-center justify-center z-10 w-full">
        <div className="w-full max-w-md bg-slate-800/90 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-6 md:p-8 shadow-2xl space-y-5">
          {/* Header */}
          <div className="text-center space-y-1.5">
            <h1 className="text-2xl font-black text-white">{t.portalTitle}</h1>
            <p className="text-xs text-slate-400">{t.subtitle}</p>
          </div>

          {/* Mode Tabs */}
          <div className="flex bg-slate-900/80 p-1 rounded-2xl border border-slate-700">
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
              {t.signInTab}
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
              {t.signUpTab}
            </button>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ==================================== */}
          {/* SIGN IN FORM */}
          {/* ==================================== */}
          {mode === 'signin' && (
            <form onSubmit={(e) => handleSignIn(e, false)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {t.emailOrPhone}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    placeholder="demo.partner@familyhubs.com / 9440154321"
                    className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {t.password}
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
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
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

              <div className="relative my-4 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-700" />
                </div>
                <span className="relative bg-slate-800 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Or Instant Access
                </span>
              </div>

              {/* 1-Click Demo Shortcut */}
              <button
                type="button"
                onClick={() => handleSignIn(undefined, true)}
                className="w-full py-2.5 bg-slate-700/60 hover:bg-slate-700 text-slate-200 border border-slate-600/80 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>{t.quickDemo}</span>
              </button>
            </form>
          )}

          {/* ==================================== */}
          {/* SIGN UP FORM (JOIN AS PARTNER) */}
          {/* ==================================== */}
          {mode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-3.5 max-h-[460px] overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t.fullNameLabel} <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="e.g. K. Srinivas"
                    className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t.mobileLabel} <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={signupPhone}
                    onChange={(e) => setSignupPhone(e.target.value)}
                    required
                    placeholder="+91 94401 54321"
                    className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t.emailLabel} (Optional)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="srinivas@partner.familyhubs.com"
                    className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t.categoryLabel}
                  </label>
                  <div className="relative">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <select
                      value={serviceCategory}
                      onChange={(e) => setServiceCategory(e.target.value)}
                      className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-8 pr-2 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="MEDICAL_TRANSPORT">Healthcare &amp; Escort</option>
                      <option value="HOME_MAINTENANCE">Electrical &amp; Plumbing</option>
                      <option value="ERRANDS">Groceries &amp; Errands</option>
                      <option value="EMERGENCY">Emergency Response</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t.regionLabel}
                  </label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <select
                      value={operatingRegion}
                      onChange={(e) => setOperatingRegion(e.target.value)}
                      className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-8 pr-2 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Miryalaguda Town & Rural Hub">Miryalaguda Town</option>
                      <option value="Reddy Colony & Sagar Road">Reddy Colony</option>
                      <option value="Housing Board Colony">Housing Board</option>
                      <option value="Old Nalgonda & Clock Tower">Old Nalgonda</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t.createPassword} (min 6 chars) <span className="text-rose-400">*</span>
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

              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-[11px] text-emerald-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{t.trustNotice}</span>
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
                    <span>{t.registerBtn}</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          <div className="text-center pt-1">
            <p className="text-[11px] text-slate-400">
              {mode === 'signin' ? (
                <>
                  {t.newPartner}{' '}
                  <button
                    onClick={() => {
                      setMode('signup');
                      setErrorMessage(null);
                    }}
                    className="text-indigo-400 font-bold hover:underline"
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
                    className="text-indigo-400 font-bold hover:underline"
                  >
                    {t.signInTab}
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 px-6 text-center text-xs text-slate-500">
        FamilyHubs Field Partner Operations • Miryalaguda &amp; Nalgonda, Telangana
      </footer>
    </div>
  );
};
