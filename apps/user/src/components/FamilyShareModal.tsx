import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Mail,
  ShieldCheck,
  CheckCircle2,
  X,
  Sparkles
} from 'lucide-react';
import type { FamilyMember } from '@shared/types';
import { getApiBaseUrl, formatDate, playNotificationChime } from '@shared/utils';

interface FamilyShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
}

export const FamilyShareModal: React.FC<FamilyShareModalProps> = ({
  isOpen,
  onClose,
  clientId,
}) => {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [invitedName, setInvitedName] = useState<string>('');
  const [invitedEmail, setInvitedEmail] = useState<string>('');
  const [relationship, setRelationship] = useState<string>('SIBLING');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchMembers = async () => {
    if (!clientId) return;
    try {
      const api = getApiBaseUrl();
      const res = await fetch(`${api}/api/clients/${clientId}/family`);
      if (res.ok) setMembers(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isOpen) fetchMembers();
  }, [isOpen, clientId]);

  if (!isOpen) return null;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitedName || !invitedEmail) return;
    setIsSubmitting(true);
    try {
      const api = getApiBaseUrl();
      const res = await fetch(`${api}/api/clients/${clientId}/family`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitedName: invitedName.trim(),
          invitedEmail: invitedEmail.trim(),
          relationship,
        }),
      });

      if (res.ok) {
        setInvitedName('');
        setInvitedEmail('');
        fetchMembers();
        playNotificationChime('success');
        setToast('Invitation sent! Sibling linked to family account.');
        setTimeout(() => setToast(null), 4000);
      } else {
        const err = await res.json().catch(() => ({}));
        setToast(err.error || 'Failed to send invite.');
        setTimeout(() => setToast(null), 4000);
      }
    } catch (err) {
      console.error(err);
      setToast('Network error sending invite.');
      setTimeout(() => setToast(null), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Shared Family Care & Siblings</h3>
              <p className="text-[11px] text-slate-500">Collaborate with brothers, sisters & family living abroad</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {toast && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toast}</span>
          </div>
        )}

        <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 mb-5 text-xs text-indigo-900">
          <div className="font-bold flex items-center gap-1.5 mb-1">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            Shared Care Benefits
          </div>
          <p className="text-[11px] text-indigo-700">
            Invited siblings can view live task check-ins, receive WhatsApp arrival alerts, track parent blood pressure & sugar vitals, and coordinate care together.
          </p>
        </div>

        {/* Invite Form */}
        <form onSubmit={handleInvite} className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-5">
          <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-indigo-600" />
            Invite Family Member
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Full Name</label>
              <input
                type="text"
                value={invitedName}
                onChange={(e) => setInvitedName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
                placeholder="e.g. Priya Reddy"
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Email Address</label>
              <input
                type="email"
                value={invitedEmail}
                onChange={(e) => setInvitedEmail(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
                placeholder="priya@example.com"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Relationship</label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
              >
                <option value="SIBLING">Sister / Brother (Sibling)</option>
                <option value="SPOUSE">Spouse / Partner</option>
                <option value="COUSIN">Cousin</option>
                <option value="GUARDIAN">Local Co-Guardian</option>
              </select>
            </div>
            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-xl shadow-xs transition cursor-pointer"
              >
                {isSubmitting ? 'Sending...' : 'Send Access Invite'}
              </button>
            </div>
          </div>
        </form>

        {/* Members List */}
        <div>
          <h4 className="text-xs font-bold text-slate-800 mb-2">Connected Family Members ({members.length})</h4>
          {members.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No additional family members invited yet.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50 text-xs gap-2">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[11px] flex items-center justify-center shrink-0">
                      {m.invited_name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900 truncate">{m.invited_name}</div>
                      <div className="text-[11px] text-slate-500 truncate">{m.invited_email} • {m.relationship}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100 shrink-0">
                    Active Caregiver
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
