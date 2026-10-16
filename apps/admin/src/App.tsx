import React, { useState, useEffect, useRef } from 'react';
import {
  Radio,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  UserCheck,
  Check,
  X,
  Volume2,
  VolumeX,
  RefreshCw,
  MessageSquare,
  ShieldCheck,
  Camera,
  Layers,
  Search,
  PhoneCall,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Eye,
  Bell,
  Sparkles,
  Settings,
  LogOut,
  Sliders,
  User,
  Lock,
  Key,
  ShieldAlert,
  Flame,
  Activity,
  Mail,
  EyeOff,
} from 'lucide-react';
import type { Task, PartnerProfile, VerificationLog, WhatsAppLog } from '@shared/types';
import { formatDate, playNotificationChime, getApiBaseUrl, getWebSocketUrl, getImageUrl } from '@shared/utils';

export default function AdminApp() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    const saved = localStorage.getItem('fh_admin_logged_in');
    return saved === null ? false : saved === 'true';
  });

  const [adminId, setAdminId] = useState<string>(() => {
    return localStorage.getItem('fh_admin_id') || 'usr_demo_admin';
  });
  const [adminName, setAdminName] = useState<string>(() => {
    return localStorage.getItem('fh_admin_name') || 'Demo Operations Admin';
  });
  const [adminEmail, setAdminEmail] = useState<string>('demo.admin@familyhubs.com');
  const [adminPassword, setAdminPassword] = useState<string>('DemoPassword123!');
  const [showAdminPassword, setShowAdminPassword] = useState<boolean>(false);
  const [adminAuthLoading, setAdminAuthLoading] = useState<boolean>(false);
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);

  const [wsConnected, setWsConnected] = useState<boolean>(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [partners, setPartners] = useState<PartnerProfile[]>([]);
  const [whatsAppLogs, setWhatsAppLogs] = useState<WhatsAppLog[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [localityFilter, setLocalityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'dispatch' | 'verifications' | 'whatsapp' | 'security' | 'settings'>('dispatch');
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [toastAlert, setToastAlert] = useState<{ title: string; message: string } | null>(null);
  const [auditTarget, setAuditTarget] = useState<Task | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);

  // Security & Audit State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [securitySettings, setSecuritySettings] = useState<{
    escrow_release_pin?: string;
    geofence_tolerance_meters?: string;
    emergency_escrow_freeze?: string;
  }>({});
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [pendingReleaseTaskId, setPendingReleaseTaskId] = useState<string | null>(null);
  const [escrowPinInput, setEscrowPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isSubmittingPin, setIsSubmittingPin] = useState<boolean>(false);
  const [newPinInput, setNewPinInput] = useState<string>('');
  const [pinChangeSuccess, setPinChangeSuccess] = useState<boolean>(false);

  // Operations Settings State
  const [geofenceLimit, setGeofenceLimit] = useState<number>(150);

  const wsRef = useRef<WebSocket | null>(null);

  const fetchData = async () => {
    try {
      const apiBase = getApiBaseUrl();
      const [tasksRes, partnersRes, waRes, secRes, audRes] = await Promise.all([
        fetch(`${apiBase}/api/tasks`),
        fetch(`${apiBase}/api/partners`),
        fetch(`${apiBase}/api/whatsapp/logs`),
        fetch(`${apiBase}/api/security/settings`),
        fetch(`${apiBase}/api/security/audit-logs`),
      ]);

      if (tasksRes.ok) {
        const tasksData: Task[] = await tasksRes.json();
        setTasks(tasksData);
        if (!selectedTask && tasksData.length > 0) {
          setSelectedTask(tasksData[0]);
        } else if (selectedTask) {
          const fresh = tasksData.find((t) => t.id === selectedTask.id);
          if (fresh) setSelectedTask(fresh);
        }
      }

      if (partnersRes.ok) {
        const partnersData: PartnerProfile[] = await partnersRes.json();
        setPartners(partnersData);
      }

      if (waRes.ok) {
        const waData: WhatsAppLog[] = await waRes.json();
        setWhatsAppLogs(waData);
      }

      if (secRes.ok) {
        const secData = await secRes.json();
        setSecuritySettings(secData);
        if (secData.geofence_tolerance_meters) {
          setGeofenceLimit(parseInt(secData.geofence_tolerance_meters));
        }
      }

      if (audRes.ok) {
        const audData = await audRes.json();
        setAuditLogs(audData);
      }
    } catch (err) {
      console.error('Admin data fetch error:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Background WebSocket listener with clean unmount handling
  useEffect(() => {
    let socket: WebSocket | null = null;
    let isMounted = true;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (!isMounted) return;
      try {
        const wsUrl = getWebSocketUrl('/ws/events', { role: 'ADMIN', userId: adminId });
        socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          if (isMounted) setWsConnected(true);
        };

        socket.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (audioEnabled) {
              playNotificationChime(msg.type === 'TASK_CREATED' ? 'alert' : 'ping');
            }

            if (msg.type === 'TASK_CREATED') {
              setToastAlert({
                title: 'New Service Request',
                message: `Task ${msg.payload.tracking_code} submitted for ${msg.payload.parent?.locality || 'Miryalaguda'}.`,
              });
            } else if (msg.type === 'PARTNER_CHECKED_IN' || msg.type === 'VERIFICATION_SUBMITTED') {
              setToastAlert({
                title: 'Verification Photo Received',
                message: `Partner check-in photo logged for ${msg.payload.tracking_code}. Ready to review.`,
              });
            } else if (msg.type === 'ESCROW_RELEASED') {
              setToastAlert({
                title: 'Escrow Released',
                message: `Task ${msg.payload.tracking_code} completed. Partner wallet credited.`,
              });
            } else if (msg.type === 'EMERGENCY_FREEZE_TOGGLED') {
              setToastAlert({
                title: msg.payload.active ? '🚨 EMERGENCY FREEZE ACTIVATED' : 'Emergency Freeze Lifted',
                message: msg.payload.active ? 'All escrow releases are now frozen platform-wide.' : 'Escrow releases resumed.',
              });
            }

            setTimeout(() => setToastAlert(null), 5000);
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
  }, [audioEnabled]);

  const handleAssignPartner = async (taskId: string, partnerId: string) => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/tasks/${taskId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId }),
      });
      if (res.ok) {
        const updated: Task = await res.json();
        setSelectedTask(updated);
        fetchData();
        if (audioEnabled) playNotificationChime('success');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Step-up Escrow Release Prompt
  const openEscrowPinModal = (taskId: string) => {
    setPendingReleaseTaskId(taskId);
    setPinError(null);
    setEscrowPinInput('');
    setShowPinModal(true);
  };

  const handleAuthorizedEscrowRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingReleaseTaskId || !escrowPinInput) return;

    setIsSubmittingPin(true);
    setPinError(null);

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/tasks/${pendingReleaseTaskId}/escrow/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: adminId,
          escrowPin: escrowPinInput,
        }),
      });

      if (res.ok) {
        const updated: Task = await res.json();
        setSelectedTask(updated);
        setAuditTarget(null);
        setShowPinModal(false);
        setEscrowPinInput('');
        fetchData();
        if (audioEnabled) playNotificationChime('success');
        setToastAlert({
          title: 'Escrow Released & Disbursed',
          message: `Task ${updated.tracking_code} authorized via PIN. Payout credited to partner.`,
        });
      } else {
        const errData = await res.json();
        setPinError(errData.error || 'Invalid Escrow Authorization PIN.');
        if (audioEnabled) playNotificationChime('alert');
      }
    } catch {
      setPinError('Connection error during PIN verification.');
    } finally {
      setIsSubmittingPin(false);
    }
  };

  const handleToggleEmergencyFreeze = async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/security/panic-freeze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorId: adminId }),
      });
      if (res.ok) {
        fetchData();
        if (audioEnabled) playNotificationChime('alert');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateEscrowPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPinInput.length !== 6) return;
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/security/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'escrow_release_pin',
          value: newPinInput,
          actorId: adminId,
        }),
      });
      if (res.ok) {
        setNewPinInput('');
        setPinChangeSuccess(true);
        setTimeout(() => setPinChangeSuccess(false), 4000);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectVerification = async () => {
    if (!auditTarget) return;
    const pendingLog = auditTarget.verification_logs?.find((v) => v.review_status === 'PENDING' || v.review_status === 'FLAGGED_OUT_OF_BOUNDS');
    if (!pendingLog) return;

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/tasks/${auditTarget.id}/verify/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logId: pendingLog.id,
          adminId: adminId,
          reason: rejectionReason || 'Photo is unclear or device GPS is outside the residence area.',
        }),
      });
      if (res.ok) {
        setShowRejectModal(false);
        setRejectionReason('');
        setAuditTarget(null);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResendWhatsApp = async (logId: string) => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/whatsapp/resend/${logId}`, {
        method: 'POST',
      });
      if (res.ok) {
        fetchData();
        if (audioEnabled) playNotificationChime('ping');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (localityFilter !== 'ALL' && !t.parent?.locality.toLowerCase().includes(localityFilter.toLowerCase())) {
      return false;
    }
    if (statusFilter === 'PENDING') return t.status === 'PENDING_OPS_REVIEW';
    if (statusFilter === 'ACTIVE') return ['DISPATCHED', 'ACCEPTED', 'IN_PROGRESS'].includes(t.status);
    if (statusFilter === 'AUDIT') return t.status === 'VERIFICATION_SUBMITTED';
    if (statusFilter === 'COMPLETED') return t.status === 'COMPLETED';
    return true;
  });

  const pendingReviewCount = tasks.filter((t) => t.status === 'PENDING_OPS_REVIEW').length;
  const pendingAuditCount = tasks.filter((t) => t.status === 'VERIFICATION_SUBMITTED').length;
  const activePartnersCount = partners.filter((p) => p.is_active).length;
  const isEmergencyFreeze = securitySettings.emergency_escrow_freeze === '1';

  const totalHeldEscrow = tasks
    .filter((t) => t.escrow?.status === 'HOLD_IN_ESCROW')
    .reduce((acc, t) => acc + (t.escrow?.amount || 0), 0);

  const handleAdminSignIn = async (e?: React.FormEvent, isDemo = false) => {
    if (e) e.preventDefault();
    setAdminAuthError(null);
    setAdminAuthLoading(true);

    const emailToUse = isDemo ? 'demo.admin@familyhubs.com' : adminEmail;
    const passwordToUse = isDemo ? 'DemoPassword123!' : adminPassword;

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'ADMIN',
          email: emailToUse,
          password: passwordToUse,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid admin credentials or clearance failure.');
      }

      const uid = data.user?.id || 'usr_demo_admin';
      const uname = data.user?.full_name || 'Demo Operations Admin';
      localStorage.setItem('fh_admin_logged_in', 'true');
      localStorage.setItem('fh_admin_id', uid);
      localStorage.setItem('fh_admin_name', uname);
      setAdminId(uid);
      setAdminName(uname);
      setIsLoggedIn(true);
      if (audioEnabled) playNotificationChime('success');
    } catch (err: any) {
      setAdminAuthError(err.message || 'Authentication failed. Please verify credentials.');
      if (audioEnabled) playNotificationChime('alert');
    } finally {
      setAdminAuthLoading(false);
    }
  };

  // ==========================================
  // VIEW: OPERATIONS LOGIN SCREEN (SIGN IN ONLY)
  // ==========================================
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center p-6 font-sans relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md bg-slate-800/90 backdrop-blur-xl p-8 rounded-3xl border border-slate-700/80 shadow-2xl space-y-6 z-10">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-indigo-600/30">
            <Radio className="w-8 h-8" />
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-black text-white">FamilyHubs Operations</h1>
            <p className="text-xs text-slate-400 mt-1">
              Command Center &amp; Quality Oversight Console
            </p>
          </div>

          {/* Explicit Notice: No Admin Signup */}
          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-700/90 text-left text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 text-indigo-400 font-bold uppercase tracking-wider text-[10px]">
              <Lock className="w-3.5 h-3.5" />
              <span>Restricted Platform Console</span>
            </div>
            <div className="text-slate-300 text-[11px] leading-relaxed">
              Admin &amp; Chief Dispatcher accounts are directly managed. Public self-registration is strictly disabled.
            </div>
          </div>

          {adminAuthError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{adminAuthError}</span>
            </div>
          )}

          <form onSubmit={(e) => handleAdminSignIn(e, false)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Admin Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  required
                  placeholder="demo.admin@familyhubs.com"
                  className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Admin Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showAdminPassword ? 'text' : 'password'}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPassword(!showAdminPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={adminAuthLoading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {adminAuthLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In to Operations Desk</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="relative my-3 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700" />
              </div>
              <span className="relative bg-slate-800 px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Or Instant Clearance
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleAdminSignIn(undefined, true)}
              className="w-full py-2.5 bg-slate-700/60 hover:bg-slate-700 text-slate-200 border border-slate-600/80 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Continue as Demo Admin (demo.admin@familyhubs.com)</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW: AUTHENTICATED ADMIN CONSOLE
  // ==========================================
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 font-sans">
      {/* Toast Alert */}
      {toastAlert && (
        <div className="fixed top-5 right-5 z-50 flex items-start gap-3 bg-white border border-slate-200 text-slate-900 p-4 rounded-2xl shadow-xl max-w-sm animate-in slide-in-from-top-3">
          <Bell className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold text-slate-900">{toastAlert.title}</div>
            <div className="text-xs text-slate-500 mt-0.5">{toastAlert.message}</div>
          </div>
        </div>
      )}

      {/* Emergency Freeze Banner */}
      {isEmergencyFreeze && (
        <div className="bg-red-600 text-white px-6 py-2.5 flex items-center justify-between text-xs font-bold shadow-md z-50">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 animate-bounce" />
            <span>EMERGENCY ESCROW FREEZE ACTIVE: All payouts are temporarily locked by Chief Concierge security policy.</span>
          </div>
          <button
            onClick={handleToggleEmergencyFreeze}
            className="bg-white text-red-700 px-3 py-1 rounded-lg text-xs font-bold hover:bg-red-50"
          >
            Lift Freeze
          </button>
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 py-3.5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-600/20">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-slate-900">
                  FamilyHubs Operations
                </span>
                <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2.5 py-0.5 rounded-full">
                  Miryalaguda &amp; Nalgonda Command
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Central Concierge Dispatch &amp; Quality Oversight
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-slate-50">
              <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
              <span className={wsConnected ? 'text-emerald-700' : 'text-amber-700'}>
                {wsConnected ? 'Command Engine Connected' : 'Connecting Engine...'}
              </span>
            </div>

            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:text-slate-900 transition"
              title={audioEnabled ? 'Mute alert sounds' : 'Enable alert sounds'}
            >
              {audioEnabled ? <Volume2 className="w-4 h-4 text-indigo-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            </button>

            <button
              onClick={() => setActiveTab('security')}
              className={`p-2 rounded-xl transition flex items-center gap-1.5 text-xs font-semibold ${
                isEmergencyFreeze ? 'bg-red-100 text-red-700 font-bold' : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
              title="Security Center"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Security</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>

            <div
              onClick={() => setActiveTab('settings')}
              className="border-l border-slate-200 pl-4 flex items-center gap-2.5 cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                {adminName.substring(0, 2).toUpperCase()}
              </div>
              <div className="hidden sm:block text-right">
                <div className="text-xs font-bold text-slate-900">{adminName}</div>
                <div className="text-[11px] text-slate-500">Chief Concierge Clearance</div>
              </div>
            </div>

            <button
              onClick={() => {
                localStorage.removeItem('fh_admin_logged_in');
                localStorage.removeItem('fh_admin_id');
                localStorage.removeItem('fh_admin_name');
                setIsLoggedIn(false);
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex space-x-2 mt-3 pt-2 border-t border-slate-100 overflow-x-auto">
          <button
            onClick={() => setActiveTab('dispatch')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'dispatch'
                ? 'bg-indigo-50 text-indigo-700 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Triage &amp; Dispatch
            {pendingReviewCount > 0 && (
              <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {pendingReviewCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('verifications')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'verifications'
                ? 'bg-indigo-50 text-indigo-700 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            Photo &amp; GPS Audit
            {pendingAuditCount > 0 && (
              <span className="bg-purple-100 text-purple-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {pendingAuditCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'whatsapp'
                ? 'bg-indigo-50 text-indigo-700 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            WhatsApp Parent Feed
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'security'
                ? 'bg-indigo-50 text-indigo-700 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Security &amp; Audit Logs
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'settings'
                ? 'bg-indigo-50 text-indigo-700 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            Operations Settings
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase">Needs Dispatch</div>
              <div className="text-2xl font-bold text-amber-600 mt-1">{pendingReviewCount}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase">Photos to Audit</div>
              <div className="text-2xl font-bold text-purple-600 mt-1">{pendingAuditCount}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase">Helpers Online</div>
              <div className="text-2xl font-bold text-emerald-600 mt-1">{activePartnersCount}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase">Escrow in Vault</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">${totalHeldEscrow.toFixed(2)}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* ================= VIEW 1: TRIAGE & DISPATCH ================= */}
        {activeTab === 'dispatch' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Queue */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2">
                  <select
                    value={localityFilter}
                    onChange={(e) => setLocalityFilter(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    <option value="ALL">All Hubs (Miryalaguda &amp; Nalgonda)</option>
                    <option value="Reddy Colony">Reddy Colony</option>
                    <option value="Housing Board">Housing Board</option>
                    <option value="Old Nalgonda">Old Nalgonda</option>
                  </select>
                </div>
                <button onClick={fetchData} className="p-1.5 text-slate-400 hover:text-slate-700">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {filteredTasks.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 space-y-2">
                  <Layers className="w-8 h-8 mx-auto text-slate-300" />
                  <div className="text-xs font-bold text-slate-600">No active care requests in triage.</div>
                  <div className="text-[11px] text-slate-400">When an NRI client books a home service, it will appear here immediately.</div>
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className={`p-4 rounded-2xl cursor-pointer transition border text-left ${
                      selectedTask?.id === task.id
                        ? 'bg-white border-indigo-600 shadow-md ring-2 ring-indigo-600/10'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                        {task.tracking_code}
                      </span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {task.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 mt-2">{task.title}</h4>

                    <div className="text-xs text-slate-500 mt-2 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{task.parent?.locality}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-slate-700 font-semibold">
                          Client: {task.client?.full_name}
                        </span>
                        <span className="font-bold text-emerald-700 font-mono">
                          ${task.escrow?.amount} Escrow
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Right Task Details & 1-Click Dispatch */}
            <div className="lg:col-span-7">
              {selectedTask ? (
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div>
                      <div className="text-xs font-mono font-bold text-indigo-700">{selectedTask.tracking_code}</div>
                      <h3 className="text-lg font-bold text-slate-900 mt-1">{selectedTask.title}</h3>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-slate-400">Escrow Security</div>
                      <div className="text-2xl font-bold font-mono text-emerald-600">
                        ${selectedTask.escrow?.amount.toFixed(2)} USD
                      </div>
                    </div>
                  </div>

                  {/* Client & Parent Profile */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <div className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">NRI Child (Client)</div>
                      <div className="font-bold text-slate-900 text-sm">{selectedTask.client?.full_name}</div>
                      <div className="text-slate-500">{selectedTask.client?.email}</div>
                      <div className="text-slate-500">{selectedTask.client?.country_residence}</div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <div className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Parent Residence</div>
                      <div className="font-bold text-slate-900 text-sm">{selectedTask.parent?.parent_name}</div>
                      <div className="text-slate-500">{selectedTask.parent?.full_address}</div>
                      <div className="text-slate-700 font-semibold">Phone: {selectedTask.parent?.primary_phone}</div>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-900">Instructions</div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 leading-relaxed">
                      {selectedTask.instructions}
                    </div>
                  </div>

                  {/* 1-Click Dispatch Helpers */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-indigo-600" />
                        Available Local Helpers
                      </div>
                      <span className="text-[11px] text-slate-400">{partners.length} Vetted Partners</span>
                    </div>

                    <div className="space-y-2">
                      {partners.map((partner) => (
                        <div
                          key={partner.user_id}
                          className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-3"
                        >
                          <div>
                            <div className="text-xs font-bold text-slate-900">{partner.full_name || partner.user?.full_name || 'Field Partner'}</div>
                            <div className="text-[11px] text-slate-500">{partner.operating_region} • {partner.service_category}</div>
                          </div>

                          {selectedTask.assigned_partner_id === partner.user_id ? (
                            <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Assigned
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAssignPartner(selectedTask.id, partner.user_id)}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-xs"
                            >
                              Dispatch Partner
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 text-slate-400">
                  Select a task from the triage list to inspect details or assign a partner.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= VIEW 2: PHOTO & GPS AUDIT ================= */}
        {activeTab === 'verifications' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Forensic Photo &amp; GPS Verification Audit</h2>
                <p className="text-xs text-slate-500">
                  Side-by-side inspection of live camera check-ins with server-enforced Haversine geofence validation.
                </p>
              </div>
            </div>

            {tasks.filter((t) => t.verification_logs && t.verification_logs.length > 0).length === 0 ? (
              <div className="bg-white p-16 text-center rounded-3xl border border-slate-200 text-slate-400 max-w-md mx-auto space-y-3">
                <Camera className="w-12 h-12 text-slate-300 mx-auto" />
                <div className="text-sm font-bold text-slate-700">0 check-in photos waiting for audit</div>
                <p className="text-xs text-slate-400">
                  When on-ground helpers arrive at a parent's residence and snap their check-in photo, it will appear here for audit.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {tasks
                  .filter((t) => t.verification_logs && t.verification_logs.length > 0)
                  .map((task) => {
                    const log = task.verification_logs![0];
                    const isFlagged = log.geofence_passed === false || (log.geofence_passed as unknown) === 0 || log.review_status === 'FLAGGED_OUT_OF_BOUNDS';
                    const isApproved = log.review_status === 'APPROVED';

                    return (
                      <div
                        key={task.id}
                        className={`bg-white rounded-3xl border p-6 space-y-4 shadow-sm ${
                          isFlagged ? 'border-red-300 ring-2 ring-red-500/10' : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                            {task.tracking_code}
                          </span>
                          <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                              isApproved
                                ? 'bg-emerald-50 text-emerald-700'
                                : isFlagged
                                ? 'bg-red-50 text-red-700 font-bold'
                                : 'bg-purple-50 text-purple-700'
                            }`}
                          >
                            {isApproved ? 'Approved & Disbursed' : isFlagged ? '⚠️ Geofence Flagged' : 'Pending Audit'}
                          </span>
                        </div>

                        {/* Photo Display */}
                        <div className="aspect-square rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 relative">
                          <img
                            src={getImageUrl(log.selfie_image_url)}
                            alt="Verification Proof"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-3 left-3 right-3 bg-black/85 backdrop-blur-md p-3 rounded-xl text-white font-mono text-[11px] space-y-1">
                            <div className="text-emerald-400 font-bold">
                              GPS: {log.latitude.toFixed(5)}°N, {log.longitude.toFixed(5)}°E
                            </div>
                            <div>Server Distance: {Math.round(log.distance_from_target_meters)}m from home</div>
                          </div>
                        </div>

                        {/* Geofence Alert if Out of Bounds */}
                        {isFlagged && (
                          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-1">
                            <div className="font-bold flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4 text-red-600" />
                              GEOFENCE SECURITY ALERT: OUT OF TOLERANCE
                            </div>
                            <div className="text-[11px] text-red-700">
                              Helper is {Math.round(log.distance_from_target_meters)}m from the parent's residence (Tolerance: {geofenceLimit}m). Flagged by server anti-spoofing engine.
                            </div>
                          </div>
                        )}

                        <div className="pt-2 flex gap-3">
                          <button
                            onClick={() => {
                              setAuditTarget(task);
                              setShowRejectModal(true);
                            }}
                            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition"
                          >
                            Request Retake
                          </button>

                          <button
                            onClick={() => openEscrowPinModal(task.id)}
                            disabled={isApproved || isEmergencyFreeze}
                            className={`flex-1 py-3 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-1.5 ${
                              isApproved
                                ? 'bg-slate-300 cursor-not-allowed text-slate-600'
                                : isEmergencyFreeze
                                ? 'bg-red-400 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-700'
                            }`}
                          >
                            <Key className="w-3.5 h-3.5" />
                            {isApproved ? 'Escrow Released' : `Authorize Payout ($${task.escrow?.amount})`}
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* ================= VIEW 3: WHATSAPP NOTIFICATIONS ================= */}
        {activeTab === 'whatsapp' && (
          <div className="space-y-4 max-w-4xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">WhatsApp Parent Notifications Feed</h2>
                <p className="text-xs text-slate-500">Zero-friction alerts dispatched directly to parents' phones in English.</p>
              </div>
              <button onClick={fetchData} className="p-2 text-slate-400 hover:text-slate-700">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {whatsAppLogs.length === 0 ? (
              <div className="bg-white p-16 text-center rounded-3xl border border-slate-200 text-slate-400 max-w-md mx-auto space-y-2">
                <MessageSquare className="w-10 h-10 text-slate-300 mx-auto" />
                <div className="text-sm font-bold text-slate-700">No WhatsApp messages dispatched yet</div>
                <p className="text-xs text-slate-400">When tasks are booked, assigned, or completed, real-time parent alerts will be logged here.</p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-200 divide-y divide-slate-100 shadow-sm overflow-hidden text-xs">
                {whatsAppLogs.map((log) => (
                  <div key={log.id} className="p-4 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-indigo-700">{log.recipient_phone}</span>
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                          {log.template_name}
                        </span>
                        <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">
                          ✓ {log.status}
                        </span>
                      </div>
                      <p className="text-slate-700 leading-relaxed max-w-xl">{log.message_preview}</p>
                      <div className="text-[10px] text-slate-400">{formatDate(log.sent_at)}</div>
                    </div>

                    <button
                      onClick={() => handleResendWhatsApp(log.id)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold shrink-0"
                    >
                      Resend
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= VIEW 4: SECURITY & AUDIT LOGS ================= */}
        {activeTab === 'security' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  Enterprise Security &amp; Audit Trail
                </h2>
                <p className="text-xs text-slate-500">
                  Forensic audit trail, cryptographic escrow release PIN management, and panic controls.
                </p>
              </div>

              {/* Panic Freeze Toggle */}
              <button
                onClick={handleToggleEmergencyFreeze}
                className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 shadow-sm ${
                  isEmergencyFreeze
                    ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                    : 'bg-slate-900 hover:bg-black text-white'
                }`}
              >
                <Flame className="w-4 h-4 text-amber-400" />
                {isEmergencyFreeze ? 'EMERGENCY FREEZE: ACTIVE (UNLOCK)' : 'EMERGENCY ESCROW FREEZE'}
              </button>
            </div>

            {/* Security Config Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase">Authorized Escrow Release PIN</div>
                <div className="text-2xl font-mono font-bold text-slate-900">
                  {securitySettings.escrow_release_pin || '849201'}
                </div>
                <div className="text-[11px] text-slate-500">Required before any escrow funds are disbursed.</div>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase">Server Geofence Tolerance</div>
                <div className="text-2xl font-mono font-bold text-emerald-600">
                  {geofenceLimit} meters
                </div>
                <div className="text-[11px] text-slate-500">Calculated via server-side Haversine engine.</div>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase">Anti-Tamper Status</div>
                <div className="text-2xl font-bold text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle2 className="w-6 h-6" />
                  Active
                </div>
                <div className="text-[11px] text-slate-500">SHA-256 release digest &amp; IP logging enabled.</div>
              </div>
            </div>

            {/* Change PIN Form */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-600" />
                Update Operations Escrow Authorization PIN
              </h3>

              <form onSubmit={handleUpdateEscrowPin} className="flex gap-4 max-w-md">
                <input
                  type="text"
                  maxLength={6}
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Enter new 6-digit PIN"
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-mono text-sm tracking-widest text-slate-800"
                />
                <button
                  type="submit"
                  disabled={newPinInput.length !== 6}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white font-bold text-xs rounded-xl transition shadow-xs"
                >
                  Save PIN
                </button>
              </form>
              {pinChangeSuccess && (
                <div className="text-xs text-emerald-600 font-bold flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> Escrow Authorization PIN successfully updated.
                </div>
              )}
            </div>

            {/* Immutable Audit Log Table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-3 p-6">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-600" />
                Immutable System Audit Logs ({auditLogs.length} events)
              </h3>

              <div className="divide-y divide-slate-100 text-xs">
                {auditLogs.map((log) => {
                  const isHigh = log.severity === 'HIGH' || log.severity === 'CRITICAL';
                  const isMed = log.severity === 'MEDIUM';

                  return (
                    <div key={log.id} className="py-3 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              isHigh
                                ? 'bg-red-100 text-red-700'
                                : isMed
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {log.severity}
                          </span>
                          <span className="font-mono font-bold text-slate-900">{log.event_type}</span>
                          <span className="text-slate-400">Actor: {log.actor_role} ({log.actor_id})</span>
                        </div>
                        <div className="text-slate-600 font-mono text-[11px]">{log.details_json}</div>
                      </div>
                      <div className="text-[11px] text-slate-400 shrink-0">{formatDate(log.created_at)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================= VIEW 5: SETTINGS ================= */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Operations Control Settings</h2>
              <p className="text-xs text-slate-500">Configure command center policies and dispatcher profile.</p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600" />
                Lead Dispatcher Profile
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Dispatcher Name</label>
                  <input
                    type="text"
                    defaultValue="Prasad Varma"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
                    readOnly
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Operational Area</label>
                  <input
                    type="text"
                    defaultValue="Miryalaguda & Old Nalgonda Command"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
                    readOnly
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => {
                  localStorage.setItem('fh_admin_logged_in', 'false');
                  setIsLoggedIn(false);
                }}
                className="w-full py-3.5 rounded-2xl border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs transition flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out from Operations Desk
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ================= ESCROW STEP-UP PIN AUTHORIZATION MODAL ================= */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Escrow Release Authorization</h3>
              </div>
              <button onClick={() => setShowPinModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              To disburse funds from the secure escrow vault directly to the on-ground helper's verified UPI account, enter your <strong>6-Digit Operations Authorization PIN</strong>.
            </p>

            <form onSubmit={handleAuthorizedEscrowRelease} className="space-y-4">
              <div>
                <label className="block text-slate-700 font-bold mb-1 text-xs">Operations Security PIN</label>
                <input
                  type="password"
                  maxLength={6}
                  autoFocus
                  value={escrowPinInput}
                  onChange={(e) => setEscrowPinInput(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="••••••"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-center text-xl font-mono tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  required
                />
                <div className="text-[11px] text-slate-400 mt-1.5 flex justify-between">
                  <span>Demo Authorized PIN: <code className="text-indigo-600 font-bold font-mono">849201</code></span>
                  <span>Logged in Security Audit</span>
                </div>
              </div>

              {pinError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{pinError}</span>
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPin || escrowPinInput.length !== 6}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white rounded-xl font-bold text-xs transition shadow-sm"
                >
                  {isSubmittingPin ? 'Verifying PIN...' : 'Authorize & Disburse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Flag / Retake Modal */}
      {showRejectModal && auditTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Request New Photo from Helper
            </h3>
            <p className="text-xs text-slate-500">
              Please explain why a retake is needed:
            </p>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Photo is too dark. Please take a clear picture in front of the door."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-800"
            />
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectVerification}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold"
              >
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
