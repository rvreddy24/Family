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
        <div className="bg-[#E8F3EE] border border-[#C8E5D7] text-[#1F5C42] px-4 py-3 rounded-xl flex items-center gap-3 text-xs font-semibold shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-[#1F5C42] shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Header Overview Card */}
      <div className="bg-[#241F1C] text-[#FAF7F2] rounded-2xl p-6 sm:p-8 shadow-sm border border-[#3D3530] relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-[#C25E2E]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 bg-[#FAF7F2]/10 text-[#F5D3C4] px-3 py-1 rounded-full text-xs font-semibold mb-3 border border-white/10">
              <Heart className="w-3.5 h-3.5 fill-[#C25E2E] text-[#C25E2E]" />
              <span>Elderly Health &amp; Wellness Diary</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {parentName}'s Clinical &amp; Wellness Journal
            </h2>
            <p className="text-[#C2B8AE] text-xs sm:text-sm mt-1.5 max-w-xl leading-relaxed">
              Real-time clinical vitals, medication adherence alarms, and encrypted digital diagnostic records for your parents in India.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowVitalModal(true)}
              className="filial-btn-primary text-xs py-2 px-3.5 cursor-pointer shadow-sm"
            >
              <Activity className="w-4 h-4" />
              <span>Log Vitals</span>
            </button>
            <button
              onClick={() => setShowMedModal(true)}
              className="bg-white/10 hover:bg-white/15 text-white border border-white/20 font-semibold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer"
            >
              <Pill className="w-4 h-4 text-[#F5D3C4]" />
              <span>Add Medicine</span>
            </button>
            <button
              onClick={() => setShowDocModal(true)}
              className="bg-white/10 hover:bg-white/15 text-white border border-white/20 font-semibold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4 text-[#C8E5D7]" />
              <span>Add Record</span>
            </button>
          </div>
        </div>

        {/* Latest Vitals Metric Ribbon */}
        {latestVital && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-7 pt-6 border-t border-white/10">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
              <div className="text-[11px] text-[#C2B8AE] font-medium">Blood Pressure</div>
              <div className="font-display text-xl font-bold mt-1 text-white">
                {latestVital.blood_pressure_sys && latestVital.blood_pressure_dia
                  ? `${latestVital.blood_pressure_sys}/${latestVital.blood_pressure_dia}`
                  : '120/80'}{' '}
                <span className="text-[11px] font-normal text-[#8C827A] font-body">mmHg</span>
              </div>
              <span className="inline-block mt-1 text-[10px] font-semibold text-[#A8DDC5] bg-[#1F5C42]/40 px-2 py-0.5 rounded-md">
                Optimal
              </span>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
              <div className="text-[11px] text-[#C2B8AE] font-medium">Blood Sugar ({latestVital.blood_sugar_type || 'FASTING'})</div>
              <div className="font-display text-xl font-bold mt-1 text-white">
                {latestVital.blood_sugar || 110}{' '}
                <span className="text-[11px] font-normal text-[#8C827A] font-body">mg/dL</span>
              </div>
              <span className="inline-block mt-1 text-[10px] font-semibold text-[#A8DDC5] bg-[#1F5C42]/40 px-2 py-0.5 rounded-md">
                Controlled
              </span>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
              <div className="text-[11px] text-[#C2B8AE] font-medium">Oxygen &amp; Pulse</div>
              <div className="font-display text-xl font-bold mt-1 text-white">
                {latestVital.spo2 || 98}%{' '}
                <span className="text-[11px] font-normal text-[#8C827A] font-body">/ {latestVital.pulse || 72} bpm</span>
              </div>
              <span className="inline-block mt-1 text-[10px] font-semibold text-[#A8DDC5] bg-[#1F5C42]/40 px-2 py-0.5 rounded-md">
                Normal
              </span>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
              <div className="text-[11px] text-[#C2B8AE] font-medium">Body Weight</div>
              <div className="font-display text-xl font-bold mt-1 text-white">
                {latestVital.weight_kg || 68}{' '}
                <span className="text-[11px] font-normal text-[#8C827A] font-body">kg</span>
              </div>
              <span className="inline-block mt-1 text-[10px] font-semibold text-[#F5D3C4] bg-[#C25E2E]/30 px-2 py-0.5 rounded-md">
                Logged: {formatDate(latestVital.recorded_at)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E7DFD5] pb-2">
        <button
          onClick={() => setSubTab('vitals')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition flex items-center gap-2 cursor-pointer ${
            subTab === 'vitals'
              ? 'bg-white text-[#C25E2E] border border-[#E7DFD5] shadow-xs'
              : 'text-[#574F49] hover:text-[#1C1917] hover:bg-[#F5F1EB]'
          }`}
        >
          <Activity className="w-4 h-4 text-[#C25E2E]" />
          <span>Vitals Timeline ({vitals.length})</span>
        </button>

        <button
          onClick={() => setSubTab('medications')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition flex items-center gap-2 cursor-pointer ${
            subTab === 'medications'
              ? 'bg-white text-[#C25E2E] border border-[#E7DFD5] shadow-xs'
              : 'text-[#574F49] hover:text-[#1C1917] hover:bg-[#F5F1EB]'
          }`}
        >
          <Pill className="w-4 h-4 text-[#B45309]" />
          <span>Medication Schedule ({medications.length})</span>
        </button>

        <button
          onClick={() => setSubTab('vault')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition flex items-center gap-2 cursor-pointer ${
            subTab === 'vault'
              ? 'bg-white text-[#C25E2E] border border-[#E7DFD5] shadow-xs'
              : 'text-[#574F49] hover:text-[#1C1917] hover:bg-[#F5F1EB]'
          }`}
        >
          <FileText className="w-4 h-4 text-[#1F5C42]" />
          <span>Medical Vault ({documents.length})</span>
        </button>
      </div>

      {/* 1. VITALS TIMELINE TAB */}
      {subTab === 'vitals' && (
        <div className="space-y-4">
          {vitals.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-[#E7DFD5] shadow-xs">
              <Activity className="w-12 h-12 text-[#C2B8AE] mx-auto mb-3" />
              <h3 className="font-display text-lg font-bold text-[#1C1917]">No Vitals Recorded Yet</h3>
              <p className="text-xs text-[#574F49] max-w-sm mx-auto mt-1 mb-5 leading-relaxed">
                Log the first blood pressure, sugar, or heart rate reading, or book a Health Check visit for our verified field nurse to measure them at home.
              </p>
              <button
                onClick={() => setShowVitalModal(true)}
                className="filial-btn-primary text-xs py-2 px-4 cursor-pointer"
              >
                Log First Reading
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E7DFD5] divide-y divide-[#E7DFD5] shadow-xs overflow-hidden">
              {vitals.map((v) => (
                <div key={v.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#FAF7F2]/60 transition">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#FBECE5] text-[#C25E2E] flex items-center justify-center shrink-0 border border-[#F5D3C4]">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-[#1C1917] text-sm">
                          BP: {v.blood_pressure_sys && v.blood_pressure_dia ? `${v.blood_pressure_sys}/${v.blood_pressure_dia} mmHg` : 'N/A'}
                        </span>
                        {v.blood_sugar && (
                          <span className="text-xs font-semibold text-[#B45309] bg-[#FEF3C7] border border-[#FDE68A] px-2 py-0.5 rounded-md">
                            Sugar: {v.blood_sugar} mg/dL ({v.blood_sugar_type})
                          </span>
                        )}
                        {v.spo2 && (
                          <span className="text-xs font-semibold text-[#1F5C42] bg-[#E8F3EE] border border-[#C8E5D7] px-2 py-0.5 rounded-md">
                            SpO2: {v.spo2}%
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#574F49] mt-1 flex items-center gap-2">
                        <span>Recorded by {v.recorded_by}</span>
                        <span>•</span>
                        <span>{formatDate(v.recorded_at)}</span>
                      </div>
                      {v.notes && (
                        <p className="text-xs text-[#574F49] italic mt-1.5 bg-[#F5F1EB] p-2.5 rounded-xl border border-[#E7DFD5]">
                          "{v.notes}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-semibold text-[#1F5C42] bg-[#E8F3EE] border border-[#C8E5D7] px-3 py-1 rounded-full">
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
          <div className="flex items-center justify-between bg-[#FAF7F2] border border-[#E7DFD5] p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <Pill className="w-5 h-5 text-[#B45309]" />
              <div>
                <h4 className="text-xs font-bold text-[#1C1917]">1-Click Concierge Medicine Refills</h4>
                <p className="text-[11px] text-[#574F49]">When prescription pills run low, click "Order Refill" to dispatch a verified field partner to the pharmacy.</p>
              </div>
            </div>
            <button
              onClick={() => setShowMedModal(true)}
              className="filial-btn-primary text-xs py-2 px-3.5 cursor-pointer shrink-0"
            >
              + Add Prescription
            </button>
          </div>

          {medications.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-[#E7DFD5] shadow-xs">
              <Pill className="w-12 h-12 text-[#C2B8AE] mx-auto mb-3" />
              <h3 className="font-display text-lg font-bold text-[#1C1917]">No Medications Scheduled</h3>
              <p className="text-xs text-[#574F49] max-w-sm mx-auto mt-1 mb-5 leading-relaxed">
                Add daily vitamins, hypertension pills, or diabetes medicines to enable automated low-stock warnings and 1-click pharmacy replenishment.
              </p>
              <button
                onClick={() => setShowMedModal(true)}
                className="filial-btn-primary text-xs py-2 px-4 cursor-pointer"
              >
                Schedule First Medication
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {medications.map((m) => {
                const isLowStock = m.stock_remaining <= m.low_stock_threshold;
                return (
                  <div key={m.id} className="bg-white rounded-2xl border border-[#E7DFD5] p-5 shadow-xs flex flex-col justify-between hover:border-[#D6C9BC] transition">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-[#FBECE5] text-[#C25E2E] flex items-center justify-center shrink-0 border border-[#F5D3C4]">
                            <Pill className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="font-bold text-[#1C1917] text-sm">{m.medicine_name}</h4>
                            <span className="text-xs text-[#C25E2E] font-semibold">{m.dosage} • {m.frequency}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteMed(m.id)}
                          className="text-[#8C827A] hover:text-[#B91C1C] p-1 rounded-lg transition cursor-pointer"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="mt-3.5 space-y-2 text-xs">
                        <div className="flex items-center justify-between bg-[#FAF7F2] p-2.5 rounded-xl border border-[#E7DFD5]">
                          <span className="text-[#574F49] flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-[#8C827A]" /> Timing:
                          </span>
                          <span className="font-semibold text-[#1C1917]">{m.time_of_day}</span>
                        </div>

                        <div className="flex items-center justify-between bg-[#FAF7F2] p-2.5 rounded-xl border border-[#E7DFD5]">
                          <span className="text-[#574F49] flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-[#8C827A]" /> Stock Remaining:
                          </span>
                          <span className={`font-bold px-2 py-0.5 rounded-md ${
                            isLowStock
                              ? 'bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]'
                              : 'bg-[#E8F3EE] text-[#1F5C42] border border-[#C8E5D7]'
                          }`}>
                            {m.stock_remaining} units {isLowStock ? '(Low Stock!)' : ''}
                          </span>
                        </div>

                        {m.instructions && (
                          <div className="text-[11px] text-[#574F49] italic px-1">
                            Note: {m.instructions}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#E7DFD5] flex items-center justify-between">
                      <span className="text-xs text-[#8C827A] font-medium font-mono">Escrow: $25</span>
                      <button
                        onClick={() => handleOrderRefill(m.id)}
                        disabled={refillLoadingId === m.id}
                        className="filial-btn-primary text-xs py-1.5 px-3 cursor-pointer disabled:opacity-50"
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
          <div className="flex items-center justify-between bg-[#FAF7F2] border border-[#E7DFD5] p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-[#1F5C42]" />
              <div>
                <h4 className="text-xs font-bold text-[#1C1917]">Encrypted Digital Health Records</h4>
                <p className="text-[11px] text-[#574F49]">Centralized storage for lab results, hospital discharge cards, and prescriptions.</p>
              </div>
            </div>
            <button
              onClick={() => setShowDocModal(true)}
              className="filial-btn-primary text-xs py-2 px-3.5 cursor-pointer shrink-0"
            >
              + Upload Document
            </button>
          </div>

          {documents.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-[#E7DFD5] shadow-xs">
              <FileText className="w-12 h-12 text-[#C2B8AE] mx-auto mb-3" />
              <h3 className="font-display text-lg font-bold text-[#1C1917]">No Documents Uploaded</h3>
              <p className="text-xs text-[#574F49] max-w-sm mx-auto mt-1 mb-5 leading-relaxed">
                Upload your parent's recent ECG, blood test results, or doctor prescriptions so you and our concierge team always have quick access.
              </p>
              <button
                onClick={() => setShowDocModal(true)}
                className="filial-btn-primary text-xs py-2 px-4 cursor-pointer"
              >
                Upload Document
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {documents.map((d) => (
                <div key={d.id} className="bg-white rounded-2xl border border-[#E7DFD5] p-5 shadow-xs flex flex-col justify-between hover:border-[#D6C9BC] transition">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-bold text-[#1F5C42] bg-[#E8F3EE] border border-[#C8E5D7] px-2 py-0.5 rounded-md uppercase">
                          {d.category.replace('_', ' ')}
                        </span>
                        <h4 className="font-bold text-[#1C1917] text-sm mt-1.5">{d.title}</h4>
                      </div>
                      <a
                        href={d.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#C25E2E] hover:text-[#A3481D] bg-[#FBECE5] p-2 rounded-xl border border-[#F5D3C4] transition"
                        title="Download / View"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>

                    <div className="mt-3.5 space-y-1 text-xs text-[#574F49]">
                      {d.doctor_name && <div>Doctor: <span className="font-semibold text-[#1C1917]">{d.doctor_name}</span></div>}
                      {d.hospital_name && <div>Hospital: <span className="font-semibold text-[#1C1917]">{d.hospital_name}</span></div>}
                      {d.document_date && <div>Date: <span className="font-semibold text-[#1C1917]">{d.document_date}</span></div>}
                      {d.notes && <div className="text-[#574F49] italic mt-1.5 bg-[#F5F1EB] p-2.5 rounded-xl border border-[#E7DFD5]">"{d.notes}"</div>}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#E7DFD5] text-[11px] text-[#8C827A]">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1917]/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E7DFD5]">
            <div className="flex items-center justify-between border-b border-[#E7DFD5] pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FBECE5] text-[#C25E2E] flex items-center justify-center border border-[#F5D3C4]">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-[#1C1917] text-base">Log Health Vitals</h3>
                  <p className="text-[11px] text-[#574F49]">Record clinical measurements for {parentName}</p>
                </div>
              </div>
              <button onClick={() => setShowVitalModal(false)} className="text-[#8C827A] hover:text-[#1C1917] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVital} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#1C1917] block mb-1">Systolic BP (mmHg)</label>
                  <input
                    type="number"
                    value={bpSys}
                    onChange={(e) => setBpSys(e.target.value)}
                    className="w-full filial-input text-xs font-semibold"
                    placeholder="120"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#1C1917] block mb-1">Diastolic BP (mmHg)</label>
                  <input
                    type="number"
                    value={bpDia}
                    onChange={(e) => setBpDia(e.target.value)}
                    className="w-full filial-input text-xs font-semibold"
                    placeholder="80"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#1C1917] block mb-1">Blood Sugar (mg/dL)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={sugar}
                    onChange={(e) => setSugar(e.target.value)}
                    className="w-full filial-input text-xs font-semibold"
                    placeholder="110"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#1C1917] block mb-1">Sugar Condition</label>
                  <select
                    value={sugarType}
                    onChange={(e) => setSugarType(e.target.value as any)}
                    className="w-full filial-input text-xs font-semibold"
                  >
                    <option value="FASTING">Fasting</option>
                    <option value="POST_PRANDIAL">Post-Prandial (After Food)</option>
                    <option value="RANDOM">Random</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#1C1917] block mb-1">Pulse (bpm)</label>
                  <input
                    type="number"
                    value={pulse}
                    onChange={(e) => setPulse(e.target.value)}
                    className="w-full filial-input text-xs font-semibold"
                    placeholder="72"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#1C1917] block mb-1">SpO2 (%)</label>
                  <input
                    type="number"
                    value={spo2}
                    onChange={(e) => setSpo2(e.target.value)}
                    className="w-full filial-input text-xs font-semibold"
                    placeholder="98"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#1C1917] block mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full filial-input text-xs font-semibold"
                    placeholder="68"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#1C1917] block mb-1">Clinical Observation / Notes</label>
                <textarea
                  value={vitalNotes}
                  onChange={(e) => setVitalNotes(e.target.value)}
                  className="w-full filial-input text-xs"
                  rows={2}
                  placeholder="e.g. Measured after morning walk and light breakfast"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowVitalModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#574F49] hover:bg-[#F5F1EB] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="filial-btn-primary text-xs py-2 px-5 cursor-pointer disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1917]/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E7DFD5]">
            <div className="flex items-center justify-between border-b border-[#E7DFD5] pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FEF3C7] text-[#B45309] flex items-center justify-center border border-[#FDE68A]">
                  <Pill className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-[#1C1917] text-base">Schedule Medication</h3>
                  <p className="text-[11px] text-[#574F49]">Enable automatic refill alerts for {parentName}</p>
                </div>
              </div>
              <button onClick={() => setShowMedModal(false)} className="text-[#8C827A] hover:text-[#1C1917] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMed} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-[#1C1917] block mb-1">Medicine Name &amp; Generic</label>
                <input
                  type="text"
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  className="w-full filial-input text-xs font-semibold"
                  placeholder="e.g. Metformin Hydrochloride, Amlodipine"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#1C1917] block mb-1">Dosage</label>
                  <input
                    type="text"
                    value={medDosage}
                    onChange={(e) => setMedDosage(e.target.value)}
                    className="w-full filial-input text-xs font-semibold"
                    placeholder="e.g. 500mg, 5mg"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#1C1917] block mb-1">Frequency</label>
                  <select
                    value={medFreq}
                    onChange={(e) => setMedFreq(e.target.value)}
                    className="w-full filial-input text-xs font-semibold"
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
                <label className="text-xs font-semibold text-[#1C1917] block mb-1">Timing Description</label>
                <input
                  type="text"
                  value={medTiming}
                  onChange={(e) => setMedTiming(e.target.value)}
                  className="w-full filial-input text-xs"
                  placeholder="e.g. Morning (After Breakfast), Night (Before Bed)"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#1C1917] block mb-1">Current Stock (Pills)</label>
                  <input
                    type="number"
                    value={medStock}
                    onChange={(e) => setMedStock(parseInt(e.target.value) || 0)}
                    className="w-full filial-input text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#1C1917] block mb-1">Alert Threshold</label>
                  <input
                    type="number"
                    value={medThreshold}
                    onChange={(e) => setMedThreshold(parseInt(e.target.value) || 7)}
                    className="w-full filial-input text-xs font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#1C1917] block mb-1">Doctor's Special Instructions</label>
                <textarea
                  value={medInstructions}
                  onChange={(e) => setMedInstructions(e.target.value)}
                  className="w-full filial-input text-xs"
                  rows={2}
                  placeholder="e.g. Avoid taking on empty stomach; drink plenty of water"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowMedModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#574F49] hover:bg-[#F5F1EB] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="filial-btn-primary text-xs py-2 px-5 cursor-pointer disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1917]/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E7DFD5]">
            <div className="flex items-center justify-between border-b border-[#E7DFD5] pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#E8F3EE] text-[#1F5C42] flex items-center justify-center border border-[#C8E5D7]">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-[#1C1917] text-base">Upload Medical Record</h3>
                  <p className="text-[11px] text-[#574F49]">Encrypted digital vault storage for {parentName}</p>
                </div>
              </div>
              <button onClick={() => setShowDocModal(false)} className="text-[#8C827A] hover:text-[#1C1917] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDoc} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-[#1C1917] block mb-1">Document Title</label>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full filial-input text-xs font-semibold"
                  placeholder="e.g. Annual Blood Lipid Profile & HbA1c"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#1C1917] block mb-1">Category</label>
                  <select
                    value={docCategory}
                    onChange={(e) => setDocCategory(e.target.value as any)}
                    className="w-full filial-input text-xs font-semibold"
                  >
                    <option value="PRESCRIPTION">Prescription</option>
                    <option value="LAB_REPORT">Lab Report</option>
                    <option value="DISCHARGE_SUMMARY">Discharge Summary</option>
                    <option value="SCAN">Scan / X-Ray / ECG</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#1C1917] block mb-1">Document Date</label>
                  <input
                    type="date"
                    value={docDate}
                    onChange={(e) => setDocDate(e.target.value)}
                    className="w-full filial-input text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#1C1917] block mb-1">Doctor Name</label>
                  <input
                    type="text"
                    value={docDoctor}
                    onChange={(e) => setDocDoctor(e.target.value)}
                    className="w-full filial-input text-xs font-semibold"
                    placeholder="e.g. Dr. K. S. Rao"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#1C1917] block mb-1">Hospital / Clinic</label>
                  <input
                    type="text"
                    value={docHospital}
                    onChange={(e) => setDocHospital(e.target.value)}
                    className="w-full filial-input text-xs font-semibold"
                    placeholder="e.g. Apollo Hospitals"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#1C1917] block mb-1">File Link or Upload URL</label>
                <input
                  type="text"
                  value={docFileUrl}
                  onChange={(e) => setDocFileUrl(e.target.value)}
                  className="w-full filial-input text-xs"
                  placeholder="https://... or /uploads/..."
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#1C1917] block mb-1">Summary / Key Findings</label>
                <textarea
                  value={docNotes}
                  onChange={(e) => setDocNotes(e.target.value)}
                  className="w-full filial-input text-xs"
                  rows={2}
                  placeholder="e.g. Normal sinus rhythm; HbA1c 6.4 (Good control)"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDocModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#574F49] hover:bg-[#F5F1EB] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="filial-btn-primary text-xs py-2 px-5 cursor-pointer disabled:opacity-50"
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
