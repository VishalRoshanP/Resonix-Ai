import { useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import WaveformVisualizer from '../components/ui/WaveformVisualizer';

export default function VoiceRelayPage() {
  const [isRecording, setIsRecording] = useState(false);
  return (
    <div className="space-y-6">
      <h1 className="text-headline-lg font-bold text-primary">Voice Relay Interface</h1>
      <div className="flex flex-col items-center justify-center py-12">
        <div className="relative mb-8">
          <button onClick={() => setIsRecording(!isRecording)} className={`w-24 h-24 rounded-full flex items-center justify-center shadow-ambient z-10 relative cursor-pointer transition-all duration-300 ${isRecording ? 'bg-secondary scale-110' : 'bg-primary hover:bg-tertiary'}`}>
            <span className="material-symbols-outlined text-white text-5xl">{isRecording ? 'stop' : 'mic'}</span>
          </button>
          {isRecording && (
            <>
              <div className="absolute inset-0 -m-4 border-2 border-secondary rounded-full animate-pulse-ring" />
              <div className="absolute inset-0 -m-8 border border-secondary/30 rounded-full animate-pulse-ring" style={{ animationDelay: '0.5s' }} />
            </>
          )}
        </div>
        <h2 className="text-headline-md font-bold text-primary mb-2">{isRecording ? 'Listening...' : 'Tap to Speak'}</h2>
        <p className="text-body-md text-on-surface-variant max-w-md text-center mb-6">
          {isRecording ? 'Gemma 4 is processing your voice command in real-time.' : 'Initiate voice command to broadcast to relay network or query Gemma 4.'}
        </p>
        <WaveformVisualizer active={isRecording} count={20} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h4 className="text-sm font-bold text-primary mb-3">Recent Commands</h4>
          <ul className="space-y-2">
            {[
              '"Gemma, analyze structural integrity of Bridge 9."',
              '"Broadcast evacuation order for Sector 7."',
              '"What is the current flood risk level?"',
            ].map((cmd, i) => (
              <li key={i} className="text-sm text-on-surface-variant italic border-l-2 border-outline-variant pl-3">{cmd}</li>
            ))}
          </ul>
        </Card>
        <Card className="p-4">
          <h4 className="text-sm font-bold text-primary mb-3">Relay Status</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-on-surface-variant">Mode</span><span className="font-semibold text-primary">Offline Mesh</span></div>
            <div className="flex justify-between"><span className="text-on-surface-variant">Reachable Nodes</span><span className="font-semibold text-primary">47 / 50</span></div>
            <div className="flex justify-between"><span className="text-on-surface-variant">Pending Messages</span><span className="font-semibold text-secondary">3</span></div>
          </div>
        </Card>
      </div>
    </div>
  );
}
