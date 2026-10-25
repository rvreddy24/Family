import React, { useState } from 'react';
import {
  Siren,
  PhoneCall,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  X,
  ShieldAlert,
  Ambulance,
  HeartPulse,
} from 'lucide-react';
import type { ParentProfile } from '@shared/types';
import { getApiBaseUrl, playNotificationChime } from '@shared/utils';

interface EmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  parents: ParentProfile[];
  clientId: string;
  onEmergencyTriggered?: () => void;
}

export const EmergencyModal: React.FC<EmergencyModalProps> = ({
  isOpen,
  onClose,
  parents,
  clientId,
  onEmergencyTriggered,
}) => {
  const [selectedParentId, setSelectedParentId] = useState<string>(parents[0]?.id || '');
  const [emergencyReason, setEmergencyReason] = useState<string>('Severe health symptoms or cardiac discomfort');
  const [customNotes, setCustomNotes] = useState<string>('');
  const [isActivating, setIsActivating] = useState<boolean>(false);
  const [activeSos, setActiveSos] = useState<any | null>(null);

  if (!isOpen) return null;

  const currentParent = parents.find((p) => p.id === selectedParentId) || parents[0];

  const handleTriggerEmergency = async () => {
    if (!currentParent) return;
    setIsActivating(true);
    try {
      const api = getApiBaseUrl();
      const res = await fetch(`${api}/api/emergency/sos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentId: currentParent.id,
          triggeredByUserId: clientId,
          latitude: currentParent.coordinates_lat,
          longitude: currentParent.coordinates_lng,
          notes: `${emergencyReason}${customNotes ? ` — ${customNotes}` : ''}`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveSos(data);
        playNotificationChime('ping');
        if (onEmergencyTriggered) onEmergencyTriggered();
      }
    } catch (err) {
      console.error('Failed to trigger emergency SOS:', err);
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#111827] rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-red-500/30 dark:border-red-500/40 animate-in zoom-in-95 text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 border border-red-200 dark:border-red-900/60">
              <Siren className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-2.5 py-0.5 rounded-full border border-red-200 dark:border-red-900/60">
                  Priority 1 Escalation
                </span>
              </div>
              <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                Emergency Concierge Dispatch
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1.5 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {activeSos ? (
          /* ACTIVE SOS STATE */
          <div className="space-y-5 text-center py-4">
            <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto border border-red-200 dark:border-red-900/60">
              <ShieldAlert className="w-7 h-7" />
            </div>

            <div>
              <h4 className="font-display text-lg font-bold text-red-600 dark:text-red-400">
                Emergency SOS Broadcasted to Operations
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
                Our 24/7 Chief Concierge team has received the emergency signal and is dispatching the nearest ambulance and verified field responder to your parents' address.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-[#1E293B]/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-left text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Parent:</span>
                <span className="font-bold text-slate-900 dark:text-white">{currentParent?.parent_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Address:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-200 truncate max-w-[220px]">{currentParent?.full_address}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Ambulance Tie-in:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-md">Automated Call Alert Sent</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Direct Line:</span>
                <a
                  href={`tel:${currentParent?.primary_phone}`}
                  className="font-bold text-blue-600 dark:text-blue-400 underline flex items-center gap-1"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  {currentParent?.primary_phone}
                </a>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold text-xs py-3 rounded-xl transition cursor-pointer"
            >
              Close &amp; Monitor from Trackers
            </button>
          </div>
        ) : (
          /* TRIGGER FORM */
          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 p-3.5 rounded-xl text-xs flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">What happens when you trigger SOS:</span>
                <ul className="list-disc list-inside mt-1 text-[11px] text-amber-700 dark:text-amber-300/80 space-y-0.5">
                  <li>Operations Admin console alerts central triage immediately.</li>
                  <li>Nearest verified field partner receives urgent priority dispatch.</li>
                  <li>Local ambulance and emergency clinic contacts are contacted.</li>
                </ul>
              </div>
            </div>

            {/* Parent selector if multiple parents */}
            {parents.length > 1 && (
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Select Parent</label>
                <select
                  value={selectedParentId}
                  onChange={(e) => setSelectedParentId(e.target.value)}
                  className="w-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {parents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.parent_name} — {p.locality}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {currentParent && (
              <div className="bg-slate-50 dark:bg-[#1E293B]/60 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                <div className="text-slate-400 text-[11px]">Dispatch Location:</div>
                <div className="font-bold text-slate-900 dark:text-white">{currentParent.parent_name}</div>
                <div className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5 text-[11px]">
                  <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  {currentParent.full_address}
                </div>
              </div>
            )}

            {/* Reason selector */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Emergency Nature</label>
              <select
                value={emergencyReason}
                onChange={(e) => setEmergencyReason(e.target.value)}
                className="w-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Severe health symptoms or cardiac discomfort">Cardiac / Chest Pain / Shortness of Breath</option>
                <option value="Accidental fall or physical trauma at residence">Accidental Fall / Unconscious / Trauma</option>
                <option value="Severe high blood pressure or uncontrolled sugar spike">Severe Blood Pressure / Diabetic Crisis</option>
                <option value="Unreachable on phone for over 4 hours - Welfare Check">Parents Not Answering Phone (Welfare Check)</option>
                <option value="Home security or utility hazard">Home Electrical / Fire / Gas Leak Hazard</option>
              </select>
            </div>

            {/* Extra notes */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Additional Details for Responders</label>
              <textarea
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                className="w-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="e.g. Neighbor has extra gate key; mother has pacemaker"
              />
            </div>

            {/* Submit */}
            <div className="pt-2">
              <button
                onClick={handleTriggerEmergency}
                disabled={isActivating || !currentParent}
                className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-sm py-3 rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Siren className="w-4 h-4" />
                <span>{isActivating ? 'DISPATCHING EMERGENCY UNITS...' : 'TRIGGER EMERGENCY SOS DISPATCH'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
