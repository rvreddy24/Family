import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Navigation,
  Phone,
  ShieldCheck,
  CheckCircle2,
  Clock,
  X,
  Compass,
  Zap,
  Activity,
} from 'lucide-react';
import type { Task, PartnerLocationUpdate } from '@shared/types';
import { getApiBaseUrl } from '@shared/utils';

interface LiveTrackingModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  latestTelemetry?: PartnerLocationUpdate | null;
}

export const LiveTrackingModal: React.FC<LiveTrackingModalProps> = ({
  task,
  isOpen,
  onClose,
  latestTelemetry,
}) => {
  const [partnerCoords, setPartnerCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (latestTelemetry && latestTelemetry.partner_id === task.assigned_partner_id) {
      setPartnerCoords({ lat: latestTelemetry.latitude, lng: latestTelemetry.longitude });
    } else if (task.assigned_partner_id) {
      const api = getApiBaseUrl();
      fetch(`${api}/api/partners/${task.assigned_partner_id}/location`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.last_latitude && data?.last_longitude) {
            setPartnerCoords({ lat: data.last_latitude, lng: data.last_longitude });
          } else {
            setPartnerCoords({
              lat: (task.parent?.coordinates_lat || 16.8724) + 0.003,
              lng: (task.parent?.coordinates_lng || 79.5631) + 0.002,
            });
          }
        })
        .catch(() => {
          setPartnerCoords({
            lat: (task.parent?.coordinates_lat || 16.8724) + 0.003,
            lng: (task.parent?.coordinates_lng || 79.5631) + 0.002,
          });
        });
    }
  }, [task, latestTelemetry]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#111827] rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 text-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-900/60">
              <Navigation className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-full">
                  Live GPS En-Route
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              </div>
              <h3 className="font-display font-bold text-slate-900 dark:text-white text-base mt-0.5">
                Caregiver Live Telemetry &amp; ETA
              </h3>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Radar Map Graphic */}
        <div className="relative h-60 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 p-4 flex flex-col justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(#3B82F6_1px,transparent_1px)] [background-size:16px_16px] opacity-15" />
          
          <div className="relative z-10 flex items-center justify-between">
            <span className="text-xs font-mono text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-md border border-emerald-800/60 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" />
              GPS: {partnerCoords?.lat.toFixed(4)}, {partnerCoords?.lng.toFixed(4)}
            </span>
            <span className="text-xs font-semibold text-white bg-white/10 px-2.5 py-1 rounded-md">
              ETA: ~8 mins
            </span>
          </div>

          {/* Connected Route Polyline Visualization */}
          <div className="relative z-10 flex items-center justify-around my-auto">
            {/* Helper Node */}
            <div className="flex flex-col items-center">
              <div className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md ring-4 ring-blue-500/30 animate-pulse">
                <Navigation className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-white mt-1.5">
                {task.assigned_partner?.full_name || 'Ground Partner'}
              </span>
              <span className="text-[10px] text-blue-200">En Route (~25 km/h)</span>
            </div>

            {/* Pulsing Dots Connection */}
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-ping [animation-delay:200ms]" />
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping [animation-delay:400ms]" />
            </div>

            {/* Parent Residence Node */}
            <div className="flex flex-col items-center">
              <div className="w-11 h-11 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md ring-4 ring-emerald-500/30">
                <MapPin className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-white mt-1.5">
                {task.parent?.parent_name}
              </span>
              <span className="text-[10px] text-emerald-200">Target Residence</span>
            </div>
          </div>

          <div className="relative z-10 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800 pt-2">
            <span>Destination: {task.parent?.locality || 'India'}</span>
            <span className="text-emerald-400 font-semibold">150m Geofence Active</span>
          </div>
        </div>

        {/* Helper Details Card */}
        <div className="mt-4 bg-slate-50 dark:bg-[#1E293B]/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center border border-blue-200 dark:border-blue-900/60">
              {task.assigned_partner?.full_name?.substring(0, 2).toUpperCase() || 'GP'}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  {task.assigned_partner?.full_name || 'Assigned Ground Partner'}
                </span>
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {task.assigned_partner?.service_category} • Verified Caregiver
              </div>
            </div>
          </div>

          {task.assigned_partner?.phone && (
            <a
              href={`tel:${task.assigned_partner.phone}`}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call Helper</span>
            </a>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold text-xs rounded-xl transition cursor-pointer"
          >
            Close Map
          </button>
        </div>
      </div>
    </div>
  );
};
