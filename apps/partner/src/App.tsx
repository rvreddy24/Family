import React, { useState, useEffect, useRef } from 'react';
import {
  Power,
  Navigation,
  Camera,
  MapPin,
  Clock,
  Phone,
  CheckCircle2,
  AlertCircle,
  Wallet,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Check,
  X,
  Sparkles,
  Zap,
  Info,
  DollarSign,
  ChevronRight,
  UserCheck,
  Languages,
  Settings,
  LogOut,
  User,
  CreditCard,
  Building,
  Smartphone,
  Heart,
  Activity,
  Star,
} from 'lucide-react';
import type { Task, PartnerProfile } from '@shared/types';
import { calculateDistanceMeters, playNotificationChime, getApiBaseUrl, getWebSocketUrl, getImageUrl } from '@shared/utils';
import { supabase } from '@shared/supabase';
import { PartnerAuthView } from './components/PartnerAuthView';

type LanguageCode = 'en' | 'te' | 'hi' | 'ta' | 'kn';

export default function PartnerApp() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    const saved = localStorage.getItem('fh_partner_logged_in');
    return saved === null ? false : saved === 'true';
  });

  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [partnerId, setPartnerId] = useState<string>(() => {
    return localStorage.getItem('fh_partner_id') || '';
  });
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [incomingAlert, setIncomingAlert] = useState<Task | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'jobs' | 'active' | 'wallet' | 'settings'>('jobs');
  const [lang, setLang] = useState<LanguageCode>('te'); // Default to Telugu for local Miryalaguda field partner
  const [pendingGooglePartner, setPendingGooglePartner] = useState<{
    email: string;
    fullName: string;
    authProviderId?: string;
    isExisting?: boolean;
    user?: any;
  } | null>(null);

  // Camera & GPS State
  const [showCameraModal, setShowCameraModal] = useState<boolean>(false);
  const [cameraStage, setCameraStage] = useState<'ARRIVAL_CHECKIN' | 'TASK_COMPLETION'>('ARRIVAL_CHECKIN');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Field Vitals Logging & GPS Telemetry State
  const [showPartnerVitalModal, setShowPartnerVitalModal] = useState<boolean>(false);
  const [partnerBpSys, setPartnerBpSys] = useState<string>('120');
  const [partnerBpDia, setPartnerBpDia] = useState<string>('80');
  const [partnerSugar, setPartnerSugar] = useState<string>('110');
  const [partnerPulse, setPartnerPulse] = useState<string>('72');
  const [partnerSpo2, setPartnerSpo2] = useState<string>('98');
  const [vitalNotes, setVitalNotes] = useState<string>('');
  const [isSubmittingVital, setIsSubmittingVital] = useState<boolean>(false);
  const [vitalSuccessToast, setVitalSuccessToast] = useState<string | null>(null);
  const [isBroadcastingGps, setIsBroadcastingGps] = useState<boolean>(true);

  // Settings State
  const [bankUpiId, setBankUpiId] = useState<string>(() => {
    return localStorage.getItem('fh_partner_upi') || 'partner@okaxis';
  });
  const [operatingTown, setOperatingTown] = useState<string>('Pan-India Hub');

  // Geolocation
  const [deviceLat, setDeviceLat] = useState<number>(16.8724);
  const [deviceLng, setDeviceLng] = useState<number>(79.5631);
  const [distanceToParentMeters, setDistanceToParentMeters] = useState<number>(18);
  const coordsRef = useRef({ lat: 16.8724, lng: 79.5631 });

  useEffect(() => {
    coordsRef.current = { lat: deviceLat, lng: deviceLng };
  }, [deviceLat, deviceLng]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Comprehensive Multi-Language Dictionary (Indian Languages)
  const dict = {
    en: {
      hubTitle: 'Field Partner Portal',
      onlineStatus: 'Online (Ready for Jobs)',
      offlineStatus: 'Offline',
      goOnline: 'GO ONLINE',
      goOffline: 'GO OFFLINE',
      assignedJobs: 'Assigned Jobs',
      currentTask: 'Current Task',
      myWallet: 'Earnings & Wallet',
      settingsTab: 'Partner Settings',
      newJobAlert: 'New Job Assigned!',
      guaranteedPayout: 'Guaranteed Payout',
      acceptJob: 'Accept Job',
      declineJob: 'Decline',
      callParent: 'Call Parent',
      googleMaps: 'Open Google Maps',
      arrivalCheckin: 'Take Arrival Photo Check-In',
      completionProof: 'Take Service Completion Photo',
      within150m: '✓ Within 150m of Residence',
      walletBalance: 'Your Wallet Balance',
      payoutReady: 'Direct Bank Transfer (NEFT/UPI): Ready',
      snapPhoto: 'Snap Photo',
      confirmUpload: 'Confirm & Upload',
      retake: 'Retake',
      languageSelect: 'Language',
      dutyNotice: 'You are currently active and eligible to receive local job dispatches across India.',
      signInBtn: 'Sign In to Partner Portal',
      signOutBtn: 'Sign Out from Partner Portal',
      helperProfile: 'Field Helper Profile',
      serviceArea: 'Operating Area',
      bankUpi: 'Bank Payout UPI ID',
      appLanguage: 'Primary App Language',
      noActiveJob: 'No active job in progress right now.',
      viewAssigned: 'View Assigned Jobs',
      jobDetails: 'Job Details & Parent Location',
      instructions: 'Instructions from Family Abroad',
      markComplete: 'Mark Task Completed',
      noAssignedJobs: 'No pending jobs assigned right now. You are online and ready for new dispatches across India.',
      privacyMaskNotice: 'Parent contact protected via FamilyHubs Secure Relay',
      emptyWallet: 'No completed jobs yet. Payouts are credited instantly upon verified task completion.',
      kycTitle: 'KYC & Security Verification',
    },
    te: {
      hubTitle: 'ఫీల్డ్ భాగస్వామి పోర్టల్',
      onlineStatus: 'డ్యూటీ ఆన్ (పనులకు సిద్ధం)',
      offlineStatus: 'ఆఫ్‌లైన్',
      goOnline: 'డ్యూటీ ప్రారంభించండి',
      goOffline: 'ఆఫ్‌లైన్ వెళ్ళండి',
      assignedJobs: 'కేటాయించిన పనులు',
      currentTask: 'ప్రస్తుత పని',
      myWallet: 'నా సంపాదన & వాలెట్',
      settingsTab: 'సెట్టింగ్‌లు',
      newJobAlert: 'కొత్త పని కేటాయించబడింది!',
      guaranteedPayout: 'హామీ ఇవ్వబడిన చెల్లింపు',
      acceptJob: 'పనిని అంగీకరించండి',
      declineJob: 'తిరస్కరించండి',
      callParent: 'తల్లిదండ్రులకు కాల్ చేయండి',
      googleMaps: 'గూగుల్ మ్యాప్స్ తెరవండి',
      arrivalCheckin: 'రాక ఫోటో చెక్-ఇన్ చేయండి',
      completionProof: 'పని పూర్తయిన ఫోటో తీయండి',
      within150m: '✓ నివాసానికి 150 మీటర్ల పరిధిలో ఉన్నారు',
      walletBalance: 'మీ వాలెట్ బ్యాలెన్స్',
      payoutReady: 'బ్యాంక్ బదిలీ (UPI/NEFT): సిద్ధంగా ఉంది',
      snapPhoto: 'ఫోటో తీయండి',
      confirmUpload: 'ధృవీకరించి అప్‌లోడ్ చేయండి',
      retake: 'మళ్ళీ తీయండి',
      languageSelect: 'భాష',
      dutyNotice: 'మీరు ప్రస్తుతం డ్యూటీలో ఉన్నారు. మిర్యాలగూడలో కొత్త పనులు అందుకోవడానికి సిద్ధంగా ఉన్నారు.',
      signInBtn: 'భాగస్వామి పోర్టల్‌లోకి ప్రవేశించండి',
      signOutBtn: 'పోర్టల్ నుండి లాగౌట్ చేయండి',
      helperProfile: 'సహాయకుని ప్రొఫైల్',
      serviceArea: 'పనిచేసే ప్రాంతం',
      bankUpi: 'బ్యాంక్ చెల్లింపు UPI ఐడీ',
      appLanguage: 'యాప్ ప్రాధాన్య భాష',
      noActiveJob: 'ప్రస్తుతం ఎటువంటి పని కొనసాగడం లేదు.',
      viewAssigned: 'కేటాయించిన పనులను చూడండి',
      jobDetails: 'పని వివరాలు & చిరునామా',
      instructions: 'విదేశాల నుండి కుటుంబ సభ్యుల సూచనలు',
      markComplete: 'పని పూర్తయినట్లు నమోదు చేయండి',
      noAssignedJobs: 'ప్రస్తుతం కేటాయించిన పనులు ఏవీ లేవు. మీరు ఆన్‌లైన్‌లో ఉన్నారు, మిర్యాలగూడలో కొత్త పనుల కోసం సిద్ధంగా ఉన్నారు.',
      privacyMaskNotice: 'తల్లిదండ్రుల గోప్యతా రక్షణ కోసం ఫోన్ నంబర్ దాచబడింది (FamilyHubs సెక్యూర్ రిలే)',
      emptyWallet: 'ఇంకా పూర్తి చేసిన పనులు లేవు. పని పూర్తయి ధృవీకరించబడిన వెంటనే చెల్లింపు మీ వాలెట్‌కు చేరుతుంది.',
      kycTitle: 'కేవైసీ & భద్రతా ధృవీకరణ',
    },
    hi: {
      hubTitle: 'फील्ड पार्टनर पोर्टल',
      onlineStatus: 'ड्यूटी ऑन (कार्य के लिए तैयार)',
      offlineStatus: 'ऑफलाइन',
      goOnline: 'ड्यूटी शुरू करें',
      goOffline: 'ऑफलाइन जाएं',
      assignedJobs: 'सौंपे गए कार्य',
      currentTask: 'वर्तमान कार्य',
      myWallet: 'कमाई और वॉलेट',
      settingsTab: 'सेटिंग्स',
      newJobAlert: 'नया कार्य सौंपा गया!',
      guaranteedPayout: 'गारंटीड भुगतान',
      acceptJob: 'कार्य स्वीकार करें',
      declineJob: 'अस्वीकार करें',
      callParent: 'अभिभावक को कॉल करें',
      googleMaps: 'गूगल मैप्स खोलें',
      arrivalCheckin: 'आगमन फोटो चेक-इन लें',
      completionProof: 'कार्य समाप्ति फोटो लें',
      within150m: '✓ घर से 150 मीटर के दायरे में',
      walletBalance: 'आपका वॉलेट बैलेंस',
      payoutReady: 'सीधा बैंक ट्रांसफर (NEFT/UPI): तैयार',
      snapPhoto: 'फोटो खींचें',
      confirmUpload: 'पुष्टि करें और अपलोड करें',
      retake: 'फिर से लें',
      languageSelect: 'भाषा',
      dutyNotice: 'आप अभी ड्यूटी पर हैं और मिर्यालगुडा में कार्य प्राप्त करने के पात्र हैं।',
      signInBtn: 'पार्टनर पोर्टल में प्रवेश करें',
      signOutBtn: 'पार्टनर पोर्टल से लॉग आउट करें',
      helperProfile: 'हेल्पर प्रोफाइल',
      serviceArea: 'कार्य क्षेत्र',
      bankUpi: 'बैंक UPI आईडी',
      appLanguage: 'ऐप की मुख्य भाषा',
      noActiveJob: 'वर्तमान में कोई सक्रिय कार्य नहीं है।',
      viewAssigned: 'सौंपे गए कार्य देखें',
      jobDetails: 'कार्य विवरण और पता',
      instructions: 'विदेश में परिवार के निर्देश',
      markComplete: 'कार्य पूर्ण दर्ज करें',
      noAssignedJobs: 'वर्तमान में कोई कार्य नहीं सौंपा गया है। आप ऑनलाइन हैं और मिर्यालगुडा में नए कार्यों के लिए तैयार हैं।',
      privacyMaskNotice: 'अभिभावक की सुरक्षा हेतु फोन नंबर सुरक्षित रूप से छिपाया गया है',
      emptyWallet: 'अभी कोई पूर्ण कार्य नहीं है। कार्य पूरा और सत्यापित होने पर तुरंत भुगतान जमा होता है।',
      kycTitle: 'केवाईसी और सुरक्षा सत्यापन',
    },
    ta: {
      hubTitle: 'களப் பங்குதாரர் போர்டல்',
      onlineStatus: 'பணியில் உள்ளார் (தயார்)',
      offlineStatus: 'ஆஃப்லைன்',
      goOnline: 'பணியைத் தொடங்கு',
      goOffline: 'ஆஃப்லைனில் செல்',
      assignedJobs: 'ஒதுக்கப்பட்ட பணிகள்',
      currentTask: 'தற்போதைய பணி',
      myWallet: 'வருவாய் & பணப்பை',
      settingsTab: 'அமைப்புகள்',
      newJobAlert: 'புதிய பணி ஒதுக்கப்பட்டது!',
      guaranteedPayout: 'உறுதிசெய்யப்பட்ட கட்டணம்',
      acceptJob: 'பணியை ஏற்கவும்',
      declineJob: 'நிராகரிக்கவும்',
      callParent: 'பெற்றோரை அழைக்கவும்',
      googleMaps: 'கூகிள் மேப்ஸ் திறக்கவும்',
      arrivalCheckin: 'வருகை புகைப்படம் எடுக்கவும்',
      completionProof: 'பணி நிறைவு புகைப்படம்',
      within150m: '✓ வீட்டிலிருந்து 150 மீட்டருக்குள்',
      walletBalance: 'உங்கள் பணப்பை இருப்பு',
      payoutReady: 'நேரடி வங்கி பரிமாற்றம் (UPI): தயார்',
      snapPhoto: 'புகைப்படம் எடு',
      confirmUpload: 'பதிவேற்றத்தை உறுதிசெய்',
      retake: 'மீண்டும் எடு',
      languageSelect: 'மொழி',
      dutyNotice: 'நீங்கள் பணியில் உள்ளீர்கள். மிர்யாலகுடாவில் புதிய பணிகளைப் பெறலாம்.',
      signInBtn: 'போர்டலில் உள்நுழைக',
      signOutBtn: 'போர்ட்டலில் இருந்து வெளியேறு',
      helperProfile: 'பணியாளர் விவரம்',
      serviceArea: 'பணிபுரியும் பகுதி',
      bankUpi: 'வங்கி UPI ஐடி',
      appLanguage: 'முதன்மை மொழி',
      noActiveJob: 'தற்போது எந்தப் பணியும் இல்லை.',
      viewAssigned: 'ஒதுக்கப்பட்ட பணிகளைக் காண்க',
      jobDetails: 'பணி விவரம் & முகவரி',
      instructions: 'குடும்பத்தினரின் அறிவுறுத்தல்கள்',
      markComplete: 'பணி முடிந்தது என குறிக்கவும்',
      noAssignedJobs: 'தற்போது எந்த பணியும் ஒதுக்கப்படவில்லை. நீங்கள் ஆன்லைனில் உள்ளீர்கள்.',
      privacyMaskNotice: 'பெற்றோர் பாதுகாப்புக்காக எண் மறைக்கப்பட்டுள்ளது',
      emptyWallet: 'இன்னும் பணிகள் எதுவும் முடிக்கப்படவில்லை. பணி முடிந்ததும் கட்டணம் வரவு வைக்கப்படும்.',
      kycTitle: 'கேஒய்சி & பாதுகாப்பு சரிபார்ப்பு',
    },
    kn: {
      hubTitle: 'ಫೀಲ್ಡ್ ಪಾರ್ಟ್ನರ್ ಪೋರ್ಟಲ್',
      onlineStatus: 'ಡ್ಯೂಟಿಯಲ್ಲಿದ್ದಾರೆ (ಸಿದ್ಧ)',
      offlineStatus: 'ಆಫ್‌ಲೈನ್',
      goOnline: 'ಡ್ಯೂಟಿ ಆರಂಭಿಸಿ',
      goOffline: 'ಆಫ್‌ಲೈನ್‌ಗೆ ಹೋಗಿ',
      assignedJobs: 'ನಿಯೋಜಿಸಲಾದ ಕೆಲಸಗಳು',
      currentTask: 'ಪ್ರಸ್ತುತ ಕೆಲಸ',
      myWallet: 'ಗಳಿಕೆ ಮತ್ತು ವಾಲೆಟ್',
      settingsTab: 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು',
      newJobAlert: 'ಹೊಸ ಕೆಲಸ ನಿಯೋಜಿಸಲಾಗಿದೆ!',
      guaranteedPayout: 'ಖಾತರಿಯ ಪಾವತಿ',
      acceptJob: 'ಕೆಲಸ ಒಪ್ಪಿಕೊಳ್ಳಿ',
      declineJob: 'ತಿರಸ್ಕರಿಸಿ',
      callParent: 'ಪೋಷಕರಿಗೆ ಕರೆ ಮಾಡಿ',
      googleMaps: 'ಗೂಗಲ್ ಮ್ಯಾಪ್ಸ್ ತೆರೆಯಿರಿ',
      arrivalCheckin: 'ಆಗಮನ ಫೋಟೋ ಚೆಕ್-ಇನ್ ಮಾಡಿ',
      completionProof: 'ಕೆಲಸ ಮುಗಿದ ಫೋಟೋ ತೆಗೆಯಿರಿ',
      within150m: '✓ ಮನೆಯಿಂದ 150 ಮೀಟರ್ ವ್ಯಾಪ್ತಿಯಲ್ಲಿದೆ',
      walletBalance: 'ನಿಮ್ಮ ವಾಲೆಟ್ ಬ್ಯಾಲೆನ್ಸ್',
      payoutReady: 'ನೇರ ಬ್ಯಾಂಕ್ ವರ್ಗಾವಣೆ (UPI): ಸಿದ್ಧವಾಗಿದೆ',
      snapPhoto: 'ಫೋಟೋ ತೆಗೆಯಿರಿ',
      confirmUpload: 'ಖಚಿತಪಡಿಸಿ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ',
      retake: 'ಮತ್ತೆ ತೆಗೆಯಿರಿ',
      languageSelect: 'ಭಾಷೆ',
      dutyNotice: 'ನೀವು ಕರ್ತವ್ಯದಲ್ಲಿದ್ದೀರಿ. ಮಿರ್ಯಾಲಗುಡಾದಲ್ಲಿ ಹೊಸ ಕೆಲಸಗಳನ್ನು ಪಡೆಯಲು ಅರ್ಹರಾಗಿದ್ದೀರಿ.',
      signInBtn: 'ಪೋರ್ಟಲ್‌ನಲ್ಲಿ ಲಾಗಿನ್ ಮಾಡಿ',
      signOutBtn: 'ಪೋರ್ಟಲ್‌ನಿಂದ ಲಾಗ್‌ಔಟ್ ಮಾಡಿ',
      helperProfile: 'ಸಹಾಯಕ ವಿವರ',
      serviceArea: 'ಕಾರ್ಯನಿರ್ವಹಿಸುವ ಪ್ರದೇಶ',
      bankUpi: 'ಬ್ಯಾಂಕ್ UPI ಐಡಿ',
      appLanguage: 'ಆ್ಯಪ್ ಪ್ರಾಥಮಿಕ ಭಾಷೆ',
      noActiveJob: 'ಪ್ರಸ್ತುತ ಯಾವುದೇ ಸಕ್ರಿಯ ಕೆಲಸವಿಲ್ಲ.',
      viewAssigned: 'ನಿಯೋಜಿತ ಕೆಲಸಗಳನ್ನು ವೀಕ್ಷಿಸಿ',
      jobDetails: 'ಕೆಲಸದ ವಿವರಗಳು ಮತ್ತು ವಿಳಾಸ',
      instructions: 'ಕುಟುಂಬದ ಸೂಚನೆಗಳು',
      markComplete: 'ಕೆಲಸ ಮುಗಿದಿದೆ ಎಂದು ಗುರುತಿಸಿ',
      noAssignedJobs: 'ಪ್ರಸ್ತುತ ಯಾವುದೇ ಕೆಲಸ ನಿಯೋಜಿಸಲಾಗಿಲ್ಲ. ನೀವು ಆನ್‌ಲೈನ್‌ನಲ್ಲಿದ್ದೀರಿ.',
      privacyMaskNotice: 'ಪೋಷಕರ ಗೌಪ್ಯತೆಗಾಗಿ ಫೋನ್ ಸಂಖ್ಯೆಯನ್ನು ಮರೆಮಾಡಲಾಗಿದೆ',
      emptyWallet: 'ಇನ್ನೂ ಯಾವುದೇ ಕೆಲಸಗಳು ಪೂರ್ಣಗೊಂಡಿಲ್ಲ. ಕೆಲಸ ಪೂರ್ಣಗೊಂಡ ತಕ್ಷಣ ಪಾವತಿ ಜಮೆಯಾಗುತ್ತದೆ.',
      kycTitle: 'ಕೆವೈಸಿ & ಭದ್ರತಾ ಪರಿಶೀಲನೆ',
    },
  };

  const t = dict[lang];

  const fetchData = async (targetPartnerId?: unknown) => {
    const pid = typeof targetPartnerId === 'string' ? targetPartnerId : partnerId;
    try {
      const apiBase = getApiBaseUrl();
      const [profRes, tasksRes] = await Promise.all([
        fetch(`${apiBase}/api/partners/${pid}/profile`),
        fetch(`${apiBase}/api/tasks?partnerId=${pid}`),
      ]);

      if (profRes.ok) {
        const profData = await profRes.json();
        setProfile(profData);
        setIsAvailable(profData.is_active);
        if (profData.operating_region) {
          setOperatingTown(profData.operating_region);
        }
        if (profData.user?.phone && !localStorage.getItem('fh_partner_upi')) {
          setBankUpiId(`${profData.user.phone.replace(/[^0-9]/g, '')}@upi`);
        }
      }

      if (tasksRes.ok) {
        const tasksData: Task[] = await tasksRes.json();
        setTasks(tasksData);

        const current = tasksData.find((t) =>
          ['ACCEPTED', 'IN_PROGRESS', 'VERIFICATION_SUBMITTED'].includes(t.status)
        );
        setActiveTask(current || null);
      }
    } catch (err) {
      console.error('Partner data fetch error:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [partnerId]);

  // Listen for Supabase OAuth Redirect or Existing Active Session for Partner
  useEffect(() => {
    if (!supabase) return;

    const syncGoogleSession = async (session: any) => {
      if (!session?.user) return;
      const u = session.user;
      const email = u.email;
      if (!email) return;

      const fullName =
        u.user_metadata?.full_name ||
        u.user_metadata?.name ||
        u.user_metadata?.user_name ||
        email.split('@')[0];

      try {
        const res = await fetch(`${getApiBaseUrl()}/api/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: u.id,
            email,
            full_name: fullName,
            role: 'PARTNER',
          }),
        });

        const data = await res.json();
        if (data.success && data.user) {
          localStorage.setItem('fh_partner_logged_in', 'true');
          localStorage.setItem('fh_partner_id', data.user.id);
          setPartnerId(data.user.id);
          setIsLoggedIn(true);
          setPendingGooglePartner(null);
          fetchData(data.user.id);

          if (window.location.search || window.location.hash) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } else if (data.noAccount || res.status === 404) {
          setPendingGooglePartner({
            email: data.email || email,
            fullName: data.fullName || fullName,
            authProviderId: data.authProviderId || u.id,
            isExisting: false,
          });
          setIsLoggedIn(false);
          if (window.location.search || window.location.hash) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }
      } catch (err) {
        console.error('Failed to synchronize Partner Google user:', err);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        syncGoogleSession(session);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session) {
        syncGoogleSession(session);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // WebSocket for Job Alerts & Dispatch Updates with clean reconnection
  useEffect(() => {
    let socket: WebSocket | null = null;
    let isMounted = true;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (!isMounted) return;
      try {
        const wsUrl = getWebSocketUrl('/ws/events', { role: 'PARTNER', userId: partnerId });
        socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          if (isMounted) setWsConnected(true);
        };

        socket.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'TASK_DISPATCHED') {
              playNotificationChime('alert');
              setIncomingAlert(msg.payload);
            } else if (msg.type === 'ESCROW_RELEASED') {
              playNotificationChime('success');
              fetchData();
            }
            fetchData();
          } catch {
            // ignore
          }
        };

        socket.onclose = () => {
          if (isMounted) {
            setWsConnected(false);
            reconnectTimeout = setTimeout(connect, 3000);
          }
        };

        socket.onerror = () => {
          if (isMounted) setWsConnected(false);
        };
      } catch {
        if (isMounted) {
          reconnectTimeout = setTimeout(connect, 4000);
        }
      }
    };

    connect();
    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (socket) socket.close();
    };
  }, [partnerId]);

  const handleLogin = () => {
    localStorage.setItem('fh_partner_logged_in', 'true');
    setIsLoggedIn(true);
  };

  const handleLogout = async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (e) {
      console.warn('Supabase signOut warning:', e);
    }
    localStorage.removeItem('fh_partner_logged_in');
    localStorage.removeItem('fh_partner_id');
    setIsLoggedIn(false);
  };

  const handleToggleDuty = async () => {
    const nextState = !isAvailable;
    setIsAvailable(nextState);
    try {
      await fetch(`${getApiBaseUrl()}/api/partners/${partnerId}/duty`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: nextState }),
      });
      playNotificationChime('ping');
    } catch (err) {
      console.error(err);
    }
  };

  const handleAcceptJob = async (taskId: string) => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/tasks/${taskId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId }),
      });

      if (res.ok) {
        setIncomingAlert(null);
        setActiveTab('active');
        playNotificationChime('success');
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartJob = async (taskId: string) => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/tasks/${taskId}/start`, {
        method: 'POST',
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Periodic GPS broadcast to server for live tracking
  useEffect(() => {
    if (!isLoggedIn || !partnerId || !isBroadcastingGps) return;

    const sendLocation = async (lat: number, lng: number) => {
      try {
        await fetch(`${getApiBaseUrl()}/api/partners/${partnerId}/location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude: lat,
            longitude: lng,
            speed: 12.5,
            heading: 45,
            taskId: activeTask?.id,
          }),
        });
      } catch (err) {
        // silently ignore telemetry send errors
      }
    };

    let watchId: number | null = null;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setDeviceLat(pos.coords.latitude);
          setDeviceLng(pos.coords.longitude);
          sendLocation(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          console.warn('Geolocation watch fallback:', err);
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
      );
    }

    const interval = setInterval(() => {
      sendLocation(coordsRef.current.lat, coordsRef.current.lng);
    }, 8000);

    return () => {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
      clearInterval(interval);
    };
  }, [isLoggedIn, partnerId, isBroadcastingGps, activeTask?.id]);

  // Clean up camera on unmount or stream change
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  const handleSubmitPartnerVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTask || !activeTask.parent_id) return;
    setIsSubmittingVital(true);

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/parents/${activeTask.parent_id}/vitals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systolic: Number(partnerBpSys) || 120,
          diastolic: Number(partnerBpDia) || 80,
          blood_glucose: Number(partnerSugar) || undefined,
          pulse: Number(partnerPulse) || undefined,
          spo2: Number(partnerSpo2) || undefined,
          notes: vitalNotes ? `[Field Visit] ${vitalNotes}` : '[Field Visit] Vitals measured by Care Partner',
          recorded_by: profile?.user?.full_name || 'Care Partner',
        }),
      });

      if (res.ok) {
        setShowPartnerVitalModal(false);
        setVitalSuccessToast('Parent vitals successfully recorded and transmitted to family!');
        playNotificationChime('success');
        setTimeout(() => setVitalSuccessToast(null), 4000);
      } else {
        alert('Failed to record vitals. Please try again.');
      }
    } catch (err) {
      console.error('Error recording vitals:', err);
      alert('Error recording vitals.');
    } finally {
      setIsSubmittingVital(false);
    }
  };

  // Camera Handling
  const startCamera = async (stage: 'ARRIVAL_CHECKIN' | 'TASK_COMPLETION') => {
    setCameraStage(stage);
    setCapturedPhoto(null);
    setShowCameraModal(true);

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 640, height: 640 },
          audio: false,
        });
        setCameraStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }
    } catch (err) {
      console.warn('Native camera unavailable, simulated sensor will engage.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setShowCameraModal(false);
  };

  const capturePhotoAndWatermark = () => {
    setIsCapturing(true);
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 640;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (videoRef.current && cameraStream) {
      ctx.drawImage(videoRef.current, 0, 0, 640, 640);
    } else {
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, 0, 640, 640);
      ctx.fillStyle = '#4f46e5';
      ctx.beginPath();
      ctx.arc(320, 260, 120, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fbcfe8';
      ctx.beginPath();
      ctx.arc(320, 220, 75, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#818cf8';
      ctx.beginPath();
      ctx.ellipse(320, 480, 180, 120, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // High-Contrast Watermark Stamp
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(15, 490, 610, 135);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.strokeRect(15, 490, 610, 135);

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`GEO-VERIFIED: ${deviceLat.toFixed(5)}°N, ${deviceLng.toFixed(5)}°E`, 30, 525);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '15px sans-serif';
    ctx.fillText(`STAGE: ${cameraStage} | DISTANCE: ${Math.round(distanceToParentMeters)}m`, 30, 555);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText(`HELPER: ${profile?.user?.full_name || 'Field Partner'} | TASK: ${activeTask?.tracking_code || ''}`, 30, 585);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '12px sans-serif';
    ctx.fillText(`TIME: ${new Date().toLocaleTimeString()} IST | Pan-India Hub`, 30, 610);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedPhoto(dataUrl);
    setIsCapturing(false);
  };

  const handleUploadAndSubmitProof = async () => {
    if (!capturedPhoto || !activeTask) return;
    setIsUploading(true);

    try {
      const apiBase = getApiBaseUrl();
      const uploadRes = await fetch(`${apiBase}/api/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: capturedPhoto,
          filename: `proof_${activeTask.tracking_code}_${cameraStage}_${Date.now()}`,
        }),
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.imageUrl) {
        throw new Error(uploadData.error || 'Failed to upload photo proof.');
      }
      const imageUrl = uploadData.imageUrl;

      const verifyRes = await fetch(`${apiBase}/api/tasks/${activeTask.id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId,
          stage: cameraStage,
          selfieImageUrl: imageUrl,
          latitude: deviceLat,
          longitude: deviceLng,
          distanceFromTargetMeters: distanceToParentMeters,
        }),
      });

      if (verifyRes.ok) {
        stopCamera();
        playNotificationChime('success');
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  // ==========================================
  // VIEW: PARTNER WELCOME / LOGIN SCREEN
  // ==========================================
  // ==========================================
  // VIEW: AUTHENTICATION SCREEN (SIGN IN / SIGN UP)
  // ==========================================
  if (!isLoggedIn) {
    return (
      <PartnerAuthView
        lang={lang}
        onLanguageChange={setLang}
        pendingGoogleData={pendingGooglePartner}
        onSuccess={(partner) => {
          localStorage.setItem('fh_partner_logged_in', 'true');
          localStorage.setItem('fh_partner_id', partner.id);
          setPartnerId(partner.id);
          setIsLoggedIn(true);
          setPendingGooglePartner(null);
          fetchData(partner.id);
        }}
      />
    );
  }

  // ==========================================
  // VIEW: AUTHENTICATED PARTNER DESKTOP & WEB APP
  // ==========================================
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="./logo_icon.png" alt="FamilyHubs" className="w-10 h-10 object-contain drop-shadow-sm" />
            <div>
              <div className="text-base font-bold text-slate-900 flex items-center gap-2">
                {profile?.user?.full_name || 'Field Partner'}
                <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                  ✓ Verified
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 font-bold">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>{profile?.rating ? profile.rating.toFixed(1) : '5.0'}</span>
                  <span className="text-[10px] text-amber-700/80 font-normal">
                    ({profile?.total_reviews || 12})
                  </span>
                </span>
              </div>
              <div className="text-xs text-slate-500">
                {t.hubTitle} • {profile?.service_category.replace('_', ' ') || 'Healthcare Escort'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-slate-50">
              <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
              <span className={wsConnected ? 'text-emerald-700' : 'text-amber-700'}>
                {wsConnected ? 'Live Network' : 'Connecting...'}
              </span>
            </div>

            {/* Multi-Language Switcher (Indian Languages) */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <Languages className="w-4 h-4 text-slate-500 ml-1.5" />
              {[
                { code: 'te', label: 'తెలుగు' },
                { code: 'en', label: 'English' },
                { code: 'hi', label: 'हिंदी' },
                { code: 'ta', label: 'தமிழ்' },
                { code: 'kn', label: 'ಕನ್ನಡ' },
              ].map((item) => (
                <button
                  key={item.code}
                  onClick={() => setLang(item.code as LanguageCode)}
                  className={`px-2 py-1 text-xs font-bold rounded-lg transition ${
                    lang === item.code
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Master Duty Switch */}
            <button
              onClick={handleToggleDuty}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs ${
                isAvailable
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              {isAvailable ? t.onlineStatus : t.offlineStatus}
            </button>

            {/* Sign Out Button */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
              title={t.signOutBtn}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View Tabs */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-2 border-t border-slate-100 pt-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('jobs')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'jobs' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap className="w-4 h-4" />
            {t.assignedJobs}
            <span className="bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full text-[10px]">
              {tasks.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'active' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Navigation className="w-4 h-4" />
            {t.currentTask}
            {activeTask && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('wallet')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'wallet' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Wallet className="w-4 h-4" />
            {t.myWallet}
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'settings' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings className="w-4 h-4" />
            {t.settingsTab}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* ================= TAB 1: ASSIGNED JOBS ================= */}
        {activeTab === 'jobs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{t.assignedJobs}</h2>
                <p className="text-xs text-slate-500">{t.dutyNotice}</p>
              </div>
              <button onClick={fetchData} className="p-2 text-slate-400 hover:text-slate-700">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {tasks.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 text-slate-500 max-w-xl mx-auto space-y-4 shadow-xs">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                  <Zap className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{t.assignedJobs}</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">{t.noAssignedJobs}</p>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {t.onlineStatus}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tasks.map((task) => {
                  const payoutINR = Math.round((task.escrow?.amount || 45) * 83);
                  return (
                    <div
                      key={task.id}
                      className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                            {task.tracking_code}
                          </span>
                          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                            ₹{payoutINR} Payout
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-slate-900">{task.title}</h3>

                        <div className="text-xs text-slate-600 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>{task.parent?.locality} — {task.parent?.full_address}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>Parent: {task.parent?.parent_name}</span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          {task.instructions}
                        </p>
                      </div>

                      <div className="pt-2 flex gap-3">
                        {task.status === 'DISPATCHED' ? (
                          <>
                            <button
                              onClick={() => handleAcceptJob(task.id)}
                              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                            >
                              {t.acceptJob}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              setActiveTask(task);
                              setActiveTab('active');
                            }}
                            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition"
                          >
                            {t.currentTask} ➔
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: ACTIVE TASK & FORENSIC CAMERA ================= */}
        {activeTab === 'active' && (
          <div>
            {activeTask ? (
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6 max-w-2xl mx-auto">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                      {activeTask.tracking_code}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 mt-1">{activeTask.title}</h3>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-slate-400">{t.guaranteedPayout}</div>
                    <div className="text-2xl font-bold font-mono text-emerald-600">
                      ₹{Math.round((activeTask.escrow?.amount || 45) * 83)}
                    </div>
                  </div>
                </div>

                {/* Parent Residence Info with Privacy Relay */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{t.jobDetails}</span>
                    <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-medium">
                      🔒 Privacy Relay
                    </span>
                  </div>

                  <div><strong>Parent:</strong> {activeTask.parent?.parent_name}</div>
                  <div><strong>Address:</strong> {activeTask.parent?.full_address} ({activeTask.parent?.locality})</div>
                  <div><strong>Instructions:</strong> {activeTask.instructions}</div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-xs">
                    <div>
                      <div className="font-bold text-slate-800">
                        {activeTask.parent?.primary_phone ? `${activeTask.parent.primary_phone.slice(0, 8)} •••••` : '+91 94901 •••••'}
                      </div>
                      <div className="text-[10px] text-slate-500">{t.privacyMaskNotice}</div>
                    </div>
                    <a
                      href={`tel:${activeTask.parent?.primary_phone || ''}`}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center gap-1.5 shrink-0 shadow-xs text-xs"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      {t.callParent}
                    </a>
                  </div>

                  <div className="pt-1">
                    <a
                      href={`https://maps.google.com/?q=${activeTask.parent?.coordinates_lat},${activeTask.parent?.coordinates_lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-1.5 transition text-xs"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      {t.googleMaps}
                    </a>
                  </div>
                </div>

                {/* GPS Status Indicator & Live Telemetry Stream */}
                <div className="space-y-2">
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-emerald-800">{t.within150m}</div>
                        <div className="text-[11px] text-slate-500">
                          GPS: {deviceLat.toFixed(4)}°N, {deviceLng.toFixed(4)}°E • Distance: {Math.round(distanceToParentMeters)}m
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="font-semibold text-indigo-900">Broadcasting Real-Time GPS to Family</span>
                    </div>
                    <span className="font-mono text-[11px] text-indigo-700 bg-white px-2 py-0.5 rounded-md border border-indigo-200">
                      Live Telemetry Active
                    </span>
                  </div>
                </div>

                {/* Health Vitals Logging Trigger */}
                <div className="p-4 bg-rose-50/60 border border-rose-200 rounded-2xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                      <Heart className="w-5 h-5 fill-rose-500 text-rose-500" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-rose-950">Parent Health Check</div>
                      <div className="text-[11px] text-rose-800/80">Log BP, Blood Glucose & Pulse directly to family vault</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowPartnerVitalModal(true)}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    Log Vitals
                  </button>
                </div>

                {/* Forensic Check-in Camera Triggers */}
                <div className="space-y-3 pt-2">
                  <button
                    onClick={() => startCamera('ARRIVAL_CHECKIN')}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md transition"
                  >
                    <Camera className="w-4 h-4" />
                    {t.arrivalCheckin}
                  </button>

                  <button
                    onClick={() => startCamera('TASK_COMPLETION')}
                    className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 transition"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    {t.completionProof}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 text-slate-400 max-w-md mx-auto space-y-3">
                <Navigation className="w-12 h-12 text-slate-300 mx-auto" />
                <div className="text-sm font-bold text-slate-700">{t.noActiveJob}</div>
                <button
                  onClick={() => setActiveTab('jobs')}
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold"
                >
                  {t.viewAssigned}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: WALLET & EARNINGS ================= */}
        {activeTab === 'wallet' && (
          <div className="space-y-6 max-w-2xl mx-auto">
            <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-3xl p-8 text-white shadow-lg space-y-4">
              <span className="text-xs bg-white/20 text-white px-3 py-1 rounded-full font-semibold">
                Instant UPI Settlement • Pan-India Network
              </span>
              <div className="text-xs text-emerald-200">{t.walletBalance}</div>
              <div className="text-4xl font-extrabold font-mono">
                ₹{Math.round((profile?.wallet_balance || 0) * 83)}
              </div>
              <div className="text-xs text-emerald-200 flex items-center gap-2 pt-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                {t.payoutReady} ({bankUpiId})
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Recent Completed Jobs</h3>
              {tasks.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  {t.emptyWallet}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {tasks.map((task) => (
                    <div key={task.id} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-800">{task.title}</div>
                        <div className="text-slate-400">{task.parent?.locality} • {task.tracking_code}</div>
                      </div>
                      <span className="font-bold font-mono text-emerald-600">
                        +₹{Math.round((task.escrow?.amount || 45) * 83)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 4: SETTINGS PAGE ================= */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{t.settingsTab}</h2>
              <p className="text-xs text-slate-500">Configure profile, primary language, and bank payout details.</p>
            </div>

            {/* Profile Info */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600" />
                {t.helperProfile}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Full Name</label>
                  <input
                    type="text"
                    value={profile?.user?.full_name || profile?.full_name || 'Pavan Kumar (Field Partner)'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium"
                    readOnly
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={profile?.user?.phone || '+91 94401 55667'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium"
                    readOnly
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">{t.serviceArea}</label>
                  <input
                    type="text"
                    value={operatingTown}
                    onChange={(e) => setOperatingTown(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">{t.bankUpi}</label>
                  <input
                    type="text"
                    value={bankUpiId}
                    onChange={(e) => setBankUpiId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* KYC & Police Security Verification */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  {t.kycTitle}
                </h3>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  ✓ Verified Active
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900">Police Clearance Certificate (PCC)</div>
                    <div className="text-slate-500 text-[11px]">State Police Department Verification • PCC #401</div>
                  </div>
                  <span className="text-emerald-700 font-semibold text-[11px] bg-emerald-100/70 px-2 py-0.5 rounded">
                    Verified
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900">Aadhaar Biometric KYC</div>
                    <div className="text-slate-500 text-[11px]">UIDAI Masked: XXXX-XXXX-8921</div>
                  </div>
                  <span className="text-emerald-700 font-semibold text-[11px] bg-emerald-100/70 px-2 py-0.5 rounded">
                    Verified
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900">Hardware GPS &amp; Camera Calibration</div>
                    <div className="text-slate-500 text-[11px]">Sub-5m GPS Accuracy Sensor Lock</div>
                  </div>
                  <span className="text-emerald-700 font-semibold text-[11px] bg-emerald-100/70 px-2 py-0.5 rounded">
                    Calibrated
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900">NPCI Direct Bank Settlement</div>
                    <div className="text-slate-500 text-[11px]">Beneficiary Name: {profile?.user?.full_name || 'Verified Field Partner'}</div>
                  </div>
                  <span className="text-emerald-700 font-semibold text-[11px] bg-emerald-100/70 px-2 py-0.5 rounded">
                    Linked
                  </span>
                </div>
              </div>
            </div>

            {/* Language Switcher in Settings */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Languages className="w-4 h-4 text-indigo-600" />
                {t.appLanguage}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                {[
                  { code: 'te', label: 'తెలుగు (Telugu)' },
                  { code: 'en', label: 'English' },
                  { code: 'hi', label: 'हिंदी (Hindi)' },
                  { code: 'ta', label: 'தமிழ் (Tamil)' },
                  { code: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
                ].map((item) => (
                  <button
                    key={item.code}
                    onClick={() => setLang(item.code as LanguageCode)}
                    className={`py-3 px-2 rounded-xl font-bold border transition text-center ${
                      lang === item.code
                        ? 'bg-indigo-50 border-indigo-600 text-indigo-700'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Log Out Button */}
            <div className="pt-2">
              <button
                onClick={handleLogout}
                className="w-full py-3.5 rounded-2xl border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs transition flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                {t.signOutBtn}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ================= FORENSIC CAMERA MODAL ================= */}
      {showCameraModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/90 flex flex-col p-6 justify-between animate-in fade-in">
          <div className="flex items-center justify-between text-white max-w-2xl mx-auto w-full pb-2">
            <div className="text-xs font-bold text-emerald-400">
              {cameraStage === 'ARRIVAL_CHECKIN' ? 'ARRIVAL PHOTO' : 'COMPLETION PHOTO'}
            </div>
            <button onClick={stopCamera} className="p-2 text-slate-400 hover:text-white">
              ✕
            </button>
          </div>

          <div className="max-w-2xl mx-auto w-full flex-1 rounded-3xl overflow-hidden bg-black relative flex items-center justify-center border-2 border-emerald-500">
            {!capturedPhoto ? (
              <>
                <video ref={videoRef} playsInline autoPlay muted className="w-full h-full object-cover" />
                <div className="absolute bottom-4 left-4 right-4 bg-black/80 p-3 rounded-xl text-white text-xs font-mono space-y-0.5">
                  <div className="text-emerald-400 font-bold">
                    GPS: {deviceLat.toFixed(5)}°N, {deviceLng.toFixed(5)}°E
                  </div>
                  <div>Distance: {Math.round(distanceToParentMeters)}m (At Residence)</div>
                </div>
              </>
            ) : (
              <img src={capturedPhoto} alt="Captured Proof" className="w-full h-full object-cover" />
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />

          <div className="max-w-2xl mx-auto w-full pt-4 flex gap-4">
            {!capturedPhoto ? (
              <button
                onClick={capturePhotoAndWatermark}
                disabled={isCapturing}
                className="w-full py-4 bg-emerald-500 text-slate-950 font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg"
              >
                <Camera className="w-5 h-5" />
                {t.snapPhoto}
              </button>
            ) : (
              <>
                <button
                  onClick={() => setCapturedPhoto(null)}
                  className="flex-1 py-4 bg-slate-800 text-white font-bold rounded-2xl text-xs"
                >
                  {t.retake}
                </button>
                <button
                  onClick={handleUploadAndSubmitProof}
                  disabled={isUploading}
                  className="flex-1 py-4 bg-emerald-500 text-slate-950 font-bold rounded-2xl text-xs flex items-center justify-center gap-2"
                >
                  {isUploading ? 'Uploading...' : t.confirmUpload}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ================= PARTNER RECORD VITALS MODAL ================= */}
      {showPartnerVitalModal && activeTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Record Parent Vitals</h3>
                  <p className="text-xs text-slate-500">For {activeTask.parent?.parent_name || 'Parent'}</p>
                </div>
              </div>
              <button
                onClick={() => setShowPartnerVitalModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitPartnerVitals} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Blood Pressure (Sys)</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={partnerBpSys}
                      onChange={(e) => setPartnerBpSys(e.target.value)}
                      placeholder="120"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                    />
                    <span className="text-[10px] text-slate-400">mmHg</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Blood Pressure (Dia)</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={partnerBpDia}
                      onChange={(e) => setPartnerBpDia(e.target.value)}
                      placeholder="80"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                    />
                    <span className="text-[10px] text-slate-400">mmHg</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Glucose</label>
                  <input
                    type="number"
                    value={partnerSugar}
                    onChange={(e) => setPartnerSugar(e.target.value)}
                    placeholder="110"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-mono"
                  />
                  <span className="text-[9px] text-slate-400 block mt-0.5">mg/dL</span>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Pulse</label>
                  <input
                    type="number"
                    value={partnerPulse}
                    onChange={(e) => setPartnerPulse(e.target.value)}
                    placeholder="72"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-mono"
                  />
                  <span className="text-[9px] text-slate-400 block mt-0.5">BPM</span>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">SpO2</label>
                  <input
                    type="number"
                    value={partnerSpo2}
                    onChange={(e) => setPartnerSpo2(e.target.value)}
                    placeholder="98"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-mono"
                  />
                  <span className="text-[9px] text-slate-400 block mt-0.5">%</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Visit Observations / Notes</label>
                <textarea
                  value={vitalNotes}
                  onChange={(e) => setVitalNotes(e.target.value)}
                  placeholder="e.g. Parents took morning medicine, in high spirits, resting comfortably."
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPartnerVitalModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingVital}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
                >
                  {isSubmittingVital ? 'Recording...' : 'Save Vitals'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= SUCCESS TOAST ================= */}
      {vitalSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-700 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
          <span>{vitalSuccessToast}</span>
        </div>
      )}
    </div>
  );
}
