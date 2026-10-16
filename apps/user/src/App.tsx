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
  KeyRound
} from 'lucide-react';
import type { Task, ParentProfile, VerificationLog } from '@shared/types';
import { formatDate, playNotificationChime, getApiBaseUrl, getWebSocketUrl, getImageUrl } from '@shared/utils';

export default function UserApp() {
  // Persistence for login status (default false to show welcome/login first if first visit)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    const saved = localStorage.getItem('fh_user_logged_in');
    return saved === null ? false : saved === 'true';
  });

  const [activeTab, setActiveTab] = useState<'explore' | 'trackers' | 'parents' | 'billing' | 'settings'>('explore');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [parents, setParents] = useState<ParentProfile[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showProofModal, setShowProofModal] = useState<VerificationLog | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  // Security Controls State
  const [isEscrowFrozen, setIsEscrowFrozen] = useState<boolean>(false);
  const [twoFactorActive, setTwoFactorActive] = useState<boolean>(true);
  const [biometricEnabled, setBiometricEnabled] = useState<boolean>(true);

  // Search & Filter State (Urban Company UX)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedLocality, setSelectedLocality] = useState<string>('Reddy Colony, Miryalaguda');

  // Settings State
  const [userCurrency, setUserCurrency] = useState<string>('USD');
  const [emailAlerts, setEmailAlerts] = useState<boolean>(true);
  const [whatsappAlerts, setWhatsappAlerts] = useState<boolean>(true);

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

  // New Parent Modal
  const [showAddParentModal, setShowAddParentModal] = useState<boolean>(false);
  const [newParentName, setNewParentName] = useState<string>('');
  const [newParentPhone, setNewParentPhone] = useState<string>('+91 ');
  const [newParentLocality, setNewParentLocality] = useState<string>('Reddy Colony, Miryalaguda');
  const [newParentAddress, setNewParentAddress] = useState<string>('');
  const [newParentNotes, setNewParentNotes] = useState<string>('');

  const wsRef = useRef<WebSocket | null>(null);

  // Curated Urban Company Style Services
  const servicesCatalog = [
    {
      id: 'srv_med_1',
      title: 'Doctor Home Visit & Comprehensive Vitals',
      category: 'MEDICAL_TRANSPORT',
      rating: '4.95',
      reviews: '142 reviews',
      price: 45,
      banner: getImageUrl('/uploads/service_medical.svg'),
      desc: 'Certified doctor home visit for complete elderly health assessment and vitals check.',
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
      desc: 'Reliable monthly prescription replenishment from Apollo or MedPlus Miryalaguda.',
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
      desc: 'Complete power backup checkup to safeguard aging parents during summer power cuts.',
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
      desc: 'Clean, safe drinking water guaranteed. Water filter maintenance and plumbing fix.',
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
      desc: 'Fresh farm fruits, cooking oils, lentils, and temple pooja items from Miryalaguda markets.',
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
      desc: 'Immediate emergency transport escort with trained caretaker staying by their side.',
      features: ['Under 20-minute rapid response dispatch', 'Vehicle escort to Lifeline or Kamineni Hospital', 'Continuous WhatsApp call coordination with NRI'],
      badge: 'Priority 24/7',
    },
  ];

  const fetchAllData = async () => {
    try {
      const apiBase = getApiBaseUrl();
      const [tasksRes, parentsRes] = await Promise.all([
        fetch(`${apiBase}/api/tasks?clientId=usr_client_ananya`),
        fetch(`${apiBase}/api/parents?clientId=usr_client_ananya`),
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
        if (parentsData.length > 0 && !reqParentId) {
          setReqParentId(parentsData[0].id);
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
          actorId: 'usr_client_ananya',
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

  useEffect(() => {
    fetchAllData();
  }, []);

  // Background WebSocket listener for instant state updates with clean reconnection handling
  useEffect(() => {
    let socket: WebSocket | null = null;
    let isMounted = true;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (!isMounted) return;
      try {
        const wsUrl = getWebSocketUrl('/ws/events', { role: 'CLIENT', userId: 'usr_client_ananya' });
        socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          if (isMounted) setWsConnected(true);
        };

        socket.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            fetchAllData();

            if (msg.type === 'PARTNER_CHECKED_IN') {
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

  const handleLogin = (userType: 'ananya' | 'rahul') => {
    localStorage.setItem('fh_user_logged_in', 'true');
    setIsLoggedIn(true);
    setToastMessage(`Welcome back! Signed in as ${userType === 'ananya' ? 'Ananya Reddy' : 'Rahul Sharma'}.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleLogout = () => {
    localStorage.setItem('fh_user_logged_in', 'false');
    setIsLoggedIn(false);
  };

  const openBookModal = (srv: typeof servicesCatalog[0]) => {
    setSelectedService(srv);
    setReqTitle(srv.title);
    setReqInstructions(`Please arrange ${srv.title}. Ensure the on-ground helper calls before arriving.`);
    setReqEscrowAmount(srv.price);
    setShowBookModal(true);
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqTitle || !reqInstructions || !reqParentId) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'usr_client_ananya',
          parentId: reqParentId,
          category: selectedService?.category || 'MEDICAL_TRANSPORT',
          title: reqTitle,
          instructions: reqInstructions,
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
        setToastMessage(`Service booked! $${reqEscrowAmount}.00 is secured in escrow.`);
        setTimeout(() => setToastMessage(null), 5000);
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddParent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/parents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'usr_client_ananya',
          parentName: newParentName,
          primaryPhone: newParentPhone,
          locality: newParentLocality,
          fullAddress: newParentAddress,
          coordinatesLat: 16.8724,
          coordinatesLng: 79.5631,
          medicalNotes: newParentNotes,
        }),
      });

      if (res.ok) {
        setShowAddParentModal(false);
        setNewParentName('');
        setNewParentAddress('');
        setNewParentNotes('');
        fetchAllData();
        setToastMessage('Parent residence added successfully!');
        setTimeout(() => setToastMessage(null), 5000);
      }
    } catch (err) {
      console.error(err);
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
  // VIEW: WELCOME & LOGIN SCREEN (IF LOGGED OUT)
  // ==========================================
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-white text-slate-800 flex flex-col font-sans">
        {/* Welcome Header */}
        <header className="border-b border-slate-100 py-4 px-6 md:px-12 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
              <Heart className="w-5 h-5 fill-white" />
            </div>
            <div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">FamilyHubs</span>
              <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-0.5 rounded-full ml-2">
                NRI Care Portal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              <MapPin className="w-3.5 h-3.5 text-indigo-600" />
              Serving Miryalaguda &amp; Nalgonda
            </span>
            <button
              onClick={() => handleLogin('ananya')}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition flex items-center gap-2"
            >
              Sign In
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <main className="flex-1 max-w-6xl mx-auto px-6 py-12 flex flex-col lg:flex-row items-center justify-between gap-12">
          {/* Left Column: Vision & 1-Click Login */}
          <div className="max-w-xl space-y-6">
            <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-1.5 rounded-full text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              100% Escrow Protection • Miryalaguda &amp; Old Nalgonda
            </div>

            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Taking Loving Care of Your Aging Parents in India
            </h1>

            <p className="text-base text-slate-600 leading-relaxed">
              Book doctor visits, prescription delivery, electrician fixes, groceries, and 24/7 emergency support. You pay from abroad through escrow—funds are only released when you verify their on-site arrival photo.
            </p>

            {/* Urban Company Style Feature Badges */}
            <div className="grid grid-cols-2 gap-3.5 pt-1">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="font-bold text-slate-900 text-sm">🛡️ Zero Cash to Parents</div>
                <div className="text-xs text-slate-500 mt-1">Parents never pay at the doorstep. Funds stay locked in escrow.</div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="font-bold text-slate-900 text-sm">📍 Live GPS Photo Check-in</div>
                <div className="text-xs text-slate-500 mt-1">Mandatory selfie verification taken within 150m of their house.</div>
              </div>
            </div>

            {/* Quick Demo Sign In Options */}
            <div className="pt-2 space-y-3">
              <button
                onClick={() => handleLogin('ananya')}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-xl shadow-indigo-600/25 transition flex items-center justify-center gap-3"
              >
                <span>Continue as Ananya Reddy (US NRI Client)</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Or explore as:</span>
                <button
                  onClick={() => handleLogin('rahul')}
                  className="text-indigo-600 font-semibold hover:underline"
                >
                  Rahul Sharma (UK NRI Client)
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Visual Showcase Graphic */}
          <div className="w-full max-w-lg space-y-4">
            <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-slate-900 aspect-video relative">
              <img
                src={getImageUrl('/uploads/hero_eldercare.svg')}
                alt="FamilyHubs Eldercare"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Preview Mini Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Doctor Visits</div>
                  <div className="text-[11px] text-slate-500">From $45 • 4.95 ★</div>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Inverter Fix</div>
                  <div className="text-[11px] text-slate-500">From $40 • 4.91 ★</div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
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
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
                <Heart className="w-5 h-5 fill-white" />
              </div>
              <div>
                <span className="text-lg font-bold text-slate-900 tracking-tight">FamilyHubs</span>
                <span className="text-[11px] bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-full ml-2">
                  Parent Care
                </span>
              </div>
            </div>

            {/* Location Selector (Urban Company Style) */}
            <div className="hidden md:flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3.5 py-1.5 rounded-xl cursor-pointer text-xs">
              <MapPin className="w-4 h-4 text-indigo-600 shrink-0" />
              <select
                value={selectedLocality}
                onChange={(e) => setSelectedLocality(e.target.value)}
                className="bg-transparent font-semibold text-slate-700 border-none outline-none cursor-pointer"
              >
                <option value="Reddy Colony, Miryalaguda">Reddy Colony, Miryalaguda</option>
                <option value="Housing Board Colony, Miryalaguda">Housing Board, Miryalaguda</option>
                <option value="Old Nalgonda (Clock Tower)">Old Nalgonda Clock Tower</option>
                <option value="Sagar Road, Miryalaguda">Sagar Road, Miryalaguda</option>
              </select>
            </div>
          </div>

          {/* Profile & Settings Trigger */}
          <div className="flex items-center gap-3">
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
                AR
              </div>
              <div className="hidden sm:block text-right">
                <div className="text-xs font-bold text-slate-900">Ananya Reddy</div>
                <div className="text-[11px] text-slate-500">San Jose, CA • Escrow Verified</div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-2 border-t border-slate-100 pt-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('explore')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'explore'
                ? 'bg-indigo-50 text-indigo-700 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-4 h-4 text-indigo-600" />
            Find Services
          </button>

          <button
            onClick={() => setActiveTab('trackers')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'trackers'
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
            onClick={() => setActiveTab('parents')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'parents'
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
            className={`px-4 py-2.5 text-xs font-semibold rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'billing'
                ? 'bg-indigo-50 text-indigo-700 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Escrow Vault
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'settings'
                ? 'bg-indigo-50 text-indigo-700 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Settings className="w-4 h-4 text-slate-500" />
            Settings
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
                  Eldercare Concierge • Miryalaguda &amp; Nalgonda
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

              {/* Escrow Vault Glance */}
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
                    className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
                      isSelected
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

                {tasks.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                      <Heart className="w-6 h-6" />
                    </div>
                    <div className="text-sm font-bold text-slate-800">No active care requests yet</div>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto">
                      Book doctor visits, inverter repair, water plumbing, or groceries for your parents in Miryalaguda or Nalgonda.
                    </p>
                    <button
                      onClick={() => setActiveTab('explore')}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-indigo-700"
                    >
                      Browse Services ➔
                    </button>
                  </div>
                ) : (
                  tasks.map((task) => {
                    const isSelected = selectedTask?.id === task.id;
                    const isCompleted = task.status === 'COMPLETED';

                    return (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className={`p-4 rounded-2xl cursor-pointer transition border text-left ${
                          isSelected
                            ? 'bg-white border-indigo-600 shadow-md ring-2 ring-indigo-600/10'
                            : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                            {task.tracking_code}
                          </span>
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                              isCompleted
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
                            {task.parent?.locality || 'Miryalaguda'}
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
                                className={`absolute -left-6 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition ${
                                  isDone
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
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 rounded-lg"
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

        {/* ================= TAB 3: MY PARENTS ================= */}
        {activeTab === 'parents' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Your Parents in India</h2>
                <p className="text-xs text-slate-500">Registered residences in Miryalaguda and Old Nalgonda.</p>
              </div>
              <button
                onClick={() => setShowAddParentModal(true)}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 transition flex items-center gap-2 shadow-sm"
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
                    <div><span className="font-semibold text-slate-700">WhatsApp:</span> {parent.primary_phone}</div>
                  </div>

                  {parent.medical_notes && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                      <strong>Care Notes:</strong> {parent.medical_notes}
                    </div>
                  )}
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

        {/* ================= TAB 5: SETTINGS PAGE ================= */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Account &amp; Care Settings</h2>
              <p className="text-xs text-slate-500">Manage your profile, preferred currency, and notification channels.</p>
            </div>

            {/* Profile Info */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600" />
                NRI Client Profile
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Full Name</label>
                  <input
                    type="text"
                    defaultValue="Ananya Reddy"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
                    readOnly
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Email</label>
                  <input
                    type="email"
                    defaultValue="ananya.reddy@gmail.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
                    readOnly
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Country of Residence</label>
                  <input
                    type="text"
                    defaultValue="United States (San Jose, CA)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
                    readOnly
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Preferred Currency</label>
                  <select
                    value={userCurrency}
                    onChange={(e) => setUserCurrency(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="CAD">CAD ($)</option>
                    <option value="INR">INR (₹)</option>
                  </select>
                </div>
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
                    onClick={handleToggleEscrowFreeze}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
                      isEscrowFrozen
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
                    <span className="text-slate-400">Active NRI Session:</span>
                    <span className="font-mono text-slate-800 font-semibold">San Jose, CA, USA (IP: 198.51.100.42)</span>
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
                onClick={handleLogout}
                className="w-full py-3.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs transition flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out from FamilyHubs
              </button>
            </div>
          </div>
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
                <label className="block text-slate-700 font-bold mb-1">Select Parent Residence</label>
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
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Specific Instructions for Local Helper</label>
                <textarea
                  rows={3}
                  value={reqInstructions}
                  onChange={(e) => setReqInstructions(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800"
                  required
                />
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

              <div>
                <label className="block text-slate-700 font-bold mb-1">WhatsApp Phone</label>
                <input
                  type="text"
                  value={newParentPhone}
                  onChange={(e) => setNewParentPhone(e.target.value)}
                  placeholder="+91 94901 22334"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Town / Area</label>
                <select
                  value={newParentLocality}
                  onChange={(e) => setNewParentLocality(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800"
                >
                  <option value="Reddy Colony, Miryalaguda">Reddy Colony, Miryalaguda</option>
                  <option value="Housing Board Colony, Miryalaguda">Housing Board Colony, Miryalaguda</option>
                  <option value="Old Nalgonda (Clock Tower)">Old Nalgonda (Clock Tower)</option>
                  <option value="Sagar Road, Miryalaguda">Sagar Road, Miryalaguda</option>
                </select>
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
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700"
                >
                  Save Parent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
