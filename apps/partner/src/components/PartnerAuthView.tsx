import React, { useState, useEffect } from 'react';
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
  KeyRound,
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
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('otp');
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginOtp, setLoginOtp] = useState<string>('');
  const [otpSentForLogin, setOtpSentForLogin] = useState<boolean>(false);

  // Sign Up Form State
  const [signupMethod, setSignupMethod] = useState<'password' | 'otp'>('otp');
  const [fullName, setFullName] = useState<string>(pendingGoogleData?.fullName || '');
  const [signupPhone, setSignupPhone] = useState<string>('');
  const [signupEmail, setSignupEmail] = useState<string>(pendingGoogleData?.email || '');
  const [serviceCategory, setServiceCategory] = useState<string>('MEDICAL_TRANSPORT');
  const [operatingRegion, setOperatingRegion] = useState<string>('Pan-India Verified Network');
  const [signupPassword, setSignupPassword] = useState<string>('');
  const [signupOtp, setSignupOtp] = useState<string>('');
  const [otpSentForSignup, setOtpSentForSignup] = useState<boolean>(false);

  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [otpNotice, setOtpNotice] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  useEffect(() => {
    if (!pendingGoogleData) return;

    if (pendingGoogleData.isExisting) {
      setMode('signin');
      setLoginMethod('otp');
      setLoginEmail(pendingGoogleData.email);
      handleSendLoginOtp(pendingGoogleData.email);
      setOtpNotice(
        `✓ Google account verified (${pendingGoogleData.email}). Enter the 6-digit verification code to complete sign-in.`
      );
    } else {
      setMode('signup');
      if (pendingGoogleData.fullName && !fullName) setFullName(pendingGoogleData.fullName);
      if (pendingGoogleData.email && !signupEmail) setSignupEmail(pendingGoogleData.email);
    }
  }, [pendingGoogleData]);

  const dict = {
    en: {
      portalTitle: 'FamilyHubs Partner Portal',
      subtitle: 'Pan-India Verified Field Concierge Network',
      signInTab: 'Partner Sign In',
      signUpTab: 'Join as New Partner',
      emailOrPhone: 'Mobile or Email Address',
      password: 'Password',
      signInBtn: 'Sign In to Partner Portal',
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
      passwordLoginTab: 'Password Login',
      otpLoginTab: 'Email OTP Code',
      sendOtpBtn: 'Send 6-Digit Email Code',
      resendCode: 'Resend code',
      enterOtp: 'Enter 6-Digit Code',
      verifySignIn: 'Verify Code & Sign In',
      verifySignUp: 'Verify Code & Register',
      passwordSignupTab: 'Password Setup',
      otpSignupTab: 'Email OTP Verification',
      sendSignupOtp: 'Send Verification Code',
      otpSentNotice: 'Verification code dispatched to your email.',
    },
    te: {
      portalTitle: 'ఫ్యామిలీహబ్స్ భాగస్వామి పోర్టల్',
      subtitle: 'మిర్యాలగూడ & నల్గొండ ధృవీకరించబడిన ఫీల్డ్ నెట్‌వర్క్',
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
      trustNotice: 'ఫోటో చెక్-ఇన్ ధృవీకరణ తర్వాత నేరుగా మీ బ్యాంక్/UPI ఖాతాలోకి చెల్లింపు.',
      passwordLoginTab: 'పాస్‌వర్డ్ లాగిన్',
      otpLoginTab: 'ఈమెయిల్ OTP',
      sendOtpBtn: '6-అంకెల కోడ్ పంపండి',
      resendCode: 'కోడ్ మళ్లీ పంపండి',
      enterOtp: '6-అంకెల కోడ్ నమోదు చేయండి',
      verifySignIn: 'ధృవీకరించి ప్రవేశించండి',
      verifySignUp: 'ధృవీకరించి నమోదు చేయండి',
      passwordSignupTab: 'పాస్‌వర్డ్ నమోదు',
      otpSignupTab: 'ఈమెయిల్ OTP',
      sendSignupOtp: 'ధృవీకరణ కోడ్ పంపండి',
      otpSentNotice: 'ధృవీకరణ కోడ్ మీ ఈమెయిల్‌కు పంపబడింది.',
    },
    hi: {
      portalTitle: 'फैमिलीहब्स पार्टनर पोर्टल',
      subtitle: 'मिर्यालगुडा और नलगोंडा सत्यापित फील्ड नेटवर्क',
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
      trustNotice: 'फोटो सत्यापन के बाद सीधे बैंक/UPI में तत्काल भुगतान।',
      passwordLoginTab: 'पासवर्ड लॉगिन',
      otpLoginTab: 'ईमेल OTP',
      sendOtpBtn: '6-अंकीय कोड भेजें',
      resendCode: 'कोड दोबारा भेजें',
      enterOtp: '6-अंकीय कोड दर्ज करें',
      verifySignIn: 'सत्यापित कर प्रवेश करें',
      verifySignUp: 'सत्यापित कर रजिस्टर करें',
      passwordSignupTab: 'पासवर्ड पंजीकरण',
      otpSignupTab: 'ईमेल OTP',
      sendSignupOtp: 'सत्यापन कोड भेजें',
      otpSentNotice: 'सत्यापन कोड आपके ईमेल पर भेजा गया है।',
    },
    ta: {
      portalTitle: 'குடும்ப மையங்கள் களப் பங்குதாரர் போர்டல்',
      subtitle: 'மிர்யாலகுடா & நல்கொண்டா சரிபார்க்கப்பட்ட கள நெட்வொர்க்',
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
      passwordLoginTab: 'கடவுச்சொல் உள்நுழைவு',
      otpLoginTab: 'மின்னஞ்சல் OTP',
      sendOtpBtn: '6-இலக்க குறியீட்டை அனுப்பவும்',
      resendCode: 'மீண்டும் அனுப்பவும்',
      enterOtp: '6-இலக்க குறியீட்டை உள்ளிடவும்',
      verifySignIn: 'சரிபார்த்து நுழையவும்',
      verifySignUp: 'சரிபார்த்து பதிவு செய்யவும்',
      passwordSignupTab: 'கடவுச்சொல் பதிவு',
      otpSignupTab: 'மின்னஞ்சல் OTP',
      sendSignupOtp: 'சரிபார்ப்புக் குறியீடு அனுப்பவும்',
      otpSentNotice: 'சரிபார்ப்புக் குறியீடு உங்கள் மின்னஞ்சலுக்கு அனுப்பப்பட்டது.',
    },
    kn: {
      portalTitle: 'ಫ್ಯಾಮಿಲಿಹಬ್ಸ್ ಫೀಲ್ಡ್ ಪಾರ್ಟ್ನರ್ ಪೋರ್ಟಲ್',
      subtitle: 'ಮಿರ್ಯಾಲಗುಡಾ & ನಲ್ಗೊಂಡ ಪರಿಶೀಲಿತ ನೆಟ್‌ವರ್ಕ್',
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
      passwordLoginTab: 'ಪಾಸ್‌ವರ್ಡ್ ಲಾಗಿನ್',
      otpLoginTab: 'ಇಮೇಲ್ OTP',
      sendOtpBtn: '6-ಅಂಕಿಯ ಕೋಡ್ ಕಳುಹಿಸಿ',
      resendCode: 'ಕೋಡ್ ಮರುಕಳುಹಿಸಿ',
      enterOtp: '6-ಅಂಕಿಯ ಕೋಡ್ ನಮೂದಿಸಿ',
      verifySignIn: 'ಪರಿಶೀಲಿಸಿ ಪ್ರವೇಶಿಸಿ',
      verifySignUp: 'ಪರಿಶೀಲಿಸಿ ನೋಂದಾಯಿಸಿ',
      passwordSignupTab: 'ಪಾಸ್‌ವರ್ಡ್ ನೋಂದಣಿ',
      otpSignupTab: 'ಇಮೇಲ್ OTP',
      sendSignupOtp: 'ಪರಿಶೀಲನಾ ಕೋಡ್ ಕಳುಹಿಸಿ',
      otpSentNotice: 'ಪರಿಶೀಲನಾ ಕೋಡ್ ನಿಮ್ಮ ಇಮೇಲ್‌ಗೆ ರವಾನಿಸಲಾಗಿದೆ.',
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

  const handleSendLoginOtp = async (targetEmailParam?: string): Promise<boolean> => {
    const targetEmail = (targetEmailParam || loginEmail).trim();
    if (!targetEmail) {
      setErrorMessage('Please enter your registered mobile or email address.');
      playNotificationChime('alert');
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
          role: 'PARTNER',
          action: 'LOGIN',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send OTP code.');
      }
      setOtpSentForLogin(true);
      setResendCooldown(30);
      const noticeMsg = data.message || t.otpSentNotice;
      setOtpNotice(noticeMsg);
      playNotificationChime('ping');
      return true;
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch verification code.');
      playNotificationChime('alert');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!loginEmail.trim()) {
      setErrorMessage('Please enter your registered email address.');
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
        throw new Error(data.error || 'Invalid mobile, email, or password.');
      }

      // Password validated -> Sign in directly!
      playNotificationChime('success');
      onSuccess(data.user);
      return;
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to sign in. Please verify your credentials.');
      playNotificationChime('alert');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyLoginOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!loginEmail.trim() || !loginOtp.trim()) {
      setErrorMessage('Please enter your email and the 6-digit verification code.');
      playNotificationChime('alert');
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
          role: 'PARTNER',
          action: 'LOGIN',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid or expired verification code.');
      }
      playNotificationChime('success');
      onSuccess(data.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'OTP verification failed. Please verify code.');
      playNotificationChime('alert');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendSignupOtp = async () => {
    if (!fullName.trim() || !signupPhone.trim()) {
      setErrorMessage('Please enter your full name and mobile number.');
      playNotificationChime('alert');
      return;
    }
    const partnerEmail =
      signupEmail.trim() ||
      `partner_${signupPhone.replace(/[^0-9]/g, '')}@partner.familyhubs.com`;

    setIsLoading(true);
    setErrorMessage(null);
    setOtpNotice(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: partnerEmail,
          role: 'PARTNER',
          action: 'SIGNUP',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send OTP.');
      }
      setOtpSentForSignup(true);
      setResendCooldown(30);
      setOtpNotice(data.message || `Verification code sent to ${partnerEmail}`);
      playNotificationChime('ping');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch verification code.');
      playNotificationChime('alert');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySignupOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const partnerEmail =
      signupEmail.trim() ||
      `partner_${signupPhone.replace(/[^0-9]/g, '')}@partner.familyhubs.com`;

    if (!signupOtp.trim()) {
      setErrorMessage('Please enter the 6-digit verification code.');
      playNotificationChime('alert');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: partnerEmail,
          otp: signupOtp.trim(),
          role: 'PARTNER',
          action: 'SIGNUP',
          fullName: fullName.trim(),
          phone: signupPhone.trim(),
          serviceCategory,
          operatingRegion,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid or expired verification code.');
      }
      playNotificationChime('success');
      onSuccess(data.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Verification failed. Please verify code.');
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
          <img src="./logo_icon.png" alt="FamilyHubs" className="w-10 h-10 object-contain drop-shadow" />
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
          {/* Official Brand Logo */}
          <div className="text-center">
            <div className="inline-block bg-white p-3 rounded-2xl shadow-xl">
              <img src="./logo.png" alt="FamilyHubs - Partner Hub" className="w-44 h-auto object-contain mx-auto" />
            </div>
          </div>

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
            <span>Continue with Google</span>
          </button>

          <div className="flex items-center my-3">
            <div className="flex-1 border-t border-slate-700/80"></div>
            <span className="px-3 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              or with phone / email
            </span>
            <div className="flex-1 border-t border-slate-700/80"></div>
          </div>

          {otpNotice && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{otpNotice}</span>
            </div>
          )}

          {/* ==================================== */}
          {/* SIGN IN FORM */}
          {/* ==================================== */}
          {mode === 'signin' && (
            <div className="space-y-4">
              <div className="flex bg-slate-900/90 p-1 rounded-xl border border-slate-700/80">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('otp');
                    setErrorMessage(null);
                    setOtpNotice(null);
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                    loginMethod === 'otp'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t.otpLoginTab}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('password');
                    setErrorMessage(null);
                    setOtpNotice(null);
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                    loginMethod === 'password'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t.passwordLoginTab}
                </button>
              </div>

              {loginMethod === 'password' ? (
                <form onSubmit={(e) => handleSignIn(e)} className="space-y-4">
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
                        placeholder="partner@familyhubs.in / 9440154321"
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
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4" />
                        <span>Verify Password & Request OTP</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form
                  onSubmit={
                    otpSentForLogin
                      ? handleVerifyLoginOtp
                      : (e) => {
                          e.preventDefault();
                          handleSendLoginOtp();
                        }
                  }
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      {t.emailLabel}
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                        placeholder="partner@familyhubs.in"
                        className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {!otpSentForLogin ? (
                    <button
                      type="submit"
                      disabled={isLoading || !loginEmail.trim()}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {isLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <KeyRound className="w-4 h-4" />
                          <span>{t.sendOtpBtn}</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <>
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="block text-xs font-semibold text-slate-300">
                            {t.enterOtp}
                          </label>
                          <button
                            type="button"
                            onClick={() => { handleSendLoginOtp(); }}
                            disabled={isLoading || resendCooldown > 0}
                            className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50 cursor-pointer"
                          >
                            {resendCooldown > 0 ? `${t.resendCode} (${resendCooldown}s)` : t.resendCode}
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
                            className="w-full bg-slate-900/90 border border-indigo-500/60 rounded-xl pl-10 pr-4 py-2.5 text-base tracking-widest font-mono text-center text-white placeholder-slate-600 focus:outline-none focus:border-indigo-400"
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
                            <span>{t.verifySignIn}</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                </form>
              )}
            </div>
          )}

          {/* ==================================== */}
          {/* SIGN UP FORM (JOIN AS PARTNER) */}
          {/* ==================================== */}
          {mode === 'signup' && (
            <div className="space-y-3.5">
              {!pendingGoogleData && (
                <div className="flex bg-slate-900/90 p-1 rounded-xl border border-slate-700/80 mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSignupMethod('password');
                      setErrorMessage(null);
                      setOtpNotice(null);
                    }}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                      signupMethod === 'password'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {t.passwordSignupTab}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSignupMethod('otp');
                      setErrorMessage(null);
                    }}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                      signupMethod === 'otp'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {t.otpSignupTab}
                  </button>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  if (signupMethod === 'otp') {
                    if (!otpSentForSignup) {
                      e.preventDefault();
                      handleSendSignupOtp();
                    } else {
                      handleVerifySignupOtp(e);
                    }
                  } else {
                    handleSignUp(e);
                  }
                }}
                className="space-y-3.5 max-h-[460px] overflow-y-auto pr-1"
              >
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
                      placeholder="e.g. Ramesh Kumar"
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
                      placeholder="+91 98765 43210"
                      className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t.emailLabel} {signupMethod === 'otp' ? <span className="text-rose-400">*</span> : '(Optional)'}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      required={signupMethod === 'otp'}
                      placeholder="partner@familyhubs.in"
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

                {!pendingGoogleData && signupMethod === 'password' && (
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
                        required={signupMethod === 'password'}
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

                {!pendingGoogleData && signupMethod === 'otp' && otpSentForSignup && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] text-slate-300 font-medium">{t.enterOtp}</span>
                      <button
                        type="button"
                        onClick={handleSendSignupOtp}
                        disabled={isLoading || resendCooldown > 0}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 disabled:opacity-50 cursor-pointer"
                      >
                        {resendCooldown > 0 ? `${t.resendCode} (${resendCooldown}s)` : t.resendCode}
                      </button>
                    </div>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        maxLength={6}
                        value={signupOtp}
                        onChange={(e) => setSignupOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        className="w-full bg-slate-950 border border-indigo-500/60 rounded-xl pl-10 pr-3 py-2 text-sm font-mono tracking-widest text-center text-white placeholder-slate-600 focus:outline-none focus:border-indigo-400"
                      />
                    </div>
                  </div>
                )}

                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-[11px] text-emerald-300 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{t.trustNotice}</span>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : signupMethod === 'otp' && !otpSentForSignup ? (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>{t.sendSignupOtp}</span>
                    </>
                  ) : signupMethod === 'otp' ? (
                    <>
                      <span>{t.verifySignUp}</span>
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <span>{t.registerBtn}</span>
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
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
        FamilyHubs Field Partner Operations • Pan-India Eldercare Network Across India
      </footer>
    </div>
  );
};
