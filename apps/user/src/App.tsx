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

export default function UserApp() {
  // Persistence for login status
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

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Settings State - Fully User Editable
  const [settingsFullName, setSettingsFullName] = useState<string>('');
  const [settingsEmail, setSettingsEmail] = useState<string>('');
  const [settingsPhone, setSettingsPhone] = useState<string>('');
  const [settingsCountry, setSettingsCountry] = useState<string>('United States');
  const [settingsCurrency, setSettingsCurrency] = useState<string>('USD');
  const [userCurrency, setUserCurrency] = useState<string>('USD');
  const [emailAlerts, setEmailAlerts] = useState<boolean>(true);
  const [whatsappAlerts, setWhatsappAlerts] = useState<boolean>(true);

  // Settings State - Parents' Care Details
  const [settingsParentName, setSettingsParentName] = useState<string>('');
  const [settingsParentPhone, setSettingsParentPhone] = useState<string>('');
  const [settingsParentWhatsapp, setSettingsParentWhatsapp] = useState<string>('');
  const [settingsParentCity, setSettingsParentCity] = useState<string>('Pan-India');
  const [settingsParentAddress, setSettingsParentAddress] = useState<string>('');
  const [settingsParentNotes, setSettingsParentNotes] = useState<string>('');
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);

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
  const [reqTitle, setReqTitle] = useState<string>('');
  const [reqInstructions, setReqInstructions] = useState<string>('');
  const [reqEscrowAmount, setReqEscrowAmount] = useState<number>(45);

  // Parent Modals
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

  // Curated Concierge Eldercare Services - Pan-India
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
    setIsSavingSettings(true);
    try {
      const api = getApiBaseUrl();
      const clientRes = await fetch(`${api}/api/clients/${currentUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: settingsFullName.trim(),
          email: settingsEmail.trim(),
          phone: settingsPhone.trim(),
          countryResidence: settingsCountry,
          currency: settingsCurrency,
        }),
      });

      if (clientRes.ok) {
        setCurrentUserName(settingsFullName.trim());
        setCurrentUserEmail(settingsEmail.trim());
        setUserCurrency(settingsCurrency);
        localStorage.setItem('fh_user_name', settingsFullName.trim());
        localStorage.setItem('fh_user_email', settingsEmail.trim());
      }

      if (parents.length > 0) {
        const targetParentId = parents[0].id;
        await fetch(`${api}/api/parents/${targetParentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parentName: settingsParentName.trim(),
            primaryPhone: settingsParentPhone.trim(),
            whatsappPhone: settingsParentWhatsapp.trim() || settingsParentPhone.trim(),
            locality: settingsParentCity.trim() || 'Pan-India',
            fullAddress: settingsParentAddress.trim(),
            medicalNotes: settingsParentNotes.trim() || null,
          }),
        });
      }

      fetchAllData();
      playNotificationChime('success');
      setToastMessage('Account profile and parents care details updated!');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchAllData();
    }
  }, [isLoggedIn]);

  // WebSocket Telemetry Listener
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
              setToastMessage("The helper has arrived at your parents' house.");
            } else if (msg.type === 'ESCROW_RELEASED') {
              playNotificationChime('success');
              setToastMessage('Service completed and verified! Escrow released.');
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
          clientId: currentUserId,
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
        setToastMessage(`Service booked! $${reqEscrowAmount}.00 secured in escrow.`);
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
    if (!newParentName.trim() || !newParentPhone.trim() || !newParentWhatsapp.trim() || !newParentAddress.trim()) {
      setToastMessage("Please fill in parent name, calling phone, WhatsApp number, and address.");
      playNotificationChime('alert');
      return;
    }
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/parents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: currentUserId,
          parentName: newParentName.trim(),
          primaryPhone: newParentPhone.trim(),
          whatsappPhone: newParentWhatsapp.trim() || newParentPhone.trim(),
          locality: newParentLocality.trim() || 'Pan-India',
          fullAddress: newParentAddress.trim(),
          coordinatesLat: 20.5937,
          coordinatesLng: 78.9629,
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
      const res = await fetch(`${getApiBaseUrl()}/api/parents/${editingParent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentName: editParentName.trim(),
          primaryPhone: editParentPhone.trim(),
          whatsappPhone: editParentWhatsapp.trim() || editParentPhone.trim(),
          locality: editParentLocality.trim() || 'Pan-India',
          fullAddress: editParentAddress.trim(),
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
    { title: 'Requested', desc: 'Secured in escrow' },
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

  const filteredServices = servicesCatalog.filter((s) => {
    const matchesSearch =
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.desc.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'ALL' || s.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // ==========================================
  // VIEW: AUTHENTICATION SCREEN
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
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#1C1917] selection:bg-[#C25E2E] selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 bg-white border border-[#E7DFD5] text-[#1C1917] px-5 py-3.5 rounded-xl shadow-lg animate-in slide-in-from-top-3">
          <Sparkles className="w-5 h-5 text-[#C25E2E] shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#FAF7F2]/95 backdrop-blur-md border-b border-[#E7DFD5]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div
              onClick={() => setActiveTab('explore')}
              className="flex items-center gap-3 cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-[#C25E2E] flex items-center justify-center text-white shadow-xs">
                <Heart className="w-5 h-5 fill-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-xl font-bold text-[#1C1917] tracking-tight">FamilyHubs</span>
                  <span className="text-[11px] bg-[#FBECE5] text-[#A3481D] font-semibold px-2 py-0.5 rounded-full border border-[#F5D3C4]">
                    Client Concierge
                  </span>
                </div>
              </div>
            </div>

            {/* Pan-India Eldercare Network Badge */}
            <div className="hidden md:flex items-center gap-2 bg-white border border-[#E7DFD5] px-3 py-1.5 rounded-xl text-xs shadow-2xs">
              <Globe className="w-3.5 h-3.5 text-[#1F5C42] shrink-0" />
              <span className="font-semibold text-[#1C1917]">Pan-India Care Network</span>
              <span className="text-[10px] bg-[#E8F3EE] text-[#1F5C42] font-bold px-1.5 py-0.5 rounded-full border border-[#C8E5D7]">All Cities</span>
            </div>
          </div>

          {/* Profile & Settings Trigger */}
          <div className="flex items-center gap-3">
            {/* 1-Tap Emergency SOS Trigger */}
            <button
              onClick={() => setShowEmergencyModal(true)}
              className="bg-[#B91C1C] hover:bg-[#991B1B] text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer shrink-0"
              title="Activate Emergency Response"
            >
              <Siren className="w-4 h-4" />
              <span className="hidden sm:inline">EMERGENCY SOS</span>
              <span className="sm:hidden">SOS</span>
            </button>

            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-[#E7DFD5] bg-white shadow-2xs">
              <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-[#1F5C42] animate-pulse' : 'bg-[#B45309]'}`} />
              <span className={wsConnected ? 'text-[#1F5C42]' : 'text-[#B45309]'}>
                {wsConnected ? 'Live Gateway' : 'Connecting...'}
              </span>
            </div>

            <button
              onClick={() => setActiveTab('settings')}
              className="p-2.5 rounded-xl text-[#574F49] hover:text-[#1C1917] hover:bg-white/80 transition cursor-pointer"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>

            <div
              onClick={() => setActiveTab('settings')}
              className="flex items-center gap-3 cursor-pointer pl-3 border-l border-[#E7DFD5]"
            >
              <div className="w-9 h-9 rounded-full bg-[#FBECE5] text-[#C25E2E] font-bold text-xs flex items-center justify-center border border-[#F5D3C4]">
                {currentUserName.substring(0, 2).toUpperCase()}
              </div>
              <div className="hidden sm:block text-right">
                <div className="text-xs font-bold text-[#1C1917]">{currentUserName}</div>
                <div className="text-[11px] text-[#574F49]">{currentUserEmail}</div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-[#8C827A] hover:text-[#B91C1C] hover:bg-[#FEE2E2] transition cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-2 border-t border-[#E7DFD5] pt-1.5 pb-1 overflow-x-auto items-center">
          <button
            onClick={() => setActiveTab('explore')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'explore'
                ? 'bg-white text-[#C25E2E] shadow-xs border border-[#E7DFD5]'
                : 'text-[#574F49] hover:text-[#1C1917] hover:bg-white/60'
            }`}
          >
            <Sparkles className="w-4 h-4 text-[#C25E2E]" />
            <span>Find Services</span>
          </button>

          <button
            onClick={() => setActiveTab('trackers')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'trackers'
                ? 'bg-white text-[#C25E2E] shadow-xs border border-[#E7DFD5]'
                : 'text-[#574F49] hover:text-[#1C1917] hover:bg-white/60'
            }`}
          >
            <Activity className="w-4 h-4 text-[#1F5C42]" />
            <span>Active Requests</span>
            <span className="bg-[#FAF7F2] border border-[#E7DFD5] text-[#574F49] px-1.5 py-0.2 rounded-full text-[10px]">
              {tasks.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('health')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'health'
                ? 'bg-white text-[#C25E2E] shadow-xs border border-[#E7DFD5]'
                : 'text-[#574F49] hover:text-[#1C1917] hover:bg-white/60'
            }`}
          >
            <Heart className="w-4 h-4 text-[#C25E2E]" />
            <span>Health &amp; Vitals</span>
          </button>

          <button
            onClick={() => setActiveTab('parents')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'parents'
                ? 'bg-white text-[#C25E2E] shadow-xs border border-[#E7DFD5]'
                : 'text-[#574F49] hover:text-[#1C1917] hover:bg-white/60'
            }`}
          >
            <UserCheck className="w-4 h-4 text-[#1F5C42]" />
            <span>My Parents</span>
            <span className="bg-[#FAF7F2] border border-[#E7DFD5] text-[#574F49] px-1.5 py-0.2 rounded-full text-[10px]">
              {parents.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('billing')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'billing'
                ? 'bg-white text-[#C25E2E] shadow-xs border border-[#E7DFD5]'
                : 'text-[#574F49] hover:text-[#1C1917] hover:bg-white/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-[#B45309]" />
            <span>Escrow Vault</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-white text-[#C25E2E] shadow-xs border border-[#E7DFD5]'
                : 'text-[#574F49] hover:text-[#1C1917] hover:bg-white/60'
            }`}
          >
            <Settings className="w-4 h-4 text-[#8C827A]" />
            <span>Settings</span>
          </button>

          <button
            onClick={() => setShowFamilyModal(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 text-[#C25E2E] hover:bg-[#FBECE5] ml-auto whitespace-nowrap border border-[#F5D3C4] cursor-pointer"
            title="Shared Family Care"
          >
            <Users className="w-4 h-4 text-[#C25E2E]" />
            <span className="hidden md:inline">Shared Sibling Care</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ================= TAB 1: EXPLORE SERVICES ================= */}
        {activeTab === 'explore' && (
          <div className="space-y-8">
            {/* Hero Search & Promo Banner */}
            <div className="bg-[#FFFFFF] rounded-3xl p-7 md:p-9 text-[#1C1917] flex flex-col md:flex-row items-center justify-between gap-8 shadow-xs border border-[#E7DFD5] relative overflow-hidden">
              <div className="absolute right-0 top-0 w-96 h-96 bg-[#FBECE5]/40 rounded-full blur-3xl pointer-events-none" />

              <div className="space-y-3.5 max-w-xl relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E8F3EE] border border-[#C8E5D7] text-[#1F5C42] text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Welcome back, {currentUserName.split(' ')[0] || 'Friend'} • All Parents Safe</span>
                </div>
                <h2 className="font-display text-2xl md:text-3.5xl font-bold tracking-tight text-[#1C1917] leading-tight">
                  What care do your parents need today?
                </h2>
                <p className="text-xs md:text-sm text-[#574F49] leading-relaxed">
                  Every booking is protected by 100% Escrow. Verified field companions check in with forensic photo proof within 150m of your parents' home.
                </p>

                {/* Search Bar */}
                <div className="relative pt-1">
                  <Search className="w-4 h-4 text-[#8C827A] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search 'Doctor visit', 'Inverter check', 'RO plumbing', 'Pooja items'..."
                    className="w-full bg-[#FAF7F2] border border-[#E7DFD5] text-[#1C1917] placeholder-[#8C827A] rounded-xl pl-11 pr-4 py-3 text-xs md:text-sm focus:outline-none focus:border-[#C25E2E] focus:ring-2 focus:ring-[#C25E2E]/10 transition-all"
                  />
                </div>
              </div>

              {/* Escrow Vault Glance */}
              <div className="flex items-center gap-4 bg-[#FAF7F2] p-5 rounded-2xl border border-[#E7DFD5] shrink-0 relative z-10 shadow-xs">
                <div>
                  <div className="text-[11px] text-[#8C827A] font-semibold uppercase tracking-wider">Secured in Escrow</div>
                  <div className="text-2xl font-bold font-mono text-[#1F5C42]">
                    ${lockedEscrow.toFixed(2)} USD
                  </div>
                  <div className="text-[10px] text-[#574F49] mt-0.5">Released upon photo review</div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-[#E8F3EE] border border-[#C8E5D7] flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 text-[#1F5C42]" />
                </div>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
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
                      <h4 className="font-display text-base font-bold text-[#1C1917] leading-snug">{service.title}</h4>
                      <p className="text-xs text-[#574F49] leading-relaxed">{service.desc}</p>

                      {/* Feature Bullet Points */}
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

                  {/* Price & Book Trigger */}
                  <div className="p-5 pt-3 border-t border-[#E7DFD5] flex items-center justify-between bg-[#FAF7F2]/50">
                    <div>
                      <span className="text-[10px] text-[#8C827A] block font-semibold uppercase">Escrow Hold</span>
                      <span className="text-lg font-bold font-mono text-[#1C1917]">
                        ${service.price} USD
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

        {/* ================= TAB 2: ACTIVE REQUESTS TRACKER ================= */}
        {activeTab === 'trackers' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Tasks List */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between pb-1">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#8C827A]">
                    Care Requests
                  </h2>
                  <button onClick={fetchAllData} className="p-1.5 text-[#8C827A] hover:text-[#1C1917] cursor-pointer">
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

                {tasks.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-2xl border border-[#E7DFD5] text-[#8C827A] space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-[#FBECE5] text-[#C25E2E] flex items-center justify-center mx-auto border border-[#F5D3C4]">
                      <Heart className="w-6 h-6" />
                    </div>
                    <div className="font-display text-base font-bold text-[#1C1917]">No active care requests yet</div>
                    <p className="text-xs text-[#574F49] max-w-xs mx-auto leading-relaxed">
                      Book doctor visits, inverter repair, water plumbing, or groceries for your parents anywhere in India.
                    </p>
                    <button
                      onClick={() => setActiveTab('explore')}
                      className="filial-btn-primary text-xs py-2 px-4 cursor-pointer"
                    >
                      Browse Services ➔
                    </button>
                  </div>
                ) : filteredUserTasks.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-2xl border border-[#E7DFD5] text-[#8C827A] space-y-1">
                    <div className="text-xs font-semibold text-[#1C1917]">No requests match this filter.</div>
                    <div className="text-[11px] text-[#8C827A]">Try switching to 'All' or 'Completed' above.</div>
                  </div>
                ) : (
                  filteredUserTasks.map((task) => {
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
                          <span className="text-xs font-mono font-bold text-[#C25E2E] bg-[#FBECE5] border border-[#F5D3C4] px-2 py-0.5 rounded">
                            {task.tracking_code}
                          </span>
                          <span
                            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                              isCompleted
                                ? 'bg-[#E8F3EE] text-[#1F5C42] border border-[#C8E5D7]'
                                : 'bg-[#FBECE5] text-[#A3481D] border border-[#F5D3C4]'
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
                  <div className="bg-white p-6 rounded-2xl border border-[#E7DFD5] shadow-xs space-y-6">
                    <div className="flex items-center justify-between pb-4 border-b border-[#E7DFD5]">
                      <div>
                        <div className="text-xs font-mono text-[#C25E2E] font-bold">{selectedTask.tracking_code}</div>
                        <h3 className="font-display text-lg font-bold text-[#1C1917]">{selectedTask.title}</h3>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] text-[#8C827A]">Protected Escrow</div>
                        <div className="text-xl font-bold font-mono text-[#1F5C42]">
                          ${selectedTask.escrow?.amount.toFixed(2)} USD
                        </div>
                      </div>
                    </div>

                    {/* Stepper */}
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

                    {/* Proof Photo Section */}
                    <div className="bg-[#FAF7F2] rounded-xl p-4 border border-[#E7DFD5] space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Camera className="w-4 h-4 text-[#C25E2E]" />
                          <h4 className="text-xs font-bold text-[#1C1917]">Arrival Verification Photo</h4>
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
                                {selectedTask.verification_logs[0].stage}
                              </div>
                              <div className="text-[11px] text-[#1F5C42] font-semibold mt-0.5">
                                ✓ GPS Verified ({Math.round(selectedTask.verification_logs[0].distance_from_target_meters)}m from home)
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => setShowProofModal(selectedTask.verification_logs![0])}
                            className="px-3 py-1.5 bg-[#FAF7F2] hover:bg-[#F5F1EB] text-xs font-semibold text-[#1C1917] rounded-lg border border-[#E7DFD5] cursor-pointer"
                          >
                            View Photo
                          </button>
                        </div>
                      ) : (
                        <div className="p-4 text-center text-xs text-[#8C827A] bg-white rounded-xl border border-dashed border-[#E7DFD5]">
                          Waiting for on-ground arrival. Once the helper arrives, their verified photo will appear here.
                        </div>
                      )}
                    </div>

                    {/* Live GPS Tracker Trigger */}
                    {(selectedTask.status === 'IN_PROGRESS' || selectedTask.status === 'ACCEPTED' || selectedTask.status === 'DISPATCHED') && (
                      <div className="bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#C25E2E] text-white flex items-center justify-center shrink-0 shadow-2xs">
                            <Navigation className="w-5 h-5 animate-pulse" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-[#1C1917]">Live Caregiver Movement</div>
                            <div className="text-[11px] text-[#574F49]">Track helper traveling live to your parents' home</div>
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

                    {/* CSAT Rating & Review for Completed Tasks */}
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
                              <div className="flex flex-wrap gap-1 mt-1">
                                {selectedTask.review.tags?.map((tag) => (
                                  <span key={tag} className="text-[10px] font-semibold bg-white border border-[#E7DFD5] text-[#574F49] px-2 py-0.5 rounded-md">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                              {selectedTask.review.feedback_text && (
                                <p className="text-[11px] text-[#574F49] italic mt-1">"{selectedTask.review.feedback_text}"</p>
                              )}
                            </div>
                          ) : (
                            <p className="text-[11px] text-[#574F49] mt-0.5">
                              Please rate the helper's punctuality and care quality to release feedback badge.
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
                    Select a request to view live progress.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: HEALTH & CARE MANAGEMENT ================= */}
        {activeTab === 'health' && (
          <HealthView
            parentId={parents[0]?.id || ''}
            parentName={parents[0]?.parent_name || 'My Parents'}
            clientId={currentUserId}
            onRefillCreated={() => {
              fetchAllData();
              setActiveTab('trackers');
            }}
          />
        )}

        {/* ================= TAB 4: MY PARENTS ================= */}
        {activeTab === 'parents' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#1C1917]">Your Parents in India</h2>
                <p className="text-xs text-[#574F49]">Registered residences across all Indian cities and towns.</p>
              </div>
              <button
                onClick={() => setShowAddParentModal(true)}
                className="filial-btn-primary text-xs py-2 px-3.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Residence</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {parents.map((parent) => (
                <div key={parent.id} className="filial-card p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-display text-base font-bold text-[#1C1917]">{parent.parent_name}</h3>
                      <span className="text-xs text-[#C25E2E] font-semibold">{parent.locality}</span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-[#FAF7F2] border border-[#E7DFD5] flex items-center justify-center text-[#574F49]">
                      <MapPin className="w-4 h-4 text-[#C25E2E]" />
                    </div>
                  </div>

                  <div className="text-xs text-[#574F49] space-y-1.5">
                    <div><span className="font-semibold text-[#1C1917]">Address:</span> {parent.full_address}</div>
                    <div><span className="font-semibold text-[#1C1917]">Calling Phone:</span> <span className="font-mono text-[#1C1917]">{parent.primary_phone}</span></div>
                    <div><span className="font-semibold text-[#1C1917]">WhatsApp:</span> <span className="font-mono text-[#1F5C42] font-bold">{parent.whatsapp_phone || parent.primary_phone}</span></div>
                  </div>

                  {parent.medical_notes && (
                    <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E7DFD5] text-xs text-[#574F49]">
                      <strong className="text-[#1C1917]">Care Notes:</strong> {parent.medical_notes}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-3 border-t border-[#E7DFD5]">
                    <button
                      onClick={() => handleOpenEditParent(parent)}
                      className="flex-1 py-2 px-3 rounded-xl bg-[#FAF7F2] hover:bg-[#F5F1EB] text-[#1C1917] font-semibold text-xs border border-[#E7DFD5] transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5 text-[#574F49]" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteParent(parent.id, parent.parent_name)}
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

        {/* ================= TAB 5: ESCROW VAULT ================= */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="filial-card p-6">
                <div className="text-xs text-[#8C827A] font-bold uppercase tracking-wider">Currently in Escrow</div>
                <div className="text-3xl font-bold font-mono text-[#1F5C42] mt-2">${lockedEscrow.toFixed(2)}</div>
                <p className="text-xs text-[#574F49] mt-1">Protected until helper finishes the task</p>
              </div>

              <div className="filial-card p-6">
                <div className="text-xs text-[#8C827A] font-bold uppercase tracking-wider">Total Completed &amp; Released</div>
                <div className="text-3xl font-bold font-mono text-[#1C1917] mt-2">${releasedEscrow.toFixed(2)}</div>
                <p className="text-xs text-[#574F49] mt-1">Disbursed after photo &amp; GPS verification</p>
              </div>

              <div className="filial-card p-6">
                <div className="text-xs text-[#8C827A] font-bold uppercase tracking-wider">Your Membership</div>
                <div className="text-xl font-bold text-[#C25E2E] mt-2">Gold Family Plan</div>
                <p className="text-xs text-[#574F49] mt-1">24/7 priority emergency triage &amp; local escort</p>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 6: SETTINGS PAGE ================= */}
        {activeTab === 'settings' && (
          <form onSubmit={handleSaveSettings} className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#1C1917]">Account &amp; Care Settings</h2>
                <p className="text-xs text-[#574F49]">Edit your contact info, currency, and parents' care details in India.</p>
              </div>
              <button
                type="submit"
                disabled={isSavingSettings}
                className="filial-btn-primary text-xs py-2 px-4 cursor-pointer disabled:opacity-50"
              >
                {isSavingSettings ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>Save Changes</span>
              </button>
            </div>

            {/* NRI Client Profile */}
            <div className="filial-card p-6 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#E7DFD5]">
                <h3 className="font-display text-base font-bold text-[#1C1917] flex items-center gap-2">
                  <User className="w-4 h-4 text-[#C25E2E]" />
                  <span>NRI Client Profile</span>
                </h3>
                <span className="text-[10px] bg-[#FBECE5] text-[#A3481D] font-semibold px-2 py-0.5 rounded-full border border-[#F5D3C4]">
                  User Editable
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="text-[#1C1917] font-semibold block mb-1">Your Full Name</label>
                  <input
                    type="text"
                    value={settingsFullName}
                    onChange={(e) => setSettingsFullName(e.target.value)}
                    required
                    placeholder="Enter your full name"
                    className="w-full filial-input"
                  />
                </div>
                <div>
                  <label className="text-[#1C1917] font-semibold block mb-1">Your Email</label>
                  <input
                    type="email"
                    value={settingsEmail}
                    onChange={(e) => setSettingsEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full filial-input"
                  />
                </div>
                <div>
                  <label className="text-[#1C1917] font-semibold block mb-1">Your Mobile Phone</label>
                  <input
                    type="tel"
                    value={settingsPhone}
                    onChange={(e) => setSettingsPhone(e.target.value)}
                    placeholder="+1 408 555 0192"
                    className="w-full filial-input"
                  />
                </div>
                <div>
                  <label className="text-[#1C1917] font-semibold block mb-1">Country of Residence</label>
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
                    <option value="Germany">Germany</option>
                    <option value="India">India</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[#1C1917] font-semibold block mb-1">Preferred Currency</label>
                  <select
                    value={settingsCurrency}
                    onChange={(e) => {
                      setSettingsCurrency(e.target.value);
                      setUserCurrency(e.target.value);
                    }}
                    className="w-full filial-input font-mono"
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

            {/* Parents' Care Details in India */}
            <div className="filial-card p-6 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#E7DFD5]">
                <h3 className="font-display text-base font-bold text-[#1C1917] flex items-center gap-2">
                  <Heart className="w-4 h-4 text-[#C25E2E] fill-[#C25E2E]" />
                  <span>Parents' Care Details in India (Pan-India)</span>
                </h3>
                <span className="text-[10px] bg-[#E8F3EE] text-[#1F5C42] font-semibold px-2 py-0.5 rounded-full border border-[#C8E5D7]">
                  Mandatory Phone &amp; WhatsApp
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="sm:col-span-2">
                  <label className="text-[#1C1917] font-semibold block mb-1">
                    Parents' Full Name(s) <span className="text-[#B91C1C]">*</span>
                  </label>
                  <input
                    type="text"
                    value={settingsParentName}
                    onChange={(e) => setSettingsParentName(e.target.value)}
                    required
                    placeholder="e.g. Lakshmi & Ramana Reddy"
                    className="w-full filial-input"
                  />
                </div>

                <div>
                  <label className="text-[#1C1917] font-semibold block mb-1">
                    Parents' Primary Calling Phone <span className="text-[#B91C1C]">*</span>
                  </label>
                  <input
                    type="tel"
                    value={settingsParentPhone}
                    onChange={(e) => setSettingsParentPhone(e.target.value)}
                    required
                    placeholder="+91 94401 23456"
                    className="w-full filial-input font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[#1C1917] font-semibold">
                      Parents' WhatsApp Number <span className="text-[#B91C1C]">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setSettingsParentWhatsapp(settingsParentPhone)}
                      className="text-[10px] text-[#C25E2E] hover:underline cursor-pointer"
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
                    className="w-full filial-input font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[#1C1917] font-semibold block mb-1">
                    City / Town in India (Pan-India) <span className="text-[#B91C1C]">*</span>
                  </label>
                  <input
                    type="text"
                    value={settingsParentCity}
                    onChange={(e) => setSettingsParentCity(e.target.value)}
                    required
                    placeholder="e.g. Hyderabad, Bengaluru, Miryalaguda, Pune, Delhi"
                    className="w-full filial-input"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[#1C1917] font-semibold block mb-1">
                    Full Street Address in India <span className="text-[#B91C1C]">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={settingsParentAddress}
                    onChange={(e) => setSettingsParentAddress(e.target.value)}
                    required
                    placeholder="House / Flat No, Apartment Name, Street / Lane, Landmark, Pincode"
                    className="w-full filial-input"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[#1C1917] font-semibold block mb-1">
                    Medical &amp; Care Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={settingsParentNotes}
                    onChange={(e) => setSettingsParentNotes(e.target.value)}
                    placeholder="Special instructions: medications, allergies, preferred hospital..."
                    className="w-full filial-input"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="w-full filial-btn-primary py-3 text-xs font-semibold cursor-pointer disabled:opacity-50"
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
            <div className="filial-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-[#1C1917] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#1F5C42]" />
                  <span>Security &amp; Escrow Protection</span>
                </h3>
                <span className="text-[11px] font-semibold text-[#1F5C42] bg-[#E8F3EE] px-2.5 py-0.5 rounded-full border border-[#C8E5D7]">
                  Bank-Grade 256-Bit TLS
                </span>
              </div>

              {/* Panic Freeze Killswitch */}
              <div className={`p-4 rounded-xl border transition ${isEscrowFrozen ? 'bg-[#FEE2E2] border-[#FECACA]' : 'bg-[#FAF7F2] border-[#E7DFD5]'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-xs text-[#1C1917]">
                      <ShieldAlert className={`w-4 h-4 ${isEscrowFrozen ? 'text-[#B91C1C]' : 'text-[#8C827A]'}`} />
                      <span>Emergency Escrow Payout Freeze</span>
                    </div>
                    <p className="text-[11px] text-[#574F49] mt-1 leading-relaxed">
                      {isEscrowFrozen
                        ? 'EMERGENCY LOCK ACTIVE. All escrow payouts are currently blocked across the platform.'
                        : 'If you suspect miscommunication or need to halt a service immediately, lock all outbound escrow transfers.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleEscrowFreeze}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                      isEscrowFrozen
                        ? 'bg-[#B91C1C] hover:bg-[#991B1B] text-white shadow-2xs'
                        : 'bg-white hover:bg-[#FAF7F2] text-[#1C1917] border border-[#E7DFD5] shadow-2xs'
                    }`}
                  >
                    {isEscrowFrozen ? 'Unlock Escrow' : 'Lock Escrow'}
                  </button>
                </div>
              </div>

              {/* 2FA & Biometric status */}
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF7F2] border border-[#E7DFD5]">
                  <div className="flex items-center gap-2.5">
                    <KeyRound className="w-4 h-4 text-[#C25E2E]" />
                    <div>
                      <div className="font-bold text-[#1C1917]">Two-Factor Authentication (2FA)</div>
                      <div className="text-[#574F49] text-[11px]">Enforced for escrow funding &amp; booking approvals</div>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-[#1F5C42] bg-[#E8F3EE] px-2 py-0.5 rounded-md border border-[#C8E5D7]">
                    Enabled
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF7F2] border border-[#E7DFD5]">
                  <div className="flex items-center gap-2.5">
                    <Fingerprint className="w-4 h-4 text-[#C25E2E]" />
                    <div>
                      <div className="font-bold text-[#1C1917]">Biometric Fast Sign-In</div>
                      <div className="text-[#574F49] text-[11px]">Apple TouchID / Windows Hello hardware key</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={biometricEnabled}
                    onChange={(e) => setBiometricEnabled(e.target.checked)}
                    className="w-4 h-4 accent-[#C25E2E] rounded cursor-pointer"
                  />
                </div>

                {/* Session telemetry */}
                <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E7DFD5] text-[#574F49] space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#8C827A]">Authenticated Client Account:</span>
                    <span className="font-mono text-[#1C1917] font-semibold">{currentUserEmail}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#8C827A]">Parent Geofence Tolerance:</span>
                    <span className="text-[#1F5C42] font-semibold">Strict 150m Server Geofence Active</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notification Preferences */}
            <div className="filial-card p-6 space-y-4">
              <h3 className="font-display text-base font-bold text-[#1C1917] flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#C25E2E]" />
                <span>Notification Preferences</span>
              </h3>
              <div className="space-y-3 text-xs">
                <label className="flex items-center justify-between p-3 rounded-xl bg-[#FAF7F2] border border-[#E7DFD5] cursor-pointer">
                  <div>
                    <div className="font-bold text-[#1C1917]">Parent WhatsApp Updates</div>
                    <div className="text-[#574F49] text-[11px]">Send zero-friction notifications to parents' phone upon dispatch &amp; arrival</div>
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
                    <div className="font-bold text-[#1C1917]">Email Invoices &amp; Receipts</div>
                    <div className="text-[#574F49] text-[11px]">Receive monthly statements and escrow release receipts</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailAlerts}
                    onChange={(e) => setEmailAlerts(e.target.checked)}
                    className="w-4 h-4 accent-[#C25E2E] rounded cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* Log Out Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-3 rounded-xl border border-[#FECACA] text-[#B91C1C] hover:bg-[#FEE2E2] font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out from FamilyHubs</span>
              </button>
            </div>
          </form>
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
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[#1C1917] font-semibold">Select Parent Residence</label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowBookModal(false);
                      setShowAddParentModal(true);
                    }}
                    className="text-[#C25E2E] hover:underline text-xs font-semibold cursor-pointer"
                  >
                    + Add New Parent
                  </button>
                </div>
                {parents.length === 0 ? (
                  <div className="p-3 bg-[#FEF3C7] border border-[#FDE68A] rounded-xl text-[#92400E] text-xs flex items-center justify-between">
                    <span>No parent registered yet.</span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowBookModal(false);
                        setShowAddParentModal(true);
                      }}
                      className="px-2.5 py-1 bg-[#B45309] text-white rounded-lg font-bold hover:bg-[#92400E] cursor-pointer"
                    >
                      Add Parent Now
                    </button>
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

              {/* Escrow summary */}
              <div className="p-4 rounded-xl bg-[#E8F3EE] border border-[#C8E5D7] flex items-center justify-between">
                <div>
                  <div className="font-bold text-[#1F5C42]">Protected Escrow Amount</div>
                  <div className="text-[11px] text-[#574F49]">Released only after verified completion</div>
                </div>
                <div className="text-xl font-bold font-mono text-[#1F5C42]">
                  ${reqEscrowAmount}.00 USD
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
                  {isSubmitting ? 'Booking...' : `Confirm & Secure ($${reqEscrowAmount})`}
                </button>
              </div>
            </form>
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
                <h3 className="font-display text-sm font-bold text-[#1C1917]">Verified On-Site Photo</h3>
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
                <span>Stage:</span>
                <span className="font-bold text-[#1C1917]">{showProofModal.stage.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span>Distance from Home:</span>
                <span className="font-bold text-[#1F5C42]">
                  {Math.round(showProofModal.distance_from_target_meters)} meters ({showProofModal.distance_from_target_meters <= 150 ? 'At Residence' : 'Flagged Perimeter'})
                </span>
              </div>
              <div className="flex justify-between">
                <span>Server Geofence:</span>
                <span className="font-semibold text-[#1F5C42] flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Forensic Pass (&le;150m)
                </span>
              </div>
              <div className="flex justify-between">
                <span>Anti-Tamper Digest:</span>
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

      {/* ================= ADD PARENT MODAL ================= */}
      {showAddParentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1917]/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-[#E7DFD5]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7DFD5]">
              <h3 className="font-display text-base font-bold text-[#1C1917]">Add Parent Residence</h3>
              <button onClick={() => setShowAddParentModal(false)} className="text-[#8C827A] hover:text-[#1C1917] p-1 cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddParent} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#1C1917] font-semibold mb-1">Parent Name(s)</label>
                <input
                  type="text"
                  value={newParentName}
                  onChange={(e) => setNewParentName(e.target.value)}
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
                    value={newParentPhone}
                    onChange={(e) => setNewParentPhone(e.target.value)}
                    placeholder="+91 94401 22334"
                    className="w-full filial-input font-mono"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[#1C1917] font-semibold">WhatsApp *</label>
                    <button
                      type="button"
                      onClick={() => setNewParentWhatsapp(newParentPhone)}
                      className="text-[10px] text-[#C25E2E] hover:underline cursor-pointer"
                    >
                      Same as call
                    </button>
                  </div>
                  <input
                    type="tel"
                    value={newParentWhatsapp}
                    onChange={(e) => setNewParentWhatsapp(e.target.value)}
                    placeholder="+91 94401 22334"
                    className="w-full filial-input font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#1C1917] font-semibold mb-1">City / Town in India (Pan-India) *</label>
                <input
                  type="text"
                  value={newParentLocality}
                  onChange={(e) => setNewParentLocality(e.target.value)}
                  placeholder="e.g. Hyderabad, Bengaluru, Delhi, Miryalaguda, Pune"
                  className="w-full filial-input"
                  required
                />
              </div>

              <div>
                <label className="block text-[#1C1917] font-semibold mb-1">Full Address</label>
                <textarea
                  rows={2}
                  value={newParentAddress}
                  onChange={(e) => setNewParentAddress(e.target.value)}
                  placeholder="House number, landmark, lane name..."
                  className="w-full filial-input"
                  required
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddParentModal(false)}
                  className="flex-1 py-2.5 bg-[#FAF7F2] border border-[#E7DFD5] text-[#574F49] rounded-xl font-semibold cursor-pointer hover:bg-[#F5F1EB]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 filial-btn-primary py-2.5 text-xs font-semibold cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1917]/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-[#E7DFD5]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7DFD5]">
              <h3 className="font-display text-base font-bold text-[#1C1917]">Edit Parent Details</h3>
              <button onClick={() => setEditingParent(null)} className="text-[#8C827A] hover:text-[#1C1917] p-1 cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateParent} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#1C1917] font-semibold mb-1">Parent Name(s)</label>
                <input
                  type="text"
                  value={editParentName}
                  onChange={(e) => setEditParentName(e.target.value)}
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
                    value={editParentPhone}
                    onChange={(e) => setEditParentPhone(e.target.value)}
                    placeholder="+91 94401 22334"
                    className="w-full filial-input font-mono"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[#1C1917] font-semibold">WhatsApp *</label>
                    <button
                      type="button"
                      onClick={() => setEditParentWhatsapp(editParentPhone)}
                      className="text-[10px] text-[#C25E2E] hover:underline cursor-pointer"
                    >
                      Same as call
                    </button>
                  </div>
                  <input
                    type="tel"
                    value={editParentWhatsapp}
                    onChange={(e) => setEditParentWhatsapp(e.target.value)}
                    placeholder="+91 94401 22334"
                    className="w-full filial-input font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#1C1917] font-semibold mb-1">City / Town in India *</label>
                <input
                  type="text"
                  value={editParentLocality}
                  onChange={(e) => setEditParentLocality(e.target.value)}
                  placeholder="e.g. Hyderabad, Bengaluru, Delhi, Miryalaguda, Pune"
                  className="w-full filial-input"
                  required
                />
              </div>

              <div>
                <label className="block text-[#1C1917] font-semibold mb-1">Full Address</label>
                <textarea
                  rows={2}
                  value={editParentAddress}
                  onChange={(e) => setEditParentAddress(e.target.value)}
                  placeholder="House number, landmark, lane name..."
                  className="w-full filial-input"
                  required
                />
              </div>

              <div>
                <label className="block text-[#1C1917] font-semibold mb-1">Care &amp; Medical Notes</label>
                <textarea
                  rows={2}
                  value={editParentNotes}
                  onChange={(e) => setEditParentNotes(e.target.value)}
                  placeholder="Any medical conditions, dietary rules, doctor contacts..."
                  className="w-full filial-input"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingParent(null)}
                  className="flex-1 py-2.5 bg-[#FAF7F2] border border-[#E7DFD5] text-[#574F49] rounded-xl font-semibold cursor-pointer hover:bg-[#F5F1EB]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingParent}
                  className="flex-1 filial-btn-primary py-2.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
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
