import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Mail,
  ShieldCheck,
  CheckCircle2,
  X,
  Sparkles,
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
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#111827] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 text-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-900/60">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-slate-900 dark:text-white text-base">Shared Family Care &amp; Siblings</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Collaborate with brothers, sisters &amp; family living abroad</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {toast && (
          <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{toast}</span>
          </div>
        )}

        <div className="bg-slate-50 dark:bg-[#1E293B]/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 mb-4 text-xs text-slate-800 dark:text-slate-200">
          <div className="font-bold flex items-center gap-1.5 mb-1 text-blue-600 dark:text-blue-400">
            <Sparkles className="w-4 h-4" />
            <span>Shared Care Benefits</span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
            Invited siblings can view live task check-ins, receive WhatsApp arrival alerts, track parent blood pressure &amp; sugar vitals, and coordinate care together.
          </p>
        </div>

        {/* Invite Form */}
        <form onSubmit={handleInvite} className="space-y-3 bg-slate-50 dark:bg-[#1E293B]/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 mb-5">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Invite Family Member</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">Full Name</label>
              <input
                type="text"
                value={invitedName}
                onChange={(e) => setInvitedName(e.target.value)}
                className="w-full bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Priya Reddy"
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">Email Address</label>
              <input
                type="email"
                value={invitedEmail}
                onChange={(e) => setInvitedEmail(e.target.value)}
                className="w-full bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="priya@example.com"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">Relationship</label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="w-full bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2 px-3 rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Sending...' : 'Send Access Invite'}
              </button>
            </div>
          </div>
        </form>

        {/* Members List */}
        <div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-2">Connected Family Members ({members.length})</h4>
          {members.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No additional family members invited yet.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#1E293B]/60 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold text-[11px] flex items-center justify-center border border-blue-200 dark:border-blue-900/60">
                      {m.invited_name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{m.invited_name}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{m.invited_email} • {m.relationship}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60">
                    Active Caregiver
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold text-xs rounded-xl transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
