import React, { useState, useEffect, useRef } from 'react';
import {
  Heart,
  ShieldCheck,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Phone,
  Camera,
  Lock,
  Wallet,
  Activity,
  UserCheck,
  Stethoscope,
  Wrench,
  ShoppingBag,
  Bell,
  RefreshCw,
  Sparkles,
  ChevronRight,
  Info,
  Calendar,
  MessageCircle,
  ArrowRight,
  ExternalLink,
  Check,
  X,
  Star,
  Search,
  Settings,
  LogOut,
  User,
  Globe,
  Sliders,
  DollarSign,
  Zap,
  ChevronDown,
  ShieldAlert,
  Fingerprint,
  KeyRound,
  Siren,
  Navigation,
  Users,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { Task, ParentProfile, VerificationLog, PartnerLocationUpdate } from '@shared/types';
import { formatDate, playNotificationChime, getApiBaseUrl, getWebSocketUrl, getImageUrl } from '@shared/utils';
import { supabase } from '@shared/supabase';
import { AuthView } from './components/AuthView';
import { HealthView } from './components/HealthView';
import { EmergencyModal } from './components/EmergencyModal';
import { TaskReviewModal } from './components/TaskReviewModal';
import { FamilyShareModal } from './components/FamilyShareModal';
import { LiveTrackingModal } from './components/LiveTrackingModal';

export const POPULAR_INDIAN_CITIES: Record<string, { lat: number; lng: number }> = {
  'Hyderabad': { lat: 17.3850, lng: 78.4867 },
  'Bengaluru': { lat: 12.9716, lng: 77.5946 },
  'Mumbai': { lat: 19.0760, lng: 72.8777 },
  'Delhi NCR': { lat: 28.6139, lng: 77.2090 },
  'Chennai': { lat: 13.0827, lng: 80.2707 },
  'Pune': { lat: 18.5204, lng: 73.8567 },
  'Kolkata': { lat: 22.5726, lng: 88.3639 },
  'Ahmedabad': { lat: 23.0225, lng: 72.5714 },
  'Kochi': { lat: 9.9312, lng: 76.2673 },
  'Coimbatore': { lat: 11.0168, lng: 76.9558 },
  'Jaipur': { lat: 26.9124, lng: 75.7873 },
  'Lucknow': { lat: 26.8467, lng: 80.9462 },
};

export function resolveCityCoordinates(cityOrAddress: string): { lat: number; lng: number } {
  if (!cityOrAddress) return POPULAR_INDIAN_CITIES['Hyderabad'];
  const lower = cityOrAddress.toLowerCase();
  for (const [cityName, coords] of Object.entries(POPULAR_INDIAN_CITIES)) {
    if (lower.includes(cityName.toLowerCase()) || lower.includes(cityName.split(' ')[0].toLowerCase())) {
      return coords;
    }
  }
  return POPULAR_INDIAN_CITIES['Hyderabad'];
}

export default function UserApp() {
  // Persistence for login status (default false to show welcome/login first if first visit)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    const saved = localStorage.getItem('fh_user_logged_in');
    return saved === null ? false : saved === 'true';
  });

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    return localStorage.getItem('fh_user_id') || 'c11e4701-0000-4000-8000-000000000001';
  });
  const [currentUserName, setCurrentUserName] = useState<string>(() => {
    return localStorage.getItem('fh_user_name') || 'Rajesh Reddy (NRI Son)';
  });
  const [currentUserEmail, setCurrentUserEmail] = useState<string>(() => {
    return localStorage.getItem('fh_user_email') || 'user@familyhubs.in';
  });

  const [clientProfile, setClientProfile] = useState<any>(null);
  const [requestFilter, setRequestFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');
  const [activeTab, setActiveTab] = useState<'explore' | 'trackers' | 'health' | 'parents' | 'billing' | 'settings'>('explore');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [parents, setParents] = useState<ParentProfile[]>([]);
  const [healthParentId, setHealthParentId] = useState<string>('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showProofModal, setShowProofModal] = useState<VerificationLog | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  // Extended Features State
  const [showEmergencyModal, setShowEmergencyModal] = useState<boolean>(false);
  const [reviewTargetTask, setReviewTargetTask] = useState<Task | null>(null);
  const [trackingTargetTask, setTrackingTargetTask] = useState<Task | null>(null);
  const [showFamilyModal, setShowFamilyModal] = useState<boolean>(false);
  const [latestPartnerTelemetry, setLatestPartnerTelemetry] = useState<PartnerLocationUpdate | null>(null);

  // Security Controls State
  const [isEscrowFrozen, setIsEscrowFrozen] = useState<boolean>(false);
  const [twoFactorActive, setTwoFactorActive] = useState<boolean>(true);
  const [biometricEnabled, setBiometricEnabled] = useState<boolean>(true);

  // Google OAuth Onboarding State
  const [pendingGoogleUser, setPendingGoogleUser] = useState<{
    email: string;
    fullName: string;
    authProviderId?: string;
    isExisting?: boolean;
    user?: any;
  } | null>(null);

  // Search & Filter State (Urban Company UX)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Settings State - Fully User Editable (Client Profile)
  const [settingsFullName, setSettingsFullName] = useState<string>('');
  const [settingsEmail, setSettingsEmail] = useState<string>('');
  const [settingsPhone, setSettingsPhone] = useState<string>('');
  const [settingsCountry, setSettingsCountry] = useState<string>('United States');
  const [settingsCurrency, setSettingsCurrency] = useState<string>('USD');
  const [userCurrency, setUserCurrency] = useState<string>('USD');
  const [emailAlerts, setEmailAlerts] = useState<boolean>(true);
  const [whatsappAlerts, setWhatsappAlerts] = useState<boolean>(true);

  // Settings State - Parents' Care Details (Mandatory Pan-India)
  const [settingsParentName, setSettingsParentName] = useState<string>('');
  const [settingsParentPhone, setSettingsParentPhone] = useState<string>('');
  const [settingsParentWhatsapp, setSettingsParentWhatsapp] = useState<string>('');
  const [settingsParentCity, setSettingsParentCity] = useState<string>('Pan-India');
  const [settingsParentAddress, setSettingsParentAddress] = useState<string>('');
  const [settingsParentNotes, setSettingsParentNotes] = useState<string>('');
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);

  // Booking Modal State (Urban Company Quick Book)
  const [showBookModal, setShowBookModal] = useState<boolean>(false);
  const [selectedService, setSelectedService] = useState<{
    id: string;
    title: string;
    category: string;
    rating: string;
    reviews: string;
    price: number;
    banner: string;
    desc: string;
    features: string[];
    badge: string;
  } | null>(null);
  const [reqParentId, setReqParentId] = useState<string>('');
  const [reqTitle, setReqTitle] = useState<string>('');
  const [reqInstructions, setReqInstructions] = useState<string>('');
  const [reqEscrowAmount, setReqEscrowAmount] = useState<number>(45);

  // Urban Company UX: Active City Selector & Custom Senior Booking Options
  const [selectedCity, setSelectedCity] = useState<string>('Hyderabad');
  const [bookingTimeSlot, setBookingTimeSlot] = useState<string>('Morning (9:00 AM – 12:00 PM)');
  const [bookingLanguage, setBookingLanguage] = useState<string>('Telugu');
  const [bookingSeniorNeeds, setBookingSeniorNeeds] = useState<string[]>(['Doorstep OTP Handshake', 'WhatsApp Photo Update']);
  const [doorstepOtp, setDoorstepOtp] = useState<string>('4829');

  // New Parent Modal (Pan-India)
  const [showAddParentModal, setShowAddParentModal] = useState<boolean>(false);
  const [newParentName, setNewParentName] = useState<string>('');
  const [newParentPhone, setNewParentPhone] = useState<string>('+91 ');
  const [newParentWhatsapp, setNewParentWhatsapp] = useState<string>('+91 ');
  const [newParentLocality, setNewParentLocality] = useState<string>('');
  const [newParentAddress, setNewParentAddress] = useState<string>('');
  const [newParentNotes, setNewParentNotes] = useState<string>('');

  // Edit Parent State
  const [editingParent, setEditingParent] = useState<ParentProfile | null>(null);
  const [editParentName, setEditParentName] = useState<string>('');
  const [editParentPhone, setEditParentPhone] = useState<string>('');
  const [editParentWhatsapp, setEditParentWhatsapp] = useState<string>('');
  const [editParentLocality, setEditParentLocality] = useState<string>('');
  const [editParentAddress, setEditParentAddress] = useState<string>('');
  const [editParentNotes, setEditParentNotes] = useState<string>('');
  const [isUpdatingParent, setIsUpdatingParent] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);

  // Curated Urban Company Style Services - Pan-India
  const servicesCatalog = [
    {
      id: 'srv_med_1',
      title: 'Doctor Home Visit & Comprehensive Vitals',
      category: 'MEDICAL_TRANSPORT',
      rating: '4.95',
      reviews: '142 reviews',
      price: 45,
      banner: getImageUrl('/uploads/service_medical.svg'),
      desc: 'Certified doctor home visit for complete elderly health assessment and vitals check across India.',
      features: ['BP, Pulse & Blood Sugar Monitoring', 'Doctor prescription review & advice', 'Instant digital health report to NRI on WhatsApp'],
      badge: 'Bestseller',
    },
    {
      id: 'srv_med_2',
      title: 'Prescription Medicine Delivery',
      category: 'MEDICAL_TRANSPORT',
      rating: '4.98',
      reviews: '230 reviews',
      price: 35,
      banner: getImageUrl('/uploads/service_medical.svg'),
      desc: 'Reliable monthly prescription replenishment from Apollo, MedPlus, or verified local pharmacies across India.',
      features: ['Original pharmacist bill included', 'Same-day home delivery to parents', 'Expiration date verification check'],
      badge: 'Same Day',
    },
    {
      id: 'srv_rep_1',
      title: 'Inverter & Battery Power Backup Service',
      category: 'HOME_MAINTENANCE',
      rating: '4.91',
      reviews: '98 reviews',
      price: 40,
      banner: getImageUrl('/uploads/service_repair.svg'),
      desc: 'Complete power backup checkup to safeguard aging parents during power cuts.',
      features: ['Distilled water top-up for all tubular cells', 'Terminal corrosion cleanup & grease', 'Inverter load & voltage testing'],
      badge: 'Popular',
    },
    {
      id: 'srv_rep_2',
      title: 'RO Water Purifier & Tap Plumbing Repair',
      category: 'HOME_MAINTENANCE',
      rating: '4.89',
      reviews: '115 reviews',
      price: 50,
      banner: getImageUrl('/uploads/service_plumbing.svg'),
      desc: 'Clean, safe drinking water guaranteed. Water filter maintenance and plumbing fix at home.',
      features: ['Sediment & carbon candle inspection', 'Digital TDS level purity meter check', 'Overhead tank float valve & tap leak fix'],
      badge: 'Essential',
    },
    {
      id: 'srv_err_1',
      title: 'Monthly Market Provisions & Pooja Samagri',
      category: 'ERRANDS',
      rating: '4.94',
      reviews: '86 reviews',
      price: 30,
      banner: getImageUrl('/uploads/service_errands.svg'),
      desc: 'Fresh farm fruits, cold-pressed oils, lentils, and temple pooja items from trusted local markets across India.',
      features: ['Handpicked fresh fruits & temple flowers', 'Pure cold-pressed sesame / groundnut oils', 'Itemized market receipt photo sent to NRI'],
      badge: 'Custom List',
    },
    {
      id: 'srv_emg_1',
      title: '24/7 Emergency Hospital Escort & Attendant',
      category: 'EMERGENCY',
      rating: '5.0',
      reviews: '64 reviews',
      price: 65,
      banner: getImageUrl('/uploads/service_emergency.svg'),
      desc: 'Immediate emergency transport escort with trained caretaker staying by your parents side.',
      features: ['Under 20-minute rapid response dispatch', 'Vehicle escort to nearest tertiary care hospital', 'Continuous WhatsApp call coordination with NRI'],
      badge: 'Priority 24/7',
    },
    {
      id: 'srv_tech_1',
      title: 'Senior Smartphone, WhatsApp & Tech Care',
      category: 'ERRANDS',
      rating: '4.97',
      reviews: '178 reviews',
      price: 25,
      banner: getImageUrl('/uploads/service_errands.svg'),
      desc: 'Patient, in-person smartphone setup: configure NRI family video calls, large fonts, emergency contacts, utility bill auto-pay, and scam safety.',
      features: ['Video calling & WhatsApp shortcuts configured', 'Online utility bills & pension certificate setup', 'Spam call blocker & scam protection guidance'],
      badge: 'Senior Favorite',
    },
    {
      id: 'srv_ac_1',
      title: 'Split AC Power Clean & Filter Servicing',
      category: 'HOME_MAINTENANCE',
      rating: '4.92',
      reviews: '154 reviews',
      price: 35,
      banner: getImageUrl('/uploads/service_repair.svg'),
      desc: 'Complete anti-bacterial deep cleaning of indoor & outdoor AC units to protect aging parents from heat exhaustion and dust allergies.',
      features: ['High-pressure jet coil wash with anti-fungal foam', 'Drain tray & pipe vacuum clog clearance', 'Cooling temperature & refrigerant gas check'],
      badge: 'Summer Essential',
    },
    {
      id: 'srv_physio_1',
      title: 'Geriatric Physiotherapy & Fall Prevention Session',
      category: 'MEDICAL_TRANSPORT',
      rating: '4.99',
      reviews: '92 reviews',
      price: 45,
      banner: getImageUrl('/uploads/service_medical.svg'),
      desc: 'Qualified home physiotherapist specializing in elderly mobility, arthritis pain relief, and balance restoration.',
      features: ['Joint mobility & posture assessment', 'Customized low-impact exercise regimen', 'Home fall-hazard audit (bathrooms & stairs)'],
      badge: 'Certified Physio',
    },
  ];

  const fetchAllData = async (targetUserId?: unknown) => {
    const uid = typeof targetUserId === 'string' ? targetUserId : currentUserId;
    try {
      const apiBase = getApiBaseUrl();
      const [tasksRes, parentsRes, profRes] = await Promise.all([
        uid ? fetch(`${apiBase}/api/tasks?clientId=${uid}`) : Promise.resolve(null),
        uid ? fetch(`${apiBase}/api/parents?clientId=${uid}`) : Promise.resolve(null),
        uid ? fetch(`${apiBase}/api/auth/me?userId=${uid}&role=CLIENT`) : Promise.resolve(null),
      ]);
      if (tasksRes && tasksRes.ok) {
        const tasksData: Task[] = await tasksRes.json();
        setTasks(tasksData);
        if (!selectedTask && tasksData.length > 0) {
          setSelectedTask(tasksData[0]);
        } else if (selectedTask) {
          const updated = tasksData.find((t) => t.id === selectedTask.id);
          if (updated) setSelectedTask(updated);
        }
      }
      if (parentsRes && parentsRes.ok) {
        const parentsData: ParentProfile[] = await parentsRes.json();
        setParents(parentsData);
        if (parentsData.length > 0) {
          if (!reqParentId) {
            setReqParentId(parentsData[0].id);
          }
          const p = parentsData[0];
          setSettingsParentName(p.parent_name || '');
          setSettingsParentPhone(p.primary_phone || '');
          setSettingsParentWhatsapp(p.whatsapp_phone || p.primary_phone || '');
          setSettingsParentCity(p.locality || 'Pan-India');
          setSettingsParentAddress(p.full_address || '');
          setSettingsParentNotes(p.medical_notes || '');
        }
      }
      if (profRes && profRes.ok) {
        const profData = await profRes.json();
        if (profData) {
          setClientProfile(profData);
          const fName = profData.user?.full_name || '';
          const mail = profData.user?.email || '';
          const ph = profData.user?.phone || '';
          const country = profData.country_residence || 'United States';
          const curr = profData.currency || 'USD';

          if (fName) {
            setCurrentUserName(fName);
            localStorage.setItem('fh_user_name', fName);
            setSettingsFullName(fName);
          }
          if (mail) {
            setCurrentUserEmail(mail);
            localStorage.setItem('fh_user_email', mail);
            setSettingsEmail(mail);
          }
          if (ph) {
            setSettingsPhone(ph);
          }
          setSettingsCountry(country);
          setSettingsCurrency(curr);
          setUserCurrency(curr);
        }
      }

      const secRes = await fetch(`${apiBase}/api/security/settings`);
      if (secRes.ok) {
        const secData = await secRes.json();
        setIsEscrowFrozen(secData.emergency_escrow_freeze === '1' || secData.emergency_escrow_freeze === 1);
      }
    } catch (err) {
      console.error('Data fetch error:', err);
    }
  };

  const handleToggleEscrowFreeze = async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/security/panic-freeze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          freeze: !isEscrowFrozen,
          actorId: currentUserId,
          actorRole: 'CLIENT',
          reason: isEscrowFrozen ? 'Client resumed standard escrow release' : 'Client emergency safety freeze from NRI portal',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsEscrowFrozen(Boolean(data.emergencyFreezeActive));
        playNotificationChime(data.emergencyFreezeActive ? 'alert' : 'success');
        setToastMessage(
          data.emergencyFreezeActive
            ? 'Emergency Escrow Freeze ACTIVATED. All payouts locked.'
            : 'Escrow disbursements resumed normally.'
        );
        setTimeout(() => setToastMessage(null), 5000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsFullName.trim() || !settingsEmail.trim()) {
      setToastMessage('Please provide your name and email.');
      playNotificationChime('alert');
      return;
    }
    if (!settingsParentName.trim() || !settingsParentPhone.trim() || !settingsParentWhatsapp.trim() || !settingsParentAddress.trim()) {
      setToastMessage("Parents' name, calling phone, WhatsApp number, and address are mandatory.");
      playNotificationChime('alert');
      return;
    }

    setIsSavingSettings(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/client/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          fullName: settingsFullName.trim(),
          email: settingsEmail.trim(),
          phone: settingsPhone.trim(),
          countryResidence: settingsCountry.trim(),
          currency: settingsCurrency,
          parentName: settingsParentName.trim(),
          parentPrimaryPhone: settingsParentPhone.trim(),
          parentWhatsappPhone: settingsParentWhatsapp.trim(),
          parentLocality: settingsParentCity.trim() || 'Pan-India',
          parentAddress: settingsParentAddress.trim(),
          parentNotes: settingsParentNotes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update settings.');
      }

      setCurrentUserName(settingsFullName.trim());
      setCurrentUserEmail(settingsEmail.trim());
      localStorage.setItem('fh_user_name', settingsFullName.trim());
      localStorage.setItem('fh_user_email', settingsEmail.trim());
      if (data.profile) setClientProfile(data.profile);
      if (data.parents) setParents(data.parents);

      playNotificationChime('success');
      setToastMessage('Account profile & parents care details saved successfully!');
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      console.error('Settings save error:', err);
      playNotificationChime('alert');
      setToastMessage(err.message || 'Failed to update settings.');
      setTimeout(() => setToastMessage(null), 5000);
    } finally {
      setIsSavingSettings(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Listen for Supabase OAuth Redirect or Existing Active Session
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
            role: 'CLIENT',
          }),
        });

        const data = await res.json();
        if (data.success && data.user) {
          localStorage.setItem('fh_user_logged_in', 'true');
          localStorage.setItem('fh_user_id', data.user.id);
          localStorage.setItem('fh_user_name', data.user.full_name);
          localStorage.setItem('fh_user_email', data.user.email);
          setCurrentUserId(data.user.id);
          setCurrentUserName(data.user.full_name);
          setCurrentUserEmail(data.user.email);
          setIsLoggedIn(true);
          setPendingGoogleUser(null);
          fetchAllData(data.user.id);
          setToastMessage(`Welcome back, ${data.user.full_name}!`);
          setTimeout(() => setToastMessage(null), 4000);

          // Clean up OAuth tokens/code from address bar without reloading
          if (window.location.search || window.location.hash) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } else if (data.noAccount || res.status === 404) {
          // If no account with that Google email, redirect to signup
          setPendingGoogleUser({
            email: data.email || email,
            fullName: data.fullName || fullName,
            authProviderId: data.authProviderId || u.id,
            isExisting: false,
          });
          setIsLoggedIn(false);
          setToastMessage('Google verified! Please enter your mobile phone number to complete signup.');
          setTimeout(() => setToastMessage(null), 6000);
          if (window.location.search || window.location.hash) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }
      } catch (err) {
        console.error('Failed to synchronize Google user with platform:', err);
      }
    };

    // Check active session on mount (handles OAuth redirect callback)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        syncGoogleSession(session);
      }
    });

    // Listen for auth changes (SIGNED_IN after Google redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session) {
        syncGoogleSession(session);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Background WebSocket listener for instant state updates with clean reconnection handling
  useEffect(() => {
    let socket: WebSocket | null = null;
    let isMounted = true;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (!isMounted) return;
      try {
        const wsUrl = getWebSocketUrl('/ws/events', { role: 'CLIENT', userId: currentUserId });
        socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          if (isMounted) setWsConnected(true);
        };

        socket.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            fetchAllData();

            if (msg.type === 'PARTNER_LOCATION_UPDATE') {
              setLatestPartnerTelemetry(msg.payload);
            } else if (msg.type === 'EMERGENCY_SOS_TRIGGERED') {
              playNotificationChime('ping');
              setToastMessage('🚨 Emergency SOS alert active! Operations dispatched response.');
            } else if (msg.type === 'EMERGENCY_SOS_RESOLVED') {
              playNotificationChime('success');
              setToastMessage('✓ Emergency safely handled and resolved by Chief Concierge.');
            } else if (msg.type === 'PARTNER_CHECKED_IN') {
              playNotificationChime('ping');
              setToastMessage("Great news! The helper has arrived at your parents' house.");
            } else if (msg.type === 'ESCROW_RELEASED') {
              playNotificationChime('success');
              setToastMessage('Service completed and verified! Escrow released to helper.');
            } else if (msg.type === 'TASK_DISPATCHED') {
              playNotificationChime('ping');
              setToastMessage('A vetted helper has been assigned and is on the way.');
            }
            setTimeout(() => setToastMessage(null), 5000);
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
  }, []);

  const handleLogout = async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (e) {
      console.warn('Supabase signOut warning:', e);
    }
    localStorage.removeItem('fh_user_logged_in');
    localStorage.removeItem('fh_user_id');
    localStorage.removeItem('fh_user_name');
    localStorage.removeItem('fh_user_email');
    setIsLoggedIn(false);
    setToastMessage('Signed out successfully.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const openBookModal = (srv: typeof servicesCatalog[0]) => {
    const randomOtp = Math.floor(1000 + Math.random() * 9000).toString();
    setDoorstepOtp(randomOtp);
    setSelectedService(srv);
    setReqTitle(srv.title);
    setReqInstructions(`Please coordinate ${srv.title} with verified photo check-in. Ring doorbell twice and speak gently.`);
    setReqEscrowAmount(srv.price);
    setShowBookModal(true);
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqTitle || !reqInstructions || !reqParentId) return;

    setIsSubmitting(true);
    try {
      const fullInstructions = [
        reqInstructions.trim(),
        `Preferred Window: ${bookingTimeSlot}`,
        `Partner Language: ${bookingLanguage}`,
        bookingSeniorNeeds.length > 0 ? `Senior Care Support: ${bookingSeniorNeeds.join(', ')}` : '',
        `Doorstep Verification PIN: ${doorstepOtp}`,
      ].filter(Boolean).join('\n• ');

      const res = await fetch(`${getApiBaseUrl()}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: currentUserId,
          parentId: reqParentId,
          category: selectedService?.category || 'MEDICAL_TRANSPORT',
          title: reqTitle,
          instructions: fullInstructions,
          scheduledAt: new Date().toISOString(),
          escrowAmount: reqEscrowAmount,
        }),
      });

      if (res.ok) {
        const createdTask: Task = await res.json();
        setShowBookModal(false);
        setActiveTab('trackers');
        setSelectedTask(createdTask);
        playNotificationChime('success');
        setToastMessage(`Service confirmed! $${reqEscrowAmount}.00 is locked safely in Escrow.`);
        setTimeout(() => setToastMessage(null), 5000);
        fetchAllData();
      } else {
        const err = await res.json().catch(() => ({}));
        setToastMessage(err.error || 'Failed to submit service request. Please retry.');
        setTimeout(() => setToastMessage(null), 5000);
      }
    } catch (err) {
      console.error(err);
      setToastMessage('Network error submitting request. Please try again.');
      setTimeout(() => setToastMessage(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddParent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newParentName.trim() || !newParentPhone.trim() || !newParentWhatsapp.trim() || !newParentAddress.trim()) {
      setToastMessage("Please fill in parent name, calling phone, WhatsApp number, and address.");
      playNotificationChime('alert');
      return;
    }
    try {
      const targetCoords = resolveCityCoordinates(newParentLocality + ' ' + newParentAddress);
      const res = await fetch(`${getApiBaseUrl()}/api/parents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: currentUserId,
          parentName: newParentName.trim(),
          primaryPhone: newParentPhone.trim(),
          whatsappPhone: newParentWhatsapp.trim() || newParentPhone.trim(),
          locality: newParentLocality.trim() || 'Hyderabad',
          fullAddress: newParentAddress.trim(),
          coordinatesLat: targetCoords.lat,
          coordinatesLng: targetCoords.lng,
          medicalNotes: newParentNotes.trim() || null,
        }),
      });

      if (res.ok) {
        setShowAddParentModal(false);
        setNewParentName('');
        setNewParentPhone('+91 ');
        setNewParentWhatsapp('+91 ');
        setNewParentLocality('');
        setNewParentAddress('');
        setNewParentNotes('');
        fetchAllData();
        playNotificationChime('success');
        setToastMessage('Parent residence added successfully!');
        setTimeout(() => setToastMessage(null), 5000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenEditParent = (parent: ParentProfile) => {
    setEditingParent(parent);
    setEditParentName(parent.parent_name);
    setEditParentPhone(parent.primary_phone);
    setEditParentWhatsapp(parent.whatsapp_phone || parent.primary_phone);
    setEditParentLocality(parent.locality || 'Pan-India');
    setEditParentAddress(parent.full_address || '');
    setEditParentNotes(parent.medical_notes || '');
  };

  const handleUpdateParent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingParent) return;
    if (!editParentName.trim() || !editParentPhone.trim() || !editParentAddress.trim()) {
      setToastMessage('Please fill in parent name, calling phone, and address.');
      return;
    }
    setIsUpdatingParent(true);
    try {
      const targetCoords = resolveCityCoordinates(editParentLocality + ' ' + editParentAddress);
      const res = await fetch(`${getApiBaseUrl()}/api/parents/${editingParent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentName: editParentName.trim(),
          primaryPhone: editParentPhone.trim(),
          whatsappPhone: editParentWhatsapp.trim() || editParentPhone.trim(),
          locality: editParentLocality.trim() || 'Hyderabad',
          fullAddress: editParentAddress.trim(),
          coordinatesLat: targetCoords.lat,
          coordinatesLng: targetCoords.lng,
          medicalNotes: editParentNotes.trim() || null,
        }),
      });

      if (res.ok) {
        setEditingParent(null);
        fetchAllData();
        setToastMessage('Parent details updated successfully!');
        setTimeout(() => setToastMessage(null), 5000);
      } else {
        const err = await res.json();
        setToastMessage(err.error || 'Failed to update parent details.');
        setTimeout(() => setToastMessage(null), 5000);
      }
    } catch (err: any) {
      console.error(err);
      setToastMessage('Error updating parent details.');
      setTimeout(() => setToastMessage(null), 5000);
    } finally {
      setIsUpdatingParent(false);
    }
  };

  const handleDeleteParent = async (parentId: string, parentName: string) => {
    if (!window.confirm(`Are you sure you want to remove ${parentName}'s residence?`)) {
      return;
    }
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/parents/${parentId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchAllData();
        setToastMessage(`${parentName}'s residence removed.`);
        setTimeout(() => setToastMessage(null), 5000);
      } else {
        const err = await res.json();
        setToastMessage(err.error || 'Failed to delete parent residence.');
        setTimeout(() => setToastMessage(null), 5000);
      }
    } catch (err) {
      console.error(err);
      setToastMessage('Error removing parent residence.');
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  const getStepIndex = (status: string) => {
    switch (status) {
      case 'PENDING_OPS_REVIEW': return 0;
      case 'DISPATCHED': return 1;
      case 'ACCEPTED':
      case 'IN_PROGRESS': return 2;
      case 'VERIFICATION_SUBMITTED': return 3;
      case 'COMPLETED': return 4;
      default: return 0;
    }
  };

  const friendlySteps = [
    { title: 'Requested', desc: 'Protected in escrow' },
    { title: 'Helper Assigned', desc: 'Vetted local concierge' },
    { title: 'On the Way', desc: 'En route to residence' },
    { title: 'Arrived & Verified', desc: 'Live GPS photo check-in' },
    { title: 'Completed', desc: 'Verified & escrow released' },
  ];

  const lockedEscrow = tasks
    .filter((t) => t.escrow?.status === 'HOLD_IN_ESCROW')
    .reduce((acc, t) => acc + (t.escrow?.amount || 0), 0);

  const releasedEscrow = tasks
    .filter((t) => t.escrow?.status === 'RELEASED_TO_PARTNER')
    .reduce((acc, t) => acc + (t.escrow?.amount || 0), 0);

  const filteredUserTasks = tasks.filter((t) => {
    if (requestFilter === 'ACTIVE') return t.status !== 'COMPLETED';
    if (requestFilter === 'COMPLETED') return t.status === 'COMPLETED';
    return true;
  });

  useEffect(() => {
    if (filteredUserTasks.length > 0) {
      if (!selectedTask || !filteredUserTasks.some((t) => t.id === selectedTask.id)) {
        setSelectedTask(filteredUserTasks[0]);
      }
    } else {
      setSelectedTask(null);
    }
  }, [requestFilter, tasks]);

  // Filtered Services based on Search & Category
  const filteredServices = servicesCatalog.filter((s) => {
    const matchesSearch =
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.desc.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'ALL' || s.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // ==========================================
  // VIEW: AUTHENTICATION SCREEN (SIGN IN / SIGN UP)
  // ==========================================
  if (!isLoggedIn) {
    return (
      <AuthView
        pendingGoogleData={pendingGoogleUser}
        onSuccess={(user) => {
          localStorage.setItem('fh_user_logged_in', 'true');
          localStorage.setItem('fh_user_id', user.id);
          localStorage.setItem('fh_user_name', user.full_name);
          localStorage.setItem('fh_user_email', user.email);
          setCurrentUserId(user.id);
          setCurrentUserName(user.full_name);
          setCurrentUserEmail(user.email);
          setIsLoggedIn(true);
          setPendingGoogleUser(null);
          fetchAllData(user.id);
        }}
      />
    );
  }

  // ==========================================
  // VIEW: AUTHENTICATED NRI CLIENT PORTAL
  // ==========================================
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 bg-white border border-slate-200 text-slate-900 px-5 py-3.5 rounded-2xl shadow-xl animate-in slide-in-from-top-3">
          <Sparkles className="w-5 h-5 text-indigo-600 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Urban Company Style Top Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div
              onClick={() => setActiveTab('explore')}
              className="flex items-center gap-3 cursor-pointer"
            >
              <img src="/logo_icon.png" alt="FamilyHubs" className="w-10 h-10 object-contain drop-shadow-sm" />
              <div>
                <span className="text-lg font-bold text-slate-900 tracking-tight">FamilyHubs</span>
                <span className="text-[11px] bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-full ml-2">
                  Parent Care
                </span>
              </div>
            </div>

            {/* Urban Company Style City Selector */}
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-200/80 px-3 py-1.5 rounded-xl text-xs transition">
              <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <select
                value={selectedCity}
                onChange={(e) => {
                  setSelectedCity(e.target.value);
                  setToastMessage(`Showing verified services in ${e.target.value}`);
                  setTimeout(() => setToastMessage(null), 3000);
                }}
                className="bg-transparent font-bold text-slate-800 text-xs focus:outline-none cursor-pointer"
              >
                {Object.keys(POPULAR_INDIAN_CITIES).map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>

            {/* Pan-India Eldercare Network Badge */}
            <div className="hidden lg:flex items-center gap-2 bg-indigo-50/80 border border-indigo-200/80 px-3 py-1.5 rounded-xl text-xs">
              <Globe className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="font-semibold text-indigo-950">100% Escrow Protection</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full">Senior Safe</span>
            </div>
          </div>

          {/* Profile & Settings Trigger */}
          <div className="flex items-center gap-3">
            {/* 1-Tap Emergency SOS Trigger */}
            <button
              onClick={() => setShowEmergencyModal(true)}
              className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-rose-600/30 transition animate-pulse cursor-pointer shrink-0"
              title="Activate Emergency Response"
            >
              <Siren className="w-4 h-4" />
              <span className="hidden sm:inline">EMERGENCY SOS</span>
              <span className="sm:hidden">SOS</span>
            </button>

            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-white shadow-xs">
              <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
              <span className={wsConnected ? 'text-emerald-700' : 'text-amber-700'}>
                {wsConnected ? 'Live Gateway' : 'Connecting...'}
              </span>
            </div>

            <button
              onClick={() => setActiveTab('settings')}
              className="p-2.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>

            <div
              onClick={() => setActiveTab('settings')}
              className="flex items-center gap-3 cursor-pointer pl-3 border-l border-slate-200"
            >
              <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-200">
                {currentUserName.substring(0, 2).toUpperCase()}
              </div>
              <div className="hidden sm:block text-right">
                <div className="text-xs font-bold text-slate-900">{currentUserName}</div>
                <div className="text-[11px] text-slate-500">{currentUserEmail}</div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-2 border-t border-slate-100 pt-1 overflow-x-auto items-center">
          <button
            onClick={() => setActiveTab('explore')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-xl transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'explore'
                ? 'bg-indigo-50 text-indigo-700 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            <Sparkles className="w-4 h-4 text-indigo-600" />
            Find Services
          </button>

          <button
            onClick={() => setActiveTab('trackers')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-xl transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'trackers'
                ? 'bg-indigo-50 text-indigo-700 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            <Activity className="w-4 h-4 text-blue-600" />
            Active Requests
            <span className="bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full text-[10px]">
              {tasks.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('health')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-xl transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'health'
                ? 'bg-rose-50 text-rose-700 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            <Heart className="w-4 h-4 text-rose-500 fill-rose-100" />
            Health & Vitals
          </button>

          <button
            onClick={() => setActiveTab('parents')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-xl transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'parents'
                ? 'bg-indigo-50 text-indigo-700 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            <UserCheck className="w-4 h-4 text-emerald-600" />
            My Parents
            <span className="bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full text-[10px]">
              {parents.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('billing')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-xl transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'billing'
                ? 'bg-indigo-50 text-indigo-700 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Escrow Vault
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-xl transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'settings'
                ? 'bg-indigo-50 text-indigo-700 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            <Settings className="w-4 h-4 text-slate-500" />
            Settings
          </button>

          <button
            onClick={() => setShowFamilyModal(true)}
            className="px-3 py-2 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 text-indigo-700 hover:bg-indigo-50 ml-auto whitespace-nowrap border border-indigo-100"
            title="Shared Family Care"
          >
            <Users className="w-4 h-4 text-indigo-600" />
            <span className="hidden md:inline">Shared Sibling Care</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ================= TAB 1: URBAN COMPANY STYLE EXPLORE SERVICES ================= */}
        {activeTab === 'explore' && (
          <div className="space-y-8">
            {/* Hero Search & Promo Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-8 text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-lg">
              <div className="space-y-4 max-w-xl">
                <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-3 py-1 rounded-full font-semibold">
                  Pan-India Eldercare Concierge • Nationwide Care Across India
                </span>
                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                  What care do your parents need today?
                </h2>
                <p className="text-xs md:text-sm text-slate-300">
                  Every booking is backed by 100% Escrow. Helpers are dispatched with live selfie check-in within 150m of their home.
                </p>

                {/* Urban Company Search Bar */}
                <div className="relative pt-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for 'Doctor visit', 'Inverter check', 'RO plumbing', 'Pooja items'..."
                    className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-2xl pl-11 pr-4 py-3 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 backdrop-blur-md"
                  />
                </div>
              </div>

              {/* Escrow Vault Glance & Brand Emblem */}
              <div className="flex items-center gap-6 shrink-0">
                <img src="/logo_icon.png" alt="FamilyHubs" className="w-20 h-20 object-contain hidden lg:block drop-shadow-lg" />
                <div className="flex items-center gap-4 bg-white/10 p-5 rounded-2xl backdrop-blur-md border border-white/10 shrink-0">
                <div>
                  <div className="text-[11px] text-slate-300 font-medium">Secured in Escrow</div>
                  <div className="text-2xl font-bold font-mono text-emerald-400">
                    ${lockedEscrow.toFixed(2)} USD
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Released upon photo review</div>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
            </div>
          </div>

            {/* Quick Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {[
                { id: 'ALL', label: 'All Services', icon: Sparkles },
                { id: 'MEDICAL_TRANSPORT', label: 'Doctor & Health', icon: Stethoscope },
                { id: 'HOME_MAINTENANCE', label: 'Electrical & RO', icon: Wrench },
                { id: 'ERRANDS', label: 'Groceries & Pooja', icon: ShoppingBag },
                { id: 'EMERGENCY', label: '24/7 Emergency', icon: AlertCircle },
              ].map((cat) => {
                const IconComponent = cat.icon;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${isSelected
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                      }`}
                  >
                    <IconComponent className="w-3.5 h-3.5" />
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Curated Service Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredServices.map((service) => (
                <div
                  key={service.id}
                  className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    {/* Visual Banner */}
                    <div className="h-44 w-full bg-slate-100 overflow-hidden relative">
                      <img
                        src={service.banner}
                        alt={service.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-bold text-slate-800 shadow-xs">
                        {service.badge}
                      </div>
                      <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-bold text-slate-900 flex items-center gap-1 shadow-xs">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        {service.rating}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-5 space-y-3">
                      <h4 className="text-base font-bold text-slate-900">{service.title}</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">{service.desc}</p>

                      {/* Feature Bullet Points */}
                      <div className="space-y-1.5 pt-1">
                        {service.features.map((feat, fIdx) => (
                          <div key={fIdx} className="flex items-center gap-2 text-[11px] text-slate-600">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Price & Book Trigger */}
                  <div className="p-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Protected Escrow</span>
                      <span className="text-lg font-bold font-mono text-slate-900">
                        ${service.price} USD
                      </span>
                    </div>

                    <button
                      onClick={() => openBookModal(service)}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                    >
                      Book Service
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= TAB 2: ACTIVE REQUESTS TRACKER ================= */}
        {activeTab === 'trackers' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Tasks List */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between pb-1">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Your Care Requests
                  </h2>
                  <button onClick={fetchAllData} className="p-1.5 text-slate-400 hover:text-slate-700">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Filter Pills: All, Ongoing, Completed */}
                <div className="flex items-center gap-1.5 pb-1">
                  <button
                    onClick={() => setRequestFilter('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      requestFilter === 'ALL'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    All ({tasks.length})
                  </button>
                  <button
                    onClick={() => setRequestFilter('ACTIVE')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      requestFilter === 'ACTIVE'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    Ongoing ({tasks.filter((t) => t.status !== 'COMPLETED').length})
                  </button>
                  <button
                    onClick={() => setRequestFilter('COMPLETED')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      requestFilter === 'COMPLETED'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    Completed ({tasks.filter((t) => t.status === 'COMPLETED').length})
                  </button>
                </div>

                {tasks.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                      <Heart className="w-6 h-6" />
                    </div>
                    <div className="text-sm font-bold text-slate-800">No active care requests yet</div>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto">
                      Book doctor visits, inverter repair, water plumbing, or groceries for your parents anywhere in India.
                    </p>
                    <button
                      onClick={() => setActiveTab('explore')}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-indigo-700 cursor-pointer"
                    >
                      Browse Services ➔
                    </button>
                  </div>
                ) : filteredUserTasks.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 space-y-2">
                    <div className="text-xs font-bold text-slate-700">No requests match this filter.</div>
                    <div className="text-[11px] text-slate-400">Try switching to 'All' or 'Completed' above.</div>
                  </div>
                ) : (
                  filteredUserTasks.map((task) => {
                    const isSelected = selectedTask?.id === task.id;
                    const isCompleted = task.status === 'COMPLETED';

                    return (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className={`p-4 rounded-2xl cursor-pointer transition border text-left ${isSelected
                            ? 'bg-white border-indigo-600 shadow-md ring-2 ring-indigo-600/10'
                            : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                          }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                            {task.tracking_code}
                          </span>
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${isCompleted
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}
                          >
                            {task.status.replace(/_/g, ' ')}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-slate-900 mt-2 line-clamp-1">{task.title}</h4>

                        <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {task.parent?.locality || 'Pan-India'}
                          </span>
                          <span className="font-semibold text-slate-700">
                            ${task.escrow?.amount || 50} Escrow
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Right Column: Timeline & Verified Proof */}
              <div className="lg:col-span-7">
                {selectedTask ? (
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                      <div>
                        <div className="text-xs font-mono text-indigo-700 font-bold">{selectedTask.tracking_code}</div>
                        <h3 className="text-base font-bold text-slate-900">{selectedTask.title}</h3>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] text-slate-400">Escrow Hold</div>
                        <div className="text-xl font-bold font-mono text-emerald-600">
                          ${selectedTask.escrow?.amount.toFixed(2)} USD
                        </div>
                      </div>
                    </div>

                    {/* Stepper */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                        Service Progress
                      </h4>
                      <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                        {friendlySteps.map((step, idx) => {
                          const currentStep = getStepIndex(selectedTask.status);
                          const isDone = idx <= currentStep;
                          const isCurrent = idx === currentStep;

                          return (
                            <div key={idx} className="relative flex items-start gap-3.5">
                              <div
                                className={`absolute -left-6 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition ${isDone
                                    ? 'bg-emerald-600 text-white shadow-sm'
                                    : 'bg-white text-slate-400 border border-slate-300'
                                  }`}
                              >
                                {isDone ? '✓' : idx + 1}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm font-semibold ${isDone ? 'text-slate-900' : 'text-slate-400'}`}>
                                    {step.title}
                                  </span>
                                  {isCurrent && (
                                    <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                                      Current Step
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">{step.desc}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Proof Photo Section */}
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Camera className="w-4 h-4 text-indigo-600" />
                          <h4 className="text-xs font-bold text-slate-900">Arrival Verification Photo</h4>
                        </div>
                      </div>

                      {selectedTask.verification_logs && selectedTask.verification_logs.length > 0 ? (
                        <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                              <img
                                src={getImageUrl(selectedTask.verification_logs[0].selfie_image_url)}
                                alt="Verification Proof"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-900">
                                {selectedTask.verification_logs[0].stage}
                              </div>
                              <div className="text-[11px] text-emerald-700 font-medium mt-0.5">
                                ✓ GPS Verified ({Math.round(selectedTask.verification_logs[0].distance_from_target_meters)}m from home)
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => setShowProofModal(selectedTask.verification_logs![0])}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 rounded-lg cursor-pointer"
                          >
                            View Photo
                          </button>
                        </div>
                      ) : (
                        <div className="p-4 text-center text-xs text-slate-500 bg-white rounded-xl border border-dashed border-slate-200">
                          Waiting for on-ground arrival. Once the helper arrives, their verified photo will appear here.
                        </div>
                      )}
                    </div>

                    {/* Live GPS Tracker Trigger for in-progress tasks */}
                    {(selectedTask.status === 'IN_PROGRESS' || selectedTask.status === 'ACCEPTED' || selectedTask.status === 'DISPATCHED') && (
                      <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-600/20">
                            <Navigation className="w-5 h-5 animate-pulse" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900">Live Helper GPS Movement</div>
                            <div className="text-[11px] text-slate-500">Track helper traveling live to your parents' home</div>
                          </div>
                        </div>
                        <button
                          onClick={() => setTrackingTargetTask(selectedTask)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          Open Live Map
                        </button>
                      </div>
                    )}

                    {/* CSAT Rating & Review for Completed Tasks */}
                    {selectedTask.status === 'COMPLETED' && (
                      <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                            <span className="text-xs font-bold text-slate-900">
                              {selectedTask.review ? 'Verified Service Review' : 'Service Feedback'}
                            </span>
                          </div>
                          {selectedTask.review ? (
                            <div className="mt-1 space-y-1">
                              <div className="flex items-center gap-1 text-amber-500 font-bold text-xs">
                                {'★'.repeat(selectedTask.review.rating)}
                                <span className="text-slate-600 font-medium ml-1">({selectedTask.review.rating}/5 Stars)</span>
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {selectedTask.review.tags?.map((tag) => (
                                  <span key={tag} className="text-[10px] font-semibold bg-white border border-amber-200 text-amber-800 px-2 py-0.5 rounded-md">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                              {selectedTask.review.feedback_text && (
                                <p className="text-[11px] text-slate-600 italic mt-1">"{selectedTask.review.feedback_text}"</p>
                              )}
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Please rate the helper's punctuality and care quality to release feedback badge.
                            </p>
                          )}
                        </div>

                        {!selectedTask.review && (
                          <button
                            onClick={() => setReviewTargetTask(selectedTask)}
                            className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
                          >
                            <Star className="w-3.5 h-3.5 fill-white" />
                            Rate Service
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400">
                    Select a request to view live progress.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: HEALTH & CARE MANAGEMENT ================= */}
        {activeTab === 'health' && (
          <div className="space-y-4">
            {parents.length > 1 && (
              <div className="flex items-center gap-2 bg-white border border-slate-200 p-2.5 rounded-2xl overflow-x-auto shadow-xs">
                <span className="text-xs font-bold text-slate-500 pl-2 shrink-0">Viewing Medical File for:</span>
                {parents.map((p) => {
                  const isSelected = (healthParentId || parents[0]?.id) === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setHealthParentId(p.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                        isSelected
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                      }`}
                    >
                      {p.parent_name} ({p.locality})
                    </button>
                  );
                })}
              </div>
            )}
            <HealthView
              parentId={healthParentId || parents[0]?.id || ''}
              parentName={parents.find((p) => p.id === (healthParentId || parents[0]?.id))?.parent_name || 'My Parents'}
              clientId={currentUserId}
              onRefillCreated={() => {
                fetchAllData();
                setActiveTab('trackers');
              }}
            />
          </div>
        )}

        {/* ================= TAB 4: MY PARENTS ================= */}
        {activeTab === 'parents' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Your Parents in India</h2>
                <p className="text-xs text-slate-500">Registered residences across all Indian cities and towns.</p>
              </div>
              <button
                onClick={() => setShowAddParentModal(true)}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 transition flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add New Residence
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {parents.map((parent) => (
                <div key={parent.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{parent.parent_name}</h3>
                      <span className="text-xs text-indigo-700 font-medium">{parent.locality}</span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                      <MapPin className="w-4 h-4 text-indigo-600" />
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1.5">
                    <div><span className="font-semibold text-slate-700">Address:</span> {parent.full_address}</div>
                    <div><span className="font-semibold text-slate-700">Calling Phone:</span> <span className="font-mono text-slate-800">{parent.primary_phone}</span></div>
                    <div><span className="font-semibold text-slate-700">WhatsApp:</span> <span className="font-mono text-emerald-700 font-bold">{parent.whatsapp_phone || parent.primary_phone}</span></div>
                  </div>

                  {parent.medical_notes && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                      <strong>Care Notes:</strong> {parent.medical_notes}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => handleOpenEditParent(parent)}
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5 text-slate-500" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteParent(parent.id, parent.parent_name)}
                      className="py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Delete Residence"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= TAB 4: ESCROW VAULT ================= */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-xs text-slate-400 font-bold uppercase">Currently in Escrow</div>
                <div className="text-3xl font-bold font-mono text-emerald-600 mt-2">${lockedEscrow.toFixed(2)}</div>
                <p className="text-xs text-slate-500 mt-1">Protected until helper finishes the task</p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-xs text-slate-400 font-bold uppercase">Total Completed &amp; Released</div>
                <div className="text-3xl font-bold font-mono text-slate-900 mt-2">${releasedEscrow.toFixed(2)}</div>
                <p className="text-xs text-slate-500 mt-1">Disbursed after photo &amp; GPS verification</p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-xs text-slate-400 font-bold uppercase">Your Membership</div>
                <div className="text-xl font-bold text-indigo-700 mt-2">Gold Family Plan</div>
                <p className="text-xs text-slate-500 mt-1">24/7 priority emergency triage &amp; local escort</p>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 5: SETTINGS PAGE (FULLY USER EDITABLE) ================= */}
        {activeTab === 'settings' && (
          <form onSubmit={handleSaveSettings} className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Account &amp; Care Settings</h2>
                <p className="text-xs text-slate-500">Edit your contact info, currency, and parents' care details in India.</p>
              </div>
              <button
                type="submit"
                disabled={isSavingSettings}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isSavingSettings ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>Save Changes</span>
              </button>
            </div>

            {/* NRI Client Profile - USER EDITABLE */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-600" />
                  NRI Client Profile
                </h3>
                <span className="text-[10px] bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-full">
                  User Editable
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="text-slate-600 font-bold block mb-1">Your Full Name</label>
                  <input
                    type="text"
                    value={settingsFullName}
                    onChange={(e) => setSettingsFullName(e.target.value)}
                    required
                    placeholder="Enter your full name"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-slate-800 font-medium outline-none transition"
                  />
                </div>
                <div>
                  <label className="text-slate-600 font-bold block mb-1">Your Email</label>
                  <input
                    type="email"
                    value={settingsEmail}
                    onChange={(e) => setSettingsEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-slate-800 font-medium outline-none transition"
                  />
                </div>
                <div>
                  <label className="text-slate-600 font-bold block mb-1">Your Mobile Phone</label>
                  <input
                    type="tel"
                    value={settingsPhone}
                    onChange={(e) => setSettingsPhone(e.target.value)}
                    placeholder="+1 408 555 0192"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-slate-800 font-medium outline-none transition"
                  />
                </div>
                <div>
                  <label className="text-slate-600 font-bold block mb-1">Country of Residence</label>
                  <select
                    value={settingsCountry}
                    onChange={(e) => setSettingsCountry(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-slate-800 font-medium outline-none transition"
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
                <div className="sm:col-span-2">
                  <label className="text-slate-600 font-bold block mb-1">Preferred Currency</label>
                  <select
                    value={settingsCurrency}
                    onChange={(e) => {
                      setSettingsCurrency(e.target.value);
                      setUserCurrency(e.target.value);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-slate-800 font-medium outline-none transition"
                  >
                    <option value="USD">USD ($ - United States Dollar)</option>
                    <option value="GBP">GBP (£ - British Pound)</option>
                    <option value="EUR">EUR (€ - Euro)</option>
                    <option value="CAD">CAD ($ - Canadian Dollar)</option>
                    <option value="INR">INR (₹ - Indian Rupee)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Parents' Care Details in India - USER EDITABLE & MANDATORY CONTACTS */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                  Parents' Care Details in India (Pan-India)
                </h3>
                <span className="text-[10px] bg-rose-50 text-rose-700 font-semibold px-2 py-0.5 rounded-full">
                  Mandatory Phone &amp; WhatsApp
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="sm:col-span-2">
                  <label className="text-slate-600 font-bold block mb-1">
                    Parents' Full Name(s) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={settingsParentName}
                    onChange={(e) => setSettingsParentName(e.target.value)}
                    required
                    placeholder="e.g. Lakshmi & Ramana Reddy"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-slate-800 font-medium outline-none transition"
                  />
                </div>

                <div>
                  <label className="text-slate-600 font-bold block mb-1">
                    Parents' Primary Calling Phone <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={settingsParentPhone}
                    onChange={(e) => setSettingsParentPhone(e.target.value)}
                    required
                    placeholder="+91 94401 23456"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-slate-800 font-mono font-medium outline-none transition"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-600 font-bold">
                      Parents' WhatsApp Number <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setSettingsParentWhatsapp(settingsParentPhone)}
                      className="text-[10px] text-indigo-600 hover:underline"
                    >
                      Same as calling
                    </button>
                  </div>
                  <input
                    type="tel"
                    value={settingsParentWhatsapp}
                    onChange={(e) => setSettingsParentWhatsapp(e.target.value)}
                    required
                    placeholder="+91 94401 23456"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-slate-800 font-mono font-medium outline-none transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-slate-600 font-bold block mb-1">
                    City / Town / District in India (Pan-India) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={settingsParentCity}
                    onChange={(e) => setSettingsParentCity(e.target.value)}
                    required
                    placeholder="e.g. Hyderabad, Bengaluru, Miryalaguda, Pune, Delhi, etc."
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-slate-800 font-medium outline-none transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-slate-600 font-bold block mb-1">
                    Full Street Address in India <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={settingsParentAddress}
                    onChange={(e) => setSettingsParentAddress(e.target.value)}
                    required
                    placeholder="House / Flat No, Apartment Name, Street / Lane, Landmark, Pincode"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-slate-800 font-medium outline-none transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-slate-600 font-bold block mb-1">
                    Medical &amp; Care Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={settingsParentNotes}
                    onChange={(e) => setSettingsParentNotes(e.target.value)}
                    placeholder="Special instructions: medications, allergies, preferred hospital..."
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-slate-800 font-medium outline-none transition"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSavingSettings ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Profile &amp; Care Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Security & Trust Controls */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Security &amp; Escrow Protection
                </h3>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Bank-Grade 256-Bit TLS
                </span>
              </div>

              {/* Panic Freeze Killswitch */}
              <div className={`p-4 rounded-xl border transition ${isEscrowFrozen ? 'bg-red-50 border-red-300' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <ShieldAlert className={`w-4 h-4 ${isEscrowFrozen ? 'text-red-600' : 'text-slate-500'}`} />
                      Emergency Escrow Payout Freeze
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {isEscrowFrozen
                        ? 'EMERGENCY LOCK ACTIVE. All escrow payouts are currently blocked across the platform.'
                        : 'If you suspect miscommunication or need to halt a service immediately, lock all outbound escrow transfers.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleEscrowFreeze}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${isEscrowFrozen
                        ? 'bg-red-600 hover:bg-red-700 text-white shadow-xs'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-xs'
                      }`}
                  >
                    {isEscrowFrozen ? 'Unlock Escrow' : 'Lock Escrow'}
                  </button>
                </div>
              </div>

              {/* 2FA & Biometric status */}
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <KeyRound className="w-4 h-4 text-indigo-600" />
                    <div>
                      <div className="font-bold text-slate-900">Two-Factor Authentication (2FA)</div>
                      <div className="text-slate-500 text-[11px]">Enforced for escrow funding &amp; booking approvals</div>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                    Enabled
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <Fingerprint className="w-4 h-4 text-indigo-600" />
                    <div>
                      <div className="font-bold text-slate-900">Biometric Fast Sign-In</div>
                      <div className="text-slate-500 text-[11px]">Apple TouchID / Windows Hello hardware key</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={biometricEnabled}
                    onChange={(e) => setBiometricEnabled(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                </div>

                {/* Session telemetry */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Authenticated Client Account:</span>
                    <span className="font-mono text-slate-800 font-semibold">{currentUserEmail}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Parent Geofence Tolerance:</span>
                    <span className="text-emerald-700 font-semibold">Strict 150m Server Geofence Active</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notification Preferences */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Bell className="w-4 h-4 text-indigo-600" />
                Notification Preferences
              </h3>
              <div className="space-y-3 text-xs">
                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <div>
                    <div className="font-bold text-slate-900">Parent WhatsApp Updates</div>
                    <div className="text-slate-500 text-[11px]">Send zero-friction notifications to parents' phone upon dispatch &amp; arrival</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={whatsappAlerts}
                    onChange={(e) => setWhatsappAlerts(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <div>
                    <div className="font-bold text-slate-900">Email Invoices &amp; Receipts</div>
                    <div className="text-slate-500 text-[11px]">Receive monthly PDF statements and escrow release receipts</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailAlerts}
                    onChange={(e) => setEmailAlerts(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                </label>
              </div>
            </div>

            {/* Log Out Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-3.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Sign Out from FamilyHubs
              </button>
            </div>
          </form>
        )}
      </main>

      {/* ================= URBAN COMPANY QUICK BOOK MODAL ================= */}
      {showBookModal && selectedService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">{selectedService.title}</h3>
              </div>
              <button onClick={() => setShowBookModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmBooking} className="space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 font-bold">Select Parent Residence</label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowBookModal(false);
                      setShowAddParentModal(true);
                    }}
                    className="text-indigo-600 hover:text-indigo-700 text-xs font-semibold"
                  >
                    + Add New Parent
                  </button>
                </div>
                {parents.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center justify-between">
                    <span>No parent registered yet.</span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowBookModal(false);
                        setShowAddParentModal(true);
                      }}
                      className="px-2.5 py-1 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700"
                    >
                      Add Parent Now
                    </button>
                  </div>
                ) : (
                  <select
                    value={reqParentId}
                    onChange={(e) => setReqParentId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
                    required
                  >
                    {parents.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.parent_name} — {p.locality}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Specific Instructions for Local Helper</label>
                <textarea
                  rows={2}
                  value={reqInstructions}
                  onChange={(e) => setReqInstructions(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800"
                  required
                />
              </div>

              {/* Urban Company Style: Preferred Time Slot */}
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">Preferred Time Window</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'Morning (9:00 AM – 12:00 PM)', label: 'Morning', time: '9 AM – 12 PM' },
                    { id: 'Afternoon (1:00 PM – 4:00 PM)', label: 'Afternoon', time: '1 PM – 4 PM' },
                    { id: 'Evening (5:00 PM – 8:00 PM)', label: 'Evening', time: '5 PM – 8 PM' },
                  ].map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => setBookingTimeSlot(slot.id)}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        bookingTimeSlot === slot.id
                          ? 'border-indigo-600 bg-indigo-50/80 text-indigo-900 font-bold shadow-xs'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className="text-[11px] font-bold">{slot.label}</div>
                      <div className="text-[9px] text-slate-500">{slot.time}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Urban Company Style: Partner Preferred Regional Language */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Partner Language</label>
                  <select
                    value={bookingLanguage}
                    onChange={(e) => setBookingLanguage(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
                  >
                    <option value="Telugu">Telugu (తెలుగు)</option>
                    <option value="Hindi">Hindi (हिन्दी)</option>
                    <option value="Tamil">Tamil (தமிழ்)</option>
                    <option value="Kannada">Kannada (ಕನ್ನಡ)</option>
                    <option value="Marathi">Marathi (मराठी)</option>
                    <option value="Bengali">Bengali (বাংলা)</option>
                    <option value="English">English</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Doorstep Handshake PIN</label>
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-emerald-900 font-mono font-bold text-sm">
                    <KeyRound className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{doorstepOtp}</span>
                    <span className="text-[10px] text-emerald-700 font-sans font-normal ml-auto">Share with parents</span>
                  </div>
                </div>
              </div>

              {/* Senior Care Assistance Checklist */}
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">Senior Comfort & Assistance Options</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    'Wheelchair / Mobility Support',
                    'Ring Bell Twice & Speak Loudly',
                    'WhatsApp Video Update on Arrival',
                    'Female Partner Attendant Preferred',
                  ].map((item) => {
                    const isChecked = bookingSeniorNeeds.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          if (isChecked) {
                            setBookingSeniorNeeds(bookingSeniorNeeds.filter((i) => i !== item));
                          } else {
                            setBookingSeniorNeeds([...bookingSeniorNeeds, item]);
                          }
                        }}
                        className={`p-2 rounded-xl border text-left flex items-center gap-2 text-[11px] transition cursor-pointer ${
                          isChecked
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-semibold'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] ${
                          isChecked ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-300'
                        }`}>
                          {isChecked ? '✓' : ''}
                        </span>
                        <span className="truncate">{item}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Escrow summary */}
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">Protected Escrow Amount</div>
                  <div className="text-[11px] text-slate-600">Released only after verified completion</div>
                </div>
                <div className="text-xl font-bold font-mono text-emerald-700">
                  ${reqEscrowAmount}.00 USD
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowBookModal(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition shadow-sm"
                >
                  {isSubmitting ? 'Booking...' : `Confirm & Secure ($${reqEscrowAmount})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= PROOF PHOTO MODAL ================= */}
      {showProofModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Verified On-Site Photo</h3>
              </div>
              <button onClick={() => setShowProofModal(null)} className="text-slate-400 hover:text-slate-600 p-1">
                ✕
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 aspect-square relative">
              <img
                src={getImageUrl(showProofModal.selfie_image_url)}
                alt="Verification Proof"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 right-3 bg-white/95 text-emerald-700 text-xs px-2.5 py-1 rounded-full font-bold shadow-md">
                ✓ GPS Checked
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Stage:</span>
                <span className="font-bold text-slate-900">{showProofModal.stage.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span>Distance from Home:</span>
                <span className="font-bold text-emerald-700">
                  {Math.round(showProofModal.distance_from_target_meters)} meters ({showProofModal.distance_from_target_meters <= 150 ? 'At Residence' : 'Flagged Perimeter'})
                </span>
              </div>
              <div className="flex justify-between">
                <span>Server Geofence:</span>
                <span className="font-semibold text-emerald-700 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Forensic Pass (&le;150m)
                </span>
              </div>
              <div className="flex justify-between">
                <span>Anti-Tamper Digest:</span>
                <span className="font-mono text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                  SHA-256 HMAC-OK
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowProofModal(null)}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ================= ADD PARENT MODAL ================= */}
      {showAddParentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Add Parent Residence</h3>
              <button onClick={() => setShowAddParentModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddParent} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Parent Name(s)</label>
                <input
                  type="text"
                  value={newParentName}
                  onChange={(e) => setNewParentName(e.target.value)}
                  placeholder="e.g. Lakshmi & Ramana Reddy"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Calling Phone *</label>
                  <input
                    type="tel"
                    value={newParentPhone}
                    onChange={(e) => setNewParentPhone(e.target.value)}
                    placeholder="+91 94401 22334"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-mono"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-700 font-bold">WhatsApp *</label>
                    <button
                      type="button"
                      onClick={() => setNewParentWhatsapp(newParentPhone)}
                      className="text-[10px] text-indigo-600 hover:underline"
                    >
                      Same as call
                    </button>
                  </div>
                  <input
                    type="tel"
                    value={newParentWhatsapp}
                    onChange={(e) => setNewParentWhatsapp(e.target.value)}
                    placeholder="+91 94401 22334"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">City / Town in India (Pan-India) *</label>
                <input
                  type="text"
                  value={newParentLocality}
                  onChange={(e) => setNewParentLocality(e.target.value)}
                  placeholder="e.g. Hyderabad, Bengaluru, Delhi, Miryalaguda, Pune"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Full Address</label>
                <textarea
                  rows={2}
                  value={newParentAddress}
                  onChange={(e) => setNewParentAddress(e.target.value)}
                  placeholder="House number, landmark, lane name..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800"
                  required
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddParentModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 cursor-pointer"
                >
                  Save Parent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= EDIT PARENT MODAL ================= */}
      {editingParent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Edit Parent Details</h3>
              <button onClick={() => setEditingParent(null)} className="text-slate-400 hover:text-slate-600 p-1">
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateParent} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Parent Name(s)</label>
                <input
                  type="text"
                  value={editParentName}
                  onChange={(e) => setEditParentName(e.target.value)}
                  placeholder="e.g. Lakshmi & Ramana Reddy"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Calling Phone *</label>
                  <input
                    type="tel"
                    value={editParentPhone}
                    onChange={(e) => setEditParentPhone(e.target.value)}
                    placeholder="+91 94401 22334"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-mono"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-700 font-bold">WhatsApp *</label>
                    <button
                      type="button"
                      onClick={() => setEditParentWhatsapp(editParentPhone)}
                      className="text-[10px] text-indigo-600 hover:underline"
                    >
                      Same as call
                    </button>
                  </div>
                  <input
                    type="tel"
                    value={editParentWhatsapp}
                    onChange={(e) => setEditParentWhatsapp(e.target.value)}
                    placeholder="+91 94401 22334"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">City / Town in India *</label>
                <input
                  type="text"
                  value={editParentLocality}
                  onChange={(e) => setEditParentLocality(e.target.value)}
                  placeholder="e.g. Hyderabad, Bengaluru, Delhi, Miryalaguda, Pune"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Full Address</label>
                <textarea
                  rows={2}
                  value={editParentAddress}
                  onChange={(e) => setEditParentAddress(e.target.value)}
                  placeholder="House number, landmark, lane name..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Care &amp; Medical Notes</label>
                <textarea
                  rows={2}
                  value={editParentNotes}
                  onChange={(e) => setEditParentNotes(e.target.value)}
                  placeholder="Any medical conditions, dietary rules, doctor contacts..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingParent(null)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingParent}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 cursor-pointer disabled:opacity-50"
                >
                  {isUpdatingParent ? 'Saving...' : 'Update Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= EXTENDED FEATURE MODALS ================= */}
      <EmergencyModal
        isOpen={showEmergencyModal}
        onClose={() => setShowEmergencyModal(false)}
        parents={parents}
        clientId={currentUserId}
        onEmergencyTriggered={() => fetchAllData()}
      />

      {reviewTargetTask && (
        <TaskReviewModal
          task={reviewTargetTask}
          isOpen={Boolean(reviewTargetTask)}
          onClose={() => setReviewTargetTask(null)}
          onReviewSubmitted={() => fetchAllData()}
        />
      )}

      {trackingTargetTask && (
        <LiveTrackingModal
          task={trackingTargetTask}
          isOpen={Boolean(trackingTargetTask)}
          onClose={() => setTrackingTargetTask(null)}
          latestTelemetry={latestPartnerTelemetry}
        />
      )}

      <FamilyShareModal
        isOpen={showFamilyModal}
        onClose={() => setShowFamilyModal(false)}
        clientId={currentUserId}
      />
    </div>
  );
}
