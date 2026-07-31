import { useState, useEffect } from 'react';
import { citizenApi } from '../../services/api';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

export default function CitizenStatusPage() {
  // Incident Data State
  const [incidentData, setIncidentData] = useState({
    incidentId: 'INC-2026-0894',
    category: 'FLOOD / WATER LOGGING',
    timestamp: '2026-07-29 17:15',
    gps: '12.9716° N, 77.5946° E (±5m)',
    etaMinutes: 8,
    assignedUnit: 'NDRF Battalion 4 (Boat #4)',
    commanderName: 'Captain V. Sharma',
    commanderPhone: '+91 98765 43210',
    responderNotes: 'Stay on upper floor or elevated roof area. NDRF Rescue Boat #4 is approaching your location. Flash light or wave white cloth.',
    currentStage: 3, // 0: Submitted, 1: AI Analysis, 2: Responder Assigned, 3: En Route, 4: Reached, 5: Completed
    aiAnalysis: {
      summary: 'Flash flood warning in Sector 4; 3 residents trapped on upper roof requiring immediate NDRF boat dispatch.',
      disasterCategory: 'FLOOD',
      severity: 'CRITICAL',
      confidenceScore: null,
      recommendedPriority: 'CRITICAL',
      recommendedResponseTeam: 'NDRF Battalion 4 Water Rescue Squad',
      model: 'google/gemma-4-e4b-it',
    },
  });

  const [isPolling, setIsPolling] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString());

  // 6 Milestone Stages Definition
  const STAGES = [
    {
      stageIndex: 0,
      title: 'Emergency Submitted',
      icon: 'emergency',
      description: 'Emergency SOS telemetry packet received by RESONIX AI network.',
      timestamp: '17:15:02',
    },
    {
      stageIndex: 1,
      title: 'AI Analysis',
      icon: 'psychology',
      description: 'Gemma 4 Triage Engine processed speech & GPS. Priority: HIGH (Level 4).',
      timestamp: '17:15:05',
    },
    {
      stageIndex: 2,
      title: 'Responder Assigned',
      icon: 'shield_person',
      description: 'Dispatched to NDRF Battalion 4 Command Unit.',
      timestamp: '17:15:20',
    },
    {
      stageIndex: 3,
      title: 'Rescue Team En Route',
      icon: 'fire_truck',
      description: 'Rescue squad in transit. Live GPS tracking active.',
      timestamp: '17:16:00',
    },
    {
      stageIndex: 4,
      title: 'Reached Location',
      icon: 'where_to_vote',
      description: 'Rescue team arrived at target GPS coordinates.',
      timestamp: 'Pending',
    },
    {
      stageIndex: 5,
      title: 'Mission Completed',
      icon: 'task_alt',
      description: 'Citizens evacuated & safety verification confirmed.',
      timestamp: 'Pending',
    },
  ];

  // 1. Polling Effect (Fetches status updates every 5 seconds)
  useEffect(() => {
    let interval;
    if (isPolling) {
      interval = setInterval(async () => {
        try {
          // Attempting backend poll
          const res = await citizenApi.getIncidentStatus(incidentData.incidentId);
          if (res?.data) {
            setIncidentData((prev) => ({ ...prev, ...res.data }));
          }
        } catch (_) {
          // Silently fall back to current status state
        }
        setLastUpdated(new Date().toLocaleTimeString());
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isPolling, incidentData.incidentId]);

  // 2. Socket.IO Listener Hook Preparation
  useEffect(() => {
    if (typeof window !== 'undefined' && window.__RESONIX_SOCKET__) {
      const socket = window.__RESONIX_SOCKET__;
      const handleStatusUpdate = (data) => {
        console.log('[CitizenStatusPage] Real-time Socket.IO Status Update:', data);
        if (data && data.incidentId === incidentData.incidentId) {
          setIncidentData((prev) => ({ ...prev, ...data }));
        }
      };

      socket.on('incident:status_update', handleStatusUpdate);
      return () => socket.off('incident:status_update', handleStatusUpdate);
    }
  }, [incidentData.incidentId]);

  // Advance Stage Demo Helper for Interactive UI Verification
  const advanceStage = () => {
    setIncidentData((prev) => ({
      ...prev,
      currentStage: (prev.currentStage + 1) % STAGES.length,
      etaMinutes: Math.max(0, prev.etaMinutes - 2),
    }));
  };

  return (
    <div className="w-full py-4 sm:py-6 space-y-4 text-left animate-fade-in pb-4">
      {/* Header & Polling Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/60 pb-3">
        <div>
          <h1 className="text-xl font-extrabold text-primary leading-none">Rescue Status Tracking</h1>
          <p className="text-[10px] text-on-surface-variant mt-1">Live Incident Telemetry & Dispatch Progress</p>
        </div>
        <div className="flex items-center gap-1.5 bg-surface-container px-2.5 py-1 rounded-full border border-outline-variant text-[10px] font-mono shrink-0">
          <span className={`w-2 h-2 rounded-full ${isPolling ? 'bg-success animate-ping' : 'bg-outline'}`} />
          <span className="text-on-surface-variant font-bold">Auto-Sync {lastUpdated}</span>
        </div>
      </div>

      {/* Top Incident Summary Card */}
      <Card className="p-4 border border-outline-variant/60 shadow-md space-y-2.5 bg-gradient-to-r from-surface to-surface-container">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-extrabold text-secondary bg-secondary/10 px-2.5 py-0.5 rounded-md border border-secondary/30">
            {incidentData.incidentId}
          </span>
          <span className="text-[10px] font-mono text-on-surface-variant">{incidentData.timestamp}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs pt-1 min-w-0">
          <div className="min-w-0">
            <span className="text-[10px] text-on-surface-variant font-bold block uppercase">Hazard Category</span>
            <span className="font-extrabold text-primary truncate block">{incidentData.category}</span>
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-on-surface-variant font-bold block uppercase">Target Location</span>
            <span className="font-mono text-primary text-[11px] truncate block">{incidentData.gps}</span>
          </div>
        </div>
      </Card>

      {/* Gemma 4 AI Analysis Summary Banner */}
      {incidentData.aiAnalysis && (
        <Card className="p-3.5 border border-secondary/30 bg-secondary/10 space-y-1.5 shadow-sm min-w-0">
          <div className="flex items-center justify-between text-xs gap-2 min-w-0">
            <div className="flex items-center gap-1.5 text-secondary font-extrabold min-w-0">
              <span className="material-symbols-outlined text-base shrink-0">smart_toy</span>
              <span className="truncate">Gemma 4 AI Incident Analysis</span>
            </div>
            <span className="text-[9px] font-mono font-bold text-secondary bg-secondary/20 px-2 py-0.5 rounded border border-secondary/40 shrink-0">
              Confidence: {typeof incidentData.aiAnalysis.confidenceScore === 'number' ? `${Math.round((incidentData.aiAnalysis.confidenceScore > 1 ? incidentData.aiAnalysis.confidenceScore / 100 : incidentData.aiAnalysis.confidenceScore) * 100)}%` : 'Not Available'}
            </span>
          </div>
          <p className="text-xs text-primary font-medium leading-relaxed break-words">
            "{incidentData.aiAnalysis.summary}"
          </p>
          <div className="pt-1 flex items-center justify-between gap-2 text-[10px] text-on-surface-variant font-mono min-w-0">
            <span className="truncate">Model: {incidentData.aiAnalysis.model || 'google/gemma-4-e4b-it'}</span>
            <span className="truncate">Team: {incidentData.aiAnalysis.recommendedResponseTeam}</span>
          </div>
        </Card>
      )}

      {/* Hero ETA & Assigned Unit Card */}
      <Card className="p-5 border-2 border-error/30 shadow-xl bg-gradient-to-b from-surface to-error/5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-error text-2xl animate-pulse">crisis_alert</span>
            <div>
              <p className="text-[10px] font-mono text-error font-extrabold uppercase">Estimated Rescue Arrival</p>
              <h2 className="text-2xl font-black text-primary leading-none">
                {incidentData.currentStage >= 4 ? 'ARRIVED ON SCENE' : `${incidentData.etaMinutes} Mins`}
              </h2>
            </div>
          </div>
          {incidentData.currentStage < 4 && (
            <span className="text-xs font-mono font-extrabold text-white bg-error px-3 py-1 rounded-full shadow-md animate-pulse">
              EN ROUTE
            </span>
          )}
        </div>

        <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/80 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-extrabold text-primary flex items-center gap-1.5">
              <span className="material-symbols-outlined text-secondary text-base">shield_person</span>
              <span>{incidentData.assignedUnit}</span>
            </span>
            <a
              href={`tel:${incidentData.commanderPhone}`}
              className="text-[10px] font-bold text-secondary bg-secondary/15 hover:bg-secondary/25 px-2.5 py-1 rounded-lg border border-secondary/30 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-xs">call</span>
              <span>Call Squad</span>
            </a>
          </div>
          <p className="text-[10px] text-on-surface-variant">Commander: {incidentData.commanderName}</p>
        </div>
      </Card>

      {/* 6-Stage Vertical Timeline View */}
      <Card className="p-5 border border-outline-variant/60 shadow-lg space-y-4">
        <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider flex items-center justify-between border-b border-outline-variant/60 pb-2">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-secondary text-base">route</span>
            <span>6-Stage Rescue Progress</span>
          </span>
          <button
            onClick={advanceStage}
            className="text-[10px] text-secondary hover:underline cursor-pointer font-mono font-bold"
            title="Simulate next status stage"
          >
            Advance Stage (Demo)
          </button>
        </h3>

        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-outline-variant">
          {STAGES.map((stg) => {
            const isCompleted = stg.stageIndex < incidentData.currentStage;
            const isCurrent = stg.stageIndex === incidentData.currentStage;
            const isPending = stg.stageIndex > incidentData.currentStage;

            return (
              <div key={stg.stageIndex} className="relative text-xs">
                {/* Timeline Circle Bullet */}
                <div
                  className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isCompleted
                      ? 'bg-success text-white ring-4 ring-success/20'
                      : isCurrent
                      ? 'bg-error text-white ring-4 ring-error/30 animate-pulse'
                      : 'bg-surface-container border border-outline text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-xs">
                    {isCompleted ? 'check' : isCurrent ? stg.icon : 'radio_button_unchecked'}
                  </span>
                </div>

                {/* Stage Text Content */}
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <h4
                      className={`font-extrabold text-xs ${
                        isCompleted
                          ? 'text-success'
                          : isCurrent
                          ? 'text-error font-black'
                          : 'text-on-surface-variant'
                      }`}
                    >
                      {stg.title}
                    </h4>
                    <span className="text-[9px] font-mono text-on-surface-variant">{stg.timestamp}</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-tight">{stg.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Responder Dispatch Guidance Notes Card */}
      <Card className="p-4 border border-secondary/30 bg-secondary/5 space-y-2 shadow-sm">
        <div className="flex items-center gap-1.5 text-secondary font-extrabold text-xs">
          <span className="material-symbols-outlined text-base">chat</span>
          <span>Responder Dispatch Notes</span>
        </div>
        <p className="text-xs text-primary leading-relaxed bg-surface-container p-3 rounded-xl border border-outline-variant font-medium">
          "{incidentData.responderNotes}"
        </p>
      </Card>
    </div>
  );
}
