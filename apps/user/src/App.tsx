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
  FileText,
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
  // Ergonomic 3-Hub Architecture: services, tracking, family
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
  const [isEscrowFrozen, setIsEscrowFrozen] = useState<boolean>(false);

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

  // Curated Concierge Services
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

  // Price formatting helper
  const formatPrice = (usdAmount: number) => {
    if (userCurrency === 'INR') return `₹${Math.round(usdAmount * 83.5)}`;
    if (userCurrency === 'GBP') return `£${(usdAmount * 0.79).toFixed(0)}`;
    if (userCurrency === 'EUR') return `€${(usdAmount * 0.92).toFixed(0)}`;
    if (userCurrency === 'CAD') return `C$${(usdAmount * 1.36).toFixed(0)}`;
    return `$${usdAmount} USD`;
  };

  // Data Fetching
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

  // WebSocket Connection
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
          setTimeout(() => setToastMessage(null), 4500);
        } else if (message.type === 'PARTNER_LOCATION_UPDATE') {
          setLatestPartnerTelemetry(message.payload);
        }
      } catch (e) {
        // ignore parse error
      }
    };

    return () => {
      ws.close();
    };
  }, [isLoggedIn, currentUserId]);

  const activeParent = parents.find((p) => p.id === activeParentId) || parents[0];

  // Escrow Calculations
  const lockedEscrow = tasks
    .filter((t) => t.status !== 'COMPLETED' && t.escrow)
    .reduce((acc, t) => acc + (t.escrow?.amount || 0), 0);

  const releasedEscrow = tasks
    .filter((t) => t.status === 'COMPLETED' && t.escrow)
    .reduce((acc, t) => acc + (t.escrow?.amount || 0), 0);

  // Active Ongoing Task (if any)
  const activeOngoingTask = tasks.find(
    (t) => t.status === 'DISPATCHED' || t.status === 'ACCEPTED' || t.status === 'IN_PROGRESS' || t.status === 'VERIFICATION_SUBMITTED'
  );

  // Filtered Services Catalog
  const filteredServices = servicesCatalog.filter((s) => {
    const matchesCat = selectedCategory === 'ALL' || s.category === selectedCategory;
    const matchesSearch =
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.features.some((f) => f.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  // Filtered Tasks
  const filteredTasks = tasks.filter((t) => {
    if (requestFilter === 'ACTIVE') return t.status !== 'COMPLETED';
    if (requestFilter === 'COMPLETED') return t.status === 'COMPLETED';
    return true;
  });

  // Logout Handler
  const handleLogout = () => {
    localStorage.removeItem('fh_user_logged_in');
    localStorage.removeItem('fh_user_id');
    localStorage.removeItem('fh_user_name');
    localStorage.removeItem('fh_user_email');
    setIsLoggedIn(false);
  };

  // Open Booking Modal
  const openBookModal = (service: typeof servicesCatalog[0]) => {
    setSelectedService(service);
    setReqEscrowAmount(service.price);
    setReqInstructions(`Provide certified assistance for ${service.title} at parents' residence.`);
    if (activeParent) setReqParentId(activeParent.id);
    setShowBookModal(true);
  };

  // Confirm Service Booking
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
        setToastMessage(`Service booked! $${reqEscrowAmount} secured in Escrow.`);
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

  // Parent CRUD Handlers
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
          setToastMessage('Parent residence updated successfully!');
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
          setToastMessage('Parent residence registered successfully!');
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

  // Save Settings
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
        setToastMessage('Account settings updated.');
        setTimeout(() => setToastMessage(null), 3000);
        setShowSettingsModal(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Stepper helper
  const getStepIndex = (status: string) => {
    switch (status) {
      case 'PENDING_OPS_REVIEW':
        return 0;
      case 'DISPATCHED':
        return 1;
      case 'ACCEPTED':
      case 'IN_PROGRESS':
        return 2;
      case 'VERIFICATION_SUBMITTED':
        return 3;
      case 'COMPLETED':
        return 4;
      default:
        return 0;
    }
  };

  const friendlySteps = [
    { title: 'Triage & Partner Matching', desc: 'Central operations assigns a verified local care companion.' },
    { title: 'Companion Dispatched', desc: 'Assigned companion begins transit toward parents home.' },
    { title: 'Doorstep Check-In & Care', desc: 'Hardware GPS lock (<150m) and timestamped photo proof taken.' },
    { title: 'NRI Review & Escrow Release', desc: 'Inspect vitals and verified photo proof before payout release.' },
  ];

  // ==========================================
  // VIEW: LANDING & AUTH SCREEN
  // ==========================================
  if (!isLoggedIn) {
    return (
      <AuthView
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
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#1C1917] selection:bg-[#C25E2E] selection:text-white font-body">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 bg-white border border-[#E7DFD5] text-[#1C1917] px-5 py-3 rounded-xl shadow-lg animate-in slide-in-from-top-3">
          <Sparkles className="w-5 h-5 text-[#C25E2E] shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* ================= HEADER ================= */}
      <header className="sticky top-0 z-40 bg-[#FAF7F2]/95 backdrop-blur-md border-b border-[#E7DFD5]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-3">
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <div
              onClick={() => setActiveTab('services')}
              className="flex items-center gap-2.5 cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-[#C25E2E] flex items-center justify-center text-white shadow-xs">
                <Heart className="w-5 h-5 fill-white" />
              </div>
              <div>
                <span className="font-display text-xl font-bold text-[#1C1917] tracking-tight">FamilyHubs</span>
                <span className="ml-2 hidden sm:inline-block text-[11px] bg-[#FBECE5] text-[#C25E2E] font-semibold px-2 py-0.5 rounded-full border border-[#F5D5C6]">
                  The Filial Sanctuary
                </span>
              </div>
            </div>

            {/* Active Parent Selector Switcher */}
            {parents.length > 0 && (
              <div className="relative ml-2 hidden md:block">
                <select
                  value={activeParentId}
                  onChange={(e) => {
                    setActiveParentId(e.target.value);
                    setReqParentId(e.target.value);
                  }}
                  className="bg-white border border-[#E7DFD5] text-xs font-semibold text-[#1C1917] rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#C25E2E] cursor-pointer shadow-2xs pr-8 appearance-none"
                >
                  {parents.map((p) => (
                    <option key={p.id} value={p.id}>
                      Care for: {p.parent_name} ({p.locality})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[#8C827A] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
          </div>

          {/* Quick Actions & Profile */}
          <div className="flex items-center gap-2.5">
            {/* Escrow Protected Live Badge */}
            <button
              onClick={() => setShowEscrowModal(true)}
              className="hidden sm:flex items-center gap-2 bg-[#E8F3EE] hover:bg-[#DCF0E5] border border-[#C8E5D7] px-3 py-1.5 rounded-xl text-xs font-semibold text-[#1F5C42] transition cursor-pointer"
              title="View Escrow Protection Guarantee"
            >
              <ShieldCheck className="w-4 h-4 text-[#1F5C42]" />
              <span>{formatPrice(lockedEscrow)} Escrow</span>
            </button>

            {/* Emergency SOS Trigger */}
            <button
              onClick={() => setShowEmergencyModal(true)}
              className="bg-[#B91C1C] hover:bg-[#991B1B] text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              title="Activate Emergency Care Relay"
            >
              <Siren className="w-4 h-4 animate-pulse" />
              <span>EMERGENCY SOS</span>
            </button>

            {/* Settings Trigger */}
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2 rounded-xl text-[#574F49] hover:text-[#1C1917] hover:bg-white border border-[#E7DFD5] transition cursor-pointer shadow-2xs"
              title="Account Settings & Currency"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* User Profile Avatar */}
            <div
              onClick={() => setShowSettingsModal(true)}
              className="flex items-center gap-2.5 cursor-pointer pl-1.5"
            >
              <div className="w-8 h-8 rounded-full bg-[#FBECE5] text-[#C25E2E] font-bold text-xs flex items-center justify-center border border-[#F5D5C6]">
                {currentUserName.substring(0, 2).toUpperCase()}
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-[#8C827A] hover:text-[#B91C1C] hover:bg-[#FEE2E2] transition cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ================= 3-HUB NAVIGATION BAR ================= */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-2 border-t border-[#E7DFD5] pt-1.5 pb-1.5">
          <button
            onClick={() => setActiveTab('services')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'services'
                ? 'bg-white text-[#C25E2E] shadow-xs border border-[#E7DFD5]'
                : 'text-[#574F49] hover:text-[#1C1917] hover:bg-white/60'
            }`}
          >
            <Sparkles className="w-4 h-4 text-[#C25E2E]" />
            <span>Care Services</span>
          </button>

          <button
            onClick={() => setActiveTab('tracking')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'tracking'
                ? 'bg-white text-[#C25E2E] shadow-xs border border-[#E7DFD5]'
                : 'text-[#574F49] hover:text-[#1C1917] hover:bg-white/60'
            }`}
          >
            <Activity className="w-4 h-4 text-[#1F5C42]" />
            <span>Live Tracking &amp; Requests</span>
            <span className="bg-[#FAF7F2] border border-[#E7DFD5] text-[#574F49] px-1.5 py-0.2 rounded-full text-[10px]">
              {tasks.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('family')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'family'
                ? 'bg-white text-[#C25E2E] shadow-xs border border-[#E7DFD5]'
                : 'text-[#574F49] hover:text-[#1C1917] hover:bg-white/60'
            }`}
          >
            <Heart className="w-4 h-4 text-[#C25E2E] fill-[#C25E2E]/20" />
            <span>Family Sanctuary</span>
            <span className="bg-[#FAF7F2] border border-[#E7DFD5] text-[#574F49] px-1.5 py-0.2 rounded-full text-[10px]">
              {parents.length} Parents
            </span>
          </button>
        </div>
      </header>

      {/* ================= MAIN CONTENT CONTAINER ================= */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-7">
        {/* ======================================================== */}
        {/* HUB 1: CARE SERVICES                                      */}
        {/* ======================================================== */}
        {activeTab === 'services' && (
          <div className="space-y-6">
            {/* Live Ongoing Task Banner (If in progress) */}
            {activeOngoingTask && (
              <div className="bg-[#FFFFFF] border-2 border-[#C25E2E]/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#C25E2E] text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Navigation className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[#C25E2E] bg-[#FBECE5] px-2 py-0.5 rounded">
                        {activeOngoingTask.tracking_code}
                      </span>
                      <span className="text-xs font-bold text-[#1C1917]">
                        Active Care Dispatch in Progress
                      </span>
                    </div>
                    <p className="text-xs text-[#574F49] mt-0.5">
                      {activeOngoingTask.title} • {activeOngoingTask.status.replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      setSelectedTask(activeOngoingTask);
                      setActiveTab('tracking');
                    }}
                    className="filial-btn-primary text-xs py-2 px-4 cursor-pointer w-full sm:w-auto"
                  >
                    Track Live Progress ➔
                  </button>
                </div>
              </div>
            )}

            {/* Personalized Hero Banner & Search */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 text-[#1C1917] border border-[#E7DFD5] shadow-xs relative overflow-hidden">
              <div className="absolute right-0 top-0 w-80 h-80 bg-[#FBECE5]/40 rounded-full blur-3xl pointer-events-none" />

              <div className="max-w-2xl space-y-3 relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E8F3EE] border border-[#C8E5D7] text-[#1F5C42] text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Welcome, {currentUserName.split(' ')[0]} • Dedicated Care for Your Parents in India</span>
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#1C1917]">
                  What care do your parents need today?
                </h2>
                <p className="text-xs sm:text-sm text-[#574F49] leading-relaxed">
                  Every service is protected by 100% Escrow. Verified field companions check in with forensic photo proof within 150m of your parents' doorstep.
                </p>

                {/* Instant Search Bar */}
                <div className="relative pt-1">
                  <Search className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search 'Doctor home visit', 'Inverter check', 'RO plumbing', 'Pooja items'..."
                    className="w-full bg-[#FAF7F2] border border-[#E7DFD5] text-[#1C1917] placeholder-[#8C827A] rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-[#C25E2E] focus:ring-2 focus:ring-[#C25E2E]/10 transition-all"
                  />
                </div>
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
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
                      isSelected
                        ? 'bg-[#C25E2E] text-white shadow-xs'
                        : 'bg-white text-[#574F49] border border-[#E7DFD5] hover:border-[#D6C9BC]'
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Curated Service Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredServices.map((service) => (
                <div
                  key={service.id}
                  className="filial-card overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    {/* Visual Banner */}
                    <div className="h-44 w-full bg-[#FAF7F2] overflow-hidden relative border-b border-[#E7DFD5]">
                      <img
                        src={service.banner}
                        alt={service.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-3 left-3 bg-white/95 px-2.5 py-1 rounded-full text-[11px] font-bold text-[#1C1917] border border-[#E7DFD5] shadow-xs">
                        {service.badge}
                      </div>
                      <div className="absolute top-3 right-3 bg-white/95 px-2.5 py-1 rounded-full text-[11px] font-bold text-[#1C1917] flex items-center gap-1 border border-[#E7DFD5] shadow-xs">
                        <Star className="w-3.5 h-3.5 text-[#B45309] fill-[#B45309]" />
                        <span>{service.rating}</span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-5 space-y-2.5">
                      <h4 className="font-display text-base font-bold text-[#1C1917] leading-snug">
                        {service.title}
                      </h4>
                      <p className="text-xs text-[#574F49] leading-relaxed">{service.desc}</p>

                      {/* Feature Checklist */}
                      <div className="space-y-1.5 pt-1">
                        {service.features.map((feat, fIdx) => (
                          <div key={fIdx} className="flex items-center gap-2 text-[11px] text-[#574F49]">
                            <Check className="w-3.5 h-3.5 text-[#1F5C42] shrink-0" />
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Price & Booking Trigger */}
                  <div className="p-5 pt-3 border-t border-[#E7DFD5] flex items-center justify-between bg-[#FAF7F2]/50">
                    <div>
                      <span className="text-[10px] text-[#8C827A] block font-semibold uppercase">Escrow Hold</span>
                      <span className="text-lg font-bold font-mono text-[#1C1917]">
                        {formatPrice(service.price)}
                      </span>
                    </div>

                    <button
                      onClick={() => openBookModal(service)}
                      className="filial-btn-primary text-xs py-2 px-4 cursor-pointer"
                    >
                      Book Service
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
              {/* Left Column: Requests Queue */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between pb-1">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#8C827A]">
                    Care Requests
                  </h2>
                  <button onClick={() => fetchAllData()} className="p-1.5 text-[#8C827A] hover:text-[#1C1917] cursor-pointer">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 pb-1">
                  <button
                    onClick={() => setRequestFilter('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      requestFilter === 'ALL'
                        ? 'bg-[#1C1917] text-white shadow-2xs'
                        : 'bg-white text-[#574F49] hover:bg-[#FAF7F2] border border-[#E7DFD5]'
                    }`}
                  >
                    All ({tasks.length})
                  </button>
                  <button
                    onClick={() => setRequestFilter('ACTIVE')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      requestFilter === 'ACTIVE'
                        ? 'bg-[#C25E2E] text-white shadow-2xs'
                        : 'bg-white text-[#574F49] hover:bg-[#FAF7F2] border border-[#E7DFD5]'
                    }`}
                  >
                    Ongoing ({tasks.filter((t) => t.status !== 'COMPLETED').length})
                  </button>
                  <button
                    onClick={() => setRequestFilter('COMPLETED')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      requestFilter === 'COMPLETED'
                        ? 'bg-[#1F5C42] text-white shadow-2xs'
                        : 'bg-white text-[#574F49] hover:bg-[#FAF7F2] border border-[#E7DFD5]'
                    }`}
                  >
                    Completed ({tasks.filter((t) => t.status === 'COMPLETED').length})
                  </button>
                </div>

                {/* Requests List */}
                {tasks.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-2xl border border-[#E7DFD5] text-[#8C827A] space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-[#FBECE5] text-[#C25E2E] flex items-center justify-center mx-auto border border-[#F5D5C6]">
                      <Heart className="w-6 h-6" />
                    </div>
                    <div className="font-display text-base font-bold text-[#1C1917]">No active requests yet</div>
                    <p className="text-xs text-[#574F49] max-w-xs mx-auto leading-relaxed">
                      Book certified doctor visits, power backup repair, or provisions for your parents in India.
                    </p>
                    <button
                      onClick={() => setActiveTab('services')}
                      className="filial-btn-primary text-xs py-2 px-4 cursor-pointer"
                    >
                      Browse Services ➔
                    </button>
                  </div>
                ) : filteredTasks.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-2xl border border-[#E7DFD5] text-[#8C827A]">
                    <div className="text-xs font-semibold text-[#1C1917]">No requests match this filter.</div>
                  </div>
                ) : (
                  filteredTasks.map((task) => {
                    const isSelected = selectedTask?.id === task.id;
                    const isCompleted = task.status === 'COMPLETED';

                    return (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className={`p-4 rounded-xl cursor-pointer transition border text-left ${
                          isSelected
                            ? 'bg-white border-[#C25E2E] shadow-sm ring-2 ring-[#C25E2E]/10'
                            : 'bg-white border-[#E7DFD5] hover:border-[#D6C9BC] shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-mono font-bold text-[#C25E2E] bg-[#FBECE5] border border-[#F5D5C6] px-2 py-0.5 rounded">
                            {task.tracking_code}
                          </span>
                          <span
                            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                              isCompleted
                                ? 'bg-[#E8F3EE] text-[#1F5C42] border border-[#C8E5D7]'
                                : 'bg-[#FBECE5] text-[#A3481D] border border-[#F5D5C6]'
                            }`}
                          >
                            {task.status.replace(/_/g, ' ')}
                          </span>
                        </div>

                        <h4 className="font-display text-sm font-bold text-[#1C1917] mt-2 line-clamp-1">{task.title}</h4>

                        <div className="flex items-center gap-4 text-xs text-[#574F49] mt-2">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-[#8C827A]" />
                            {task.parent?.locality || 'Pan-India'}
                          </span>
                          <span className="font-semibold text-[#1C1917] font-mono">
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
                  <div className="bg-white p-6 rounded-2xl border border-[#E7DFD5] shadow-xs space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-4 border-b border-[#E7DFD5]">
                      <div>
                        <div className="text-xs font-mono text-[#C25E2E] font-bold">{selectedTask.tracking_code}</div>
                        <h3 className="font-display text-lg font-bold text-[#1C1917]">{selectedTask.title}</h3>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] text-[#8C827A]">Protected Escrow</div>
                        <div className="text-xl font-bold font-mono text-[#1F5C42]">
                          {formatPrice(selectedTask.escrow?.amount || 45)}
                        </div>
                      </div>
                    </div>

                    {/* Progress Stepper */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#8C827A] mb-4">
                        Service Progress
                      </h4>
                      <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E7DFD5]">
                        {friendlySteps.map((step, idx) => {
                          const currentStep = getStepIndex(selectedTask.status);
                          const isDone = idx <= currentStep;
                          const isCurrent = idx === currentStep;

                          return (
                            <div key={idx} className="relative flex items-start gap-3.5">
                              <div
                                className={`absolute -left-6 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition ${
                                  isDone
                                    ? 'bg-[#1F5C42] text-white shadow-2xs'
                                    : 'bg-white text-[#8C827A] border border-[#E7DFD5]'
                                }`}
                              >
                                {isDone ? '✓' : idx + 1}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm font-semibold ${isDone ? 'text-[#1C1917]' : 'text-[#8C827A]'}`}>
                                    {step.title}
                                  </span>
                                  {isCurrent && (
                                    <span className="text-[10px] bg-[#E8F3EE] text-[#1F5C42] border border-[#C8E5D7] px-2 py-0.5 rounded-full font-semibold">
                                      Current Step
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-[#574F49] mt-0.5">{step.desc}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Verified Photo Proof Section */}
                    <div className="bg-[#FAF7F2] rounded-xl p-4 border border-[#E7DFD5] space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Camera className="w-4 h-4 text-[#C25E2E]" />
                          <h4 className="text-xs font-bold text-[#1C1917]">Arrival Forensic Photo Verification</h4>
                        </div>
                      </div>

                      {selectedTask.verification_logs && selectedTask.verification_logs.length > 0 ? (
                        <div className="p-3 bg-white rounded-xl border border-[#E7DFD5] flex items-center justify-between gap-3 shadow-2xs">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#FAF7F2] border border-[#E7DFD5] shrink-0">
                              <img
                                src={getImageUrl(selectedTask.verification_logs[0].selfie_image_url)}
                                alt="Verification Proof"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-[#1C1917]">
                                {selectedTask.verification_logs[0].stage.replace('_', ' ')}
                              </div>
                              <div className="text-[11px] text-[#1F5C42] font-semibold mt-0.5">
                                ✓ GPS Verified ({Math.round(selectedTask.verification_logs[0].distance_from_target_meters)}m from residence)
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => setShowProofModal(selectedTask.verification_logs![0])}
                            className="px-3 py-1.5 bg-[#FAF7F2] hover:bg-[#F5F1EB] text-xs font-semibold text-[#1C1917] rounded-lg border border-[#E7DFD5] cursor-pointer"
                          >
                            Inspect Proof
                          </button>
                        </div>
                      ) : (
                        <div className="p-4 text-center text-xs text-[#8C827A] bg-white rounded-xl border border-dashed border-[#E7DFD5]">
                          Waiting for companion arrival. Verified photo and sub-150m GPS proof will appear here automatically.
                        </div>
                      )}
                    </div>

                    {/* Live Movement Trigger */}
                    {(selectedTask.status === 'IN_PROGRESS' || selectedTask.status === 'ACCEPTED' || selectedTask.status === 'DISPATCHED') && (
                      <div className="bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#C25E2E] text-white flex items-center justify-center shrink-0 shadow-2xs">
                            <Navigation className="w-5 h-5 animate-pulse" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-[#1C1917]">Live Caregiver Movement</div>
                            <div className="text-[11px] text-[#574F49]">Track companion live en route to parents' home</div>
                          </div>
                        </div>
                        <button
                          onClick={() => setTrackingTargetTask(selectedTask)}
                          className="filial-btn-primary text-xs py-2 px-3.5 cursor-pointer"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>Open Live Map</span>
                        </button>
                      </div>
                    )}

                    {/* CSAT Review for Completed Tasks */}
                    {selectedTask.status === 'COMPLETED' && (
                      <div className="bg-[#FEF3C7]/40 border border-[#FDE68A] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Star className="w-4 h-4 text-[#B45309] fill-[#B45309]" />
                            <span className="text-xs font-bold text-[#1C1917]">
                              {selectedTask.review ? 'Verified Service Review' : 'Service Feedback'}
                            </span>
                          </div>
                          {selectedTask.review ? (
                            <div className="mt-1 space-y-1">
                              <div className="flex items-center gap-1 text-[#B45309] font-bold text-xs">
                                {'★'.repeat(selectedTask.review.rating)}
                                <span className="text-[#574F49] font-medium ml-1">({selectedTask.review.rating}/5 Stars)</span>
                              </div>
                              {selectedTask.review.feedback_text && (
                                <p className="text-[11px] text-[#574F49] italic mt-1">"{selectedTask.review.feedback_text}"</p>
                              )}
                            </div>
                          ) : (
                            <p className="text-[11px] text-[#574F49] mt-0.5">
                              Please rate the helper's punctuality and care quality.
                            </p>
                          )}
                        </div>

                        {!selectedTask.review && (
                          <button
                            onClick={() => setReviewTargetTask(selectedTask)}
                            className="bg-[#B45309] hover:bg-[#92400E] text-white font-bold text-xs px-4 py-2 rounded-xl shadow-2xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
                          >
                            <Star className="w-3.5 h-3.5 fill-white" />
                            <span>Rate Service</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white p-12 text-center rounded-2xl border border-[#E7DFD5] text-[#8C827A]">
                    Select a care request to inspect live progress and verified proof.
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
          <div className="space-y-6">
            {/* Sanctuary Sub-navigation */}
            <div className="flex items-center gap-2 overflow-x-auto border-b border-[#E7DFD5] pb-3">
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
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-white text-[#C25E2E] shadow-xs border border-[#E7DFD5]'
                        : 'text-[#574F49] hover:text-[#1C1917] hover:bg-white/60'
                    }`}
                  >
                    <SubIcon className="w-3.5 h-3.5 text-[#C25E2E]" />
                    <span>{sub.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Sub-Panel 1: Parent Residences */}
            {familySubTab === 'residences' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-xl font-bold text-[#1C1917]">Registered Residences in India</h3>
                    <p className="text-xs text-[#574F49]">Manage addresses, emergency calling numbers, and care instructions.</p>
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
                    className="filial-btn-primary text-xs py-2 px-3.5 cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Residence</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {parents.map((p) => (
                    <div key={p.id} className="filial-card p-6 space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-display text-base font-bold text-[#1C1917]">{p.parent_name}</h4>
                          <span className="text-xs text-[#C25E2E] font-semibold">{p.locality}</span>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-[#FAF7F2] border border-[#E7DFD5] flex items-center justify-center text-[#574F49]">
                          <MapPin className="w-4 h-4 text-[#C25E2E]" />
                        </div>
                      </div>

                      <div className="text-xs text-[#574F49] space-y-1.5">
                        <div><strong className="text-[#1C1917]">Address:</strong> {p.full_address}</div>
                        <div><strong className="text-[#1C1917]">Calling Phone:</strong> <span className="font-mono text-[#1C1917]">{p.primary_phone}</span></div>
                        <div><strong className="text-[#1C1917]">WhatsApp:</strong> <span className="font-mono text-[#1F5C42] font-bold">{p.whatsapp_phone || p.primary_phone}</span></div>
                      </div>

                      {p.medical_notes && (
                        <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E7DFD5] text-xs text-[#574F49]">
                          <strong className="text-[#1C1917]">Care Notes:</strong> {p.medical_notes}
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-3 border-t border-[#E7DFD5]">
                        <button
                          onClick={() => handleOpenEditParent(p)}
                          className="flex-1 py-2 px-3 rounded-xl bg-[#FAF7F2] hover:bg-[#F5F1EB] text-[#1C1917] font-semibold text-xs border border-[#E7DFD5] transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5 text-[#574F49]" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteParent(p.id, p.parent_name)}
                          className="py-2 px-3 rounded-xl bg-[#FEE2E2] hover:bg-[#FECACA] text-[#B91C1C] font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer border border-[#FECACA]"
                          title="Delete Residence"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-[#B91C1C]" />
                          <span>Delete</span>
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
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-xl font-bold text-[#1C1917]">Shared Sibling Care Circle</h3>
                    <p className="text-xs text-[#574F49]">
                      Synchronize brothers and sisters across USA, UK, Canada, and UAE so the entire family stays updated.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowFamilyModal(true)}
                    className="filial-btn-primary text-xs py-2 px-3.5 cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Invite Family Member</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {familyMembers.map((member) => {
                    const name = member.invited_name || (member as any).full_name || 'Family Member';
                    const email = member.invited_email || (member as any).email || '';
                    return (
                      <div key={member.id} className="filial-card p-6 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#FBECE5] text-[#C25E2E] font-bold text-xs flex items-center justify-center border border-[#F5D5C6]">
                              {name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <h4 className="font-display text-sm font-bold text-[#1C1917]">{name}</h4>
                              <span className="text-[11px] text-[#C25E2E] font-semibold">{member.relationship}</span>
                            </div>
                          </div>
                          <span className="text-[10px] bg-[#E8F3EE] text-[#1F5C42] border border-[#C8E5D7] px-2 py-0.5 rounded-full font-semibold">
                            Active Sibling
                          </span>
                        </div>

                        <div className="text-xs text-[#574F49] space-y-1 pt-1">
                          {email && <div><strong className="text-[#1C1917]">Email:</strong> {email}</div>}
                          <div><strong className="text-[#1C1917]">Status:</strong> <span className="font-semibold text-[#1F5C42]">{member.status || 'ACTIVE'}</span></div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1917]/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-[#E7DFD5]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7DFD5]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#C25E2E]" />
                <h3 className="font-display text-base font-bold text-[#1C1917]">{selectedService.title}</h3>
              </div>
              <button onClick={() => setShowBookModal(false)} className="text-[#8C827A] hover:text-[#1C1917] p-1 cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmBooking} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#1C1917] font-semibold mb-1">Select Parent Residence</label>
                {parents.length === 0 ? (
                  <div className="p-3 bg-[#FEF3C7] border border-[#FDE68A] rounded-xl text-[#92400E] text-xs">
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
                <label className="block text-[#1C1917] font-semibold mb-1">Specific Instructions for Local Helper</label>
                <textarea
                  rows={3}
                  value={reqInstructions}
                  onChange={(e) => setReqInstructions(e.target.value)}
                  className="w-full filial-input"
                  required
                />
              </div>

              {/* Escrow Guarantee Box */}
              <div className="p-4 rounded-xl bg-[#E8F3EE] border border-[#C8E5D7] flex items-center justify-between">
                <div>
                  <div className="font-bold text-[#1F5C42]">Protected Escrow Amount</div>
                  <div className="text-[11px] text-[#574F49]">Released only after you inspect arrival photo &amp; GPS proof</div>
                </div>
                <div className="text-xl font-bold font-mono text-[#1F5C42]">
                  {formatPrice(reqEscrowAmount)}
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowBookModal(false)}
                  className="flex-1 py-2.5 bg-[#FAF7F2] border border-[#E7DFD5] text-[#574F49] rounded-xl font-semibold cursor-pointer hover:bg-[#F5F1EB]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 filial-btn-primary py-2.5 text-xs font-semibold cursor-pointer"
                >
                  {isSubmitting ? 'Booking...' : `Confirm & Secure (${formatPrice(reqEscrowAmount)})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= ESCROW PROTECTION MODAL ================= */}
      {showEscrowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1917]/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-[#E7DFD5]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7DFD5]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#1F5C42]" />
                <h3 className="font-display text-base font-bold text-[#1C1917]">100% Escrow Protection Vault</h3>
              </div>
              <button onClick={() => setShowEscrowModal(false)} className="text-[#8C827A] hover:text-[#1C1917] p-1 cursor-pointer">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-left">
              <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E7DFD5]">
                <div className="text-[10px] text-[#8C827A] font-bold uppercase">Locked in Escrow</div>
                <div className="text-xl font-bold font-mono text-[#1F5C42] mt-1">{formatPrice(lockedEscrow)}</div>
                <div className="text-[10px] text-[#574F49] mt-0.5">Awaiting verified service</div>
              </div>

              <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E7DFD5]">
                <div className="text-[10px] text-[#8C827A] font-bold uppercase">Total Released</div>
                <div className="text-xl font-bold font-mono text-[#1C1917] mt-1">{formatPrice(releasedEscrow)}</div>
                <div className="text-[10px] text-[#574F49] mt-0.5">Disbursed upon approval</div>
              </div>
            </div>

            <div className="text-xs text-[#574F49] space-y-2 bg-[#E8F3EE]/50 p-4 rounded-xl border border-[#C8E5D7]">
              <div className="font-bold text-[#1F5C42] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#1F5C42]" />
                <span>How Your Escrow Protects You:</span>
              </div>
              <p className="leading-relaxed">
                1. Your payment is held safely in escrow before companion dispatch.
                <br />
                2. Companion must check in with hardware GPS (&lt;150m) and timestamped photo proof.
                <br />
                3. Payout is released to the companion's UPI wallet only after forensic verification.
              </p>
            </div>

            <button
              onClick={() => setShowEscrowModal(false)}
              className="w-full py-2.5 bg-[#FAF7F2] hover:bg-[#F5F1EB] text-[#1C1917] rounded-xl text-xs font-semibold transition border border-[#E7DFD5] cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* ================= PROOF PHOTO MODAL ================= */}
      {showProofModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1917]/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-[#E7DFD5]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7DFD5]">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-[#C25E2E]" />
                <h3 className="font-display text-sm font-bold text-[#1C1917]">Verified On-Site Arrival Photo</h3>
              </div>
              <button onClick={() => setShowProofModal(null)} className="text-[#8C827A] hover:text-[#1C1917] p-1 cursor-pointer">
                ✕
              </button>
            </div>

            <div className="rounded-xl overflow-hidden bg-[#FAF7F2] border border-[#E7DFD5] aspect-square relative">
              <img
                src={getImageUrl(showProofModal.selfie_image_url)}
                alt="Verification Proof"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 right-3 bg-white/95 text-[#1F5C42] text-xs px-2.5 py-1 rounded-full font-bold shadow-md border border-[#C8E5D7]">
                ✓ GPS Checked
              </div>
            </div>

            <div className="bg-[#FAF7F2] p-4 rounded-xl border border-[#E7DFD5] space-y-2 text-xs text-[#574F49]">
              <div className="flex justify-between">
                <span>Distance from Residence:</span>
                <span className="font-bold text-[#1F5C42]">
                  {Math.round(showProofModal.distance_from_target_meters)} meters (&le;150m Pass)
                </span>
              </div>
              <div className="flex justify-between">
                <span>Anti-Tamper Integrity:</span>
                <span className="font-mono text-[10px] text-[#574F49] bg-white px-2 py-0.5 rounded border border-[#E7DFD5]">
                  SHA-256 HMAC-OK
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowProofModal(null)}
              className="w-full py-2.5 bg-[#FAF7F2] hover:bg-[#F5F1EB] text-[#1C1917] rounded-xl text-xs font-semibold transition border border-[#E7DFD5] cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ================= ADD / EDIT PARENT MODAL ================= */}
      {(showAddParentModal || showEditParentModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1917]/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-[#E7DFD5]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7DFD5]">
              <h3 className="font-display text-base font-bold text-[#1C1917]">
                {showEditParentModal ? 'Edit Parent Residence' : 'Add Parent Residence'}
              </h3>
              <button
                onClick={() => {
                  setShowAddParentModal(false);
                  setShowEditParentModal(false);
                }}
                className="text-[#8C827A] hover:text-[#1C1917] p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveParent} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#1C1917] font-semibold mb-1">Parent Full Name(s) *</label>
                <input
                  type="text"
                  value={parentNameInput}
                  onChange={(e) => setParentNameInput(e.target.value)}
                  placeholder="e.g. Lakshmi & Ramana Reddy"
                  className="w-full filial-input"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#1C1917] font-semibold mb-1">Calling Phone *</label>
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[#1C1917] font-semibold">WhatsApp *</label>
                    <button
                      type="button"
                      onClick={() => setParentWhatsappInput(parentPhoneInput)}
                      className="text-[10px] text-[#C25E2E] hover:underline cursor-pointer"
                    >
                      Same as call
                    </button>
                  </div>
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
                <label className="block text-[#1C1917] font-semibold mb-1">City / Locality in India *</label>
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
                <label className="block text-[#1C1917] font-semibold mb-1">Full Street Address *</label>
                <textarea
                  rows={2}
                  value={parentAddressInput}
                  onChange={(e) => setParentAddressInput(e.target.value)}
                  placeholder="House/Flat No, Landmark, Road, City, Pincode"
                  className="w-full filial-input"
                  required
                />
              </div>

              <div>
                <label className="block text-[#1C1917] font-semibold mb-1">Care &amp; Medical Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={parentNotesInput}
                  onChange={(e) => setParentNotesInput(e.target.value)}
                  placeholder="Medications, mobility assistance, preferred hospital..."
                  className="w-full filial-input"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddParentModal(false);
                    setShowEditParentModal(false);
                  }}
                  className="flex-1 py-2.5 bg-[#FAF7F2] border border-[#E7DFD5] text-[#574F49] rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 filial-btn-primary py-2.5 text-xs font-semibold cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : 'Save Residence'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= SETTINGS & PROFILE MODAL ================= */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1917]/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-[#E7DFD5] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7DFD5]">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#C25E2E]" />
                <h3 className="font-display text-base font-bold text-[#1C1917]">Account &amp; Preferences</h3>
              </div>
              <button onClick={() => setShowSettingsModal(false)} className="text-[#8C827A] hover:text-[#1C1917] p-1 cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
              <div className="space-y-3">
                <h4 className="font-bold text-[#1C1917] uppercase tracking-wider text-[11px] text-[#8C827A]">
                  NRI Profile Details
                </h4>

                <div>
                  <label className="block text-[#1C1917] font-semibold mb-1">Your Full Name</label>
                  <input
                    type="text"
                    value={settingsFullName}
                    onChange={(e) => setSettingsFullName(e.target.value)}
                    required
                    className="w-full filial-input"
                  />
                </div>

                <div>
                  <label className="block text-[#1C1917] font-semibold mb-1">Your Email Address</label>
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
                    <label className="block text-[#1C1917] font-semibold mb-1">Country of Residence</label>
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
                      <option value="Singapore">Singapore</option>
                      <option value="India">India</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[#1C1917] font-semibold mb-1">Display Currency</label>
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
              </div>

              {/* Notification Toggles */}
              <div className="pt-2 border-t border-[#E7DFD5] space-y-3">
                <h4 className="font-bold text-[#1C1917] uppercase tracking-wider text-[11px] text-[#8C827A]">
                  Care Alerts
                </h4>

                <label className="flex items-center justify-between p-3 rounded-xl bg-[#FAF7F2] border border-[#E7DFD5] cursor-pointer">
                  <div>
                    <div className="font-bold text-[#1C1917]">Parent WhatsApp Notifications</div>
                    <div className="text-[11px] text-[#574F49]">Send arrival &amp; health updates directly to parents</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={whatsappAlerts}
                    onChange={(e) => setWhatsappAlerts(e.target.checked)}
                    className="w-4 h-4 accent-[#C25E2E] rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-[#FAF7F2] border border-[#E7DFD5] cursor-pointer">
                  <div>
                    <div className="font-bold text-[#1C1917]">Email Invoices &amp; Proof Digests</div>
                    <div className="text-[11px] text-[#574F49]">Receive monthly escrow statements and receipts</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailAlerts}
                    onChange={(e) => setEmailAlerts(e.target.checked)}
                    className="w-4 h-4 accent-[#C25E2E] rounded cursor-pointer"
                  />
                </label>
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="flex-1 py-2.5 bg-[#FAF7F2] border border-[#E7DFD5] text-[#574F49] rounded-xl font-semibold cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="flex-1 filial-btn-primary py-2.5 text-xs font-semibold cursor-pointer"
                >
                  {isSavingSettings ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= COMPONENT MODALS ================= */}
      {/* 1. Emergency Modal */}
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

      {/* 2. Live Tracking Modal */}
      {trackingTargetTask && (
        <LiveTrackingModal
          task={trackingTargetTask}
          isOpen={!!trackingTargetTask}
          onClose={() => setTrackingTargetTask(null)}
          latestTelemetry={latestPartnerTelemetry}
        />
      )}

      {/* 3. Task Review Modal */}
      {reviewTargetTask && (
        <TaskReviewModal
          task={reviewTargetTask}
          isOpen={!!reviewTargetTask}
          onClose={() => setReviewTargetTask(null)}
          onReviewSubmitted={() => {
            setReviewTargetTask(null);
            fetchAllData();
            setToastMessage('Review submitted! Thank you for rating.');
            setTimeout(() => setToastMessage(null), 3000);
          }}
        />
      )}

      {/* 4. Family Share Modal */}
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
