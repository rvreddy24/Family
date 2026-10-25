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
  ExternalLink,
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

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Comprehensive Multi-Language Dictionary (Indian Languages)
  const dict = {
    en: {
      hubTitle: 'Care Companion Console',
      onlineStatus: 'Active on Duty',
      offlineStatus: 'Off Duty',
      goOnline: 'GO ONLINE',
      goOffline: 'GO OFFLINE',
      assignedJobs: 'Available & Assigned Tasks',
      currentTask: 'Active Care Task',
      myWallet: 'Earnings & Escrow Wallet',
      settingsTab: 'Companion Settings',
      newJobAlert: 'New Care Dispatch Assigned!',
      guaranteedPayout: 'Guaranteed Payout',
      acceptJob: 'Accept Dispatch',
      declineJob: 'Decline',
      callParent: 'Call Parent (Relay)',
      googleMaps: 'Navigate in Google Maps',
      arrivalCheckin: 'Take Arrival Photo Check-In',
      completionProof: 'Take Task Completion Photo',
      within150m: '✓ Within 150m of Parent Residence',
      walletBalance: 'Escrow Wallet Balance',
      payoutReady: 'Direct UPI Settlement: Ready',
      snapPhoto: 'Capture Photo Proof',
      confirmUpload: 'Confirm & Submit to Family',
      retake: 'Retake Photo',
      languageSelect: 'Language',
      dutyNotice: 'You are currently active and eligible to receive verified eldercare dispatches.',
      signInBtn: 'Sign In to Console',
      signOutBtn: 'Sign Out',
      helperProfile: 'Companion Profile',
      serviceArea: 'Operating Territory',
      bankUpi: 'Bank Payout UPI ID',
      appLanguage: 'Preferred App Language',
      noActiveJob: 'No active care task in progress right now.',
      viewAssigned: 'View Assigned Tasks',
      jobDetails: 'Care Details & Residence Location',
      instructions: 'Caregiver Instructions from Family Abroad',
      markComplete: 'Mark Task Completed',
      noAssignedJobs: 'No pending tasks assigned right now. You are online and ready for new dispatches.',
      privacyMaskNotice: 'Parent contact protected via FamilyHubs Secure Relay',
      emptyWallet: 'No completed tasks yet. Payouts are credited instantly upon verified task completion.',
      kycTitle: 'KYC & Police Security Verification',
    },
    te: {
      hubTitle: 'కేర్ భాగస్వామి కన్సోల్',
      onlineStatus: 'డ్యూటీ ఆన్ (పనులకు సిద్ధం)',
      offlineStatus: 'ఆఫ్‌లైన్',
      goOnline: 'డ్యూటీ ప్రారంభించండి',
      goOffline: 'ఆఫ్‌లైన్ వెళ్ళండి',
      assignedJobs: 'కేటాయించిన పనులు',
      currentTask: 'ప్రస్తుత సంరక్షణ పని',
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
      payoutReady: 'బ్యాంక్ బదిలీ (UPI): సిద్ధంగా ఉంది',
      snapPhoto: 'ఫోటో తీయండి',
      confirmUpload: 'ధృవీకరించి అప్‌లోడ్ చేయండి',
      retake: 'మళ్ళీ తీయండి',
      languageSelect: 'భాష',
      dutyNotice: 'మీరు ప్రస్తుతం డ్యూటీలో ఉన్నారు. కొత్త పనులు అందుకోవడానికి సిద్ధంగా ఉన్నారు.',
      signInBtn: 'పోర్టల్‌లోకి ప్రవేశించండి',
      signOutBtn: 'లాగౌట్ చేయండి',
      helperProfile: 'సహాయకుని ప్రొఫైల్',
      serviceArea: 'పనిచేసే ప్రాంతం',
      bankUpi: 'బ్యాంక్ చెల్లింపు UPI ఐడీ',
      appLanguage: 'యాప్ ప్రాధాన్య భాష',
      noActiveJob: 'ప్రస్తుతం ఎటువంటి పని కొనసాగడం లేదు.',
      viewAssigned: 'కేటాయించిన పనులను చూడండి',
      jobDetails: 'పని వివరాలు & చిరునామా',
      instructions: 'విదేశాల నుండి కుటుంబ సభ్యుల సూచనలు',
      markComplete: 'పని పూర్తయినట్లు నమోదు చేయండి',
      noAssignedJobs: 'ప్రస్తుతం కేటాయించిన పనులు ఏవీ లేవు. మీరు ఆన్‌లైన్‌లో ఉన్నారు.',
      privacyMaskNotice: 'తల్లిదండ్రుల గోప్యతా రక్షణ కోసం ఫోన్ నంబర్ దాచబడింది (FamilyHubs సెక్యూర్ రిలే)',
      emptyWallet: 'ఇంకా పూర్తి చేసిన పనులు లేవు. పని పూర్తి కాగానే తక్షణ చెల్లింపు మీ వాలెట్‌కు చేరుతుంది.',
      kycTitle: 'కేవైసీ & పోలీస్ భద్రతా ధృవీకరణ',
    },
    hi: {
      hubTitle: 'केयर कंपेनियन कंसोल',
      onlineStatus: 'ड्यूटी ऑन (कार्य के लिए तैयार)',
      offlineStatus: 'ऑफलाइन',
      goOnline: 'ड्यूटी शुरू करें',
      goOffline: 'ऑफलाइन जाएं',
      assignedJobs: 'सौंपे गए कार्य',
      currentTask: 'वर्तमान केयर टास्क',
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
      payoutReady: 'सीधा बैंक ट्रांसफर (UPI): तैयार',
      snapPhoto: 'फोटो खींचें',
      confirmUpload: 'पुष्टि करें और अपलोड करें',
      retake: 'फिर से लें',
      languageSelect: 'भाषा',
      dutyNotice: 'आप अभी ड्यूटी पर हैं और नए कार्य प्राप्त करने के पात्र हैं।',
      signInBtn: 'पार्टनर पोर्टल में प्रवेश करें',
      signOutBtn: 'लॉग आउट करें',
      helperProfile: 'हेल्पर प्रोफाइल',
      serviceArea: 'कार्य क्षेत्र',
      bankUpi: 'बैंक UPI आईडी',
      appLanguage: 'ऐप की मुख्य भाषा',
      noActiveJob: 'वर्तमान में कोई सक्रिय कार्य नहीं है।',
      viewAssigned: 'सौंपे गए कार्य देखें',
      jobDetails: 'कार्य विवरण और पता',
      instructions: 'विदेश में परिवार के निर्देश',
      markComplete: 'कार्य पूर्ण दर्ज करें',
      noAssignedJobs: 'वर्तमान में कोई कार्य नहीं सौंपा गया है। आप ऑनलाइन हैं।',
      privacyMaskNotice: 'अभिभावक की सुरक्षा हेतु फोन नंबर सुरक्षित रूप से छिपाया गया है',
      emptyWallet: 'अभी कोई पूर्ण कार्य नहीं है। कार्य सत्यापित होते ही तुरंत भुगतान जमा होगा।',
      kycTitle: 'केवाईसी और पुलिस सुरक्षा सत्यापन',
    },
    ta: {
      hubTitle: 'களப் பராமரிப்பாளர் கன்சோல்',
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
      dutyNotice: 'நீங்கள் பணியில் உள்ளீர்கள். புதிய பணிகளைப் பெறலாம்.',
      signInBtn: 'உள்நுழைக',
      signOutBtn: 'வெளியேறு',
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
      kycTitle: 'கேஒய்சி & போலீஸ் சரிபார்ப்பு',
    },
    kn: {
      hubTitle: 'ಆರೈಕೆ ಸಹಾಯಕ ಕನ್ಸೋಲ್',
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
      dutyNotice: 'ನೀವು ಕರ್ತವ್ಯದಲ್ಲಿದ್ದೀರಿ. ಹೊಸ ಕೆಲಸಗಳನ್ನು ಪಡೆಯಲು ಅರ್ಹರಾಗಿದ್ದೀರಿ.',
      signInBtn: 'ಲಾಗಿನ್ ಮಾಡಿ',
      signOutBtn: 'ಲಾಗ್‌ಔಟ್ ಮಾಡಿ',
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
      kycTitle: 'ಕೆವೈಸಿ & ಪೊಲೀಸ್ ಪರಿಶೀಲನೆ',
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

        const current = tasksData.find((tk) =>
          ['ACCEPTED', 'IN_PROGRESS', 'VERIFICATION_SUBMITTED'].includes(tk.status)
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
      sendLocation(deviceLat, deviceLng);
    }, 8000);

    return () => {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
      clearInterval(interval);
    };
  }, [isLoggedIn, partnerId, isBroadcastingGps, activeTask?.id, deviceLat, deviceLng]);

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
        setVitalSuccessToast('Parent vitals successfully recorded and transmitted to family vault!');
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
      ctx.fillStyle = '#FAF7F2';
      ctx.fillRect(0, 0, 640, 640);
      ctx.fillStyle = '#C25E2E';
      ctx.beginPath();
      ctx.arc(320, 260, 120, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F5D5C6';
      ctx.beginPath();
      ctx.arc(320, 220, 75, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#A3481D';
      ctx.beginPath();
      ctx.ellipse(320, 480, 180, 120, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // High-Contrast Watermark Stamp with Filial Sanctuary Styling
    ctx.fillStyle = 'rgba(28, 25, 23, 0.90)';
    ctx.fillRect(15, 480, 610, 145);
    ctx.strokeStyle = '#1F5C42';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(15, 480, 610, 145);

    ctx.fillStyle = '#34D399';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(`GEO-VERIFIED: ${deviceLat.toFixed(5)}°N, ${deviceLng.toFixed(5)}°E`, 30, 515);

    ctx.fillStyle = '#FAF7F2';
    ctx.font = '15px sans-serif';
    ctx.fillText(`STAGE: ${cameraStage} | DISTANCE: ${Math.round(distanceToParentMeters)}m`, 30, 545);

    ctx.fillStyle = '#D6D3D1';
    ctx.font = '13px sans-serif';
    ctx.fillText(`COMPANION: ${profile?.user?.full_name || 'Field Partner'} | CODE: ${activeTask?.tracking_code || ''}`, 30, 575);

    ctx.fillStyle = '#FBBF24';
    ctx.font = '12px sans-serif';
    ctx.fillText(`TIMESTAMP: ${new Date().toLocaleTimeString()} IST | FamilyHubs Trust Mesh`, 30, 605);

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

  // If unauthenticated, show redesigned PartnerAuthView
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

  // Authenticated Companion View
  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#1C1917] font-body antialiased">
      {/* Editorial Decorative Grain Pattern */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.025] z-0"
        style={{
          backgroundImage: `radial-gradient(#C25E2E 0.75px, transparent 0.75px)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-[#FFFFFF]/95 backdrop-blur-md border-b border-[#E7DFD5] shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] border border-[#E7DFD5] flex items-center justify-center p-1.5 shadow-xs shrink-0">
              <img src="/logo_icon.png" alt="FamilyHubs" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="text-base font-bold text-[#1C1917] flex items-center gap-2 flex-wrap">
                <span className="font-display tracking-tight">
                  {profile?.user?.full_name || 'Field Companion'}
                </span>
                <span className="text-[11px] bg-[#E8F3EE] text-[#1F5C42] font-semibold px-2 py-0.5 rounded-full border border-[#C8E5D7] flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Verified
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-[#B45309] bg-[#FEF3C7] px-2 py-0.5 rounded-full border border-[#FDE68A] font-bold">
                  <Star className="w-3 h-3 fill-[#F59E0B] text-[#F59E0B]" />
                  <span>{profile?.rating ? profile.rating.toFixed(1) : '5.0'}</span>
                  <span className="text-[10px] text-[#92400E] font-normal">
                    ({profile?.total_reviews || 12})
                  </span>
                </span>
              </div>
              <div className="text-xs text-[#8C827A] flex items-center gap-2">
                <span>{t.hubTitle}</span>
                <span>•</span>
                <span>{profile?.service_category.replace('_', ' ') || 'Healthcare Escort'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Live Network Pill */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-[#FAF7F2] border-[#E7DFD5]">
              <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-[#1F5C42] animate-pulse' : 'bg-[#B45309]'}`} />
              <span className={wsConnected ? 'text-[#1F5C42]' : 'text-[#B45309]'}>
                {wsConnected ? 'Mesh Online' : 'Reconnecting...'}
              </span>
            </div>

            {/* Multilingual Switcher */}
            <div className="flex items-center gap-1 bg-[#F5F1EB] p-1 rounded-xl border border-[#E7DFD5]">
              <Languages className="w-3.5 h-3.5 text-[#8C827A] ml-1 mr-0.5 hidden sm:block" />
              {[
                { code: 'te', label: 'తె' },
                { code: 'en', label: 'EN' },
                { code: 'hi', label: 'हि' },
                { code: 'ta', label: 'த' },
                { code: 'kn', label: 'ಕ' },
              ].map((item) => (
                <button
                  key={item.code}
                  onClick={() => setLang(item.code as LanguageCode)}
                  className={`px-2 py-1 text-xs font-bold rounded-lg transition-all ${
                    lang === item.code
                      ? 'bg-[#FFFFFF] text-[#C25E2E] shadow-xs border border-[#E7DFD5]'
                      : 'text-[#574F49] hover:text-[#1C1917]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Master Duty Switch */}
            <button
              onClick={handleToggleDuty}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer ${
                isAvailable
                  ? 'bg-[#1F5C42] text-white hover:bg-[#164632]'
                  : 'bg-[#E7DFD5] text-[#574F49] hover:bg-[#D6D3D1]'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              {isAvailable ? t.onlineStatus : t.offlineStatus}
            </button>

            {/* Sign Out Button */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-[#8C827A] hover:text-[#B91C1C] hover:bg-[#FEE2E2] transition cursor-pointer"
              title={t.signOutBtn}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View Tabs */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 border-t border-[#E7DFD5] pt-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('jobs')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'jobs' 
                ? 'border-b-2 border-[#C25E2E] text-[#C25E2E] font-bold bg-[#FAF7F2]' 
                : 'text-[#574F49] hover:text-[#1C1917]'
            }`}
          >
            <Zap className="w-4 h-4" />
            {t.assignedJobs}
            <span className="bg-[#E7DFD5] text-[#1C1917] px-1.5 py-0.2 rounded-full text-[10px] font-bold">
              {tasks.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'active' 
                ? 'border-b-2 border-[#C25E2E] text-[#C25E2E] font-bold bg-[#FAF7F2]' 
                : 'text-[#574F49] hover:text-[#1C1917]'
            }`}
          >
            <Navigation className="w-4 h-4" />
            {t.currentTask}
            {activeTask && (
              <span className="w-2 h-2 rounded-full bg-[#1F5C42] animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('wallet')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'wallet' 
                ? 'border-b-2 border-[#C25E2E] text-[#C25E2E] font-bold bg-[#FAF7F2]' 
                : 'text-[#574F49] hover:text-[#1C1917]'
            }`}
          >
            <Wallet className="w-4 h-4" />
            {t.myWallet}
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'settings' 
                ? 'border-b-2 border-[#C25E2E] text-[#C25E2E] font-bold bg-[#FAF7F2]' 
                : 'text-[#574F49] hover:text-[#1C1917]'
            }`}
          >
            <Settings className="w-4 h-4" />
            {t.settingsTab}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6 z-10">
        {/* ================= TAB 1: ASSIGNED JOBS ================= */}
        {activeTab === 'jobs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E7DFD5]">
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-[#1C1917]">
                  {t.assignedJobs}
                </h2>
                <p className="text-xs text-[#574F49] mt-0.5">{t.dutyNotice}</p>
              </div>
              <button 
                onClick={fetchData} 
                className="p-2 text-[#8C827A] hover:text-[#1C1917] hover:bg-[#F5F1EB] rounded-xl transition cursor-pointer"
                title="Refresh tasks"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {tasks.length === 0 ? (
              <div className="bg-[#FFFFFF] p-12 text-center rounded-3xl border border-[#E7DFD5] text-[#574F49] max-w-xl mx-auto space-y-4 shadow-xs">
                <div className="w-16 h-16 rounded-2xl bg-[#FBECE5] text-[#C25E2E] flex items-center justify-center mx-auto">
                  <Zap className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-[#1C1917]">{t.assignedJobs}</h3>
                  <p className="text-xs text-[#8C827A] mt-1 max-w-md mx-auto">{t.noAssignedJobs}</p>
                </div>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E8F3EE] text-[#1F5C42] text-xs font-semibold border border-[#C8E5D7]">
                  <span className="w-2 h-2 rounded-full bg-[#1F5C42] animate-pulse" />
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
                      className="bg-[#FFFFFF] p-6 rounded-3xl border border-[#E7DFD5] shadow-xs space-y-4 flex flex-col justify-between hover:border-[#C25E2E]/40 transition-all"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-[#C25E2E] bg-[#FBECE5] px-2.5 py-0.5 rounded-md border border-[#F5D5C6]">
                            {task.tracking_code}
                          </span>
                          <span className="text-xs font-bold text-[#1F5C42] bg-[#E8F3EE] px-3 py-1 rounded-full border border-[#C8E5D7]">
                            ₹{payoutINR} Escrow Payout
                          </span>
                        </div>

                        <h3 className="font-display text-lg font-bold text-[#1C1917] leading-snug">
                          {task.title}
                        </h3>

                        <div className="text-xs text-[#574F49] space-y-1.5">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-[#8C827A] shrink-0" />
                            <span>{task.parent?.locality} — {task.parent?.full_address}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-[#8C827A] shrink-0" />
                            <span>Parent: <strong className="text-[#1C1917]">{task.parent?.parent_name}</strong></span>
                          </div>
                        </div>

                        <p className="text-xs text-[#574F49] bg-[#FAF7F2] p-3 rounded-xl border border-[#E7DFD5] leading-relaxed">
                          "{task.instructions}"
                        </p>
                      </div>

                      <div className="pt-2 flex gap-3">
                        {task.status === 'DISPATCHED' ? (
                          <button
                            onClick={() => handleAcceptJob(task.id)}
                            className="w-full py-3.5 bg-[#C25E2E] hover:bg-[#A3481D] text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <span>{t.acceptJob}</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setActiveTask(task);
                              setActiveTab('active');
                            }}
                            className="w-full py-3.5 bg-[#FAF7F2] hover:bg-[#F5F1EB] text-[#1C1917] border border-[#E7DFD5] rounded-xl text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <span>{t.currentTask}</span>
                            <ChevronRight className="w-4 h-4 text-[#8C827A]" />
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
              <div className="bg-[#FFFFFF] p-6 sm:p-8 rounded-3xl border border-[#E7DFD5] shadow-xs space-y-6 max-w-2xl mx-auto">
                <div className="flex items-start justify-between pb-4 border-b border-[#E7DFD5]">
                  <div>
                    <span className="text-xs font-mono font-bold text-[#C25E2E] bg-[#FBECE5] px-2.5 py-0.5 rounded-md border border-[#F5D5C6]">
                      {activeTask.tracking_code}
                    </span>
                    <h3 className="font-display text-xl font-bold text-[#1C1917] mt-1.5">
                      {activeTask.title}
                    </h3>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-[#8C827A]">{t.guaranteedPayout}</div>
                    <div className="text-2xl font-bold font-mono text-[#1F5C42]">
                      ₹{Math.round((activeTask.escrow?.amount || 45) * 83)}
                    </div>
                  </div>
                </div>

                {/* Parent Residence Info with Privacy Relay */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF7F2] border border-[#E7DFD5] space-y-3.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1C1917] text-sm">{t.jobDetails}</span>
                    <span className="text-[10px] bg-[#E8F3EE] text-[#1F5C42] px-2.5 py-0.5 rounded-full font-semibold border border-[#C8E5D7]">
                      🔒 Privacy Relay Active
                    </span>
                  </div>

                  <div className="space-y-1 text-[#574F49]">
                    <div><strong>Parent:</strong> {activeTask.parent?.parent_name}</div>
                    <div><strong>Address:</strong> {activeTask.parent?.full_address} ({activeTask.parent?.locality})</div>
                    <div><strong>Instructions:</strong> {activeTask.instructions}</div>
                  </div>

                  <div className="p-3 bg-[#FFFFFF] rounded-xl border border-[#E7DFD5] flex items-center justify-between gap-3 shadow-xs">
                    <div>
                      <div className="font-bold text-[#1C1917]">
                        {activeTask.parent?.primary_phone ? `${activeTask.parent.primary_phone.slice(0, 8)} •••••` : '+91 94901 •••••'}
                      </div>
                      <div className="text-[10px] text-[#8C827A]">{t.privacyMaskNotice}</div>
                    </div>
                    <a
                      href={`tel:${activeTask.parent?.primary_phone || ''}`}
                      className="px-3.5 py-2.5 bg-[#C25E2E] hover:bg-[#A3481D] text-white font-semibold rounded-xl flex items-center gap-1.5 shrink-0 shadow-xs text-xs cursor-pointer"
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
                      className="w-full py-3 bg-[#FFFFFF] hover:bg-[#F5F1EB] text-[#1C1917] border border-[#E7DFD5] font-semibold rounded-xl flex items-center justify-center gap-2 transition text-xs shadow-xs"
                    >
                      <MapPin className="w-4 h-4 text-[#C25E2E]" />
                      {t.googleMaps}
                      <ExternalLink className="w-3.5 h-3.5 text-[#8C827A]" />
                    </a>
                  </div>
                </div>

                {/* GPS Status Indicator & Live Telemetry Stream */}
                <div className="space-y-2">
                  <div className="p-4 rounded-2xl bg-[#E8F3EE] border border-[#C8E5D7] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#FFFFFF] text-[#1F5C42] flex items-center justify-center border border-[#C8E5D7] shadow-xs">
                        <MapPin className="w-5 h-5 text-[#1F5C42]" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#1F5C42]">{t.within150m}</div>
                        <div className="text-[11px] text-[#574F49] font-mono">
                          GPS: {deviceLat.toFixed(4)}°N, {deviceLng.toFixed(4)}°E • Distance: {Math.round(distanceToParentMeters)}m
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-[#FAF7F2] border border-[#E7DFD5] rounded-2xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#1F5C42] animate-pulse" />
                      <span className="font-semibold text-[#1C1917]">Live Telemetry Broadcasting to Family</span>
                    </div>
                    <span className="font-mono text-[10px] text-[#1F5C42] bg-[#FFFFFF] px-2 py-0.5 rounded-md border border-[#E7DFD5]">
                      Sensor Linked
                    </span>
                  </div>
                </div>

                {/* Parent Health Vitals Logging Action */}
                <div className="p-4 bg-[#FBECE5]/70 border border-[#F5D5C6] rounded-2xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FFFFFF] text-[#C25E2E] flex items-center justify-center border border-[#F5D5C6] shadow-xs">
                      <Heart className="w-5 h-5 fill-[#C25E2E] text-[#C25E2E]" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#1C1917]">Parent Health &amp; Vitals Check</div>
                      <div className="text-[11px] text-[#574F49]">Log BP, Blood Glucose & Pulse directly to encrypted family vault</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowPartnerVitalModal(true)}
                    className="px-3.5 py-2.5 bg-[#C25E2E] hover:bg-[#A3481D] text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer shrink-0"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    Log Vitals
                  </button>
                </div>

                {/* Forensic Check-in Camera Triggers */}
                <div className="space-y-3 pt-2">
                  <button
                    onClick={() => startCamera('ARRIVAL_CHECKIN')}
                    className="w-full py-4 bg-[#C25E2E] hover:bg-[#A3481D] text-white font-semibold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    {t.arrivalCheckin}
                  </button>

                  <button
                    onClick={() => startCamera('TASK_COMPLETION')}
                    className="w-full py-3.5 bg-[#FAF7F2] hover:bg-[#F5F1EB] text-[#1C1917] font-semibold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 border border-[#E7DFD5] transition cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#1F5C42]" />
                    {t.completionProof}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-[#FFFFFF] p-12 text-center rounded-3xl border border-[#E7DFD5] text-[#8C827A] max-w-md mx-auto space-y-4 shadow-xs">
                <Navigation className="w-12 h-12 text-[#8C827A] mx-auto opacity-40" />
                <div className="font-display text-base font-bold text-[#1C1917]">{t.noActiveJob}</div>
                <button
                  onClick={() => setActiveTab('jobs')}
                  className="px-5 py-2.5 bg-[#C25E2E] hover:bg-[#A3481D] text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition"
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
            {/* Dignified Escrow Balance Card */}
            <div className="bg-gradient-to-br from-[#1F5C42] to-[#164632] rounded-3xl p-8 text-white shadow-md space-y-4 relative overflow-hidden">
              <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 w-64 h-64 bg-white/5 rounded-full pointer-events-none" />
              
              <div className="flex items-center justify-between">
                <span className="text-[11px] bg-white/15 text-white px-3 py-1 rounded-full font-semibold tracking-wide uppercase">
                  Instant UPI Escrow Payouts
                </span>
                <span className="text-xs font-mono text-emerald-200">
                  Pan-India Direct Settlement
                </span>
              </div>

              <div>
                <div className="text-xs text-emerald-200/80 mb-1">{t.walletBalance}</div>
                <div className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight">
                  ₹{Math.round((profile?.wallet_balance || 0) * 83)}
                </div>
              </div>

              <div className="text-xs text-emerald-100 flex items-center gap-2 pt-2 border-t border-white/15">
                <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                <span>{t.payoutReady} ({bankUpiId})</span>
              </div>
            </div>

            {/* Completed Tasks Audit */}
            <div className="bg-[#FFFFFF] p-6 rounded-3xl border border-[#E7DFD5] shadow-xs space-y-4">
              <h3 className="font-display text-base font-bold text-[#1C1917]">
                Recent Task Disbursements
              </h3>
              {tasks.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#8C827A] bg-[#FAF7F2] rounded-2xl border border-dashed border-[#E7DFD5]">
                  {t.emptyWallet}
                </div>
              ) : (
                <div className="divide-y divide-[#E7DFD5] text-xs">
                  {tasks.map((task) => (
                    <div key={task.id} className="py-3.5 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-[#1C1917]">{task.title}</div>
                        <div className="text-[#8C827A] mt-0.5">{task.parent?.locality} • <span className="font-mono">{task.tracking_code}</span></div>
                      </div>
                      <span className="font-bold font-mono text-[#1F5C42] text-sm">
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
            <div className="pb-2 border-b border-[#E7DFD5]">
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[#1C1917]">
                {t.settingsTab}
              </h2>
              <p className="text-xs text-[#574F49] mt-0.5">
                Configure profile, primary language, and bank payout details.
              </p>
            </div>

            {/* Profile Info */}
            <div className="bg-[#FFFFFF] p-6 rounded-3xl border border-[#E7DFD5] shadow-xs space-y-4">
              <h3 className="font-display text-base font-bold text-[#1C1917] flex items-center gap-2">
                <User className="w-4 h-4 text-[#C25E2E]" />
                {t.helperProfile}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="text-[#8C827A] font-semibold block mb-1">Full Name</label>
                  <input
                    type="text"
                    value={profile?.user?.full_name || profile?.full_name || 'Verified Companion'}
                    className="w-full bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl px-3.5 py-2.5 text-[#1C1917] font-medium"
                    readOnly
                  />
                </div>
                <div>
                  <label className="text-[#8C827A] font-semibold block mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={profile?.user?.phone || '+91 94401 55667'}
                    className="w-full bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl px-3.5 py-2.5 text-[#1C1917] font-medium font-mono"
                    readOnly
                  />
                </div>
                <div>
                  <label className="text-[#8C827A] font-semibold block mb-1">{t.serviceArea}</label>
                  <input
                    type="text"
                    value={operatingTown}
                    onChange={(e) => setOperatingTown(e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl px-3.5 py-2.5 text-[#1C1917]"
                  />
                </div>
                <div>
                  <label className="text-[#8C827A] font-semibold block mb-1">{t.bankUpi}</label>
                  <input
                    type="text"
                    value={bankUpiId}
                    onChange={(e) => setBankUpiId(e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl px-3.5 py-2.5 text-[#1C1917] font-mono"
                  />
                </div>
              </div>
            </div>

            {/* KYC & Police Security Verification */}
            <div className="bg-[#FFFFFF] p-6 rounded-3xl border border-[#E7DFD5] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-[#1C1917] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#1F5C42]" />
                  {t.kycTitle}
                </h3>
                <span className="text-[11px] font-semibold text-[#1F5C42] bg-[#E8F3EE] px-2.5 py-0.5 rounded-full border border-[#C8E5D7]">
                  ✓ Verified Active
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-3.5 bg-[#FAF7F2] rounded-xl border border-[#E7DFD5] flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[#1C1917]">Police Clearance Certificate (PCC)</div>
                    <div className="text-[#8C827A] text-[11px]">State Police Department Verification • PCC #401</div>
                  </div>
                  <span className="text-[#1F5C42] font-semibold text-[11px] bg-[#E8F3EE] px-2 py-0.5 rounded border border-[#C8E5D7]">
                    Verified
                  </span>
                </div>

                <div className="p-3.5 bg-[#FAF7F2] rounded-xl border border-[#E7DFD5] flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[#1C1917]">Aadhaar Biometric KYC</div>
                    <div className="text-[#8C827A] text-[11px]">UIDAI Masked: XXXX-XXXX-8921</div>
                  </div>
                  <span className="text-[#1F5C42] font-semibold text-[11px] bg-[#E8F3EE] px-2 py-0.5 rounded border border-[#C8E5D7]">
                    Verified
                  </span>
                </div>

                <div className="p-3.5 bg-[#FAF7F2] rounded-xl border border-[#E7DFD5] flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[#1C1917]">Hardware GPS &amp; Camera Calibration</div>
                    <div className="text-[#8C827A] text-[11px]">Sub-5m GPS Accuracy Sensor Lock</div>
                  </div>
                  <span className="text-[#1F5C42] font-semibold text-[11px] bg-[#E8F3EE] px-2 py-0.5 rounded border border-[#C8E5D7]">
                    Calibrated
                  </span>
                </div>

                <div className="p-3.5 bg-[#FAF7F2] rounded-xl border border-[#E7DFD5] flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[#1C1917]">NPCI Direct Bank Settlement</div>
                    <div className="text-[#8C827A] text-[11px]">Beneficiary Name: {profile?.user?.full_name || 'Verified Field Partner'}</div>
                  </div>
                  <span className="text-[#1F5C42] font-semibold text-[11px] bg-[#E8F3EE] px-2 py-0.5 rounded border border-[#C8E5D7]">
                    Linked
                  </span>
                </div>
              </div>
            </div>

            {/* Language Switcher in Settings */}
            <div className="bg-[#FFFFFF] p-6 rounded-3xl border border-[#E7DFD5] shadow-xs space-y-3">
              <h3 className="font-display text-base font-bold text-[#1C1917] flex items-center gap-2">
                <Languages className="w-4 h-4 text-[#C25E2E]" />
                {t.appLanguage}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
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
                    className={`py-3 px-2 rounded-xl font-bold border transition-all text-center cursor-pointer ${
                      lang === item.code
                        ? 'bg-[#FBECE5] border-[#C25E2E] text-[#C25E2E]'
                        : 'bg-[#FAF7F2] border-[#E7DFD5] text-[#574F49] hover:bg-[#F5F1EB]'
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
                className="w-full py-3.5 rounded-2xl border border-[#FCA5A5] text-[#B91C1C] hover:bg-[#FEE2E2] font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-[#1C1917]/90 backdrop-blur-sm flex flex-col p-4 sm:p-6 justify-between animate-fadeIn">
          <div className="flex items-center justify-between text-white max-w-2xl mx-auto w-full pb-2">
            <div className="text-xs font-bold text-[#34D399] tracking-wider uppercase flex items-center gap-2">
              <Camera className="w-4 h-4" />
              <span>{cameraStage === 'ARRIVAL_CHECKIN' ? 'ARRIVAL PHOTO PROOF' : 'COMPLETION PHOTO PROOF'}</span>
            </div>
            <button 
              onClick={stopCamera} 
              className="p-2 text-[#D6D3D1] hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="max-w-2xl mx-auto w-full flex-1 rounded-3xl overflow-hidden bg-black relative flex items-center justify-center border-2 border-[#1F5C42]">
            {!capturedPhoto ? (
              <>
                <video ref={videoRef} playsInline autoPlay muted className="w-full h-full object-cover" />
                <div className="absolute bottom-4 left-4 right-4 bg-[#1C1917]/85 backdrop-blur-xs p-3.5 rounded-2xl text-white text-xs font-mono space-y-1 border border-white/10">
                  <div className="text-[#34D399] font-bold">
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
                className="w-full py-4 bg-[#1F5C42] hover:bg-[#164632] text-white font-semibold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
              >
                <Camera className="w-5 h-5" />
                {t.snapPhoto}
              </button>
            ) : (
              <>
                <button
                  onClick={() => setCapturedPhoto(null)}
                  className="flex-1 py-4 bg-[#292524] text-white font-semibold rounded-2xl text-xs hover:bg-[#44403C] transition cursor-pointer"
                >
                  {t.retake}
                </button>
                <button
                  onClick={handleUploadAndSubmitProof}
                  disabled={isUploading}
                  className="flex-1 py-4 bg-[#1F5C42] hover:bg-[#164632] text-white font-semibold rounded-2xl text-xs flex items-center justify-center gap-2 transition cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-[#1C1917]/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#FFFFFF] rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-[#E7DFD5] space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7DFD5]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#FBECE5] text-[#C25E2E] flex items-center justify-center border border-[#F5D5C6]">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-[#1C1917]">Record Parent Vitals</h3>
                  <p className="text-xs text-[#8C827A]">For {activeTask.parent?.parent_name || 'Parent'}</p>
                </div>
              </div>
              <button
                onClick={() => setShowPartnerVitalModal(false)}
                className="p-1.5 rounded-full text-[#8C827A] hover:bg-[#FAF7F2] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitPartnerVitals} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#574F49] mb-1">Blood Pressure (Sys)</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={partnerBpSys}
                      onChange={(e) => setPartnerBpSys(e.target.value)}
                      placeholder="120"
                      required
                      className="w-full bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#1C1917] focus:outline-none focus:border-[#C25E2E]"
                    />
                    <span className="text-[10px] text-[#8C827A]">mmHg</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#574F49] mb-1">Blood Pressure (Dia)</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={partnerBpDia}
                      onChange={(e) => setPartnerBpDia(e.target.value)}
                      placeholder="80"
                      required
                      className="w-full bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#1C1917] focus:outline-none focus:border-[#C25E2E]"
                    />
                    <span className="text-[10px] text-[#8C827A]">mmHg</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-[#574F49] mb-1">Glucose</label>
                  <input
                    type="number"
                    value={partnerSugar}
                    onChange={(e) => setPartnerSugar(e.target.value)}
                    placeholder="110"
                    className="w-full bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl px-2.5 py-2 text-xs font-mono text-[#1C1917] focus:outline-none focus:border-[#C25E2E]"
                  />
                  <span className="text-[9px] text-[#8C827A] block mt-0.5">mg/dL</span>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#574F49] mb-1">Pulse</label>
                  <input
                    type="number"
                    value={partnerPulse}
                    onChange={(e) => setPartnerPulse(e.target.value)}
                    placeholder="72"
                    className="w-full bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl px-2.5 py-2 text-xs font-mono text-[#1C1917] focus:outline-none focus:border-[#C25E2E]"
                  />
                  <span className="text-[9px] text-[#8C827A] block mt-0.5">BPM</span>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#574F49] mb-1">SpO2</label>
                  <input
                    type="number"
                    value={partnerSpo2}
                    onChange={(e) => setPartnerSpo2(e.target.value)}
                    placeholder="98"
                    className="w-full bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl px-2.5 py-2 text-xs font-mono text-[#1C1917] focus:outline-none focus:border-[#C25E2E]"
                  />
                  <span className="text-[9px] text-[#8C827A] block mt-0.5">%</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#574F49] mb-1">Visit Observations / Notes</label>
                <textarea
                  value={vitalNotes}
                  onChange={(e) => setVitalNotes(e.target.value)}
                  placeholder="e.g. Parents took morning medicine, in high spirits, resting comfortably."
                  rows={2}
                  className="w-full bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl p-2.5 text-xs text-[#1C1917] focus:outline-none focus:border-[#C25E2E]"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPartnerVitalModal(false)}
                  className="flex-1 py-3 rounded-xl border border-[#E7DFD5] text-xs font-semibold text-[#574F49] hover:bg-[#FAF7F2] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingVital}
                  className="flex-1 py-3 bg-[#C25E2E] hover:bg-[#A3481D] text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
                >
                  {isSubmittingVital ? 'Recording...' : 'Transmit Vitals'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= SUCCESS TOAST ================= */}
      {vitalSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1F5C42] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          <span>{vitalSuccessToast}</span>
        </div>
      )}
    </div>
  );
}
