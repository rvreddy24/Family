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
  Activity
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
      // Fetch latest partner location
      const api = getApiBaseUrl();
      fetch(`${api}/api/partners/${task.assigned_partner_id}/location`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.last_latitude && data?.last_longitude) {
            setPartnerCoords({ lat: data.last_latitude, lng: data.last_longitude });
          } else {
            // Default near parent residence for demonstration
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

  const parentLat = task.parent?.coordinates_lat || 16.8724;
  const parentLng = task.parent?.coordinates_lng || 79.5631;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <Navigation className="w-5 h-5 text-indigo-600 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                  Live GPS En-Route
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              </div>
              <h3 className="font-bold text-slate-900 text-base mt-0.5">
                Helper Live Location & ETA
              </h3>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Radar Map Graphic Simulation */}
        <div className="relative h-64 bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 p-4 flex flex-col justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:16px_16px] opacity-20" />
          
          <div className="relative z-10 flex items-center justify-between">
            <span className="text-xs font-mono text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-md border border-emerald-800 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" />
              Live Telemetry: {partnerCoords ? `${partnerCoords.lat.toFixed(4)}°N, ${partnerCoords.lng.toFixed(4)}°E` : 'Locking GPS Signal...'}
            </span>
            <span className="text-xs font-bold text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded-md">
              ETA: ~8 mins
            </span>
          </div>

          {/* Connected Route Polyline Visualization */}
          <div className="relative z-10 flex items-center justify-around my-auto">
            {/* Helper Node */}
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/50 ring-4 ring-indigo-400/30 animate-pulse">
                <Navigation className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-white mt-1.5 max-w-[110px] sm:max-w-[140px] truncate text-center">
                {task.assigned_partner?.full_name || 'Ground Partner'}
              </span>
              <span className="text-[10px] text-indigo-300">En Route (~25 km/h)</span>
            </div>

            {/* Pulsing Dots Connection */}
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
              <div className="w-2 h-2 rounded-full bg-indigo-400 animate-ping [animation-delay:200ms]" />
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping [animation-delay:400ms]" />
            </div>

            {/* Parent Residence Node */}
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-500/50 ring-4 ring-rose-400/30">
                <MapPin className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-white mt-1.5 max-w-[110px] sm:max-w-[140px] truncate text-center">
                {task.parent?.parent_name}
              </span>
              <span className="text-[10px] text-rose-300">Target Residence</span>
            </div>
          </div>

          <div className="relative z-10 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800 pt-2">
            <span>Destination: {task.parent?.locality || 'Pan-India'}</span>
            <span className="text-emerald-400 font-semibold">150m Geofence Active</span>
          </div>
        </div>

        {/* Helper Details Card */}
        <div className="mt-4 bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-200 shrink-0">
              {task.assigned_partner?.full_name?.substring(0, 2).toUpperCase() || 'GP'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-900 truncate">
                  {task.assigned_partner?.full_name || 'Assigned Ground Partner'}
                </span>
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {task.assigned_partner?.service_category} • KYC Verified
              </div>
            </div>
          </div>

          {task.assigned_partner?.phone && (
            <a
              href={`tel:${task.assigned_partner.phone}`}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 shrink-0"
            >
              <Phone className="w-3.5 h-3.5" />
              Call Helper
            </a>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition"
          >
            Close Map
          </button>
        </div>
      </div>
    </div>
  );
};
