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
  Siren,
  Navigation,
  Users,
  Pencil,
  Trash2,
  Pill,
  Sun,
  Moon,
} from 'lucide-react';
import type { Task, ParentProfile, VerificationLog, PartnerLocationUpdate, FamilyMember } from '@shared/types';
import { formatDate, playNotificationChime, getApiBaseUrl, getWebSocketUrl, getImageUrl } from '@shared/utils';
import { supabase } from '@shared/supabase';
import { AuthView } from './components/AuthView';
import { HealthView } from './components/HealthView';
import { EmergencyModal } from './components/EmergencyModal';
import { TaskReviewModal } from './components/TaskReviewModal';
import { FamilyShareModal } from './components/FamilyShareModal';
import { LiveTrackingModal } from './components/LiveTrackingModal';

export default function UserApp() {
  // Theme State (Light / Dark Mode)
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('fh_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('fh_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('fh_theme', 'light');
    }
  }, [isDark]);

  // Session Persistence
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
    return localStorage.getItem('fh_user_email') || 'rajesh.reddy@gmail.com';
  });

  // Client Profile & Navigation State
  const [clientProfile, setClientProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'services' | 'tracking' | 'family'>('services');
  const [familySubTab, setFamilySubTab] = useState<'residences' | 'health' | 'medications' | 'siblings'>('residences');

  // Core Data State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [parents, setParents] = useState<ParentProfile[]>([]);
  const [activeParentId, setActiveParentId] = useState<string>('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);

  // Telemetry & WebSocket
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [latestPartnerTelemetry, setLatestPartnerTelemetry] = useState<PartnerLocationUpdate | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [requestFilter, setRequestFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');

  // Currency & Settings
  const [userCurrency, setUserCurrency] = useState<string>(() => {
    return localStorage.getItem('fh_currency') || 'USD';
  });
  const [emailAlerts, setEmailAlerts] = useState<boolean>(true);
  const [whatsappAlerts, setWhatsappAlerts] = useState<boolean>(true);

  // Profile Settings Form
  const [settingsFullName, setSettingsFullName] = useState<string>(currentUserName);
  const [settingsEmail, setSettingsEmail] = useState<string>(currentUserEmail);
  const [settingsPhone, setSettingsPhone] = useState<string>('+1 408 555 0192');
  const [settingsCountry, setSettingsCountry] = useState<string>('United States');
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);

  // Modals State
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showEscrowModal, setShowEscrowModal] = useState<boolean>(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState<boolean>(false);
  const [showProofModal, setShowProofModal] = useState<VerificationLog | null>(null);
  const [reviewTargetTask, setReviewTargetTask] = useState<Task | null>(null);
  const [trackingTargetTask, setTrackingTargetTask] = useState<Task | null>(null);
  const [showFamilyModal, setShowFamilyModal] = useState<boolean>(false);

  // Booking Modal State
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
  const [reqInstructions, setReqInstructions] = useState<string>('');
  const [reqEscrowAmount, setReqEscrowAmount] = useState<number>(45);

  // Add / Edit Parent Modal State
  const [showAddParentModal, setShowAddParentModal] = useState<boolean>(false);
  const [showEditParentModal, setShowEditParentModal] = useState<boolean>(false);
  const [editingParent, setEditingParent] = useState<ParentProfile | null>(null);
  const [parentNameInput, setParentNameInput] = useState<string>('');
  const [parentPhoneInput, setParentPhoneInput] = useState<string>('+91 ');
  const [parentWhatsappInput, setParentWhatsappInput] = useState<string>('+91 ');
  const [parentLocalityInput, setParentLocalityInput] = useState<string>('');
  const [parentAddressInput, setParentAddressInput] = useState<string>('');
  const [parentNotesInput, setParentNotesInput] = useState<string>('');

  const wsRef = useRef<WebSocket | null>(null);

  // Curated Services
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
  ];

  const formatPrice = (usdAmount: number) => {
    if (userCurrency === 'INR') return `₹${Math.round(usdAmount * 83.5)}`;
    if (userCurrency === 'GBP') return `£${(usdAmount * 0.79).toFixed(0)}`;
    if (userCurrency === 'EUR') return `€${(usdAmount * 0.92).toFixed(0)}`;
    if (userCurrency === 'CAD') return `C$${(usdAmount * 1.36).toFixed(0)}`;
    return `$${usdAmount} USD`;
  };

  const fetchAllData = async (targetUserId?: string) => {
    const uid = targetUserId || currentUserId;
    if (!uid) return;
    try {
      const apiBase = getApiBaseUrl();
      const [tasksRes, parentsRes, profRes, familyRes] = await Promise.all([
        fetch(`${apiBase}/api/tasks?clientId=${uid}`),
        fetch(`${apiBase}/api/parents?clientId=${uid}`),
        fetch(`${apiBase}/api/auth/me?userId=${uid}&role=CLIENT`),
        fetch(`${apiBase}/api/clients/${uid}/family`),
      ]);

      if (tasksRes.ok) {
        const tasksData: Task[] = await tasksRes.json();
        setTasks(tasksData);
        if (!selectedTask && tasksData.length > 0) {
          setSelectedTask(tasksData[0]);
        } else if (selectedTask) {
          const updated = tasksData.find((t) => t.id === selectedTask.id);
          if (updated) setSelectedTask(updated);
        }
      }

      if (parentsRes.ok) {
        const parentsData: ParentProfile[] = await parentsRes.json();
        setParents(parentsData);
        if (parentsData.length > 0) {
          if (!activeParentId || !parentsData.some((p) => p.id === activeParentId)) {
            setActiveParentId(parentsData[0].id);
            setReqParentId(parentsData[0].id);
          }
        }
      }

      if (profRes.ok) {
        const profData = await profRes.json();
        if (profData?.user) {
          setClientProfile(profData);
          if (profData.user.full_name) {
            setCurrentUserName(profData.user.full_name);
            setSettingsFullName(profData.user.full_name);
            localStorage.setItem('fh_user_name', profData.user.full_name);
          }
          if (profData.user.email) {
            setCurrentUserEmail(profData.user.email);
            setSettingsEmail(profData.user.email);
            localStorage.setItem('fh_user_email', profData.user.email);
          }
          if (profData.country_residence) setSettingsCountry(profData.country_residence);
          if (profData.currency) {
            setUserCurrency(profData.currency);
            localStorage.setItem('fh_currency', profData.currency);
          }
        }
      }

      if (familyRes.ok) {
        const famData = await familyRes.json();
        if (Array.isArray(famData)) setFamilyMembers(famData);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    fetchAllData();

    const wsUrl = `${getWebSocketUrl()}?role=CLIENT&userId=${currentUserId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'TASK_UPDATED' || message.type === 'TASK_CREATED' || message.type === 'TASK_DISPATCHED' || message.type === 'VERIFICATION_SUBMITTED') {
          fetchAllData();
          playNotificationChime('ping');
          setToastMessage(message.payload?.message || 'Care request updated live!');
          setTimeout(() => setToastMessage(null), 4000);
        } else if (message.type === 'PARTNER_LOCATION_UPDATE') {
          setLatestPartnerTelemetry(message.payload);
        }
      } catch (e) {
        // ignore
      }
    };

    return () => {
      ws.close();
    };
  }, [isLoggedIn, currentUserId]);

  const activeParent = parents.find((p) => p.id === activeParentId) || parents[0];

  const lockedEscrow = tasks
    .filter((t) => t.status !== 'COMPLETED' && t.escrow)
    .reduce((acc, t) => acc + (t.escrow?.amount || 0), 0);

  const releasedEscrow = tasks
    .filter((t) => t.status === 'COMPLETED' && t.escrow)
    .reduce((acc, t) => acc + (t.escrow?.amount || 0), 0);

  const activeOngoingTask = tasks.find(
    (t) => t.status === 'DISPATCHED' || t.status === 'ACCEPTED' || t.status === 'IN_PROGRESS' || t.status === 'VERIFICATION_SUBMITTED'
  );

  const filteredServices = servicesCatalog.filter((s) => {
    const matchesCat = selectedCategory === 'ALL' || s.category === selectedCategory;
    const matchesSearch =
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.features.some((f) => f.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const filteredTasks = tasks.filter((t) => {
    if (requestFilter === 'ACTIVE') return t.status !== 'COMPLETED';
    if (requestFilter === 'COMPLETED') return t.status === 'COMPLETED';
    return true;
  });

  const handleLogout = () => {
    localStorage.removeItem('fh_user_logged_in');
    localStorage.removeItem('fh_user_id');
    localStorage.removeItem('fh_user_name');
    localStorage.removeItem('fh_user_email');
    setIsLoggedIn(false);
  };

  const openBookModal = (service: typeof servicesCatalog[0]) => {
    setSelectedService(service);
    setReqEscrowAmount(service.price);
    setReqInstructions(`Provide certified assistance for ${service.title} at parents' residence.`);
    if (activeParent) setReqParentId(activeParent.id);
    setShowBookModal(true);
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;
    setIsSubmitting(true);
    try {
      const api = getApiBaseUrl();
      const parentToUse = parents.find((p) => p.id === reqParentId) || activeParent;
      const res = await fetch(`${api}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: currentUserId,
          parentId: parentToUse ? parentToUse.id : undefined,
          title: selectedService.title,
          category: selectedService.category,
          escrowAmount: reqEscrowAmount,
          specialInstructions: reqInstructions,
        }),
      });

      if (res.ok) {
        const newTask = await res.json();
        playNotificationChime('success');
        setShowBookModal(false);
        setToastMessage(`Service booked! ${formatPrice(reqEscrowAmount)} secured in Escrow.`);
        setTimeout(() => setToastMessage(null), 4000);
        await fetchAllData();
        setSelectedTask(newTask);
        setActiveTab('tracking');
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to book service.');
      }
    } catch (err: any) {
      alert(err.message || 'Network error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveParent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentNameInput.trim()) return;
    setIsSubmitting(true);
    try {
      const api = getApiBaseUrl();
      const payload = {
        clientId: currentUserId,
        parentName: parentNameInput.trim(),
        primaryPhone: parentPhoneInput.trim(),
        whatsappPhone: parentWhatsappInput.trim() || parentPhoneInput.trim(),
        locality: parentLocalityInput.trim() || 'Pan-India',
        fullAddress: parentAddressInput.trim() || 'India',
        coordinatesLat: 17.4156,
        coordinatesLng: 78.4357,
        medicalNotes: parentNotesInput.trim(),
      };

      if (showEditParentModal && editingParent) {
        const res = await fetch(`${api}/api/parents/${editingParent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          setShowEditParentModal(false);
          setToastMessage('Parent residence updated.');
          await fetchAllData();
        }
      } else {
        const res = await fetch(`${api}/api/parents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const created = await res.json();
          setShowAddParentModal(false);
          setActiveParentId(created.id);
          setToastMessage('Parent residence registered.');
          await fetchAllData();
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save parent details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditParent = (parent: ParentProfile) => {
    setEditingParent(parent);
    setParentNameInput(parent.parent_name);
    setParentPhoneInput(parent.primary_phone);
    setParentWhatsappInput(parent.whatsapp_phone || parent.primary_phone);
    setParentLocalityInput(parent.locality);
    setParentAddressInput(parent.full_address);
    setParentNotesInput(parent.medical_notes || '');
    setShowEditParentModal(true);
  };

  const handleDeleteParent = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove ${name}'s residence profile?`)) return;
    try {
      const api = getApiBaseUrl();
      const res = await fetch(`${api}/api/parents/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setToastMessage('Parent residence removed.');
        await fetchAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const api = getApiBaseUrl();
      const res = await fetch(`${api}/api/client/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          fullName: settingsFullName,
          email: settingsEmail,
          phone: settingsPhone,
          countryResidence: settingsCountry,
          currency: userCurrency,
        }),
      });
      if (res.ok) {
        setCurrentUserName(settingsFullName);
        localStorage.setItem('fh_user_name', settingsFullName);
        localStorage.setItem('fh_currency', userCurrency);
        setToastMessage('Settings updated.');
        setTimeout(() => setToastMessage(null), 3000);
        setShowSettingsModal(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingSettings(false);
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
    { title: 'Triage & Partner Matching', desc: 'Central operations assigns a verified local care companion.' },
    { title: 'Companion Dispatched', desc: 'Assigned companion begins transit toward parents home.' },
    { title: 'Doorstep Check-In & Care', desc: 'Hardware GPS lock (<150m) and timestamped photo proof taken.' },
    { title: 'NRI Review & Escrow Release', desc: 'Inspect vitals and verified photo proof before payout release.' },
  ];

  // ==========================================
  // VIEW: AUTHENTICATION SCREEN
  // ==========================================
  if (!isLoggedIn) {
    return (
      <AuthView
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
        onSuccess={(user) => {
          localStorage.setItem('fh_user_logged_in', 'true');
          localStorage.setItem('fh_user_id', user.id);
          localStorage.setItem('fh_user_name', user.full_name);
          localStorage.setItem('fh_user_email', user.email);
          setCurrentUserId(user.id);
          setCurrentUserName(user.full_name);
          setCurrentUserEmail(user.email);
          setIsLoggedIn(true);
          fetchAllData(user.id);
        }}
      />
    );
  }

  // ==========================================
  // VIEW: AUTHENTICATED CLIENT SANCTUARY
  // ==========================================
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-slate-100 font-body transition-colors duration-200">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2.5 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2.5 rounded-xl shadow-lg animate-in slide-in-from-top-3">
          <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* ================= ULTRA-CLEAN SIMPLIFIED HEADER ================= */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#090D16]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Left: Brand Identity */}
          <div
            onClick={() => setActiveTab('services')}
            className="flex items-center gap-2.5 cursor-pointer shrink-0"
          >
            <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center p-1 shadow-xs shrink-0">
              <img src="/logo_icon.png" alt="FamilyHubs" className="w-full h-full object-contain" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              FamilyHubs
            </span>
          </div>

          {/* Center: Simplified 3 Navigation Hubs */}
          <nav className="flex items-center gap-1 bg-slate-100 dark:bg-[#111827] p-1 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <button
              onClick={() => setActiveTab('services')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'services'
                  ? 'bg-white dark:bg-[#1E293B] text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Services
            </button>
            <button
              onClick={() => setActiveTab('tracking')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'tracking'
                  ? 'bg-white dark:bg-[#1E293B] text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>Requests</span>
              {tasks.length > 0 && (
                <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-1.5 py-0.2 rounded-full">
                  {tasks.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('family')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'family'
                  ? 'bg-white dark:bg-[#1E293B] text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Family
            </button>
          </nav>

          {/* Right: Quick Tools & Profile */}
          <div className="flex items-center gap-2.5">
            {/* Active Parent Selector Pill */}
            {parents.length > 0 && (
              <div className="relative hidden md:block">
                <select
                  value={activeParentId}
                  onChange={(e) => {
                    setActiveParentId(e.target.value);
                    setReqParentId(e.target.value);
                  }}
                  className="bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer pr-7 appearance-none"
                >
                  {parents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.parent_name} ({p.locality})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}

            {/* Escrow Protected Pill */}
            <button
              onClick={() => setShowEscrowModal(true)}
              className="hidden sm:flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 dark:text-emerald-400 transition cursor-pointer"
              title="View Escrow Protection Guarantee"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{formatPrice(lockedEscrow)} Escrow</span>
            </button>

            {/* Dark / Light Mode Switch */}
            <button
              type="button"
              onClick={() => setIsDark(!isDark)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Emergency SOS Trigger */}
            <button
              onClick={() => setShowEmergencyModal(true)}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-xs transition cursor-pointer"
              title="Emergency SOS Relay"
            >
              <Siren className="w-3.5 h-3.5" />
              <span>SOS</span>
            </button>

            {/* Profile Avatar / Settings */}
            <button
              onClick={() => setShowSettingsModal(true)}
              className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center justify-center border border-blue-200 dark:border-blue-900 cursor-pointer"
              title="Account Settings"
            >
              {currentUserName.substring(0, 2).toUpperCase()}
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ================= MAIN CONTAINER ================= */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ======================================================== */}
        {/* HUB 1: CARE SERVICES                                      */}
        {/* ======================================================== */}
        {activeTab === 'services' && (
          <div className="space-y-6">
            {/* Live Ongoing Task Banner */}
            {activeOngoingTask && (
              <div className="bg-white dark:bg-[#111827] border border-blue-200 dark:border-blue-900/60 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <Navigation className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded">
                        {activeOngoingTask.tracking_code}
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Care Dispatch in Progress
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {activeOngoingTask.title} • {activeOngoingTask.status.replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedTask(activeOngoingTask);
                    setActiveTab('tracking');
                  }}
                  className="filial-btn-primary text-xs py-1.5 px-3 cursor-pointer w-full sm:w-auto"
                >
                  Track Live ➔
                </button>
              </div>
            )}

            {/* Clean Hero Search */}
            <div className="bg-white dark:bg-[#111827] rounded-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                    What care do your parents need today?
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    100% Escrow protected. Field companions check in within 150m of your parents' home.
                  </p>
                </div>
              </div>

              {/* Instant Search Bar */}
              <div className="relative pt-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search 'Doctor home visit', 'Inverter check', 'RO plumbing', 'Pooja items'..."
                  className="w-full filial-input pl-10"
                />
              </div>
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {[
                { id: 'ALL', label: 'All Services', icon: Sparkles },
                { id: 'MEDICAL_TRANSPORT', label: 'Doctor & Health', icon: Stethoscope },
                { id: 'HOME_MAINTENANCE', label: 'Electrical & Power', icon: Wrench },
                { id: 'ERRANDS', label: 'Provisions & Pooja', icon: ShoppingBag },
                { id: 'EMERGENCY', label: '24/7 Emergency', icon: AlertCircle },
              ].map((cat) => {
                const IconComponent = cat.icon;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Service Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredServices.map((service) => (
                <div
                  key={service.id}
                  className="filial-card overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    {/* Visual Banner */}
                    <div className="h-40 w-full bg-slate-100 dark:bg-slate-800 overflow-hidden relative border-b border-slate-200 dark:border-slate-800">
                      <img
                        src={service.banner}
                        alt={service.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-3 left-3 bg-white/95 dark:bg-[#111827]/95 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs">
                        {service.badge}
                      </div>
                      <div className="absolute top-3 right-3 bg-white/95 dark:bg-[#111827]/95 px-2 py-0.5 rounded-full text-[11px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 border border-slate-200 dark:border-slate-700 shadow-xs">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        <span>{service.rating}</span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-2">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                        {service.title}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        {service.desc}
                      </p>

                      <div className="space-y-1 pt-1">
                        {service.features.map((feat, fIdx) => (
                          <div key={fIdx} className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Price & Booking Trigger */}
                  <div className="p-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Escrow Hold</span>
                      <span className="text-base font-bold font-mono text-slate-900 dark:text-white">
                        {formatPrice(service.price)}
                      </span>
                    </div>

                    <button
                      onClick={() => openBookModal(service)}
                      className="filial-btn-primary text-xs py-1.5 px-3.5 cursor-pointer"
                    >
                      Book Care
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* HUB 2: LIVE TRACKING & REQUESTS                           */}
        {/* ======================================================== */}
        {activeTab === 'tracking' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Requests List */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between pb-1">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Care Requests
                  </h2>
                  <button onClick={() => fetchAllData()} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1 pb-1">
                  <button
                    onClick={() => setRequestFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      requestFilter === 'ALL'
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                        : 'bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    All ({tasks.length})
                  </button>
                  <button
                    onClick={() => setRequestFilter('ACTIVE')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      requestFilter === 'ACTIVE'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    Ongoing ({tasks.filter((t) => t.status !== 'COMPLETED').length})
                  </button>
                  <button
                    onClick={() => setRequestFilter('COMPLETED')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      requestFilter === 'COMPLETED'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    Completed ({tasks.filter((t) => t.status === 'COMPLETED').length})
                  </button>
                </div>

                {tasks.length === 0 ? (
                  <div className="p-8 text-center bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 space-y-2">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                      <Heart className="w-5 h-5" />
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">No care requests yet</div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                      Book certified doctor visits or essentials for your parents.
                    </p>
                    <button
                      onClick={() => setActiveTab('services')}
                      className="filial-btn-primary text-xs py-1.5 px-3 cursor-pointer mt-2"
                    >
                      Browse Services ➔
                    </button>
                  </div>
                ) : filteredTasks.length === 0 ? (
                  <div className="p-6 text-center bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                    No requests match this filter.
                  </div>
                ) : (
                  filteredTasks.map((task) => {
                    const isSelected = selectedTask?.id === task.id;
                    const isCompleted = task.status === 'COMPLETED';

                    return (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className={`p-3.5 rounded-xl cursor-pointer transition border text-left ${
                          isSelected
                            ? 'bg-white dark:bg-[#1E293B] border-blue-500 ring-2 ring-blue-500/10 shadow-xs'
                            : 'bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded">
                            {task.tracking_code}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              isCompleted
                                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                                : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400'
                            }`}
                          >
                            {task.status.replace(/_/g, ' ')}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 dark:text-white mt-1.5 line-clamp-1">
                          {task.title}
                        </h4>

                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {task.parent?.locality || 'Pan-India'}
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                            {formatPrice(task.escrow?.amount || 45)} Escrow
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Right Column: Detailed Operation View */}
              <div className="lg:col-span-7">
                {selectedTask ? (
                  <div className="bg-white dark:bg-[#111827] p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 dark:border-slate-800">
                      <div>
                        <div className="text-xs font-mono text-blue-600 dark:text-blue-400 font-bold">{selectedTask.tracking_code}</div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">{selectedTask.title}</h3>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400">Protected Escrow</div>
                        <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                          {formatPrice(selectedTask.escrow?.amount || 45)}
                        </div>
                      </div>
                    </div>

                    {/* Progress Stepper */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                        Service Progress
                      </h4>
                      <div className="relative pl-5 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                        {friendlySteps.map((step, idx) => {
                          const currentStep = getStepIndex(selectedTask.status);
                          const isDone = idx <= currentStep;
                          const isCurrent = idx === currentStep;

                          return (
                            <div key={idx} className="relative flex items-start gap-3">
                              <div
                                className={`absolute -left-5 mt-0.5 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[10px] font-bold transition ${
                                  isDone
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-white dark:bg-[#1E293B] text-slate-400 border border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                {isDone ? '✓' : idx + 1}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-semibold ${isDone ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                                    {step.title}
                                  </span>
                                  {isCurrent && (
                                    <span className="text-[9px] bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 px-1.5 py-0.2 rounded font-semibold">
                                      Current
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{step.desc}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Verified Photo Proof */}
                    <div className="bg-slate-50 dark:bg-[#0F172A] rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <Camera className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">Forensic Photo Verification</h4>
                      </div>

                      {selectedTask.verification_logs && selectedTask.verification_logs.length > 0 ? (
                        <div className="p-3 bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shadow-2xs">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                              <img
                                src={getImageUrl(selectedTask.verification_logs[0].selfie_image_url)}
                                alt="Verification Proof"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-900 dark:text-white">
                                {selectedTask.verification_logs[0].stage.replace('_', ' ')}
                              </div>
                              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                                ✓ GPS Verified ({Math.round(selectedTask.verification_logs[0].distance_from_target_meters)}m)
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => setShowProofModal(selectedTask.verification_logs![0])}
                            className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 rounded-lg cursor-pointer"
                          >
                            Inspect
                          </button>
                        </div>
                      ) : (
                        <div className="p-3 text-center text-xs text-slate-400 bg-white dark:bg-[#111827] rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                          Waiting for companion arrival. Verified photo will appear here.
                        </div>
                      )}
                    </div>

                    {/* Live Movement Trigger */}
                    {(selectedTask.status === 'IN_PROGRESS' || selectedTask.status === 'ACCEPTED' || selectedTask.status === 'DISPATCHED') && (
                      <div className="bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                            <Navigation className="w-4 h-4 animate-pulse" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">Live Caregiver Movement</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">Track helper traveling live to residence</div>
                          </div>
                        </div>
                        <button
                          onClick={() => setTrackingTargetTask(selectedTask)}
                          className="filial-btn-primary text-xs py-1.5 px-3 cursor-pointer"
                        >
                          <span>Open Map</span>
                        </button>
                      </div>
                    )}

                    {/* Review for Completed Tasks */}
                    {selectedTask.status === 'COMPLETED' && (
                      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3.5 flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                            <span>{selectedTask.review ? 'Service Review' : 'Rate Service'}</span>
                          </div>
                          {selectedTask.review ? (
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                              {'★'.repeat(selectedTask.review.rating)} - "{selectedTask.review.feedback_text || 'Completed with excellence'}"
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              Please rate the companion's punctuality and care.
                            </p>
                          )}
                        </div>

                        {!selectedTask.review && (
                          <button
                            onClick={() => setReviewTargetTask(selectedTask)}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition cursor-pointer"
                          >
                            Rate Helper
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white dark:bg-[#111827] p-10 text-center rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                    Select a request to inspect live progress.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* HUB 3: FAMILY SANCTUARY                                   */}
        {/* ======================================================== */}
        {activeTab === 'family' && (
          <div className="space-y-5">
            {/* Sanctuary Sub-tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-200 dark:border-slate-800 pb-2.5">
              {[
                { id: 'residences', label: 'Parent Residences', icon: MapPin },
                { id: 'health', label: 'Health & Vitals', icon: Activity },
                { id: 'medications', label: 'Medications & Refills', icon: Pill },
                { id: 'siblings', label: 'Sibling Care Circle', icon: Users },
              ].map((sub) => {
                const SubIcon = sub.icon;
                const isSelected = familySubTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => setFamilySubTab(sub.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <SubIcon className="w-3.5 h-3.5" />
                    <span>{sub.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Sub-Panel 1: Parent Residences */}
            {familySubTab === 'residences' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Registered Residences in India</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Addresses and emergency contacts.</p>
                  </div>
                  <button
                    onClick={() => {
                      setParentNameInput('');
                      setParentPhoneInput('+91 ');
                      setParentWhatsappInput('+91 ');
                      setParentLocalityInput('');
                      setParentAddressInput('');
                      setParentNotesInput('');
                      setShowAddParentModal(true);
                    }}
                    className="filial-btn-primary text-xs py-1.5 px-3 cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Residence</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {parents.map((p) => (
                    <div key={p.id} className="filial-card p-5 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">{p.parent_name}</h4>
                          <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">{p.locality}</span>
                        </div>
                        <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                          <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                        <div><strong className="text-slate-900 dark:text-slate-200">Address:</strong> {p.full_address}</div>
                        <div><strong className="text-slate-900 dark:text-slate-200">Phone:</strong> <span className="font-mono">{p.primary_phone}</span></div>
                        <div><strong className="text-slate-900 dark:text-slate-200">WhatsApp:</strong> <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{p.whatsapp_phone || p.primary_phone}</span></div>
                      </div>

                      {p.medical_notes && (
                        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                          <strong>Care Notes:</strong> {p.medical_notes}
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                          onClick={() => handleOpenEditParent(p)}
                          className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Pencil className="w-3 h-3 text-slate-500" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteParent(p.id, p.parent_name)}
                          className="py-1.5 px-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-semibold text-xs transition flex items-center justify-center gap-1 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-Panel 2: Health & Vitals */}
            {familySubTab === 'health' && (
              <HealthView
                parentId={activeParent?.id || ''}
                parentName={activeParent?.parent_name || 'My Parents'}
                clientId={currentUserId}
                onRefillCreated={() => {
                  fetchAllData();
                  setActiveTab('tracking');
                }}
              />
            )}

            {/* Sub-Panel 3: Medications & Pharmacy Refills */}
            {familySubTab === 'medications' && (
              <HealthView
                parentId={activeParent?.id || ''}
                parentName={activeParent?.parent_name || 'My Parents'}
                clientId={currentUserId}
                onRefillCreated={() => {
                  fetchAllData();
                  setActiveTab('tracking');
                }}
              />
            )}

            {/* Sub-Panel 4: Sibling Care Circle */}
            {familySubTab === 'siblings' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Sibling Care Circle</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Synchronize brothers and sisters across USA, UK, Canada, and UAE.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowFamilyModal(true)}
                    className="filial-btn-primary text-xs py-1.5 px-3 cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Invite Sibling</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {familyMembers.map((member) => {
                    const name = member.invited_name || (member as any).full_name || 'Family Member';
                    const email = member.invited_email || (member as any).email || '';
                    return (
                      <div key={member.id} className="filial-card p-5 space-y-2.5">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center justify-center">
                              {name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-900 dark:text-white">{name}</h4>
                              <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">{member.relationship}</span>
                            </div>
                          </div>
                          <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-semibold">
                            Active
                          </span>
                        </div>

                        <div className="text-xs text-slate-500 space-y-0.5 pt-1">
                          {email && <div><strong>Email:</strong> {email}</div>}
                          <div><strong>Status:</strong> <span className="font-semibold text-emerald-600 dark:text-emerald-400">{member.status || 'ACTIVE'}</span></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ================= QUICK BOOK MODAL ================= */}
      {showBookModal && selectedService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#111827] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{selectedService.title}</h3>
              </div>
              <button onClick={() => setShowBookModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmBooking} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Select Parent Residence</label>
                {parents.length === 0 ? (
                  <div className="p-3 bg-amber-50 text-amber-800 rounded-lg text-xs">
                    Please add a parent residence first.
                  </div>
                ) : (
                  <select
                    value={reqParentId}
                    onChange={(e) => setReqParentId(e.target.value)}
                    className="w-full filial-input"
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
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Specific Instructions for Local Helper</label>
                <textarea
                  rows={3}
                  value={reqInstructions}
                  onChange={(e) => setReqInstructions(e.target.value)}
                  className="w-full filial-input"
                  required
                />
              </div>

              {/* Escrow Guarantee Box */}
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between">
                <div>
                  <div className="font-bold text-emerald-700 dark:text-emerald-400">Protected Escrow Amount</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Released only after arrival photo &amp; GPS inspection</div>
                </div>
                <div className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400">
                  {formatPrice(reqEscrowAmount)}
                </div>
              </div>

              <div className="pt-2 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowBookModal(false)}
                  className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 filial-btn-primary py-2 text-xs font-semibold cursor-pointer"
                >
                  {isSubmitting ? 'Booking...' : `Confirm & Secure (${formatPrice(reqEscrowAmount)})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= ESCROW MODAL ================= */}
      {showEscrowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#111827] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Escrow Protection Vault</h3>
              </div>
              <button onClick={() => setShowEscrowModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Locked in Escrow</div>
                <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">{formatPrice(lockedEscrow)}</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Total Released</div>
                <div className="text-lg font-bold font-mono text-slate-800 dark:text-white mt-1">{formatPrice(releasedEscrow)}</div>
              </div>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 rounded-xl border border-emerald-200/60 dark:border-emerald-800/40">
              <div className="font-bold text-emerald-700 dark:text-emerald-400">Escrow Guarantee:</div>
              <p>• Companion must arrive within 150m of parent doorstep.</p>
              <p>• GPS timestamp and photo proof required.</p>
              <p>• Funds released only after verification.</p>
            </div>

            <button
              onClick={() => setShowEscrowModal(false)}
              className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ================= PROOF PHOTO MODAL ================= */}
      {showProofModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#111827] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Verified On-Site Arrival Photo</h3>
              <button onClick={() => setShowProofModal(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <div className="rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 aspect-square relative border border-slate-200 dark:border-slate-700">
              <img
                src={getImageUrl(showProofModal.selfie_image_url)}
                alt="Verification Proof"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2.5 right-2.5 bg-white/95 dark:bg-[#111827]/95 text-emerald-600 dark:text-emerald-400 text-xs px-2 py-0.5 rounded-full font-bold shadow-xs">
                ✓ GPS Checked
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex justify-between">
                <span>Distance from Residence:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {Math.round(showProofModal.distance_from_target_meters)}m (&le;150m Pass)
                </span>
              </div>
              <div className="flex justify-between">
                <span>Anti-Tamper Integrity:</span>
                <span className="font-mono text-[10px] text-slate-500 bg-white dark:bg-slate-800 px-1.5 py-0.2 rounded">
                  SHA-256 HMAC-OK
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowProofModal(null)}
              className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ================= ADD / EDIT PARENT MODAL ================= */}
      {(showAddParentModal || showEditParentModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#111827] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {showEditParentModal ? 'Edit Parent Residence' : 'Add Parent Residence'}
              </h3>
              <button
                onClick={() => {
                  setShowAddParentModal(false);
                  setShowEditParentModal(false);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveParent} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Parent Full Name(s) *</label>
                <input
                  type="text"
                  value={parentNameInput}
                  onChange={(e) => setParentNameInput(e.target.value)}
                  placeholder="e.g. Lakshmi & Ramana Reddy"
                  className="w-full filial-input"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Calling Phone *</label>
                  <input
                    type="tel"
                    value={parentPhoneInput}
                    onChange={(e) => setParentPhoneInput(e.target.value)}
                    placeholder="+91 94401 23456"
                    className="w-full filial-input font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">WhatsApp *</label>
                  <input
                    type="tel"
                    value={parentWhatsappInput}
                    onChange={(e) => setParentWhatsappInput(e.target.value)}
                    placeholder="+91 94401 23456"
                    className="w-full filial-input font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">City / Locality *</label>
                <input
                  type="text"
                  value={parentLocalityInput}
                  onChange={(e) => setParentLocalityInput(e.target.value)}
                  placeholder="e.g. Banjara Hills, Hyderabad"
                  className="w-full filial-input"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Street Address *</label>
                <textarea
                  rows={2}
                  value={parentAddressInput}
                  onChange={(e) => setParentAddressInput(e.target.value)}
                  placeholder="House No, Road, Landmark"
                  className="w-full filial-input"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Medical Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={parentNotesInput}
                  onChange={(e) => setParentNotesInput(e.target.value)}
                  placeholder="Medications, hospital preferences..."
                  className="w-full filial-input"
                />
              </div>

              <div className="pt-2 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddParentModal(false);
                    setShowEditParentModal(false);
                  }}
                  className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 filial-btn-primary py-2 text-xs font-semibold cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : 'Save Residence'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= SETTINGS MODAL ================= */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#111827] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Account Preferences</h3>
              </div>
              <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Your Full Name</label>
                <input
                  type="text"
                  value={settingsFullName}
                  onChange={(e) => setSettingsFullName(e.target.value)}
                  required
                  className="w-full filial-input"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Your Email</label>
                <input
                  type="email"
                  value={settingsEmail}
                  onChange={(e) => setSettingsEmail(e.target.value)}
                  required
                  className="w-full filial-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Country</label>
                  <select
                    value={settingsCountry}
                    onChange={(e) => setSettingsCountry(e.target.value)}
                    className="w-full filial-input"
                  >
                    <option value="United States">United States</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="Canada">Canada</option>
                    <option value="Australia">Australia</option>
                    <option value="UAE (Dubai)">UAE (Dubai)</option>
                    <option value="India">India</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Display Currency</label>
                  <select
                    value={userCurrency}
                    onChange={(e) => setUserCurrency(e.target.value)}
                    className="w-full filial-input font-mono"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="CAD">CAD ($)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="flex-1 filial-btn-primary py-2 text-xs font-semibold cursor-pointer"
                >
                  {isSavingSettings ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Emergency Modal */}
      <EmergencyModal
        isOpen={showEmergencyModal}
        onClose={() => setShowEmergencyModal(false)}
        parents={parents}
        clientId={currentUserId}
        onEmergencyTriggered={() => {
          fetchAllData();
          setActiveTab('tracking');
        }}
      />

      {/* Live Tracking Modal */}
      {trackingTargetTask && (
        <LiveTrackingModal
          task={trackingTargetTask}
          isOpen={!!trackingTargetTask}
          onClose={() => setTrackingTargetTask(null)}
          latestTelemetry={latestPartnerTelemetry}
        />
      )}

      {/* Task Review Modal */}
      {reviewTargetTask && (
        <TaskReviewModal
          task={reviewTargetTask}
          isOpen={!!reviewTargetTask}
          onClose={() => setReviewTargetTask(null)}
          onReviewSubmitted={() => {
            setReviewTargetTask(null);
            fetchAllData();
            setToastMessage('Review submitted. Thank you!');
            setTimeout(() => setToastMessage(null), 3000);
          }}
        />
      )}

      {/* Family Share Modal */}
      <FamilyShareModal
        isOpen={showFamilyModal}
        onClose={() => {
          setShowFamilyModal(false);
          fetchAllData();
        }}
        clientId={currentUserId}
      />
    </div>
  );
}
