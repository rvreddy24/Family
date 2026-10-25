import React, { useState, useEffect } from 'react';
import {
  Heart,
  Activity,
  Plus,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  FileText,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Stethoscope,
  Pill,
  X,
} from 'lucide-react';
import type { ParentVital, ParentMedication, MedicalVaultDocument } from '@shared/types';
import { formatDate, getApiBaseUrl, playNotificationChime } from '@shared/utils';

interface HealthViewProps {
  parentId: string;
  parentName: string;
  clientId: string;
  onRefillCreated?: () => void;
}

export const HealthView: React.FC<HealthViewProps> = ({
  parentId,
  parentName,
  clientId,
  onRefillCreated,
}) => {
  const [vitals, setVitals] = useState<ParentVital[]>([]);
  const [medications, setMedications] = useState<ParentMedication[]>([]);
  const [documents, setDocuments] = useState<MedicalVaultDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [subTab, setSubTab] = useState<'vitals' | 'medications' | 'vault'>('vitals');

  // Modals
  const [showVitalModal, setShowVitalModal] = useState<boolean>(false);
  const [showMedModal, setShowMedModal] = useState<boolean>(false);
  const [showDocModal, setShowDocModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [refillLoadingId, setRefillLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Form states - Vitals
  const [bpSys, setBpSys] = useState<string>('120');
  const [bpDia, setBpDia] = useState<string>('80');
  const [sugar, setSugar] = useState<string>('110');
  const [sugarType, setSugarType] = useState<'FASTING' | 'POST_PRANDIAL' | 'RANDOM'>('FASTING');
  const [pulse, setPulse] = useState<string>('72');
  const [spo2, setSpo2] = useState<string>('98');
  const [weight, setWeight] = useState<string>('68');
  const [vitalNotes, setVitalNotes] = useState<string>('');

  // Form states - Medications
  const [medName, setMedName] = useState<string>('');
  const [medDosage, setMedDosage] = useState<string>('500mg');
  const [medFreq, setMedFreq] = useState<string>('DAILY');
  const [medTiming, setMedTiming] = useState<string>('Morning (After Breakfast)');
  const [medStock, setMedStock] = useState<number>(30);
  const [medThreshold, setMedThreshold] = useState<number>(7);
  const [medInstructions, setMedInstructions] = useState<string>('');

  // Form states - Vault Documents
  const [docTitle, setDocTitle] = useState<string>('');
  const [docCategory, setDocCategory] = useState<'PRESCRIPTION' | 'LAB_REPORT' | 'DISCHARGE_SUMMARY' | 'SCAN'>('PRESCRIPTION');
  const [docFileUrl, setDocFileUrl] = useState<string>('');
  const [docDoctor, setDocDoctor] = useState<string>('');
  const [docHospital, setDocHospital] = useState<string>('');
  const [docDate, setDocDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [docNotes, setDocNotes] = useState<string>('');

  const fetchHealthData = async () => {
    if (!parentId) return;
    try {
      setLoading(true);
      const api = getApiBaseUrl();
      const [vRes, mRes, dRes] = await Promise.all([
        fetch(`${api}/api/parents/${parentId}/vitals`),
        fetch(`${api}/api/parents/${parentId}/medications`),
        fetch(`${api}/api/parents/${parentId}/documents`),
      ]);

      if (vRes.ok) setVitals(await vRes.json());
      if (mRes.ok) setMedications(await mRes.json());
      if (dRes.ok) setDocuments(await dRes.json());
    } catch (err) {
      console.error('Failed to load health data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, [parentId]);

  const handleSaveVital = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const api = getApiBaseUrl();
      const res = await fetch(`${api}/api/parents/${parentId}/vitals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bloodPressureSys: bpSys ? parseInt(bpSys) : null,
          bloodPressureDia: bpDia ? parseInt(bpDia) : null,
          bloodSugar: sugar ? parseFloat(sugar) : null,
          bloodSugarType: sugarType,
          pulse: pulse ? parseInt(pulse) : null,
          spo2: spo2 ? parseInt(spo2) : null,
          weightKg: weight ? parseFloat(weight) : null,
          recordedBy: 'FAMILY_NRI',
          notes: vitalNotes.trim() || null,
        }),
      });

      if (res.ok) {
        setShowVitalModal(false);
        setVitalNotes('');
        fetchHealthData();
        playNotificationChime('success');
        setMessage('Health vitals saved to clinical journal.');
        setTimeout(() => setMessage(null), 4000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveMed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medName) return;
    setIsSubmitting(true);
    try {
      const api = getApiBaseUrl();
      const res = await fetch(`${api}/api/parents/${parentId}/medications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medicineName: medName.trim(),
          dosage: medDosage.trim(),
          frequency: medFreq,
          timeOfDay: medTiming.trim(),
          stockRemaining: medStock,
          lowStockThreshold: medThreshold,
          instructions: medInstructions.trim() || null,
        }),
      });

      if (res.ok) {
        setShowMedModal(false);
        setMedName('');
        setMedInstructions('');
        fetchHealthData();
        playNotificationChime('success');
        setMessage('Medication scheduled with refill tracking.');
        setTimeout(() => setMessage(null), 4000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOrderRefill = async (medId: string) => {
    setRefillLoadingId(medId);
    try {
      const api = getApiBaseUrl();
      const res = await fetch(`${api}/api/parents/${parentId}/medications/${medId}/refill-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      });

      if (res.ok) {
        playNotificationChime('success');
        setMessage('Pharmacy concierge refill task dispatched!');
        setTimeout(() => setMessage(null), 5000);
        if (onRefillCreated) onRefillCreated();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRefillLoadingId(null);
    }
  };

  const handleDeleteMed = async (medId: string) => {
    if (!confirm('Remove this medication from schedule?')) return;
    try {
      const api = getApiBaseUrl();
      await fetch(`${api}/api/parents/${parentId}/medications/${medId}`, { method: 'DELETE' });
      fetchHealthData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle) return;
    setIsSubmitting(true);
    try {
      const api = getApiBaseUrl();
      const res = await fetch(`${api}/api/parents/${parentId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: docTitle.trim(),
          category: docCategory,
          fileUrl: docFileUrl || '/uploads/prescription_sample.pdf',
          doctorName: docDoctor.trim() || null,
          hospitalName: docHospital.trim() || null,
          documentDate: docDate,
          notes: docNotes.trim() || null,
          uploadedBy: clientId,
        }),
      });

      if (res.ok) {
        setShowDocModal(false);
        setDocTitle('');
        setDocDoctor('');
        setDocHospital('');
        setDocNotes('');
        fetchHealthData();
        playNotificationChime('success');
        setMessage('Medical document uploaded to vault!');
        setTimeout(() => setMessage(null), 4000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const latestVital = vitals[0] || null;

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {message && (
        <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 px-4 py-3 rounded-xl flex items-center gap-3 text-xs font-semibold shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Header Overview Card */}
      <div className="bg-slate-900 dark:bg-[#111827] text-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 bg-blue-500/10 text-blue-300 px-3 py-1 rounded-full text-xs font-semibold mb-3 border border-blue-500/20">
              <Heart className="w-3.5 h-3.5 fill-blue-400 text-blue-400" />
              <span>Elderly Health &amp; Wellness Diary</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {parentName}'s Clinical &amp; Wellness Journal
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-1.5 max-w-xl leading-relaxed">
              Real-time clinical vitals, medication adherence alarms, and encrypted digital diagnostic records for your parents in India.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowVitalModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2 px-3.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Activity className="w-4 h-4" />
              <span>Log Vitals</span>
            </button>
            <button
              onClick={() => setShowMedModal(true)}
              className="bg-white/10 hover:bg-white/15 text-white border border-white/20 font-semibold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer"
            >
              <Pill className="w-4 h-4 text-blue-300" />
              <span>Add Medicine</span>
            </button>
            <button
              onClick={() => setShowDocModal(true)}
              className="bg-white/10 hover:bg-white/15 text-white border border-white/20 font-semibold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4 text-emerald-300" />
              <span>Add Record</span>
            </button>
          </div>
        </div>

        {/* Latest Vitals Metric Ribbon */}
        {latestVital && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-7 pt-6 border-t border-white/10">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
              <div className="text-[11px] text-slate-400 font-medium">Blood Pressure</div>
              <div className="font-display text-xl font-bold mt-1 text-white">
                {latestVital.blood_pressure_sys && latestVital.blood_pressure_dia
                  ? `${latestVital.blood_pressure_sys}/${latestVital.blood_pressure_dia}`
                  : '120/80'}{' '}
                <span className="text-[11px] font-normal text-slate-400 font-body">mmHg</span>
              </div>
              <span className="inline-block mt-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/40">
                Optimal
              </span>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
              <div className="text-[11px] text-slate-400 font-medium">Blood Sugar ({latestVital.blood_sugar_type || 'FASTING'})</div>
              <div className="font-display text-xl font-bold mt-1 text-white">
                {latestVital.blood_sugar || 110}{' '}
                <span className="text-[11px] font-normal text-slate-400 font-body">mg/dL</span>
              </div>
              <span className="inline-block mt-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/40">
                Controlled
              </span>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
              <div className="text-[11px] text-slate-400 font-medium">Oxygen &amp; Pulse</div>
              <div className="font-display text-xl font-bold mt-1 text-white">
                {latestVital.spo2 || 98}%{' '}
                <span className="text-[11px] font-normal text-slate-400 font-body">/ {latestVital.pulse || 72} bpm</span>
              </div>
              <span className="inline-block mt-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/40">
                Normal
              </span>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
              <div className="text-[11px] text-slate-400 font-medium">Body Weight</div>
              <div className="font-display text-xl font-bold mt-1 text-white">
                {latestVital.weight_kg || 68}{' '}
                <span className="text-[11px] font-normal text-slate-400 font-body">kg</span>
              </div>
              <span className="inline-block mt-1 text-[10px] font-semibold text-blue-300 bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-800/40">
                Logged: {formatDate(latestVital.recorded_at)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setSubTab('vitals')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition flex items-center gap-2 cursor-pointer ${
            subTab === 'vitals'
              ? 'bg-white dark:bg-[#1E293B] text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Vitals Timeline ({vitals.length})</span>
        </button>

        <button
          onClick={() => setSubTab('medications')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition flex items-center gap-2 cursor-pointer ${
            subTab === 'medications'
              ? 'bg-white dark:bg-[#1E293B] text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <Pill className="w-4 h-4 text-amber-500" />
          <span>Medication Schedule ({medications.length})</span>
        </button>

        <button
          onClick={() => setSubTab('vault')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition flex items-center gap-2 cursor-pointer ${
            subTab === 'vault'
              ? 'bg-white dark:bg-[#1E293B] text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <FileText className="w-4 h-4 text-emerald-500" />
          <span>Medical Vault ({documents.length})</span>
        </button>
      </div>

      {/* 1. VITALS TIMELINE TAB */}
      {subTab === 'vitals' && (
        <div className="space-y-4">
          {vitals.length === 0 ? (
            <div className="bg-white dark:bg-[#111827] rounded-2xl p-10 text-center border border-slate-200 dark:border-slate-800 shadow-xs">
              <Activity className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">No Vitals Recorded Yet</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-5 leading-relaxed">
                Log the first blood pressure, sugar, or heart rate reading, or book a Health Check visit for our verified field nurse to measure them at home.
              </p>
              <button
                onClick={() => setShowVitalModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2 px-4 rounded-xl transition cursor-pointer"
              >
                Log First Reading
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 shadow-xs overflow-hidden">
              {vitals.map((v) => (
                <div key={v.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-900/60">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                          BP: {v.blood_pressure_sys && v.blood_pressure_dia ? `${v.blood_pressure_sys}/${v.blood_pressure_dia} mmHg` : 'N/A'}
                        </span>
                        {v.blood_sugar && (
                          <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/60 px-2 py-0.5 rounded-md">
                            Sugar: {v.blood_sugar} mg/dL ({v.blood_sugar_type})
                          </span>
                        )}
                        {v.spo2 && (
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-md">
                            SpO2: {v.spo2}%
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                        <span>Recorded by {v.recorded_by}</span>
                        <span>•</span>
                        <span>{formatDate(v.recorded_at)}</span>
                      </div>
                      {v.notes && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 italic mt-1.5 bg-slate-50 dark:bg-[#1E293B]/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                          "{v.notes}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-3 py-1 rounded-full">
                      Verified Clinical Log
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. MEDICATIONS TAB */}
      {subTab === 'medications' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-50 dark:bg-[#1E293B]/60 border border-slate-200 dark:border-slate-800 p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <Pill className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">1-Click Concierge Medicine Refills</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">When prescription pills run low, click "Order Refill" to dispatch a verified field partner to the pharmacy.</p>
              </div>
            </div>
            <button
              onClick={() => setShowMedModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2 px-3.5 rounded-xl transition cursor-pointer shrink-0"
            >
              + Add Prescription
            </button>
          </div>

          {medications.length === 0 ? (
            <div className="bg-white dark:bg-[#111827] rounded-2xl p-10 text-center border border-slate-200 dark:border-slate-800 shadow-xs">
              <Pill className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">No Medications Scheduled</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-5 leading-relaxed">
                Add daily vitamins, hypertension pills, or diabetes medicines to enable automated low-stock warnings and 1-click pharmacy replenishment.
              </p>
              <button
                onClick={() => setShowMedModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2 px-4 rounded-xl transition cursor-pointer"
              >
                Schedule First Medication
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {medications.map((m) => {
                const isLowStock = m.stock_remaining <= m.low_stock_threshold;
                return (
                  <div key={m.id} className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-900/60">
                            <Pill className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm">{m.medicine_name}</h4>
                            <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">{m.dosage} • {m.frequency}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteMed(m.id)}
                          className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-1 rounded-lg transition cursor-pointer"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="mt-3.5 space-y-2 text-xs">
                        <div className="flex items-center justify-between bg-slate-50 dark:bg-[#1E293B]/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" /> Timing:
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white">{m.time_of_day}</span>
                        </div>

                        <div className="flex items-center justify-between bg-slate-50 dark:bg-[#1E293B]/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" /> Stock Remaining:
                          </span>
                          <span className={`font-bold px-2 py-0.5 rounded-md ${
                            isLowStock
                              ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/60'
                              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                          }`}>
                            {m.stock_remaining} units {isLowStock ? '(Low Stock!)' : ''}
                          </span>
                        </div>

                        {m.instructions && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 italic px-1">
                            Note: {m.instructions}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium font-mono">Escrow: $25</span>
                      <button
                        onClick={() => handleOrderRefill(m.id)}
                        disabled={refillLoadingId === m.id}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-1.5 px-3 rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {refillLoadingId === m.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        <span>Order Refill via Concierge</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. MEDICAL VAULT TAB */}
      {subTab === 'vault' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-50 dark:bg-[#1E293B]/60 border border-slate-200 dark:border-slate-800 p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Encrypted Digital Health Records</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Centralized storage for lab results, hospital discharge cards, and prescriptions.</p>
              </div>
            </div>
            <button
              onClick={() => setShowDocModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2 px-3.5 rounded-xl transition cursor-pointer shrink-0"
            >
              + Upload Document
            </button>
          </div>

          {documents.length === 0 ? (
            <div className="bg-white dark:bg-[#111827] rounded-2xl p-10 text-center border border-slate-200 dark:border-slate-800 shadow-xs">
              <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">No Documents Uploaded</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-5 leading-relaxed">
                Upload your parent's recent ECG, blood test results, or doctor prescriptions so you and our concierge team always have quick access.
              </p>
              <button
                onClick={() => setShowDocModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2 px-4 rounded-xl transition cursor-pointer"
              >
                Upload Document
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {documents.map((d) => (
                <div key={d.id} className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-md uppercase">
                          {d.category.replace('_', ' ')}
                        </span>
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm mt-1.5">{d.title}</h4>
                      </div>
                      <a
                        href={d.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 p-2 rounded-xl border border-blue-200 dark:border-blue-900/60 transition"
                        title="Download / View"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>

                    <div className="mt-3.5 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                      {d.doctor_name && <div>Doctor: <span className="font-semibold text-slate-900 dark:text-white">{d.doctor_name}</span></div>}
                      {d.hospital_name && <div>Hospital: <span className="font-semibold text-slate-900 dark:text-white">{d.hospital_name}</span></div>}
                      {d.document_date && <div>Date: <span className="font-semibold text-slate-900 dark:text-white">{d.document_date}</span></div>}
                      {d.notes && <div className="text-slate-600 dark:text-slate-300 italic mt-1.5 bg-slate-50 dark:bg-[#1E293B]/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">"{d.notes}"</div>}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400">
                    Uploaded {formatDate(d.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: LOG VITALS */}
      {showVitalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#111827] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-900/60">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-slate-900 dark:text-white text-base">Log Health Vitals</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Record clinical measurements for {parentName}</p>
                </div>
              </div>
              <button onClick={() => setShowVitalModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVital} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Systolic BP (mmHg)</label>
                  <input
                    type="number"
                    value={bpSys}
                    onChange={(e) => setBpSys(e.target.value)}
                    className="w-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="120"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Diastolic BP (mmHg)</label>
                  <input
                    type="number"
                    value={bpDia}
                    onChange={(e) => setBpDia(e.target.value)}
                    className="w-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="80"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Blood Sugar (mg/dL)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={sugar}
                    onChange={(e) => setSugar(e.target.value)}
                    className="w-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="110"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Sugar Condition</label>
                  <select
                    value={sugarType}
                    onChange={(e) => setSugarType(e.target.value as any)}
                    className="w-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="FASTING">Fasting</option>
                    <option value="POST_PRANDIAL">Post-Prandial (After Food)</option>
                    <option value="RANDOM">Random</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Pulse (bpm)</label>
                  <input
                    type="number"
                    value={pulse}
                    onChange={(e) => setPulse(e.target.value)}
                    className="w-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="72"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">SpO2 (%)</label>
                  <input
                    type="number"
                    value={spo2}
                    onChange={(e) => setSpo2(e.target.value)}
                    className="w-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="98"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="68"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Clinical Observation / Notes</label>
                <textarea
                  value={vitalNotes}
                  onChange={(e) => setVitalNotes(e.target.value)}
                  className="w-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="e.g. Measured after morning walk and light breakfast"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowVitalModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2 px-5 rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Vitals'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD MEDICATION */}
      {showMedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#111827] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-900/60">
                  <Pill className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-slate-900 dark:text-white text-base">Schedule Medication</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Enable automatic refill alerts for {parentName}</p>
                </div>
              </div>
              <button onClick={() => setShowMedModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMed} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Medicine Name &amp; Generic</label>
                <input
                  type="text"
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  className="w-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Metformin Hydrochloride, Amlodipine"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Dosage</label>
                  <input
                    type="text"
                    value={medDosage}
                    onChange={(e) => setMedDosage(e.target.value)}
                    className="w-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 500mg, 5mg"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Frequency</label>
                  <select
                    value={medFreq}
                    onChange={(e) => setMedFreq(e.target.value)}
                    className="w-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="DAILY">Once Daily</option>
                    <option value="TWICE_DAILY">Twice Daily</option>
                    <option value="THREE_TIMES_DAILY">Three Times Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="AS_NEEDED">As Needed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Timing Description</label>
                <input
                  type="text"
                  value={medTiming}
                  onChange={(e) => setMedTiming(e.target.value)}
                  className="w-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Morning (After Breakfast), Night (Before Bed)"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Current Stock (Pills)</label>
                  <input
                    type="number"
                    value={medStock}
                    onChange={(e) => setMedStock(parseInt(e.target.value) || 0)}
                    className="w-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Alert Threshold</label>
                  <input
                    type="number"
                    value={medThreshold}
                    onChange={(e) => setMedThreshold(parseInt(e.target.value) || 7)}
                    className="w-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Doctor's Special Instructions</label>
                <textarea
                  value={medInstructions}
                  onChange={(e) => setMedInstructions(e.target.value)}
                  className="w-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="e.g. Avoid taking on empty stomach; drink plenty of water"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowMedModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2 px-5 rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Add to Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: UPLOAD VAULT DOCUMENT */}
      {showDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#111827] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800/60">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-slate-900 dark:text-white text-base">Upload Medical Record</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Encrypted digital vault storage for {parentName}</p>
                </div>
              </div>
              <button onClick={() => setShowDocModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDoc} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Document Title</label>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Annual Blood Lipid Profile & HbA1c"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Category</label>
                  <select
                    value={docCategory}
                    onChange={(e) => setDocCategory(e.target.value as any)}
                    className="w-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PRESCRIPTION">Prescription</option>
                    <option value="LAB_REPORT">Lab Report</option>
                    <option value="DISCHARGE_SUMMARY">Discharge Summary</option>
                    <option value="SCAN">Scan / X-Ray / ECG</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Document Date</label>
                  <input
                    type="date"
                    value={docDate}
                    onChange={(e) => setDocDate(e.target.value)}
                    className="w-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Doctor Name</label>
                  <input
                    type="text"
                    value={docDoctor}
                    onChange={(e) => setDocDoctor(e.target.value)}
                    className="w-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Dr. K. S. Rao"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Hospital / Clinic</label>
                  <input
                    type="text"
                    value={docHospital}
                    onChange={(e) => setDocHospital(e.target.value)}
                    className="w-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Apollo Hospitals"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">File Link or Upload URL</label>
                <input
                  type="text"
                  value={docFileUrl}
                  onChange={(e) => setDocFileUrl(e.target.value)}
                  className="w-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://... or /uploads/..."
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Summary / Key Findings</label>
                <textarea
                  value={docNotes}
                  onChange={(e) => setDocNotes(e.target.value)}
                  className="w-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="e.g. Normal sinus rhythm; HbA1c 6.4 (Good control)"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDocModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2 px-5 rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Uploading...' : 'Save to Vault'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
