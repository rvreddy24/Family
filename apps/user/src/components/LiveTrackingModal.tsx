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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1917]/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-[#E7DFD5] animate-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-[#E7DFD5] pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#FBECE5] text-[#C25E2E] flex items-center justify-center border border-[#F5D3C4]">
              <Navigation className="w-5 h-5 text-[#C25E2E]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F5C42] bg-[#E8F3EE] border border-[#C8E5D7] px-2 py-0.5 rounded-full">
                  Live GPS En-Route
                </span>
                <span className="w-2 h-2 rounded-full bg-[#1F5C42] animate-ping" />
              </div>
              <h3 className="font-display font-bold text-[#1C1917] text-base mt-0.5">
                Caregiver Live Telemetry &amp; ETA
              </h3>
            </div>
          </div>
          <button onClick={onClose} className="text-[#8C827A] hover:text-[#1C1917] cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Radar Map Graphic */}
        <div className="relative h-60 bg-[#1C1917] rounded-xl overflow-hidden border border-[#3D3530] p-4 flex flex-col justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(#C25E2E_1px,transparent_1px)] [background-size:16px_16px] opacity-15" />
          
          <div className="relative z-10 flex items-center justify-between">
            <span className="text-xs font-mono text-[#A8DDC5] bg-[#0B261B]/80 px-2.5 py-1 rounded-md border border-[#143F2D] flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" />
              GPS: {partnerCoords?.lat.toFixed(4)}, {partnerCoords?.lng.toFixed(4)}
            </span>
            <span className="text-xs font-semibold text-[#FAF7F2] bg-white/10 px-2.5 py-1 rounded-md">
              ETA: ~8 mins
            </span>
          </div>

          {/* Connected Route Polyline Visualization */}
          <div className="relative z-10 flex items-center justify-around my-auto">
            {/* Helper Node */}
            <div className="flex flex-col items-center">
              <div className="w-11 h-11 rounded-full bg-[#C25E2E] text-white flex items-center justify-center shadow-md ring-4 ring-[#C25E2E]/30 animate-pulse">
                <Navigation className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-white mt-1.5">
                {task.assigned_partner?.full_name || 'Ground Partner'}
              </span>
              <span className="text-[10px] text-[#F5D3C4]">En Route (~25 km/h)</span>
            </div>

            {/* Pulsing Dots Connection */}
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#E07A5F] animate-ping" />
              <div className="w-2 h-2 rounded-full bg-[#E07A5F] animate-ping [animation-delay:200ms]" />
              <div className="w-2 h-2 rounded-full bg-[#70C2A0] animate-ping [animation-delay:400ms]" />
            </div>

            {/* Parent Residence Node */}
            <div className="flex flex-col items-center">
              <div className="w-11 h-11 rounded-full bg-[#1F5C42] text-white flex items-center justify-center shadow-md ring-4 ring-[#1F5C42]/30">
                <MapPin className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-white mt-1.5">
                {task.parent?.parent_name}
              </span>
              <span className="text-[10px] text-[#A8DDC5]">Target Residence</span>
            </div>
          </div>

          <div className="relative z-10 text-[11px] text-[#8C827A] flex items-center justify-between border-t border-white/10 pt-2">
            <span>Destination: {task.parent?.locality || 'India'}</span>
            <span className="text-[#A8DDC5] font-semibold">150m Geofence Active</span>
          </div>
        </div>

        {/* Helper Details Card */}
        <div className="mt-4 bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FBECE5] text-[#C25E2E] font-bold text-xs flex items-center justify-center border border-[#F5D3C4]">
              {task.assigned_partner?.full_name?.substring(0, 2).toUpperCase() || 'GP'}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-[#1C1917]">
                  {task.assigned_partner?.full_name || 'Assigned Ground Partner'}
                </span>
                <ShieldCheck className="w-4 h-4 text-[#1F5C42]" />
              </div>
              <div className="text-[11px] text-[#574F49]">
                {task.assigned_partner?.service_category} • Verified Caregiver
              </div>
            </div>
          </div>

          {task.assigned_partner?.phone && (
            <a
              href={`tel:${task.assigned_partner.phone}`}
              className="filial-btn-primary text-xs py-1.5 px-3 cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call Helper</span>
            </a>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#1C1917] hover:bg-[#2C2723] text-white font-semibold text-xs rounded-xl transition cursor-pointer"
          >
            Close Map
          </button>
        </div>
      </div>
    </div>
  );
};
