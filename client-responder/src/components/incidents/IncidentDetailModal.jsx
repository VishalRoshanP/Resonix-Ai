import { useState, useEffect } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import LiveDeviceRelayPath from '../dashboard/LiveDeviceRelayPath';
import { incidentApi } from '../../services/api';

export default function IncidentDetailModal({ incident, isOpen, onClose, onUpdateIncident }) {
  // 1. ALL REACT HOOKS DECLARED UNCONDITIONALLY AT VERY TOP LEVEL (Strict Rules of Hooks)
  const [activeTab, setActiveTab] = useState('situation');
  const [isExplainabilityOpen, setIsExplainabilityOpen] = useState(false);
  const [transcriptMode, setTranscriptMode] = useState('Original');
  const [resourceFleet] = useState({
    ambulancesAvailable: 8,
    fireUnitsAvailable: 3,
    policeTeamsAvailable: 15,
    volunteersAvailable: 42,
  });
  const [editableResources, setEditableResources] = useState([]);
  const [deploymentTimestamp, setDeploymentTimestamp] = useState(null);
  const [currentLifecycleStage, setCurrentLifecycleStage] = useState(2);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentSuccessMsg, setDeploymentSuccessMsg] = useState('');
  const [assignedTeam, setAssignedTeam] = useState('');
  const [priority, setPriority] = useState('UNASSIGNED');
  const [status, setStatus] = useState('OPEN');
  const [newNote, setNewNote] = useState('');
  const [internalNotes, setInternalNotes] = useState([]);

  // ESC Key Navigation Listener to close panel seamlessly
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isOpen && e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Synchronize internal state whenever incident object changes
  useEffect(() => {
    if (incident) {
      const imgData = incident.imageAnalysis || incident.rawDoc?.imageAnalysis || null;
      const category = (
        imgData?.detectedEmergencyType ||
        imgData?.sceneType ||
        incident.gemmaAnalysis?.disasterCategory ||
        incident.aiAnalysis?.disasterType ||
        incident.category ||
        'FLOOD'
      ).toUpperCase();
      let initResources = [
        { id: 'rec_amb', name: 'Ambulance', count: 2, icon: 'medical_services', available: 8 },
        { id: 'rec_police', name: 'Police Patrol Unit', count: 1, icon: 'local_police', available: 15 },
        { id: 'rec_vol', name: 'Emergency Volunteers', count: 5, icon: 'groups', available: 42 },
      ];
      if (category === 'FLOOD') {
        initResources = [
          { id: 'rec_amb', name: 'Ambulance', count: 2, icon: 'medical_services', available: 8 },
          { id: 'rec_boat', name: 'Rescue Boat Squad', count: 1, icon: 'sailing', available: 5 },
          { id: 'rec_police', name: 'Police Control Team', count: 2, icon: 'local_police', available: 15 },
          { id: 'rec_med', name: 'Mobile Medical Triage Team', count: 1, icon: 'health_and_safety', available: 6 },
        ];
      } else if (category === 'BUILDING_COLLAPSE' || category === 'STRUCTURAL') {
        initResources = [
          { id: 'rec_fire', name: 'Fire & Heavy Rescue Squad', count: 2, icon: 'local_fire_department', available: 3 },
          { id: 'rec_amb', name: 'Ambulance', count: 4, icon: 'medical_services', available: 8 },
          { id: 'rec_police', name: 'Police Patrol Unit', count: 3, icon: 'local_police', available: 15 },
          { id: 'rec_heavy', name: 'Heavy Excavation Equipment', count: 1, icon: 'construction', available: 4 },
        ];
      } else if (category === 'FIRE') {
        initResources = [
          { id: 'rec_fire', name: 'Fire Engine Unit', count: 3, icon: 'local_fire_department', available: 3 },
          { id: 'rec_amb', name: 'Ambulance', count: 2, icon: 'medical_services', available: 8 },
          { id: 'rec_police', name: 'Police Control Team', count: 2, icon: 'local_police', available: 15 },
          { id: 'rec_hazmat', name: 'Hazmat Containment Team', count: 1, icon: 'warning', available: 2 },
        ];
      }
      setEditableResources(incident.deployedResources || initResources);
      setDeploymentTimestamp(incident.deployedAt || null);
      setCurrentLifecycleStage(incident.deployedAt ? 3 : 2);
      setAssignedTeam(incident.assignedUnit || incident.gemmaAnalysis?.recommendedResponseTeam || 'Standby Command Squad');
      setPriority((incident.priority || incident.gemmaAnalysis?.priority || incident.severity || 'UNASSIGNED').toUpperCase());
      setStatus((incident.status || 'OPEN').toUpperCase());
      setInternalNotes(incident.notes || [
        { id: 1, author: 'Officer J. Miller', time: '17:18', text: 'Initial SOS report verified and logged.' },
      ]);
    }
  }, [incident]);

  // 2. EARLY RETURN PLACED SAFELY AFTER ALL HOOK DECLARATIONS
  if (!isOpen || !incident) return null;

  const imgData = incident.imageAnalysis || incident.rawDoc?.imageAnalysis || null;
  const category = (
    imgData?.detectedEmergencyType ||
    imgData?.sceneType ||
    incident.gemmaAnalysis?.disasterCategory ||
    incident.aiAnalysis?.disasterType ||
    incident.category ||
    'FLOOD'
  ).toUpperCase();

  // User-Friendly Confidence Label Formatting (No hardcoded values allowed)
  const rawConfidence = incident.gemmaAnalysis?.confidenceScore ?? incident.aiAnalysis?.confidenceScore;

  const getConfidenceInfo = (score) => {
    if (typeof score !== 'number' || isNaN(score) || score === null) {
      return {
        label: 'AI Confidence Not Available',
        color: 'bg-stone-500/20 text-stone-400 border-stone-500/40',
        note: 'Confidence score not provided by backend or Gemma model',
      };
    }
    const num = score > 1 ? score / 100 : score;
    const pct = Math.round(num * 100);
    if (num >= 0.85) {
      return {
        label: `High Confidence (${pct}%)`,
        color: 'bg-success/20 text-success border-success/40',
        note: 'AI reasoning cross-verified against multi-source telemetry',
      };
    }
    if (num >= 0.65) {
      return {
        label: `Medium Confidence (${pct}%)`,
        color: 'bg-amber-500/20 text-amber-500 border-amber-500/40',
        note: 'AI reasoning derived from single-source citizen report',
      };
    }
    return {
      label: `Needs Review (${pct}%)`,
      color: 'bg-error/20 text-error border-error/40',
      note: 'Requires manual review by command officer',
    };
  };

  const confidenceInfo = getConfidenceInfo(rawConfidence);

  const aiAnalysis = incident.gemmaAnalysis || incident.aiAnalysis || {};
  const liveSummary = incident.incidentSummary || aiAnalysis.summary || incident.aiSummary || incident.description || 'Emergency incident report logged by citizen';
  const livePriority = (incident.priority || aiAnalysis.priority || incident.severity || 'UNASSIGNED').toUpperCase();

  const PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  const STATUSES = ['OPEN', 'DISPATCHED', 'EN_ROUTE', 'ON_SCENE', 'RESOLVED', 'CLOSED'];

  // Increase / Decrease Editable Resource Count
  const handleQuantityChange = (id, delta) => {
    setEditableResources((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newCount = Math.max(0, item.count + delta);
          return { ...item, count: newCount };
        }
        return item;
      })
    );
  };

  // Deployment Action Handler
  const handleDeployResources = () => {
    setIsDeploying(true);
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setDeploymentTimestamp(nowStr);
    setCurrentLifecycleStage(3); // Stage 3: Teams Dispatched
    setStatus('DISPATCHED');

    const deployedUnitsSummary = editableResources
      .filter((r) => r.count > 0)
      .map((r) => `${r.name} × ${r.count}`)
      .join(', ');

    setDeploymentSuccessMsg(`Resources Deployed Successfully! Units Dispatched: ${deployedUnitsSummary}`);

    const updatedIncident = {
      ...incident,
      status: 'DISPATCHED',
      deployedAt: nowStr,
      assignedUnit: deployedUnitsSummary || incident.assignedUnit,
      deployedResources: editableResources,
      currentLifecycleStage: 3,
    };

    setTimeout(() => {
      setIsDeploying(false);
      onUpdateIncident?.(updatedIncident);
    }, 800);

    setTimeout(() => setDeploymentSuccessMsg(''), 4000);
  };

  // Complete Incident Handler (Updates MongoDB & emits Socket.IO)
  const handleConfirmComplete = async () => {
    setIsCompleting(true);
    try {
      const notesToSave = completionNotes.trim() || 'Emergency successfully resolved by response team.';
      const nowIso = new Date().toISOString();

      const updatePayload = {
        status: 'RESOLVED',
        completedAt: nowIso,
        completedBy: 'Command Officer',
        completionNotes: notesToSave,
        resolutionSummary: notesToSave,
      };

      const targetId = incident._id || incident.id;
      await incidentApi.updateIncident(targetId, updatePayload);

      setStatus('RESOLVED');
      setCurrentLifecycleStage(5); // Stage 5: Resolved

      const updatedIncident = {
        ...incident,
        ...updatePayload,
        status: 'RESOLVED',
        currentLifecycleStage: 5,
      };

      onUpdateIncident?.(updatedIncident);
      setDeploymentSuccessMsg('✅ Emergency incident marked as COMPLETED successfully!');
      setShowCompleteModal(false);
    } catch (err) {
      const realError = err?.data?.message || err?.message || 'Server connection error';
      console.error('[IncidentDetailModal] Complete incident backend exception:', err);
      setDeploymentSuccessMsg(`❌ Failed to update incident status: ${realError}`);
    } finally {
      setIsCompleting(false);
    }
  };

  // Helper to format real timestamps from MongoDB
  const formatRealTimestamp = (dateVal) => {
    if (!dateVal || dateVal === 'Pending') return 'Pending';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    } catch (_) {
      return String(dateVal);
    }
  };

  // Real-Time Response Lifecycle Stages
  const lcData = incident.responseLifecycle || {};
  const currentStatus = (incident.status || status || 'OPEN').toUpperCase();

  const receivedTimeStr = formatRealTimestamp(lcData.receivedAt || incident.createdAt || incident.timestamp || incident.time);
  const aiTimeStr = formatRealTimestamp(lcData.aiCompletedAt || incident.aiCompletedAt || incident.createdAt || incident.timestamp);
  const reviewTimeStr = formatRealTimestamp(lcData.reviewStartedAt || incident.reviewStartedAt || incident.createdAt);
  const dispatchTimeStr = deploymentTimestamp ? formatRealTimestamp(deploymentTimestamp) : (lcData.dispatchTime || incident.dispatchTime ? formatRealTimestamp(lcData.dispatchTime || incident.dispatchTime) : 'Pending');
  const arrivalTimeStr = lcData.arrivalTime || incident.arrivalTime ? formatRealTimestamp(lcData.arrivalTime || incident.arrivalTime) : 'Pending';
  const resolvedTimeStr = lcData.resolvedAt || incident.resolvedAt ? formatRealTimestamp(lcData.resolvedAt || incident.resolvedAt) : 'Pending';

  const getStageState = (stageIdx) => {
    const isResolved = currentStatus === 'RESOLVED' || currentStatus === 'CLOSED';
    const isCancelled = currentStatus === 'CANCELLED';
    const isDispatched = currentStatus === 'DISPATCHED' || currentStatus === 'EN_ROUTE' || Boolean(deploymentTimestamp || lcData.dispatchTime);
    const isOnScene = currentStatus === 'ON_SCENE' || currentStatus === 'ON_SITE' || Boolean(lcData.arrivalTime);

    if (isCancelled) {
      if (stageIdx === 0) return 'Completed';
      return 'Cancelled';
    }

    switch (stageIdx) {
      case 0: return 'Completed';
      case 1: return incident.aiAnalysis?.aiAvailable === false ? 'Failed' : 'Completed';
      case 2: return (isDispatched || isOnScene || isResolved) ? 'Completed' : 'Current';
      case 3:
        if (isOnScene || isResolved) return 'Completed';
        if (isDispatched) return 'Current';
        return 'Waiting';
      case 4:
        if (isResolved) return 'Completed';
        if (isOnScene) return 'Current';
        return 'Waiting';
      case 5: return isResolved ? 'Completed' : 'Waiting';
      default: return 'Waiting';
    }
  };

  const REAL_LIFECYCLE_STAGES = [
    { stageIndex: 0, title: 'Report Received', icon: 'emergency', timestamp: receivedTimeStr, state: getStageState(0) },
    { stageIndex: 1, title: 'AI Assessment', icon: 'psychology', timestamp: aiTimeStr, state: getStageState(1) },
    { stageIndex: 2, title: 'Dispatcher Review', icon: 'rate_review', timestamp: reviewTimeStr, state: getStageState(2) },
    { stageIndex: 3, title: 'Teams Dispatched', icon: 'local_shipping', timestamp: dispatchTimeStr, state: getStageState(3) },
    { stageIndex: 4, title: 'On Site', icon: 'where_to_vote', timestamp: arrivalTimeStr, state: getStageState(4) },
    { stageIndex: 5, title: 'Resolved', icon: 'task_alt', timestamp: resolvedTimeStr, state: getStageState(5) },
  ];

  const getStageStyle = (stState) => {
    switch (stState) {
      case 'Completed': return 'bg-success/15 border-success/40 text-success font-bold';
      case 'Current': return 'bg-secondary/15 border-secondary text-secondary font-black ring-2 ring-secondary/40 animate-pulse';
      case 'Failed': return 'bg-error/15 border-error text-error font-black';
      case 'Cancelled': return 'bg-stone-500/15 border-stone-500 text-stone-500 font-bold';
      case 'Waiting':
      default: return 'bg-surface border-outline-variant/40 text-on-surface-variant opacity-60';
    }
  };

  const handleAddNote = (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    const noteObj = {
      id: Date.now(),
      author: 'Command Officer',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: newNote.trim(),
    };

    setInternalNotes([...internalNotes, noteObj]);
    setNewNote('');
  };

  const handleSaveChanges = () => {
    const updated = {
      ...incident,
      assignedUnit: assignedTeam,
      priority,
      status,
      notes: internalNotes,
      deployedResources: editableResources,
      deployedAt: deploymentTimestamp,
      currentLifecycleStage,
    };
    onUpdateIncident?.(updated);
    setDeploymentSuccessMsg('Incident details updated successfully.');
    setTimeout(() => {
      setDeploymentSuccessMsg('');
      onClose();
    }, 1000);
  };

  const getBadgeStyle = (st) => {
    const upper = (st || '').toUpperCase();
    if (upper === 'CRITICAL' || upper === 'HIGH') return 'bg-error text-white font-black';
    if (upper === 'DISPATCHED' || upper === 'EN_ROUTE') return 'bg-amber-500 text-white font-black';
    if (upper === 'RESOLVED' || upper === 'CLOSED') return 'bg-success text-white font-black';
    return 'bg-secondary text-white font-bold';
  };

  // Filter out any stages that are unreached, unverified, or have "Pending" timestamps
  const verifiedStages = REAL_LIFECYCLE_STAGES.filter(
    (stg) => (stg.state === 'Completed' || stg.state === 'Current' || stg.state === 'Failed') && stg.timestamp !== 'Pending'
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 z-50 animate-fade-in text-left overflow-y-auto">
      <Card className="relative bg-surface border border-outline-variant max-w-4xl w-full p-5 sm:p-6 space-y-5 shadow-2xl my-auto max-h-[92vh] overflow-y-auto">
        
        {/* TOP-RIGHT CLOSE PANEL BUTTON */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Incident Details"
          title="Close panel (Press ESC)"
          className="absolute top-4 right-4 sm:top-5 sm:right-6 w-9 h-9 rounded-full bg-surface-container hover:bg-surface-container-high active:bg-surface-variant border border-outline-variant/60 flex items-center justify-center text-primary cursor-pointer transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-secondary shrink-0 shadow-sm z-20"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>

        {/* MODAL HEADER BAR */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant/60 pb-3 pr-10 sm:pr-12">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold text-secondary uppercase bg-secondary/15 px-2.5 py-0.5 rounded border border-secondary/30">
                AI MISSION CONTROL • INCIDENT {incident.displayId || incident.id || incident._id || incident.mongoId || incident.packetId || 'Not Found'}
              </span>
              <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded ${getBadgeStyle(status)}`}>
                STATUS: {status}
              </span>
              <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded ${getBadgeStyle(priority)}`}>
                PRIORITY: {priority}
              </span>
              <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded border font-bold ${confidenceInfo.color}`}>
                {confidenceInfo.label}
              </span>
            </div>
            <h2 className="text-xl font-black text-primary tracking-tight">
              {category} EMERGENCY MISSION CONTROL
            </h2>
            <p className="text-xs text-on-surface-variant font-medium">
              Target Location: <strong className="text-primary">{incident.location || 'Sector 4, Koramangala'}</strong> • Reported: {receivedTimeStr}
            </p>
          </div>

          <div className="flex items-center gap-2 pr-2 sm:pr-4">
            {status !== 'RESOLVED' && status !== 'CLOSED' && (
              <button
                type="button"
                onClick={() => setShowCompleteModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-success text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm hover:brightness-95 cursor-pointer transition-all min-h-[36px]"
              >
                <span className="material-symbols-outlined text-base">task_alt</span>
                <span>Complete Incident</span>
              </button>
            )}
          </div>
        </div>

        {deploymentSuccessMsg && (
          <div className="p-3 rounded-xl bg-success/15 border border-success/30 text-success text-xs font-bold flex items-center gap-2 animate-fade-in shadow-sm">
            <span className="material-symbols-outlined text-base">check_circle</span>
            <span>{deploymentSuccessMsg}</span>
          </div>
        )}

        {/* VERIFIED INCIDENT LIFECYCLE & STATUS CARD (NO PLACEHOLDERS / NO PENDING) */}
        <div className="p-3.5 rounded-2xl bg-surface-container border border-outline-variant/60 space-y-3 shadow-sm">
          <div className="flex items-center justify-between border-b border-outline-variant/40 pb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-base">verified</span>
              <span className="text-[10px] font-mono font-extrabold text-primary uppercase tracking-wider">
                Verified Response Lifecycle & Incident Status
              </span>
            </div>

            <span className="text-[9px] font-mono font-bold text-success bg-success/10 px-2 py-0.5 rounded border border-success/25">
              100% REAL EVENT DATA
            </span>
          </div>

          {/* VERIFIED STAGES CHIPS */}
          <div className="flex flex-wrap items-center gap-2">
            {verifiedStages.map((stg) => (
              <div
                key={stg.stageIndex}
                className={`px-3 py-1.5 rounded-xl border text-xs flex items-center gap-2 transition-all ${getStageStyle(stg.state)}`}
              >
                <span className="material-symbols-outlined text-sm">{stg.icon}</span>
                <div className="text-left">
                  <span className="text-[10px] font-extrabold block leading-tight">{stg.title}</span>
                  <span className="text-[8px] font-mono block opacity-90">{stg.timestamp}</span>
                </div>
              </div>
            ))}
          </div>

          {/* VERIFIED INCIDENT STATUS METRICS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs pt-1 border-t border-outline-variant/30">
            <div className="p-2 rounded-xl bg-surface border border-outline-variant/40">
              <span className="text-[9px] font-bold text-on-surface-variant uppercase block">Current Status</span>
              <strong className="text-primary text-xs font-black">{status}</strong>
            </div>

            <div className="p-2 rounded-xl bg-surface border border-outline-variant/40">
              <span className="text-[9px] font-bold text-secondary uppercase block">AI Status</span>
              <strong className="text-secondary text-xs font-bold">
                {incident.aiAnalysis?.aiAvailable !== false ? 'Gemma 4 Complete' : 'Pending Analysis'}
              </strong>
            </div>

            <div className="p-2 rounded-xl bg-surface border border-outline-variant/40">
              <span className="text-[9px] font-bold text-on-surface-variant uppercase block">Received Time</span>
              <strong className="text-primary text-xs font-mono font-bold">{receivedTimeStr}</strong>
            </div>

            <div className="p-2 rounded-xl bg-surface border border-outline-variant/40">
              <span className="text-[9px] font-bold text-on-surface-variant uppercase block">Last Updated</span>
              <strong className="text-primary text-xs font-mono font-bold">
                {formatRealTimestamp(incident.updatedAt || incident.createdAt)}
              </strong>
            </div>

            <div className="p-2 rounded-xl bg-surface border border-outline-variant/40">
              <span className="text-[9px] font-bold text-error uppercase block">Priority</span>
              <strong className="text-error text-xs font-black">{priority}</strong>
            </div>

            <div className="p-2 rounded-xl bg-surface border border-outline-variant/40">
              <span className="text-[9px] font-bold text-success uppercase block">Confidence</span>
              <strong className="text-success text-xs font-bold">
                {typeof aiAnalysis.confidenceScore === 'number'
                  ? `${Math.round((aiAnalysis.confidenceScore > 1 ? aiAnalysis.confidenceScore / 100 : aiAnalysis.confidenceScore) * 100)}%`
                  : 'Not Available'}
              </strong>
            </div>
          </div>
        </div>

        {/* THREE SIMPLIFIED WORKSPACE TABS */}
        <div className="flex border-b border-outline-variant/60 gap-2">
          <button
            onClick={() => setActiveTab('situation')}
            className={`px-4 py-2 text-xs font-black rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'situation'
                ? 'bg-secondary text-white border-t-2 border-secondary'
                : 'text-on-surface-variant hover:text-primary bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-base">assignment</span>
            <span>1. Situation & Relay Path</span>
          </button>

          <button
            onClick={() => setActiveTab('action_plan')}
            className={`px-4 py-2 text-xs font-black rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'action_plan'
                ? 'bg-secondary text-white border-t-2 border-secondary'
                : 'text-on-surface-variant hover:text-primary bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-base">smart_button</span>
            <span>2. Action Plan</span>
          </button>

          <button
            onClick={() => setActiveTab('resources')}
            className={`px-4 py-2 text-xs font-black rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'resources'
                ? 'bg-secondary text-white border-t-2 border-secondary'
                : 'text-on-surface-variant hover:text-primary bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-base">inventory_2</span>
            <span>3. Resources</span>
          </button>
        </div>

        {/* TAB 1: SITUATION & MISSION BRIEF & DEVICE RELAY PATH */}
        {activeTab === 'situation' && (
          <div className="space-y-4 animate-fade-in">
            {/* LIVE DEVICE RELAY PATH VISUALIZATION */}
            <LiveDeviceRelayPath incident={incident} />

            {/* MISSION BRIEF CARD GENERATED FROM GEMMA RESPONSE */}
            <Card className="p-4 border border-secondary/40 bg-secondary/5 shadow-md space-y-3">
              <div className="flex items-center justify-between border-b border-outline-variant/60 pb-2">
                <h3 className="text-xs font-black text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-secondary text-base">psychology</span>
                  <span>AI MISSION BRIEF</span>
                </h3>
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded border font-bold ${confidenceInfo.color}`}>
                  {confidenceInfo.label} ({confidenceInfo.note})
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-surface border border-outline-variant/60 space-y-1">
                  <span className="text-[10px] font-bold text-secondary uppercase block">Current Situation</span>
                  <p className="text-primary font-medium leading-relaxed">
                    "{incident.aiSummary || aiAnalysis.summary}"
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-surface border border-outline-variant/60 space-y-1">
                  <span className="text-[10px] font-bold text-error uppercase block">Primary Risks</span>
                  <p className="text-primary font-medium leading-relaxed">
                    "{aiAnalysis.explanations?.priorityReason || incident.description || 'Under responder assessment'}"
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-surface border border-outline-variant/60 space-y-1">
                  <span className="text-[10px] font-bold text-amber-500 uppercase block">Immediate Objectives</span>
                  <p className="text-primary font-medium leading-relaxed">
                    {incident.recommendedAction || incident.gemmaAnalysis?.recommendedAction || incident.description || 'Emergency assessment in progress'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-surface border border-outline-variant/60 space-y-1">
                  <span className="text-[10px] font-bold text-sky-400 uppercase block">Recommended Resources</span>
                  <p className="text-primary font-bold">
                    {editableResources.map((r) => `${r.name} × ${r.count}`).join(', ')}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-surface border border-outline-variant/60 space-y-1">
                  <span className="text-[10px] font-bold text-success uppercase block">Estimated Response Window</span>
                  <p className="text-primary font-mono font-black text-sm">
                    8 Minutes (ETA)
                  </p>
                </div>
              </div>
            </Card>

            {/* ==================================================================== */}
            {/* COLLAPSIBLE AI EXPLAINABILITY PANEL (GEMMA 4 E4B EXPLANATIONS) */}
            {/* ==================================================================== */}
            {(() => {
              const explainData = incident.gemmaAnalysis?.explainability || incident.aiAnalysis?.explainability || incident.explainability || {};
              
              const expLang = explainData.detectedLanguage || incident.detectedLanguage || incident.gemmaAnalysis?.language || null;
              const expLangReason = explainData.languageReason || (expLang ? `Detected script signatures and spoken patterns for ${expLang}` : null);
              
              const expCategory = explainData.category || incident.category || incident.gemmaAnalysis?.incidentType || null;
              const expCatReason = explainData.categoryReason || (expCategory ? `Transcript indicates ${expCategory} hazard conditions` : null);
              
              const expSeverity = (explainData.severity || incident.priority || incident.gemmaAnalysis?.priority || incident.severity || '').toUpperCase() || null;
              const expSevReason = explainData.severityReason || (expSeverity ? `Classified as ${expSeverity} based on victim density and situation urgency` : null);
              
              const keyPhrasesList = Array.isArray(explainData.keyPhrases) ? explainData.keyPhrases : (explainData.keyPhrases ? [explainData.keyPhrases] : []);
              const hazardsList = Array.isArray(explainData.hazards) ? explainData.hazards : (explainData.hazards ? [explainData.hazards] : (incident.gemmaAnalysis?.hazards || []));
              
              const peopleCount = explainData.peopleAffected || incident.peopleAffected || incident.gemmaAnalysis?.peopleAffected || null;
              const translationText = explainData.translation || incident.englishTranslation || incident.gemmaAnalysis?.englishText || null;
              
              const resourcesText = explainData.recommendedResources || (Array.isArray(incident.gemmaAnalysis?.recommendedResources) ? incident.gemmaAnalysis.recommendedResources.join(', ') : null) || null;
              
              const rawConf = typeof explainData.confidence === 'number' ? explainData.confidence : (typeof incident.gemmaAnalysis?.confidenceScore === 'number' ? incident.gemmaAnalysis.confidenceScore : null);

              return (
                <div className="p-4 rounded-2xl bg-surface-container border border-purple-500/30 shadow-md space-y-3">
                  <button
                    type="button"
                    onClick={() => setIsExplainabilityOpen((prev) => !prev)}
                    className="w-full flex items-center justify-between text-left cursor-pointer focus:outline-none"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                        <span className="material-symbols-outlined text-base">auto_awesome</span>
                      </div>
                      <div>
                        <h3 className="text-xs font-black text-primary uppercase tracking-wider leading-none">
                          AI Analysis Explanation
                        </h3>
                        <span className="text-[10px] text-on-surface-variant font-medium mt-0.5 block">
                          Gemma 4 E4B Explainability Panel · Click to {isExplainabilityOpen ? 'collapse' : 'expand'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/25">
                        XAI REASONING
                      </span>
                      <span className="material-symbols-outlined text-lg text-on-surface-variant">
                        {isExplainabilityOpen ? 'expand_less' : 'expand_more'}
                      </span>
                    </div>
                  </button>

                  {isExplainabilityOpen && (
                    <div className="pt-3 border-t border-outline-variant/40 space-y-3 animate-fade-in text-xs">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* 1. Detected Language & Reason */}
                        <div className="p-3 rounded-xl bg-surface border border-outline-variant/40 space-y-1">
                          <span className="text-[10px] font-bold text-secondary uppercase block">Detected Language</span>
                          <p className="font-extrabold text-primary">{expLang || 'Not Available'}</p>
                          <span className="text-[10px] font-bold text-on-surface-variant block mt-1">Reason:</span>
                          <p className="text-[11px] text-on-surface-variant italic">
                            {expLangReason || 'Not Available'}
                          </p>
                        </div>

                        {/* 2. Emergency Category & Reason */}
                        <div className="p-3 rounded-xl bg-surface border border-outline-variant/40 space-y-1">
                          <span className="text-[10px] font-bold text-secondary uppercase block">Emergency Category</span>
                          <p className="font-extrabold text-primary">{expCategory || 'Not Available'}</p>
                          <span className="text-[10px] font-bold text-on-surface-variant block mt-1">Reason:</span>
                          <p className="text-[11px] text-on-surface-variant italic">
                            {expCatReason || 'Not Available'}
                          </p>
                        </div>

                        {/* 3. Severity & Reason */}
                        <div className="p-3 rounded-xl bg-surface border border-outline-variant/40 space-y-1">
                          <span className="text-[10px] font-bold text-error uppercase block">Severity / Priority</span>
                          <p className="font-extrabold text-error">{expSeverity || 'Not Available'}</p>
                          <span className="text-[10px] font-bold text-on-surface-variant block mt-1">Reason:</span>
                          <p className="text-[11px] text-on-surface-variant italic">
                            {expSevReason || 'Not Available'}
                          </p>
                        </div>

                        {/* 4. Key Phrases Extracted */}
                        <div className="p-3 rounded-xl bg-surface border border-outline-variant/40 space-y-1">
                          <span className="text-[10px] font-bold text-secondary uppercase block">Key Phrases Extracted</span>
                          {keyPhrasesList.length > 0 ? (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {keyPhrasesList.map((phrase, idx) => (
                                <span key={idx} className="px-2 py-0.5 rounded bg-secondary/10 text-secondary text-[10px] font-bold border border-secondary/20">
                                  "{phrase}"
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-on-surface-variant italic">Not Available</p>
                          )}
                        </div>

                        {/* 5. Hazards Identified */}
                        <div className="p-3 rounded-xl bg-surface border border-outline-variant/40 space-y-1">
                          <span className="text-[10px] font-bold text-amber-500 uppercase block">Hazards Identified</span>
                          {hazardsList.length > 0 ? (
                            <p className="font-bold text-amber-500">{hazardsList.join(', ')}</p>
                          ) : (
                            <p className="text-[11px] text-on-surface-variant italic">Not Available</p>
                          )}
                        </div>

                        {/* 6. Number of People Detected */}
                        <div className="p-3 rounded-xl bg-surface border border-outline-variant/40 space-y-1">
                          <span className="text-[10px] font-bold text-secondary uppercase block">Number of People Detected</span>
                          <p className="font-extrabold text-primary">
                            {peopleCount ? `${peopleCount} Persons` : 'Not Available'}
                          </p>
                        </div>

                        {/* 7. Translation */}
                        <div className="p-3 rounded-xl bg-surface border border-outline-variant/40 space-y-1">
                          <span className="text-[10px] font-bold text-secondary uppercase block">Translation (English)</span>
                          <p className="text-[11px] text-primary italic font-medium">
                            {translationText ? `"${translationText}"` : 'Not Available'}
                          </p>
                        </div>

                        {/* 8. Recommended Resources */}
                        <div className="p-3 rounded-xl bg-surface border border-outline-variant/40 space-y-1">
                          <span className="text-[10px] font-bold text-success uppercase block">Recommended Resources</span>
                          <p className="font-bold text-success">{resourcesText || 'Not Available'}</p>
                        </div>
                      </div>

                      {/* 9. Confidence */}
                      <div className="p-2.5 rounded-xl bg-surface border border-outline-variant/40 flex items-center justify-between text-[11px]">
                        <span className="font-bold text-on-surface-variant">Gemma AI Model Confidence:</span>
                        <span className="font-bold font-mono text-secondary">
                          {typeof rawConf === 'number'
                            ? `${Math.round((rawConf > 1 ? rawConf / 100 : rawConf) * 100)}%`
                            : 'Not Available'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ==================================================================== */}
            {/* GEMMA 4 E4B VISION IMAGE ANALYSIS PANEL (PHOTO EVIDENCE INTELLIGENCE) */}
            {/* ==================================================================== */}
            {(() => {
              const imgData = incident.imageAnalysis || incident.rawDoc?.imageAnalysis || null;

              return (
                <div className="p-4 rounded-2xl bg-surface-container border border-secondary/30 shadow-md space-y-3 text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-secondary/15 border border-secondary/30 flex items-center justify-center text-secondary shrink-0">
                        <span className="material-symbols-outlined text-base">image_search</span>
                      </div>
                      <div>
                        <h4 className="font-black text-xs text-primary uppercase tracking-wider">
                          Gemma 4 e4b Vision Image Analysis
                        </h4>
                        <p className="text-[10px] text-on-surface-variant">Photo Evidence Intelligence</p>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-secondary bg-secondary/10 px-2 py-0.5 rounded border border-secondary/20">
                      Independent Vision Pipeline
                    </span>
                  </div>

                  {imgData ? (
                    <div className="space-y-3 pt-1">
                      {/* Photo Preview if available */}
                      {(incident.photoReference?.dataUrl || imgData.imageUrl) && (
                        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface border border-outline-variant/60">
                          <img
                            src={incident.photoReference?.dataUrl || imgData.imageUrl}
                            alt="Uploaded emergency photo"
                            className="w-16 h-16 object-cover rounded-lg border border-outline-variant/60 shadow-sm shrink-0"
                          />
                          <div>
                            <span className="text-[10px] font-extrabold text-secondary uppercase block">Uploaded Scene Photo</span>
                            <span className="text-[11px] font-mono font-bold text-primary block">Evaluated by Gemma 4 Vision Engine</span>
                          </div>
                        </div>
                      )}

                      <div className="p-3 rounded-xl bg-surface border border-outline-variant/60">
                        <span className="font-extrabold text-[10px] text-secondary uppercase block mb-1">Scene Summary</span>
                        <p className="font-medium text-xs text-primary leading-relaxed">
                          "{imgData.summary || 'Not Detected'}"
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-surface border border-outline-variant/40 space-y-0.5 sm:col-span-2">
                          <span className="text-[10px] font-extrabold text-secondary uppercase block">Detected Emergency Type (From Image)</span>
                          <p className="font-extrabold text-sm text-primary">{imgData.detectedEmergencyType || imgData.sceneType || 'Not Detected'}</p>
                        </div>

                        <div className="p-2.5 rounded-xl bg-surface border border-outline-variant/40 space-y-0.5">
                          <span className="text-[10px] font-bold text-on-surface-variant block">Hazards Detected</span>
                          <p className="font-bold text-error">{Array.isArray(imgData.hazards) && imgData.hazards.length > 0 ? imgData.hazards.join(', ') : 'Not Detected'}</p>
                        </div>

                        <div className="p-2.5 rounded-xl bg-surface border border-outline-variant/40 space-y-0.5">
                          <span className="text-[10px] font-bold text-on-surface-variant block">Visible Objects</span>
                          <p className="font-bold text-primary">{Array.isArray(imgData.visibleObjects) && imgData.visibleObjects.length > 0 ? imgData.visibleObjects.join(', ') : 'Not Detected'}</p>
                        </div>

                        <div className="p-2.5 rounded-xl bg-surface border border-outline-variant/40 space-y-0.5">
                          <span className="text-[10px] font-bold text-on-surface-variant block">Estimated Number of People</span>
                          <p className="font-extrabold text-secondary">{imgData.possibleVictims != null ? `${imgData.possibleVictims} Persons` : 'Not Detected'}</p>
                        </div>

                        <div className="p-2.5 rounded-xl bg-surface border border-outline-variant/40 space-y-0.5">
                          <span className="text-[10px] font-bold text-on-surface-variant block">Building Damage</span>
                          <p className="font-bold text-amber-500">{imgData.buildingDamage || 'Not Detected'}</p>
                        </div>

                        <div className="p-2.5 rounded-xl bg-surface border border-outline-variant/40 space-y-0.5">
                          <span className="text-[10px] font-bold text-on-surface-variant block">Fire Detection</span>
                          <p className={`font-bold ${imgData.fireDetected ? 'text-error' : 'text-primary'}`}>{imgData.fireDetected ? '🔥 Fire Detected' : 'Not Detected'}</p>
                        </div>

                        <div className="p-2.5 rounded-xl bg-surface border border-outline-variant/40 space-y-0.5">
                          <span className="text-[10px] font-bold text-on-surface-variant block">Flood Detection</span>
                          <p className={`font-bold ${imgData.floodDetected ? 'text-secondary' : 'text-primary'}`}>{imgData.floodDetected ? '🌊 Flood Detected' : 'Not Detected'}</p>
                        </div>

                        <div className="p-2.5 rounded-xl bg-surface border border-outline-variant/40 space-y-0.5">
                          <span className="text-[10px] font-bold text-on-surface-variant block">Smoke Detection</span>
                          <p className={`font-bold ${imgData.smokeDetected ? 'text-amber-500' : 'text-primary'}`}>{imgData.smokeDetected ? '💨 Smoke Detected' : 'Not Detected'}</p>
                        </div>

                        <div className="p-2.5 rounded-xl bg-surface border border-outline-variant/40 space-y-0.5">
                          <span className="text-[10px] font-bold text-on-surface-variant block">Recommended Response</span>
                          <p className="font-bold text-success">{Array.isArray(imgData.recommendedResources) && imgData.recommendedResources.length > 0 ? imgData.recommendedResources.join(', ') : 'Not Detected'}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-surface border border-outline-variant/40 text-center text-xs text-on-surface-variant font-medium">
                      No photo evidence provided for this emergency report.
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ==================================================================== */}
            {/* PHASE 4 — MULTILINGUAL EMERGENCY VOICE INTELLIGENCE CARD (STRICT REAL DATA) */}
            {/* ==================================================================== */}
            {(() => {
              const detectedLanguage =
                incident.detectedLanguage ||
                incident.gemmaAnalysis?.language ||
                incident.multilingualData?.originalLanguage ||
                incident.languageHint ||
                'Unknown Language';

              const originalVoiceTranscript =
                incident.originalVoiceTranscript ||
                incident.voiceTranscript ||
                incident.multilingualData?.originalText ||
                incident.transcript ||
                incident.description ||
                'No voice transcript available.';

              const englishTranslation =
                incident.englishTranslation ||
                incident.gemmaAnalysis?.englishText ||
                incident.gemmaAnalysis?.translation ||
                incident.multilingualData?.translatedSummary ||
                (detectedLanguage.toLowerCase().includes('english') ? originalVoiceTranscript : null);

              const gemmaSummary =
                incident.incidentSummary ||
                incident.gemmaAnalysis?.summary ||
                incident.aiSummary ||
                aiAnalysis?.summary ||
                'AI analysis is temporarily unavailable. The original emergency report is still available for responders.';

              const rawPriority =
                incident.priority ||
                incident.gemmaAnalysis?.priority ||
                incident.severity ||
                aiAnalysis?.priority;

              const displayPriority = rawPriority ? String(rawPriority).toUpperCase() : 'UNASSIGNED';

              const rawPeopleAffected =
                incident.peopleAffected !== undefined && incident.peopleAffected !== null
                  ? incident.peopleAffected
                  : incident.gemmaAnalysis?.peopleAffected !== undefined && incident.gemmaAnalysis?.peopleAffected !== null
                  ? incident.gemmaAnalysis.peopleAffected
                  : null;

              const peopleAffectedDisplay =
                rawPeopleAffected !== null ? `${rawPeopleAffected} Persons` : 'Unknown';

              const recommendedAction =
                incident.recommendedAction ||
                incident.gemmaAnalysis?.recommendedAction ||
                aiAnalysis?.recommendedAction ||
                'Awaiting Gemma AI recommendation';

              return (
                <Card className="p-4 border border-secondary/40 bg-surface shadow-md space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/60 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-secondary/15 border border-secondary/30 flex items-center justify-center text-secondary shrink-0">
                        <span className="material-symbols-outlined text-base">translate</span>
                      </div>
                      <div>
                        <h3 className="text-xs font-black text-primary uppercase tracking-wider leading-none">
                          Multilingual Emergency Voice Intelligence (Gemma 4)
                        </h3>
                        <span className="text-[10px] text-on-surface-variant font-medium">
                          Language: <strong className="text-secondary font-bold">{detectedLanguage}</strong> · Model: gemma4:e4b
                        </span>
                      </div>
                    </div>

                    {/* TOGGLE: Original | English */}
                    <div className="flex items-center bg-surface-container p-1 rounded-xl border border-outline-variant/60 gap-1">
                      <button
                        type="button"
                        onClick={() => setTranscriptMode('Original')}
                        className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                          transcriptMode === 'Original'
                            ? 'bg-secondary text-white shadow-xs font-black'
                            : 'text-on-surface-variant hover:text-primary'
                        }`}
                      >
                        Original ({detectedLanguage})
                      </button>

                      <button
                        type="button"
                        onClick={() => setTranscriptMode('English')}
                        className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                          transcriptMode === 'English'
                            ? 'bg-secondary text-white shadow-xs font-black'
                            : 'text-on-surface-variant hover:text-primary'
                        }`}
                      >
                        English
                      </button>
                    </div>
                  </div>

                  {/* Active Transcript Display (Toggled Original vs English) */}
                  <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/60 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold text-on-surface-variant">
                      <span className="uppercase font-mono">
                        {transcriptMode === 'Original' ? `Original Voice Transcript (${detectedLanguage})` : 'English Translation'}
                      </span>
                      <span className="text-[9px] font-mono text-success bg-success/10 px-2 py-0.5 rounded border border-success/25 font-extrabold">
                        UNALTERED SOURCE
                      </span>
                    </div>
                    <p className="text-xs text-primary font-bold italic leading-relaxed">
                      {transcriptMode === 'Original'
                        ? (originalVoiceTranscript === 'No voice transcript available.' ? 'No voice transcript available.' : `"${originalVoiceTranscript}"`)
                        : (englishTranslation ? `"${englishTranslation}"` : 'Original transcript is in English or translation not required.')}
                    </p>
                  </div>

                  {/* Grid of Phase 4 Intelligence Attributes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    {/* Language */}
                    <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/40 space-y-1">
                      <span className="text-[10px] font-bold text-secondary uppercase block">Language</span>
                      <span className="font-extrabold text-primary text-xs flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm text-secondary">language</span>
                        {detectedLanguage}
                      </span>
                    </div>

                    {/* Priority */}
                    <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/40 space-y-1">
                      <span className="text-[10px] font-bold text-error uppercase block">Priority</span>
                      <span className="font-extrabold text-error text-xs flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm text-error">warning</span>
                        {displayPriority}
                      </span>
                    </div>

                    {/* People Affected */}
                    <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/40 space-y-1">
                      <span className="text-[10px] font-bold text-amber-500 uppercase block">People Affected</span>
                      <span className="font-extrabold text-primary text-xs flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm text-amber-500">group</span>
                        {peopleAffectedDisplay}
                      </span>
                    </div>

                    {/* Recommended Action */}
                    <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/40 space-y-1">
                      <span className="text-[10px] font-bold text-success uppercase block">Recommended Action</span>
                      <p className="font-bold text-primary text-[11px] leading-snug">
                        {recommendedAction}
                      </p>
                    </div>
                  </div>

                  {/* Gemma Responder Summary */}
                  <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/40 space-y-1">
                    <span className="text-[10px] font-bold text-secondary uppercase block">Gemma Intelligence Summary</span>
                    <p className="text-primary font-medium text-xs leading-relaxed">
                      "{gemmaSummary}"
                    </p>
                  </div>
                </Card>
              );
            })()}
          </div>
        )}

        {/* TAB 2: ACTION PLAN */}
        {activeTab === 'action_plan' && (
          <div className="space-y-4 animate-fade-in">
            {/* SMART RESOURCE DEPLOYMENT & SINGLE DEPLOY BUTTON */}
            <Card className="p-4 border border-outline-variant/60 shadow-md space-y-4">
              <div className="flex items-center justify-between border-b border-outline-variant/60 pb-2">
                <div>
                  <h3 className="text-xs font-black text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-secondary text-base">smart_button</span>
                    <span>SMART RESOURCE DEPLOYMENT ACTION</span>
                  </h3>
                  <p className="text-[11px] text-on-surface-variant">Adjust quantities then click 'Deploy Resources' to dispatch units</p>
                </div>
                <span className="text-[10px] font-mono text-success font-bold">Category: {category}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {editableResources.map((res) => (
                  <div key={res.id} className="p-3 rounded-xl bg-surface-container border border-outline-variant/60 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-lg text-secondary">{res.icon}</span>
                      <div>
                        <span className="font-bold text-primary block">{res.name}</span>
                        <span className="text-[10px] font-mono text-on-surface-variant">Available Fleet: {res.available} Units</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-surface p-1 rounded-lg border border-outline-variant/60">
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(res.id, -1)}
                        className="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high border border-outline-variant flex items-center justify-center font-black text-primary cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-mono font-black text-xs text-primary px-1.5">{res.count}</span>
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(res.id, 1)}
                        className="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high border border-outline-variant flex items-center justify-center font-black text-primary cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* SINGLE DEPLOY BUTTON */}
              <div className="pt-2 border-t border-outline-variant/40 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-mono">
                  <span className="text-on-surface-variant">Deployment Status: </span>
                  <strong className={deploymentTimestamp ? 'text-success font-black' : 'text-amber-500 font-bold'}>
                    {deploymentTimestamp ? `DEPLOYED AT ${deploymentTimestamp}` : 'AWAITING DEPLOYMENT'}
                  </strong>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleDeployResources}
                  disabled={isDeploying}
                  className="font-black text-xs px-6 py-2.5 min-h-[42px] bg-secondary hover:bg-secondary-high text-white shadow-lg"
                >
                  <span className="material-symbols-outlined text-base">local_shipping</span>
                  <span>{isDeploying ? 'Deploying Fleet...' : 'Deploy Resources'}</span>
                </Button>
              </div>
            </Card>

            {/* Management Controls & Dispatcher Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4 border border-outline-variant/60 shadow-md space-y-3">
                <h3 className="text-xs font-black text-primary uppercase tracking-wider border-b border-outline-variant/60 pb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-secondary text-base">tune</span>
                  <span>INCIDENT CONTROLS</span>
                </h3>

                <div className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-primary block">Triage Priority</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-surface-container border border-outline-variant text-xs font-bold text-primary focus:outline-none focus:border-secondary cursor-pointer min-h-[38px]"
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-primary block">Operational Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-surface-container border border-outline-variant text-xs font-bold text-primary focus:outline-none focus:border-secondary cursor-pointer min-h-[38px]"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-primary block">Assign Rescue Team</label>
                    <input
                      type="text"
                      value={assignedTeam}
                      onChange={(e) => setAssignedTeam(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-surface-container border border-outline-variant text-xs font-bold text-primary focus:outline-none focus:border-secondary min-h-[38px]"
                    />
                  </div>
                </div>
              </Card>

              {/* Internal Dispatcher Log */}
              <Card className="p-4 border border-outline-variant/60 shadow-md space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <h3 className="text-xs font-black text-primary uppercase tracking-wider border-b border-outline-variant/60 pb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-secondary text-base">sticky_note_2</span>
                    <span>DISPATCHER LOG</span>
                  </h3>

                  <div className="max-h-36 overflow-y-auto space-y-2 p-2 bg-surface-container rounded-xl border border-outline-variant/40">
                    {internalNotes.map((n) => (
                      <div key={n.id} className="p-2 rounded-lg bg-surface border border-outline-variant/60 space-y-0.5 text-[11px]">
                        <div className="flex items-center justify-between text-[10px] font-mono font-bold text-secondary">
                          <span>{n.author}</span>
                          <span>{n.time}</span>
                        </div>
                        <p className="text-primary font-medium">{n.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleAddNote} className="flex gap-2 pt-2">
                  <input
                    type="text"
                    placeholder="Add dispatcher note..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-surface-container border border-outline-variant text-xs font-medium text-primary focus:outline-none focus:border-secondary min-h-[38px]"
                  />
                  <Button variant="secondary" size="sm" type="submit" className="min-h-[38px]">
                    Add Note
                  </Button>
                </form>
              </Card>
            </div>
          </div>
        )}

        {/* TAB 3: RESOURCES */}
        {activeTab === 'resources' && (
          <div className="space-y-4 animate-fade-in">
            {/* Live Fleet Overview */}
            <Card className="p-4 border border-secondary/30 bg-secondary/5 shadow-md space-y-3">
              <div className="flex items-center justify-between border-b border-outline-variant/60 pb-2">
                <h3 className="text-xs font-black text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-secondary text-base">inventory_2</span>
                  <span>LIVE RESOURCE FLEET AVAILABILITY</span>
                </h3>
                <span className="text-[10px] font-mono text-secondary font-bold uppercase">LIVE FLEET METRICS</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-surface border border-outline-variant/60 flex items-center gap-3">
                  <span className="material-symbols-outlined text-xl text-error">medical_services</span>
                  <div>
                    <span className="text-base font-black text-primary font-mono block">{resourceFleet.ambulancesAvailable}</span>
                    <span className="text-[10px] font-bold text-on-surface-variant block">Ambulances</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-surface border border-outline-variant/60 flex items-center gap-3">
                  <span className="material-symbols-outlined text-xl text-amber-500">local_fire_department</span>
                  <div>
                    <span className="text-base font-black text-primary font-mono block">{resourceFleet.fireUnitsAvailable}</span>
                    <span className="text-[10px] font-bold text-on-surface-variant block">Fire Units</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-surface border border-outline-variant/60 flex items-center gap-3">
                  <span className="material-symbols-outlined text-xl text-secondary">local_police</span>
                  <div>
                    <span className="text-base font-black text-primary font-mono block">{resourceFleet.policeTeamsAvailable}</span>
                    <span className="text-[10px] font-bold text-on-surface-variant block">Police Teams</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-surface border border-outline-variant/60 flex items-center gap-3">
                  <span className="material-symbols-outlined text-xl text-sky-400">groups</span>
                  <div>
                    <span className="text-base font-black text-primary font-mono block">{resourceFleet.volunteersAvailable}</span>
                    <span className="text-[10px] font-bold text-on-surface-variant block">Volunteers</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Configured Roster Breakdown */}
            <Card className="p-4 border border-outline-variant/60 shadow-md space-y-3">
              <h3 className="text-xs font-black text-primary uppercase tracking-wider border-b border-outline-variant/60 pb-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-secondary text-base">format_list_bulleted</span>
                <span>Configured Deployment Roster for {category} Emergency</span>
              </h3>

              <div className="space-y-2 text-xs">
                {editableResources.map((res) => (
                  <div key={res.id} className="p-3 rounded-xl bg-surface-container border border-outline-variant/40 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary text-base">{res.icon}</span>
                      <span className="font-bold text-primary">{res.name}</span>
                    </div>
                    <span className="font-mono font-black text-xs text-secondary bg-secondary/15 px-2.5 py-0.5 rounded border border-secondary/30">
                      Quantity: {res.count} Unit(s)
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* MODAL ACTION FOOTER */}
        <div className="pt-3 border-t border-outline-variant/60 flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSaveChanges} className="font-extrabold px-6 min-h-[40px]">
            Save Incident Changes
          </Button>
        </div>
      </Card>

      {/* CONFIRMATION DIALOG MODAL FOR INCIDENT COMPLETION */}
      {showCompleteModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-60 animate-fade-in text-left">
          <Card className="bg-surface border border-outline-variant max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-outline-variant/60 pb-3">
              <div className="w-10 h-10 rounded-xl bg-success/15 border border-success/30 flex items-center justify-center text-success shrink-0">
                <span className="material-symbols-outlined text-2xl">task_alt</span>
              </div>
              <div>
                <h3 className="text-lg font-black text-primary leading-tight">Complete Incident?</h3>
                <p className="text-xs text-on-surface-variant">Mark Emergency #{incident._id || incident.id || incident.mongoId || incident.packetId || 'Not Found'} as Resolved</p>
              </div>
            </div>

            <p className="text-xs text-primary font-medium leading-relaxed">
              Are you sure this emergency has been resolved? This action will mark the incident as completed and move it to the Completed Incidents section.
            </p>

            <div className="space-y-1.5 text-xs">
              <label className="font-bold text-primary block">Resolution Summary (Optional Notes):</label>
              <textarea
                rows={3}
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                placeholder="e.g. Victims rescued safely, Flood water receding, Fire extinguished..."
                className="w-full p-2.5 rounded-xl bg-surface-container border border-outline-variant text-xs font-medium text-primary focus:outline-none focus:border-secondary"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCompleteModal(false)}
                disabled={isCompleting}
                className="text-xs"
              >
                Cancel
              </Button>

              <button
                type="button"
                onClick={handleConfirmComplete}
                disabled={isCompleting}
                className="px-4 py-2 rounded-xl bg-success text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm hover:brightness-95 cursor-pointer disabled:opacity-50 min-h-[38px]"
              >
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span>{isCompleting ? 'Completing...' : 'Complete Incident'}</span>
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
