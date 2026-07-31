import { useState, useEffect } from 'react';
import {
  buildEmergencyPacket,
  savePacketToLocalQueue,
  getLocalPackets,
  clearLocalPackets,
  transmitPacketToBackend,
} from '../../services/emergencyPacketManager';
import { useLanguage } from '../../contexts/LanguageContext';
import { useLocationDetector } from '../../hooks/useLocationDetector';
import Button from '../ui/Button';

export default function EmergencyPacketWidget({ currentAudio, currentPhoto }) {
  const { currentLanguage } = useLanguage();
  const { locationData, hasLocation } = useLocationDetector();

  const [localQueue, setLocalQueue] = useState([]);
  const [activePacket, setActivePacket] = useState(null);
  const [showJsonViewer, setShowJsonViewer] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [transmitMessage, setTransmitMessage] = useState(null);

  // Sync queue state on mount
  useEffect(() => {
    setLocalQueue(getLocalPackets());
  }, []);

  const handleGeneratePacket = () => {
    setTransmitMessage(null);

    const packet = buildEmergencyPacket({
      language: currentLanguage,
      audio: currentAudio,
      photo: currentPhoto,
      gps: {
        hasLocation,
        latitude: locationData?.latitude,
        longitude: locationData?.longitude,
        accuracy: locationData?.accuracy,
      },
    });

    setActivePacket(packet);
    const updatedQueue = savePacketToLocalQueue(packet);
    setLocalQueue(updatedQueue);
  };

  const handleTransmitQueue = async () => {
    if (localQueue.length === 0) return;
    setIsTransmitting(true);
    setTransmitMessage(null);

    let transmittedCount = 0;

    for (const pkt of [...localQueue]) {
      const res = await transmitPacketToBackend(pkt);
      if (res && res.success) {
        transmittedCount++;
      }
    }

    const remaining = getLocalPackets();
    setLocalQueue(remaining);
    setIsTransmitting(false);
    setTransmitMessage(`Successfully transmitted ${transmittedCount} emergency packet(s) to server.`);
  };

  const handleClear = () => {
    clearLocalPackets();
    setLocalQueue([]);
    setActivePacket(null);
    setTransmitMessage('Local packet queue cleared.');
  };

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 text-left space-y-4 shadow-sm animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-outline-variant/60">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary text-xl">
            inventory_2
          </span>
          <span className="font-bold text-primary text-sm">Structured Emergency Packet</span>
        </div>

        <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-secondary/10 border border-secondary/20 text-secondary">
          {localQueue.length} Queued Locally
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={handleGeneratePacket}
          className="w-full sm:w-auto"
        >
          ⚡ Create Emergency Packet
        </Button>

        {localQueue.length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleTransmitQueue}
            disabled={isTransmitting}
          >
            {isTransmitting ? 'Transmitting...' : `Transmit Queue (${localQueue.length})`}
          </Button>
        )}

        {activePacket && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowJsonViewer(!showJsonViewer)}
          >
            {showJsonViewer ? 'Hide JSON' : 'View Packet JSON'}
          </Button>
        )}
      </div>

      {/* Transmit Status Message */}
      {transmitMessage && (
        <p className="text-xs text-emerald-400 font-semibold bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20">
          {transmitMessage}
        </p>
      )}

      {/* Active Packet Summary Badge */}
      {activePacket && (
        <div className="p-3 bg-surface-container/50 border border-outline-variant rounded-xl text-xs space-y-2">
          <div className="flex items-center justify-between font-mono font-bold text-primary">
            <span>{activePacket.packetId}</span>
            <span className="text-2xs text-secondary px-2 py-0.5 rounded bg-secondary/10">
              {activePacket.packetStatus}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-2xs text-on-surface-variant">
            <div>Lang: <strong className="text-primary">{activePacket.selectedLanguage}</strong></div>
            <div>Network: <strong className="text-primary">{activePacket.internetStatus}</strong></div>
            <div>Audio: <strong className="text-primary">{activePacket.audioReference.hasAudio ? 'Attached' : 'None'}</strong></div>
            <div>Photo: <strong className="text-primary">{activePacket.photoReference.hasPhoto ? 'Attached' : 'None'}</strong></div>
            <div>GPS: <strong className="text-primary">{activePacket.gpsCoordinates.hasGps ? `${activePacket.gpsCoordinates.latitude?.toFixed(4)}, ${activePacket.gpsCoordinates.longitude?.toFixed(4)}` : 'None'}</strong></div>
            <div>Gemma 4: <strong className="text-emerald-400">Ready</strong></div>
          </div>
        </div>
      )}

      {/* JSON Inspector View */}
      {showJsonViewer && activePacket && (
        <div className="p-3 bg-surface-container-dark rounded-xl border border-secondary/30 text-2xs font-mono overflow-x-auto text-emerald-400 max-h-60">
          <pre>{JSON.stringify(activePacket, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
