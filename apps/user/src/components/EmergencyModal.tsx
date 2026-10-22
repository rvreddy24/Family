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
  HeartPulse
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentParent = parents.find((p) => p.id === selectedParentId) || parents[0];

  const handleTriggerEmergency = async () => {
    if (!currentParent) return;
    setIsActivating(true);
    setErrorMsg(null);
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
        setErrorMsg(null);
        playNotificationChime('ping');
        if (onEmergencyTriggered) onEmergencyTriggered();
      } else {
        const errData = await res.json().catch(() => ({}));
        setErrorMsg(errData.error || 'Emergency dispatch rejected. Please contact local ambulance 108 / 112 directly.');
      }
    } catch (err) {
      console.error('Failed to trigger emergency SOS:', err);
      setErrorMsg('Network error: Unable to connect to operations desk. Dial 108 / 112 immediately.');
    } finally {
      setIsActivating(false);
    }
  };

  const handleClose = () => {
    setActiveSos(null);
    setErrorMsg(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border-2 border-rose-500 animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rose-100 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-rose-600/30 animate-pulse">
              <Siren className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full">
                  Priority 1 Escalation
                </span>
              </div>
              <h3 className="text-xl font-black text-slate-900 mt-1">
                Emergency SOS Dispatch
              </h3>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {activeSos ? (
          /* ACTIVE SOS STATE */
          <div className="space-y-5 text-center py-4">
            <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto animate-bounce">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div>
              <h4 className="text-lg font-black text-rose-600">
                🚨 EMERGENCY SOS BROADCASTED TO OPERATIONS
              </h4>
              <p className="text-xs text-slate-600 mt-2 max-w-md mx-auto">
                Our 24/7 Chief Concierge team has received the emergency signal and is dispatching the nearest ambulance and field responder to your parents' address.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Parent:</span>
                <span className="font-bold text-slate-900">{currentParent?.parent_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Address:</span>
                <span className="font-semibold text-slate-800 truncate max-w-[220px]">{currentParent?.full_address}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Ambulance Tie-in:</span>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">Automated Call Alert Sent</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Calling Parent:</span>
                <a
                  href={`tel:${currentParent?.primary_phone}`}
                  className="font-bold text-indigo-600 underline flex items-center gap-1"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  {currentParent?.primary_phone}
                </a>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-3 rounded-xl transition"
            >
              Close & Monitor from Trackers
            </button>
          </div>
        ) : (
          /* TRIGGER FORM */
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3.5 rounded-2xl text-xs flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">What happens when you trigger SOS:</span>
                <ul className="list-disc list-inside mt-1 text-[11px] text-amber-800 space-y-0.5">
                  <li>Operations Admin siren alarm sounds immediately.</li>
                  <li>Nearest available ground partner receives an urgent audio page.</li>
                  <li>Ambulance and local ER are placed on high standby.</li>
                </ul>
              </div>
            </div>

            {/* Parent selector if multiple parents */}
            {parents.length > 1 && (
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Select Parent</label>
                <select
                  value={selectedParentId}
                  onChange={(e) => setSelectedParentId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900"
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
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 text-xs space-y-1">
                <div className="text-slate-500">Dispatch Location:</div>
                <div className="font-bold text-slate-900">{currentParent.parent_name}</div>
                <div className="text-slate-600 flex items-center gap-1.5 text-[11px]">
                  <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  {currentParent.full_address}
                </div>
              </div>
            )}

            {/* Reason selector */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Emergency Nature</label>
              <select
                value={emergencyReason}
                onChange={(e) => setEmergencyReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900"
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
              <label className="text-xs font-bold text-slate-700 block mb-1">Additional Details for Responders</label>
              <textarea
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs"
                rows={2}
                placeholder="e.g. Neighbor has extra gate key; mother has pacemaker"
              />
            </div>

            {/* Submit */}
            <div className="pt-2">
              <button
                onClick={handleTriggerEmergency}
                disabled={isActivating || !currentParent}
                className="w-full bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 disabled:opacity-50 text-white font-black text-sm py-3.5 rounded-2xl shadow-xl shadow-rose-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Siren className="w-5 h-5 animate-pulse" />
                {isActivating ? 'DISPATCHING EMERGENCY UNITS...' : 'TRIGGER EMERGENCY SOS DISPATCH'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
