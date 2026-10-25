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
  Star,
  Siren,
  FileCheck,
} from 'lucide-react';
import type { Task, PartnerProfile, VerificationLog, WhatsAppLog } from '@shared/types';
import { formatDate, playNotificationChime, getApiBaseUrl, getWebSocketUrl, getImageUrl } from '@shared/utils';

export default function AdminApp() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    const saved = localStorage.getItem('fh_admin_logged_in');
    return saved === null ? false : saved === 'true';
  });

  const [adminId, setAdminId] = useState<string>(() => {
    return localStorage.getItem('fh_admin_id') || '';
  });
  const [adminName, setAdminName] = useState<string>(() => {
    return localStorage.getItem('fh_admin_name') || 'Operations Admin';
  });
  const [adminEmail, setAdminEmail] = useState<string>(() => {
    return localStorage.getItem('fh_admin_email') || 'admin@familyhubs.in';
  });
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [showAdminPassword, setShowAdminPassword] = useState<boolean>(false);
  const [adminAuthLoading, setAdminAuthLoading] = useState<boolean>(false);
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);

  const [wsConnected, setWsConnected] = useState<boolean>(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [partners, setPartners] = useState<PartnerProfile[]>([]);
  const [whatsAppLogs, setWhatsAppLogs] = useState<WhatsAppLog[]>([]);
  const [activeEmergencies, setActiveEmergencies] = useState<any[]>([]);
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
      const [tasksRes, partnersRes, waRes, secRes, audRes, emRes] = await Promise.all([
        fetch(`${apiBase}/api/tasks`),
        fetch(`${apiBase}/api/partners`),
        fetch(`${apiBase}/api/whatsapp/logs`),
        fetch(`${apiBase}/api/security/settings`),
        fetch(`${apiBase}/api/security/audit-logs`),
        fetch(`${apiBase}/api/emergency/active`),
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

      if (emRes && emRes.ok) {
        const emData = await emRes.json();
        setActiveEmergencies(emData);
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
              playNotificationChime(msg.type === 'EMERGENCY_SOS_TRIGGERED' || msg.type === 'TASK_CREATED' ? 'alert' : 'ping');
            }

            if (msg.type === 'EMERGENCY_SOS_TRIGGERED') {
              setToastAlert({
                title: '🚨 CRITICAL EMERGENCY SOS SIGNAL',
                message: `Emergency reported for ${msg.payload.parent_name || 'Aging Parent'}. Priority 1 response required!`,
              });
            } else if (msg.type === 'EMERGENCY_SOS_RESOLVED') {
              setToastAlert({
                title: 'Emergency Handled',
                message: 'Emergency status safely resolved by ops.',
              });
            } else if (msg.type === 'TASK_CREATED') {
              setToastAlert({
                title: 'New Service Request',
                message: `Task ${msg.payload.tracking_code} submitted for ${msg.payload.parent?.locality || 'Pan-India'}.`,
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

  useEffect(() => {
    if (filteredTasks.length > 0) {
      if (!selectedTask || !filteredTasks.some((t) => t.id === selectedTask.id)) {
        setSelectedTask(filteredTasks[0]);
      }
    } else {
      setSelectedTask(null);
    }
  }, [statusFilter, localityFilter, tasks]);

  const pendingReviewCount = tasks.filter((t) => t.status === 'PENDING_OPS_REVIEW').length;
  const ongoingCount = tasks.filter((t) => ['DISPATCHED', 'ACCEPTED', 'IN_PROGRESS'].includes(t.status)).length;
  const pendingAuditCount = tasks.filter((t) => t.status === 'VERIFICATION_SUBMITTED').length;
  const completedCount = tasks.filter((t) => t.status === 'COMPLETED').length;
  const activePartnersCount = partners.filter((p) => p.is_active).length;
  const isEmergencyFreeze = securitySettings.emergency_escrow_freeze === '1';

  const totalHeldEscrow = tasks
    .filter((t) => t.escrow?.status === 'HOLD_IN_ESCROW')
    .reduce((acc, t) => acc + (t.escrow?.amount || 0), 0);

  const handleAdminSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAdminAuthError(null);
    setAdminAuthLoading(true);

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'ADMIN',
          email: adminEmail.trim(),
          password: adminPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid admin credentials or clearance failure.');
      }

      const uid = data.user?.id || '';
      const uname = data.user?.full_name || 'Operations Admin';
      const uemail = data.user?.email || adminEmail.trim();
      localStorage.setItem('fh_admin_logged_in', 'true');
      localStorage.setItem('fh_admin_id', uid);
      localStorage.setItem('fh_admin_name', uname);
      localStorage.setItem('fh_admin_email', uemail);
      setAdminId(uid);
      setAdminName(uname);
      setAdminEmail(uemail);
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
  // VIEW: OPERATIONS LOGIN SCREEN (Warm Editorial)
  // ==========================================
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] text-[#1C1917] flex flex-col justify-center items-center p-6 font-body antialiased relative">
        <div 
          className="absolute inset-0 pointer-events-none opacity-[0.035]"
          style={{
            backgroundImage: `radial-gradient(#C25E2E 0.75px, transparent 0.75px)`,
            backgroundSize: '24px 24px',
          }}
        />

        <div className="w-full max-w-md bg-[#FFFFFF] border border-[#E7DFD5] p-8 sm:p-10 rounded-3xl shadow-sm space-y-6 z-10">
          {/* Brand Seal */}
          <div className="text-center space-y-3">
            <div className="w-20 h-20 rounded-3xl bg-[#FFFFFF] border border-[#E7DFD5] flex items-center justify-center p-3 mx-auto shadow-md">
              <img src="/logo_icon.png" alt="FamilyHubs Operations" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#FBECE5] text-[#C25E2E] border border-[#F5D5C6] text-[10px] font-bold uppercase tracking-wider mb-1.5">
                <ShieldCheck className="w-3 h-3" />
                <span>Command Center Clearance</span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#1C1917] tracking-tight">
                FamilyHubs Operations
              </h1>
              <p className="text-xs text-[#574F49] mt-1">
                Central Concierge Dispatch &amp; Quality Oversight
              </p>
            </div>
          </div>

          {/* Explicit Notice: Restricted Console */}
          <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E7DFD5] text-xs space-y-1">
            <div className="flex items-center gap-1.5 text-[#C25E2E] font-bold text-[11px]">
              <Lock className="w-3.5 h-3.5" />
              <span>Restricted Administrator Desk</span>
            </div>
            <div className="text-[#574F49] text-[11px] leading-relaxed">
              Dispatch &amp; escrow controls require authorized operations credentials. Self-registration is strictly disabled.
            </div>
          </div>

          {adminAuthError && (
            <div className="p-3.5 rounded-xl bg-[#FEE2E2] border border-[#FCA5A5] text-[#991B1B] text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-[#B91C1C] shrink-0 mt-0.5" />
              <span className="font-medium">{adminAuthError}</span>
            </div>
          )}

          <form onSubmit={(e) => handleAdminSignIn(e)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#574F49] mb-1.5">
                Admin Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  required
                  placeholder="admin@familyhubs.in"
                  className="w-full bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl !pl-11 pr-4 py-2.5 text-sm text-[#1C1917] placeholder-[#8C827A] focus:outline-none focus:border-[#C25E2E] focus:ring-2 focus:ring-[#C25E2E]/10"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#574F49] mb-1.5">
                Admin Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showAdminPassword ? 'text' : 'password'}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl !pl-11 !pr-11 py-2.5 text-sm text-[#1C1917] placeholder-[#8C827A] focus:outline-none focus:border-[#C25E2E] focus:ring-2 focus:ring-[#C25E2E]/10 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPassword(!showAdminPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8C827A] hover:text-[#1C1917] cursor-pointer"
                >
                  {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={adminAuthLoading}
              className="w-full py-3.5 bg-[#C25E2E] hover:bg-[#A3481D] text-white font-semibold text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
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
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW: AUTHENTICATED ADMIN CONSOLE
  // ==========================================
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

      {/* Toast Alert */}
      {toastAlert && (
        <div className="fixed top-5 right-5 z-50 flex items-start gap-3 bg-[#FFFFFF] border border-[#E7DFD5] text-[#1C1917] p-4 rounded-2xl shadow-xl max-w-sm animate-fadeIn">
          <Bell className="w-5 h-5 text-[#C25E2E] shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold text-[#1C1917]">{toastAlert.title}</div>
            <div className="text-xs text-[#574F49] mt-0.5">{toastAlert.message}</div>
          </div>
        </div>
      )}

      {/* Critical Emergency SOS Incident Banner */}
      {activeEmergencies.length > 0 && (
        <div className="bg-[#B91C1C] text-white px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-bold shadow-xl z-50 animate-pulse border-b border-[#991B1B]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white text-[#B91C1C] flex items-center justify-center shrink-0 shadow-sm">
              <Siren className="w-5 h-5 animate-spin" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-white text-[#B91C1C] px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  🚨 LIVE EMERGENCY INCIDENT ({activeEmergencies.length} Active)
                </span>
                <span className="text-white text-sm font-bold">{activeEmergencies[0].parent_name}</span>
              </div>
              <div className="text-rose-100 font-medium text-[11px] mt-0.5">
                Address: {activeEmergencies[0].parent_address} • Phone: {activeEmergencies[0].parent_phone}
                {activeEmergencies[0].notes && ` • "${activeEmergencies[0].notes}"`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`tel:${activeEmergencies[0].parent_phone}`}
              className="bg-white/20 hover:bg-white/30 text-white border border-white/40 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              Call Parent
            </a>
            <button
              onClick={async () => {
                const notes = prompt('Enter resolution summary for this emergency:', 'Ambulance confirmed on scene. Vitals stabilized and family updated.');
                if (!notes) return;
                try {
                  const api = getApiBaseUrl();
                  await fetch(`${api}/api/emergency/${activeEmergencies[0].id}/resolve`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ resolvedBy: adminId || 'admin', resolutionNotes: notes }),
                  });
                  fetchData();
                } catch (e) {
                  console.error(e);
                }
              }}
              className="bg-white text-[#B91C1C] hover:bg-[#FEE2E2] px-4 py-1.5 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >
              Mark Emergency Resolved ✓
            </button>
          </div>
        </div>
      )}

      {/* Emergency Freeze Banner */}
      {isEmergencyFreeze && (
        <div className="bg-[#B45309] text-white px-6 py-2.5 flex items-center justify-between text-xs font-bold shadow-md z-50">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4" />
            <span>EMERGENCY ESCROW FREEZE ACTIVE: All payouts are temporarily locked by Chief Concierge security policy.</span>
          </div>
          <button
            onClick={handleToggleEmergencyFreeze}
            className="bg-white text-[#B45309] px-3 py-1 rounded-lg text-xs font-bold hover:bg-[#FEF3C7] cursor-pointer"
          >
            Lift Freeze
          </button>
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#FFFFFF]/95 backdrop-blur-md border-b border-[#E7DFD5] px-6 py-3.5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] border border-[#E7DFD5] flex items-center justify-center p-1.5 shadow-xs shrink-0">
              <img src="/logo_icon.png" alt="FamilyHubs" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-base font-bold text-[#1C1917] tracking-tight">
                  FamilyHubs Operations
                </span>
                <span className="text-[11px] bg-[#FBECE5] text-[#C25E2E] font-semibold px-2.5 py-0.5 rounded-full border border-[#F5D5C6]">
                  Pan-India Command
                </span>
              </div>
              <p className="text-xs text-[#8C827A]">
                Central Concierge Dispatch &amp; Quality Oversight
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 flex-wrap">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-[#FAF7F2] border-[#E7DFD5]">
              <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-[#1F5C42] animate-pulse' : 'bg-[#B45309]'}`} />
              <span className={wsConnected ? 'text-[#1F5C42]' : 'text-[#B45309]'}>
                {wsConnected ? 'Command Engine Connected' : 'Connecting Engine...'}
              </span>
            </div>

            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className="p-2 rounded-xl bg-[#FAF7F2] border border-[#E7DFD5] text-[#574F49] hover:text-[#1C1917] transition cursor-pointer"
              title={audioEnabled ? 'Mute alert sounds' : 'Enable alert sounds'}
            >
              {audioEnabled ? <Volume2 className="w-4 h-4 text-[#C25E2E]" /> : <VolumeX className="w-4 h-4 text-[#8C827A]" />}
            </button>

            <button
              onClick={() => setActiveTab('security')}
              className={`p-2 rounded-xl transition flex items-center gap-1.5 text-xs font-semibold border cursor-pointer ${
                isEmergencyFreeze ? 'bg-[#FEE2E2] text-[#B91C1C] border-[#FCA5A5]' : 'bg-[#FAF7F2] border-[#E7DFD5] text-[#574F49] hover:text-[#1C1917]'
              }`}
              title="Security Center"
            >
              <ShieldCheck className="w-4 h-4 text-[#1F5C42]" />
              <span className="hidden sm:inline">Security</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className="p-2 rounded-xl text-[#574F49] hover:text-[#1C1917] hover:bg-[#FAF7F2] border border-transparent hover:border-[#E7DFD5] transition cursor-pointer"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            <div
              onClick={() => setActiveTab('settings')}
              className="border-l border-[#E7DFD5] pl-3.5 flex items-center gap-2.5 cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-[#FBECE5] text-[#C25E2E] font-bold text-xs flex items-center justify-center border border-[#F5D5C6]">
                {adminName.substring(0, 2).toUpperCase()}
              </div>
              <div className="hidden sm:block text-right">
                <div className="text-xs font-bold text-[#1C1917]">{adminName}</div>
                <div className="text-[10px] text-[#8C827A]">Chief Concierge Clearance</div>
              </div>
            </div>

            <button
              onClick={() => {
                localStorage.removeItem('fh_admin_logged_in');
                localStorage.removeItem('fh_admin_id');
                localStorage.removeItem('fh_admin_name');
                setIsLoggedIn(false);
              }}
              className="p-2 rounded-xl text-[#8C827A] hover:text-[#B91C1C] hover:bg-[#FEE2E2] transition cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View Tabs */}
        <div className="max-w-7xl mx-auto flex space-x-1 mt-2.5 pt-1.5 border-t border-[#E7DFD5] overflow-x-auto">
          <button
            onClick={() => setActiveTab('dispatch')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-xl flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'dispatch'
                ? 'border-b-2 border-[#C25E2E] text-[#C25E2E] font-bold bg-[#FAF7F2]'
                : 'text-[#574F49] hover:text-[#1C1917]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Triage &amp; Dispatch
            {pendingReviewCount > 0 && (
              <span className="bg-[#FBECE5] text-[#C25E2E] text-[10px] px-1.5 py-0.2 rounded-full font-bold border border-[#F5D5C6]">
                {pendingReviewCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('verifications')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-xl flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'verifications'
                ? 'border-b-2 border-[#C25E2E] text-[#C25E2E] font-bold bg-[#FAF7F2]'
                : 'text-[#574F49] hover:text-[#1C1917]'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            Photo &amp; GPS Audit
            {pendingAuditCount > 0 && (
              <span className="bg-[#FEF3C7] text-[#B45309] text-[10px] px-1.5 py-0.2 rounded-full font-bold border border-[#FDE68A]">
                {pendingAuditCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-xl flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'whatsapp'
                ? 'border-b-2 border-[#C25E2E] text-[#C25E2E] font-bold bg-[#FAF7F2]'
                : 'text-[#574F49] hover:text-[#1C1917]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            WhatsApp Parent Feed
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-xl flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'security'
                ? 'border-b-2 border-[#C25E2E] text-[#C25E2E] font-bold bg-[#FAF7F2]'
                : 'text-[#574F49] hover:text-[#1C1917]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#1F5C42]" />
            Security &amp; Audit Logs
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-xl flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'settings'
                ? 'border-b-2 border-[#C25E2E] text-[#C25E2E] font-bold bg-[#FAF7F2]'
                : 'text-[#574F49] hover:text-[#1C1917]'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            Operations Settings
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6 z-10">
        {/* Metric Cards - Interactive Filter Controls */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <div
            onClick={() => { setStatusFilter('PENDING'); setActiveTab('dispatch'); }}
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
              statusFilter === 'PENDING' && activeTab === 'dispatch'
                ? 'bg-[#FFFFFF] border-[#C25E2E] ring-2 ring-[#C25E2E]/20 shadow-sm'
                : 'bg-[#FFFFFF] border-[#E7DFD5] hover:border-[#C25E2E]/40 shadow-xs'
            }`}
          >
            <div>
              <div className="text-[10px] font-bold text-[#C25E2E] uppercase tracking-wider">Needs Dispatch</div>
              <div className="font-display text-2xl font-bold text-[#1C1917] mt-0.5">{pendingReviewCount}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#FBECE5] text-[#C25E2E] flex items-center justify-center border border-[#F5D5C6]">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>

          <div
            onClick={() => { setStatusFilter('ACTIVE'); setActiveTab('dispatch'); }}
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
              statusFilter === 'ACTIVE' && activeTab === 'dispatch'
                ? 'bg-[#FFFFFF] border-[#1F5C42] ring-2 ring-[#1F5C42]/20 shadow-sm'
                : 'bg-[#FFFFFF] border-[#E7DFD5] hover:border-[#1F5C42]/40 shadow-xs'
            }`}
          >
            <div>
              <div className="text-[10px] font-bold text-[#1F5C42] uppercase tracking-wider">Ongoing In-Field</div>
              <div className="font-display text-2xl font-bold text-[#1C1917] mt-0.5">{ongoingCount}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#E8F3EE] text-[#1F5C42] flex items-center justify-center border border-[#C8E5D7]">
              <Activity className="w-5 h-5" />
            </div>
          </div>

          <div
            onClick={() => setActiveTab('verifications')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
              activeTab === 'verifications'
                ? 'bg-[#FFFFFF] border-[#B45309] ring-2 ring-[#B45309]/20 shadow-sm'
                : 'bg-[#FFFFFF] border-[#E7DFD5] hover:border-[#B45309]/40 shadow-xs'
            }`}
          >
            <div>
              <div className="text-[10px] font-bold text-[#B45309] uppercase tracking-wider">Photos to Audit</div>
              <div className="font-display text-2xl font-bold text-[#1C1917] mt-0.5">{pendingAuditCount}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#FEF3C7] text-[#B45309] flex items-center justify-center border border-[#FDE68A]">
              <Camera className="w-5 h-5" />
            </div>
          </div>

          <div
            onClick={() => { setStatusFilter('COMPLETED'); setActiveTab('dispatch'); }}
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
              statusFilter === 'COMPLETED' && activeTab === 'dispatch'
                ? 'bg-[#FFFFFF] border-[#1F5C42] ring-2 ring-[#1F5C42]/20 shadow-sm'
                : 'bg-[#FFFFFF] border-[#E7DFD5] hover:border-[#1F5C42]/40 shadow-xs'
            }`}
          >
            <div>
              <div className="text-[10px] font-bold text-[#1F5C42] uppercase tracking-wider">Completed</div>
              <div className="font-display text-2xl font-bold text-[#1C1917] mt-0.5">{completedCount}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#E8F3EE] text-[#1F5C42] flex items-center justify-center border border-[#C8E5D7]">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div
            onClick={() => { setStatusFilter('ALL'); setActiveTab('dispatch'); }}
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
              statusFilter === 'ALL' && activeTab === 'dispatch'
                ? 'bg-[#FFFFFF] border-[#1C1917] ring-2 ring-[#1C1917]/10 shadow-sm'
                : 'bg-[#FFFFFF] border-[#E7DFD5] hover:border-[#1C1917]/30 shadow-xs'
            }`}
          >
            <div>
              <div className="text-[10px] font-bold text-[#8C827A] uppercase tracking-wider">Escrow in Vault</div>
              <div className="font-display text-2xl font-bold text-[#1C1917] mt-0.5 font-mono">${totalHeldEscrow.toFixed(2)}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] text-[#1C1917] flex items-center justify-center border border-[#E7DFD5]">
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
                    className="bg-[#FFFFFF] border border-[#E7DFD5] rounded-xl px-3 py-1.5 text-xs font-semibold text-[#1C1917] focus:outline-none focus:border-[#C25E2E] shadow-xs cursor-pointer"
                  >
                    <option value="ALL">All Hubs (Pan-India)</option>
                    <option value="Telangana">Telangana Hub</option>
                    <option value="Karnataka">Karnataka Hub</option>
                    <option value="Maharashtra">Maharashtra Hub</option>
                    <option value="Delhi">Delhi NCR Hub</option>
                  </select>
                </div>
                <button 
                  onClick={fetchData} 
                  className="p-1.5 text-[#8C827A] hover:text-[#1C1917] hover:bg-[#FAF7F2] rounded-lg transition cursor-pointer"
                  title="Refresh tasks"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {[
                  { id: 'ALL', label: 'All', count: tasks.length },
                  { id: 'PENDING', label: 'Needs Dispatch', count: pendingReviewCount },
                  { id: 'ACTIVE', label: 'Ongoing', count: ongoingCount },
                  { id: 'AUDIT', label: 'Needs Audit', count: pendingAuditCount },
                  { id: 'COMPLETED', label: 'Completed', count: completedCount },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setStatusFilter(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
                      statusFilter === f.id
                        ? 'bg-[#1C1917] text-white shadow-xs'
                        : 'bg-[#FFFFFF] text-[#574F49] hover:bg-[#FAF7F2] border border-[#E7DFD5]'
                    }`}
                  >
                    <span>{f.label}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      statusFilter === f.id ? 'bg-white/20 text-white' : 'bg-[#FAF7F2] text-[#8C827A]'
                    }`}>
                      {f.count}
                    </span>
                  </button>
                ))}
              </div>

              {filteredTasks.length === 0 ? (
                <div className="p-12 text-center bg-[#FFFFFF] rounded-2xl border border-[#E7DFD5] text-[#8C827A] space-y-2">
                  <Layers className="w-8 h-8 mx-auto text-[#8C827A] opacity-40" />
                  <div className="font-display text-sm font-bold text-[#1C1917]">No requests match this filter.</div>
                  <div className="text-[11px] text-[#8C827A]">Try selecting 'All' or a different filter pill above.</div>
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className={`p-4 rounded-2xl cursor-pointer transition border text-left ${
                      selectedTask?.id === task.id
                        ? 'bg-[#FFFFFF] border-[#C25E2E] shadow-sm ring-2 ring-[#C25E2E]/10'
                        : 'bg-[#FFFFFF] border-[#E7DFD5] hover:border-[#C25E2E]/40 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-bold text-[#C25E2E] bg-[#FBECE5] px-2 py-0.5 rounded border border-[#F5D5C6]">
                        {task.tracking_code}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        task.status === 'COMPLETED'
                          ? 'bg-[#E8F3EE] text-[#1F5C42] border border-[#C8E5D7]'
                          : task.status === 'VERIFICATION_SUBMITTED'
                          ? 'bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]'
                          : task.status === 'IN_PROGRESS'
                          ? 'bg-[#E8F3EE] text-[#1F5C42] border border-[#C8E5D7]'
                          : task.status === 'ACCEPTED'
                          ? 'bg-[#FBECE5] text-[#C25E2E] border border-[#F5D5C6]'
                          : task.status === 'DISPATCHED'
                          ? 'bg-[#FAF7F2] text-[#574F49] border border-[#E7DFD5]'
                          : 'bg-[#FBECE5] text-[#C25E2E] border border-[#F5D5C6]'
                      }`}>
                        {task.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <h4 className="font-display text-sm font-bold text-[#1C1917] mt-2 leading-snug">
                      {task.title}
                    </h4>

                    <div className="text-xs text-[#574F49] mt-2 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#8C827A]" />
                        <span>{task.parent?.locality}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[#1C1917] font-semibold">
                          Client: {task.client?.full_name}
                        </span>
                        <span className="font-bold text-[#1F5C42] font-mono">
                          ${task.escrow?.amount} Escrow
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Right Task Details: Specialized for Ongoing, Completed & Pending */}
            <div className="lg:col-span-7">
              {selectedTask ? (
                <div className="bg-[#FFFFFF] p-6 rounded-3xl border border-[#E7DFD5] shadow-xs space-y-6">
                  {/* Status Banner */}
                  <div className={`p-3.5 rounded-2xl flex items-center justify-between text-xs font-bold border ${
                    selectedTask.status === 'COMPLETED'
                      ? 'bg-[#E8F3EE] border-[#C8E5D7] text-[#1F5C42]'
                      : selectedTask.status === 'VERIFICATION_SUBMITTED'
                      ? 'bg-[#FEF3C7] border-[#FDE68A] text-[#B45309]'
                      : ['DISPATCHED', 'ACCEPTED', 'IN_PROGRESS'].includes(selectedTask.status)
                      ? 'bg-[#E8F3EE] border-[#C8E5D7] text-[#1F5C42]'
                      : 'bg-[#FBECE5] border-[#F5D5C6] text-[#C25E2E]'
                  }`}>
                    <div className="flex items-center gap-2">
                      {selectedTask.status === 'COMPLETED' ? (
                        <CheckCircle2 className="w-4 h-4 text-[#1F5C42]" />
                      ) : selectedTask.status === 'VERIFICATION_SUBMITTED' ? (
                        <Camera className="w-4 h-4 text-[#B45309]" />
                      ) : ['DISPATCHED', 'ACCEPTED', 'IN_PROGRESS'].includes(selectedTask.status) ? (
                        <Activity className="w-4 h-4 text-[#1F5C42] animate-pulse" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-[#C25E2E]" />
                      )}
                      <span>
                        {selectedTask.status === 'COMPLETED'
                          ? 'SERVICE COMPLETED & ESCROW DISBURSED'
                          : selectedTask.status === 'VERIFICATION_SUBMITTED'
                          ? 'PHOTO CHECK-IN SUBMITTED — READY FOR AUDIT'
                          : selectedTask.status === 'IN_PROGRESS'
                          ? 'ONGOING IN-FIELD — COMPANION PERFORMING SERVICE'
                          : selectedTask.status === 'ACCEPTED'
                          ? 'ONGOING IN-FIELD — COMPANION EN ROUTE'
                          : selectedTask.status === 'DISPATCHED'
                          ? 'DISPATCHED — AWAITING COMPANION ACCEPTANCE'
                          : 'NEEDS IMMEDIATE DISPATCH'}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] opacity-75">{selectedTask.tracking_code}</span>
                  </div>

                  <div className="flex items-center justify-between pb-4 border-b border-[#E7DFD5]">
                    <div>
                      <h3 className="font-display text-xl font-bold text-[#1C1917]">{selectedTask.title}</h3>
                      <div className="text-xs text-[#8C827A] mt-0.5">Category: {selectedTask.category?.replace(/_/g, ' ')}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-[#8C827A]">Escrow Security</div>
                      <div className="text-2xl font-bold font-mono text-[#1F5C42]">
                        ${selectedTask.escrow?.amount ? selectedTask.escrow.amount.toFixed(2) : '50.00'} USD
                      </div>
                    </div>
                  </div>

                  {/* Client & Parent Profile */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E7DFD5] space-y-1.5">
                      <div className="font-bold text-[#8C827A] uppercase tracking-wider text-[10px]">NRI Adult Child (Client)</div>
                      <div className="font-bold text-[#1C1917] text-sm">{selectedTask.client?.full_name}</div>
                      <div className="text-[#574F49]">{selectedTask.client?.email}</div>
                      <div className="text-[#8C827A]">{selectedTask.client?.country_residence}</div>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E7DFD5] space-y-1.5">
                      <div className="font-bold text-[#8C827A] uppercase tracking-wider text-[10px]">Parent Residence</div>
                      <div className="font-bold text-[#1C1917] text-sm">{selectedTask.parent?.parent_name}</div>
                      <div className="text-[#574F49]">{selectedTask.parent?.full_address}</div>
                      <div className="text-[#1C1917] font-semibold">Phone: {selectedTask.parent?.primary_phone}</div>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-[#1C1917]">Instructions</div>
                    <div className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#E7DFD5] text-xs text-[#574F49] leading-relaxed">
                      "{selectedTask.instructions}"
                    </div>
                  </div>

                  {/* DYNAMIC SECTION BASED ON TASK STATUS */}
                  {selectedTask.status === 'COMPLETED' ? (
                    <div className="space-y-4 pt-2 border-t border-[#E7DFD5]">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#1F5C42] flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-[#1F5C42]" />
                        Completed Job Execution Summary
                      </h4>

                      <div className="p-4 bg-[#E8F3EE]/50 rounded-2xl border border-[#C8E5D7] text-xs space-y-3">
                        <div className="flex justify-between items-center pb-2 border-b border-[#C8E5D7]/60">
                          <span className="text-[#574F49]">Service Status:</span>
                          <span className="font-bold text-[#1F5C42]">Completed &amp; Escrow Released</span>
                        </div>
                        <div className="flex justify-between items-center pb-2 border-b border-[#C8E5D7]/60">
                          <span className="text-[#574F49]">Partner Payout:</span>
                          <span className="font-bold font-mono text-[#1F5C42]">${selectedTask.escrow?.amount} USD (Credited to Partner Wallet)</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[#574F49]">Executed by:</span>
                          <span className="font-semibold text-[#1C1917]">
                            {partners.find((p) => p.user_id === selectedTask.assigned_partner_id)?.full_name || 'Verified Companion'}
                          </span>
                        </div>
                      </div>

                      {/* Photo Proof Thumbnail if available */}
                      {selectedTask.verification_logs && selectedTask.verification_logs.length > 0 && (
                        <div className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#E7DFD5] space-y-2">
                          <div className="text-xs font-bold text-[#1C1917]">Forensic Check-In Verification Record</div>
                          <div className="flex items-center gap-4">
                            <img
                              src={getImageUrl(selectedTask.verification_logs[0].selfie_image_url)}
                              alt="Completed Proof"
                              className="w-20 h-20 rounded-xl object-cover border border-[#E7DFD5] shadow-xs"
                            />
                            <div className="text-xs text-[#574F49] space-y-1">
                              <div className="font-bold text-[#1F5C42]">✓ Geofence Verified (&lt; 150m from home)</div>
                              <div className="text-[11px] font-mono text-[#8C827A]">
                                GPS: {selectedTask.verification_logs[0].latitude.toFixed(4)}°N, {selectedTask.verification_logs[0].longitude.toFixed(4)}°E
                              </div>
                              <div className="text-[11px] text-[#8C827A]">
                                Distance: {Math.round(selectedTask.verification_logs[0].distance_from_target_meters)}m from residence
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* CSAT Client Review */}
                      {selectedTask.review && (
                        <div className="p-4 bg-[#FEF3C7]/60 rounded-2xl border border-[#FDE68A] text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#92400E] flex items-center gap-1.5">
                              <Star className="w-4 h-4 fill-[#F59E0B] text-[#F59E0B]" />
                              Client CSAT Rating: {selectedTask.review.rating}/5 Stars
                            </span>
                            <span className="text-[10px] text-[#92400E] bg-white px-2 py-0.5 rounded-md font-bold border border-[#FDE68A]">
                              Verified NRI Feedback
                            </span>
                          </div>
                          {selectedTask.review.tags && selectedTask.review.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {selectedTask.review.tags.map((t: string) => (
                                <span key={t} className="text-[10px] bg-white text-[#574F49] px-2 py-0.5 rounded-md border border-[#E7DFD5] font-medium">
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                          {selectedTask.review.feedback_text && (
                            <div className="text-[11px] text-[#574F49] italic bg-white/80 p-2.5 rounded-xl border border-[#FDE68A]">
                              "{selectedTask.review.feedback_text}"
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : selectedTask.status === 'VERIFICATION_SUBMITTED' ? (
                    <div className="space-y-4 pt-2 border-t border-[#E7DFD5]">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#B45309] flex items-center gap-1.5">
                          <Camera className="w-4 h-4 text-[#B45309]" />
                          Photo Check-In Submitted — Audit &amp; Escrow Release
                        </h4>
                      </div>

                      {selectedTask.verification_logs && selectedTask.verification_logs.length > 0 && (
                        <div className="p-4 bg-[#FEF3C7]/40 rounded-2xl border border-[#FDE68A] text-xs flex items-center gap-4">
                          <img
                            src={getImageUrl(selectedTask.verification_logs[0].selfie_image_url)}
                            alt="Check-in Photo"
                            className="w-24 h-24 rounded-xl object-cover border border-[#FDE68A] shadow-xs"
                          />
                          <div className="space-y-1">
                            <div className="font-bold text-[#92400E]">Check-In Selfie at Parent Home</div>
                            <div className="text-[11px] text-[#574F49]">
                              Distance: {Math.round(selectedTask.verification_logs[0].distance_from_target_meters)}m (Tolerance: {geofenceLimit}m)
                            </div>
                            <div className="text-[11px] font-mono text-[#1F5C42] font-bold">
                              ✓ Server Geofence Passed
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={() => {
                            setAuditTarget(selectedTask);
                            setShowRejectModal(true);
                          }}
                          className="flex-1 py-3 bg-[#FAF7F2] hover:bg-[#F5F1EB] text-[#1C1917] border border-[#E7DFD5] font-semibold rounded-xl text-xs transition cursor-pointer"
                        >
                          Request Retake
                        </button>
                        <button
                          onClick={() => openEscrowPinModal(selectedTask.id)}
                          className="flex-1 py-3 bg-[#1F5C42] hover:bg-[#164632] text-white font-semibold rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Key className="w-3.5 h-3.5" />
                          Authorize Escrow Payout (${selectedTask.escrow?.amount})
                        </button>
                      </div>
                    </div>
                  ) : ['DISPATCHED', 'ACCEPTED', 'IN_PROGRESS'].includes(selectedTask.status) ? (
                    <div className="space-y-4 pt-2 border-t border-[#E7DFD5]">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#1F5C42] flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-[#1F5C42] animate-pulse" />
                        Assigned Field Companion (Ongoing In-Field)
                      </h4>

                      <div className="p-4 bg-[#E8F3EE]/50 rounded-2xl border border-[#C8E5D7] text-xs space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-bold text-[#1C1917] text-sm">
                              {partners.find((p) => p.user_id === selectedTask.assigned_partner_id)?.full_name || 'Verified Field Companion'}
                            </div>
                            <div className="text-[#8C827A] text-[11px]">
                              {partners.find((p) => p.user_id === selectedTask.assigned_partner_id)?.operating_region || 'Pan-India Operations Hub'}
                            </div>
                          </div>
                          <span className="px-3 py-1 bg-[#E8F3EE] text-[#1F5C42] font-bold text-xs rounded-xl border border-[#C8E5D7]">
                            {selectedTask.status.replace(/_/g, ' ')}
                          </span>
                        </div>

                        {/* Phone and Call action */}
                        <div className="flex items-center justify-between pt-2 border-t border-[#C8E5D7]/60">
                          <span className="text-[#574F49]">Contact Companion:</span>
                          <a
                            href={`tel:${partners.find((p) => p.user_id === selectedTask.assigned_partner_id)?.phone || '+919440155667'}`}
                            className="font-bold text-[#C25E2E] hover:underline flex items-center gap-1 font-mono"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                            {partners.find((p) => p.user_id === selectedTask.assigned_partner_id)?.phone || '+91 94401 55667'}
                          </a>
                        </div>
                      </div>

                      {/* Photo checkin preview if already submitted */}
                      {selectedTask.verification_logs && selectedTask.verification_logs.length > 0 && (
                        <div className="p-3.5 bg-[#FAF7F2] rounded-2xl border border-[#E7DFD5] flex items-center gap-3">
                          <img
                            src={getImageUrl(selectedTask.verification_logs[0].selfie_image_url)}
                            alt="Check-in"
                            className="w-14 h-14 rounded-xl object-cover border border-[#E7DFD5]"
                          />
                          <div className="text-xs text-[#574F49]">
                            <div className="font-bold text-[#1C1917]">Arrival Check-In Registered</div>
                            <div className="text-[11px] text-[#8C827A]">Distance: {Math.round(selectedTask.verification_logs[0].distance_from_target_meters)}m from home</div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* PENDING_OPS_REVIEW - Needs Dispatch */
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-[#1C1917] flex items-center gap-1.5">
                          <UserCheck className="w-4 h-4 text-[#C25E2E]" />
                          Available Local Helpers for Dispatch
                        </div>
                        <span className="text-[11px] text-[#8C827A]">{partners.length} Vetted Companions</span>
                      </div>

                      <div className="space-y-2">
                        {partners.map((partner) => (
                          <div
                            key={partner.user_id}
                            className="p-3.5 bg-[#FAF7F2] rounded-2xl border border-[#E7DFD5] flex items-center justify-between gap-3"
                          >
                            <div>
                              <div className="text-xs font-bold text-[#1C1917]">{partner.full_name || partner.user?.full_name || 'Field Companion'}</div>
                              <div className="text-[11px] text-[#8C827A]">{partner.operating_region} • {partner.service_category}</div>
                            </div>

                            {selectedTask.assigned_partner_id === partner.user_id ? (
                              <span className="px-3 py-1.5 bg-[#E8F3EE] text-[#1F5C42] text-xs font-bold rounded-xl flex items-center gap-1 border border-[#C8E5D7]">
                                <Check className="w-3.5 h-3.5" /> Assigned
                              </span>
                            ) : (
                              <button
                                onClick={() => handleAssignPartner(selectedTask.id, partner.user_id)}
                                className="px-4 py-2 bg-[#C25E2E] hover:bg-[#A3481D] text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer"
                              >
                                Dispatch Companion
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-[#FFFFFF] p-12 text-center rounded-3xl border border-[#E7DFD5] text-[#8C827A]">
                  Select a task from the list to inspect details or manage dispatch.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= VIEW 2: PHOTO & GPS AUDIT ================= */}
        {activeTab === 'verifications' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-[#E7DFD5]">
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-[#1C1917]">
                  Forensic Photo &amp; GPS Verification Audit
                </h2>
                <p className="text-xs text-[#574F49] mt-0.5">
                  Side-by-side inspection of live camera check-ins with server-enforced Haversine geofence validation.
                </p>
              </div>
            </div>

            {tasks.filter((t) => t.verification_logs && t.verification_logs.length > 0).length === 0 ? (
              <div className="bg-[#FFFFFF] p-16 text-center rounded-3xl border border-[#E7DFD5] text-[#8C827A] max-w-md mx-auto space-y-3 shadow-xs">
                <Camera className="w-12 h-12 text-[#8C827A] mx-auto opacity-40" />
                <div className="font-display text-sm font-bold text-[#1C1917]">0 check-in photos waiting for audit</div>
                <p className="text-xs text-[#8C827A]">
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
                        className={`bg-[#FFFFFF] rounded-3xl border p-6 space-y-4 shadow-xs transition-all ${
                          isFlagged ? 'border-[#FCA5A5] ring-2 ring-[#FCA5A5]/20' : 'border-[#E7DFD5]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-[#C25E2E] bg-[#FBECE5] px-2.5 py-0.5 rounded border border-[#F5D5C6]">
                            {task.tracking_code}
                          </span>
                          <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                              isApproved
                                ? 'bg-[#E8F3EE] text-[#1F5C42] border border-[#C8E5D7]'
                                : isFlagged
                                ? 'bg-[#FEE2E2] text-[#B91C1C] font-bold border border-[#FCA5A5]'
                                : 'bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]'
                            }`}
                          >
                            {isApproved ? 'Approved & Disbursed' : isFlagged ? '⚠️ Geofence Flagged' : 'Pending Audit'}
                          </span>
                        </div>

                        {/* Photo Display */}
                        <div className="aspect-square rounded-2xl overflow-hidden bg-[#1C1917] border border-[#E7DFD5] relative">
                          <img
                            src={getImageUrl(log.selfie_image_url)}
                            alt="Verification Proof"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-3 left-3 right-3 bg-[#1C1917]/85 backdrop-blur-md p-3.5 rounded-xl text-white font-mono text-[11px] space-y-1 border border-white/10">
                            <div className="text-[#34D399] font-bold">
                              GPS: {log.latitude.toFixed(5)}°N, {log.longitude.toFixed(5)}°E
                            </div>
                            <div>Server Distance: {Math.round(log.distance_from_target_meters)}m from home</div>
                          </div>
                        </div>

                        {/* Geofence Alert if Out of Bounds */}
                        {isFlagged && (
                          <div className="p-3.5 bg-[#FEE2E2] border border-[#FCA5A5] rounded-xl text-xs text-[#991B1B] space-y-1">
                            <div className="font-bold flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4 text-[#B91C1C]" />
                              GEOFENCE SECURITY ALERT: OUT OF TOLERANCE
                            </div>
                            <div className="text-[11px] text-[#7F1D1D] leading-relaxed">
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
                            className="flex-1 py-3 bg-[#FAF7F2] hover:bg-[#F5F1EB] text-[#1C1917] border border-[#E7DFD5] font-semibold rounded-xl text-xs transition cursor-pointer"
                          >
                            Request Retake
                          </button>

                          <button
                            onClick={() => openEscrowPinModal(task.id)}
                            disabled={isApproved || isEmergencyFreeze}
                            className={`flex-1 py-3 text-white font-semibold rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                              isApproved
                                ? 'bg-[#E7DFD5] cursor-not-allowed text-[#8C827A]'
                                : isEmergencyFreeze
                                ? 'bg-[#FCA5A5] cursor-not-allowed'
                                : 'bg-[#1F5C42] hover:bg-[#164632]'
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
            <div className="flex items-center justify-between pb-2 border-b border-[#E7DFD5]">
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-[#1C1917]">
                  WhatsApp Parent Notifications Feed
                </h2>
                <p className="text-xs text-[#574F49] mt-0.5">
                  Zero-friction alerts dispatched directly to parents' phones in English and local languages.
                </p>
              </div>
              <button 
                onClick={fetchData} 
                className="p-2 text-[#8C827A] hover:text-[#1C1917] hover:bg-[#FAF7F2] rounded-lg transition cursor-pointer"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {whatsAppLogs.length === 0 ? (
              <div className="bg-[#FFFFFF] p-16 text-center rounded-3xl border border-[#E7DFD5] text-[#8C827A] max-w-md mx-auto space-y-2 shadow-xs">
                <MessageSquare className="w-10 h-10 text-[#8C827A] mx-auto opacity-40" />
                <div className="font-display text-sm font-bold text-[#1C1917]">No WhatsApp messages dispatched yet</div>
                <p className="text-xs text-[#8C827A]">When tasks are booked, assigned, or completed, real-time parent alerts will be logged here.</p>
              </div>
            ) : (
              <div className="bg-[#FFFFFF] rounded-3xl border border-[#E7DFD5] divide-y divide-[#E7DFD5] shadow-xs overflow-hidden text-xs">
                {whatsAppLogs.map((log) => (
                  <div key={log.id} className="p-4 sm:p-5 flex items-start justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-[#C25E2E]">{log.recipient_phone}</span>
                        <span className="bg-[#FAF7F2] text-[#574F49] px-2 py-0.5 rounded-full text-[10px] font-semibold border border-[#E7DFD5]">
                          {log.template_name}
                        </span>
                        <span className="text-[#1F5C42] font-semibold bg-[#E8F3EE] px-2 py-0.5 rounded-full text-[10px] border border-[#C8E5D7]">
                          ✓ {log.status}
                        </span>
                      </div>
                      <p className="text-[#574F49] leading-relaxed max-w-xl">{log.message_preview}</p>
                      <div className="text-[10px] text-[#8C827A] font-mono">{formatDate(log.sent_at)}</div>
                    </div>

                    <button
                      onClick={() => handleResendWhatsApp(log.id)}
                      className="px-3.5 py-1.5 bg-[#FAF7F2] hover:bg-[#F5F1EB] text-[#1C1917] border border-[#E7DFD5] rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition shadow-xs"
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
            <div className="flex items-center justify-between pb-2 border-b border-[#E7DFD5]">
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-[#1C1917] flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#1F5C42]" />
                  Enterprise Security &amp; Audit Trail
                </h2>
                <p className="text-xs text-[#574F49] mt-0.5">
                  Forensic audit trail, cryptographic escrow release PIN management, and panic controls.
                </p>
              </div>

              {/* Panic Freeze Toggle */}
              <button
                onClick={handleToggleEmergencyFreeze}
                className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer ${
                  isEmergencyFreeze
                    ? 'bg-[#B91C1C] hover:bg-[#991B1B] text-white animate-pulse'
                    : 'bg-[#1C1917] hover:bg-black text-white'
                }`}
              >
                <Flame className="w-4 h-4 text-[#F59E0B]" />
                {isEmergencyFreeze ? 'EMERGENCY FREEZE: ACTIVE (UNLOCK)' : 'EMERGENCY ESCROW FREEZE'}
              </button>
            </div>

            {/* Security Config Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#FFFFFF] p-5 rounded-3xl border border-[#E7DFD5] shadow-xs space-y-2">
                <div className="text-[10px] font-bold text-[#8C827A] uppercase tracking-wider">Authorized Escrow Release PIN</div>
                <div className="text-2xl font-mono font-bold text-[#1C1917]">
                  {securitySettings.escrow_release_pin || '849201'}
                </div>
                <div className="text-[11px] text-[#574F49]">Required before any escrow funds are disbursed.</div>
              </div>

              <div className="bg-[#FFFFFF] p-5 rounded-3xl border border-[#E7DFD5] shadow-xs space-y-2">
                <div className="text-[10px] font-bold text-[#8C827A] uppercase tracking-wider">Server Geofence Tolerance</div>
                <div className="text-2xl font-mono font-bold text-[#1F5C42]">
                  {geofenceLimit} meters
                </div>
                <div className="text-[11px] text-[#574F49]">Calculated via server-side Haversine engine.</div>
              </div>

              <div className="bg-[#FFFFFF] p-5 rounded-3xl border border-[#E7DFD5] shadow-xs space-y-2">
                <div className="text-[10px] font-bold text-[#8C827A] uppercase tracking-wider">Anti-Tamper Status</div>
                <div className="text-2xl font-bold text-[#1F5C42] flex items-center gap-1.5">
                  <CheckCircle2 className="w-6 h-6" />
                  Active
                </div>
                <div className="text-[11px] text-[#574F49]">SHA-256 release digest &amp; IP logging enabled.</div>
              </div>
            </div>

            {/* Change PIN Form */}
            <div className="bg-[#FFFFFF] p-6 rounded-3xl border border-[#E7DFD5] shadow-xs space-y-4">
              <h3 className="font-display text-base font-bold text-[#1C1917] flex items-center gap-2">
                <Key className="w-4 h-4 text-[#C25E2E]" />
                Update Operations Escrow Authorization PIN
              </h3>

              <form onSubmit={handleUpdateEscrowPin} className="flex gap-3 max-w-md">
                <input
                  type="text"
                  maxLength={6}
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Enter new 6-digit PIN"
                  className="flex-1 bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl px-4 py-2.5 font-mono text-sm tracking-widest text-[#1C1917] focus:outline-none focus:border-[#C25E2E]"
                />
                <button
                  type="submit"
                  disabled={newPinInput.length !== 6}
                  className="px-5 py-2.5 bg-[#C25E2E] hover:bg-[#A3481D] disabled:bg-[#E7DFD5] text-white font-semibold text-xs rounded-xl transition shadow-xs cursor-pointer"
                >
                  Save PIN
                </button>
              </form>
              {pinChangeSuccess && (
                <div className="text-xs text-[#1F5C42] font-bold flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> Escrow Authorization PIN successfully updated.
                </div>
              )}
            </div>

            {/* Immutable Audit Log Table */}
            <div className="bg-[#FFFFFF] rounded-3xl border border-[#E7DFD5] shadow-xs overflow-hidden space-y-3 p-6">
              <h3 className="font-display text-base font-bold text-[#1C1917] flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#C25E2E]" />
                Immutable System Audit Logs ({auditLogs.length} events)
              </h3>

              <div className="divide-y divide-[#E7DFD5] text-xs">
                {auditLogs.map((log) => {
                  const isHigh = log.severity === 'HIGH' || log.severity === 'CRITICAL';
                  const isMed = log.severity === 'MEDIUM';

                  return (
                    <div key={log.id} className="py-3 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              isHigh
                                ? 'bg-[#FEE2E2] text-[#B91C1C]'
                                : isMed
                                ? 'bg-[#FEF3C7] text-[#B45309]'
                                : 'bg-[#E8F3EE] text-[#1F5C42]'
                            }`}
                          >
                            {log.severity}
                          </span>
                          <span className="font-mono font-bold text-[#1C1917]">{log.event_type}</span>
                          <span className="text-[#8C827A]">Actor: {log.actor_role} ({log.actor_id})</span>
                        </div>
                        <div className="text-[#574F49] font-mono text-[11px]">{log.details_json}</div>
                      </div>
                      <div className="text-[11px] text-[#8C827A] shrink-0 font-mono">{formatDate(log.created_at)}</div>
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
            <div className="pb-2 border-b border-[#E7DFD5]">
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[#1C1917]">
                Operations Control Settings
              </h2>
              <p className="text-xs text-[#574F49] mt-0.5">
                Configure command center policies and dispatcher profile.
              </p>
            </div>

            <div className="bg-[#FFFFFF] p-6 rounded-3xl border border-[#E7DFD5] shadow-xs space-y-4">
              <h3 className="font-display text-base font-bold text-[#1C1917] flex items-center gap-2">
                <User className="w-4 h-4 text-[#C25E2E]" />
                Lead Dispatcher Profile
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="text-[#8C827A] font-semibold block mb-1">Dispatcher Name</label>
                  <input
                    type="text"
                    value={adminName || 'Operations Administrator'}
                    className="w-full bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl px-3.5 py-2.5 text-[#1C1917] font-medium"
                    readOnly
                  />
                </div>
                <div>
                  <label className="text-[#8C827A] font-semibold block mb-1">Admin Email</label>
                  <input
                    type="email"
                    value={adminEmail || 'admin@familyhubs.in'}
                    className="w-full bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl px-3.5 py-2.5 text-[#1C1917] font-medium"
                    readOnly
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[#8C827A] font-semibold block mb-1">Operational Area</label>
                  <input
                    type="text"
                    value="Pan-India Eldercare Operations Command"
                    className="w-full bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl px-3.5 py-2.5 text-[#1C1917] font-medium"
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
                className="w-full py-3.5 rounded-2xl border border-[#FCA5A5] text-[#B91C1C] hover:bg-[#FEE2E2] font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1917]/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#FFFFFF] rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-5 shadow-2xl border border-[#E7DFD5]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7DFD5]">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-[#C25E2E]" />
                <h3 className="font-display text-base font-bold text-[#1C1917]">Escrow Release Authorization</h3>
              </div>
              <button onClick={() => setShowPinModal(false)} className="text-[#8C827A] hover:text-[#1C1917] p-1 cursor-pointer">
                ✕
              </button>
            </div>

            <p className="text-xs text-[#574F49] leading-relaxed">
              To disburse funds from the secure escrow vault directly to the on-ground helper's verified UPI account, enter your <strong>6-Digit Operations Authorization PIN</strong>.
            </p>

            <form onSubmit={handleAuthorizedEscrowRelease} className="space-y-4">
              <div>
                <label className="block text-[#1C1917] font-semibold mb-1 text-xs">Operations Security PIN</label>
                <input
                  type="password"
                  maxLength={6}
                  autoFocus
                  value={escrowPinInput}
                  onChange={(e) => setEscrowPinInput(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="••••••"
                  className="w-full bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl p-3 text-center text-xl font-mono tracking-widest text-[#1C1917] focus:outline-none focus:border-[#C25E2E]"
                  required
                />
                <div className="text-[11px] text-[#8C827A] mt-1.5 flex justify-between">
                  <span>Authorized Escrow PIN Required</span>
                  <span>Logged in Security Audit</span>
                </div>
              </div>

              {pinError && (
                <div className="p-3 rounded-xl bg-[#FEE2E2] border border-[#FCA5A5] text-xs text-[#991B1B] font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#B91C1C]" />
                  <span>{pinError}</span>
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="flex-1 py-3 bg-[#FAF7F2] text-[#574F49] hover:bg-[#F5F1EB] border border-[#E7DFD5] rounded-xl font-semibold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPin || escrowPinInput.length !== 6}
                  className="flex-1 py-3 bg-[#1F5C42] hover:bg-[#164632] disabled:bg-[#E7DFD5] text-white rounded-xl font-semibold text-xs transition shadow-xs cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1917]/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#FFFFFF] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-[#E7DFD5]">
            <h3 className="font-display text-base font-bold text-[#1C1917] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#B45309]" />
              Request New Photo from Companion
            </h3>
            <p className="text-xs text-[#574F49]">
              Please explain why a retake is needed:
            </p>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Photo is too dark. Please take a clear picture in front of the residence entrance."
              className="w-full bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl p-3 text-xs text-[#1C1917] focus:outline-none focus:border-[#C25E2E]"
            />
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 py-2.5 bg-[#FAF7F2] text-[#574F49] hover:bg-[#F5F1EB] border border-[#E7DFD5] rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectVerification}
                className="flex-1 py-2.5 bg-[#B91C1C] hover:bg-[#991B1B] text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
              >
                Send Retake Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
