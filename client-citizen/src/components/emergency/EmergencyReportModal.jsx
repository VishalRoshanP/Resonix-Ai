import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSettings } from '../../contexts/SettingsContext';
import { citizenApi } from '../../services/api';
import {
  buildEmergencyPacket,
  buildFastSosPayload,
  transmitPacketToBackend,
} from '../../services/emergencyPacketManager';
import Button from '../ui/Button';
import { resolveConfiguredApiBaseUrl } from '../../utils/env';

// Multilingual Speech Language Options (Web Speech API BCP-47 Locales)
export const VOICE_LANGUAGES = [
  { code: 'ta-IN', name: 'Tamil', label: 'தமிழ் (Tamil)' },
  { code: 'hi-IN', name: 'Hindi', label: 'हिन्दी (Hindi)' },
  { code: 'te-IN', name: 'Telugu', label: 'తెలుగు (Telugu)' },
  { code: 'kn-IN', name: 'Kannada', label: 'ಕನ್ನಡ (Kannada)' },
  { code: 'ml-IN', name: 'Malayalam', label: 'മലയാളം (Malayalam)' },
  { code: 'bn-IN', name: 'Bengali', label: 'বাংলা (Bengali)' },
  { code: 'mr-IN', name: 'Marathi', label: 'मराठी (Marathi)' },
  { code: 'gu-IN', name: 'Gujarati', label: 'ગુજરાતી (Gujarati)' },
  { code: 'pa-IN', name: 'Punjabi', label: 'ਪੰਜਾਬੀ (Punjabi)' },
  { code: 'en-IN', name: 'English', label: 'English (en-IN)' },
  { code: 'AUTO', name: 'Auto Detect', label: '🌐 Auto Detect' },
];

export const LANGUAGE_LOCALE_MAP = {
  Tamil: 'ta-IN',
  Hindi: 'hi-IN',
  Telugu: 'te-IN',
  Kannada: 'kn-IN',
  Malayalam: 'ml-IN',
  Bengali: 'bn-IN',
  Marathi: 'mr-IN',
  Gujarati: 'gu-IN',
  Punjabi: 'pa-IN',
  English: 'en-IN',
  ta: 'ta-IN',
  hi: 'hi-IN',
  te: 'te-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  bn: 'bn-IN',
  mr: 'mr-IN',
  gu: 'gu-IN',
  pa: 'pa-IN',
  en: 'en-IN',
  'ta-IN': 'ta-IN',
  'hi-IN': 'hi-IN',
  'te-IN': 'te-IN',
  'kn-IN': 'kn-IN',
  'ml-IN': 'ml-IN',
  'bn-IN': 'bn-IN',
  'mr-IN': 'mr-IN',
  'gu-IN': 'gu-IN',
  'pa-IN': 'pa-IN',
  'en-IN': 'en-IN',
  'en-US': 'en-IN',
};

export const LANGUAGE_MAP = LANGUAGE_LOCALE_MAP;

// Emergency Category Options with subtle visual identity
// 8 Direct Major Categories (visually simple, responsive, zero clutter)
export const EMERGENCY_CATEGORIES = [
  { id: 'FLOOD', label: 'Flood / Water', shortLabel: 'Flood', icon: 'water_damage', badge: '🌊' },
  { id: 'FIRE', label: 'Fire', shortLabel: 'Fire', icon: 'local_fire_department', badge: '🔥' },
  { id: 'MEDICAL', label: 'Medical', shortLabel: 'Medical', icon: 'medical_services', badge: '✚' },
  { id: 'BUILDING_COLLAPSE', label: 'Building Collapse', shortLabel: 'Building Collapse', icon: 'domain_disabled', badge: '🏚' },
  { id: 'STORM', label: 'Cyclone / Storm', shortLabel: 'Cyclone / Storm', icon: 'cyclone', badge: '🌪' },
  { id: 'EARTHQUAKE', label: 'Earthquake', shortLabel: 'Earthquake', icon: 'emergency_home', badge: '⚠' },
  { id: 'LANDSLIDE', label: 'Landslide', shortLabel: 'Landslide', icon: 'landscape', badge: '⛰️' },
  { id: 'OTHER', label: 'Other Hazard', shortLabel: 'Other', icon: 'warning', badge: '⚡' },
];

export const CATEGORIES = EMERGENCY_CATEGORIES;

// Secondary Hazard Taxonomy (India-Relevant / NDMA SACHET Domain Reference)
export const SECONDARY_HAZARD_CATEGORIES = [
  { id: 'TSUNAMI', label: 'Tsunami', badge: '🌊', icon: 'tsunami' },
  { id: 'AVALANCHE', label: 'Avalanche', badge: '❄️', icon: 'ac_unit' },
  { id: 'LIGHTNING', label: 'Lightning', badge: '⚡', icon: 'bolt' },
  { id: 'THUNDERSTORM', label: 'Thunderstorm / Squall', badge: '⛈️', icon: 'thunderstorm' },
  { id: 'DUSTSTORM', label: 'Duststorm', badge: '🌪️', icon: 'air' },
  { id: 'HEATWAVE', label: 'Heat Wave', badge: '☀️', icon: 'sunny' },
  { id: 'COLDWAVE', label: 'Cold Wave', badge: '🥶', icon: 'severe_cold' },
  { id: 'DROUGHT', label: 'Drought', badge: '🏜️', icon: 'water_loss' },
  { id: 'FOREST_FIRE', label: 'Forest Fire', badge: '🌲🔥', icon: 'forest' },
  { id: 'URBAN_FLOOD', label: 'Urban Flood', badge: '🏙️🌊', icon: 'location_city' },
  { id: 'CHEMICAL_EMERGENCY', label: 'Chemical Emergency', badge: '☣️', icon: 'science' },
  { id: 'BIOLOGICAL_EMERGENCY', label: 'Biological Emergency', badge: '🦠', icon: 'coronavirus' },
  { id: 'NUCLEAR_RADIOLOGICAL_EMERGENCY', label: 'Nuclear / Radiation', badge: '☢️', icon: 'radio' },
  { id: 'AIR_POLLUTION_SMOG', label: 'Air Pollution / Smog', badge: '🌫️', icon: 'foggy' },
  { id: 'OTHER', label: 'Other (Unlisted)', badge: '❓', icon: 'emergency' },
];

// Contextual mapping from Primary Category to relevant NDMA Secondary Hazards
export const CATEGORY_HAZARD_MAP = {
  FLOOD: ['URBAN_FLOOD', 'TSUNAMI', 'DROUGHT'],
  FIRE: ['FOREST_FIRE', 'CHEMICAL_EMERGENCY'],
  STORM: ['THUNDERSTORM', 'LIGHTNING', 'DUSTSTORM'],
  EARTHQUAKE: ['TSUNAMI', 'AVALANCHE'],
  LANDSLIDE: ['AVALANCHE'],
  BUILDING_COLLAPSE: ['CHEMICAL_EMERGENCY'],
  MEDICAL: ['BIOLOGICAL_EMERGENCY', 'HEATWAVE', 'COLDWAVE'],
  OTHER: [
    'HEATWAVE',
    'COLDWAVE',
    'DROUGHT',
    'CHEMICAL_EMERGENCY',
    'BIOLOGICAL_EMERGENCY',
    'NUCLEAR_RADIOLOGICAL_EMERGENCY',
    'AIR_POLLUTION_SMOG',
    'OTHER',
  ],
};

/**
 * Format duration in seconds to MM:SS string
 * @param {number} seconds
 * @returns {string} e.g. "00:08"
 */
export function formatTime(seconds = 0) {
  const totalSecs = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Resolves BCP47 language code for Web Speech API recognition
 */
export function resolveSpeechLanguage(selectedCode, detectedCode = null) {
  if (detectedCode) {
    return LANGUAGE_MAP[detectedCode] || detectedCode;
  }
  if (selectedCode && selectedCode !== 'AUTO') {
    return LANGUAGE_MAP[selectedCode] || selectedCode;
  }
  return '';
}

/**
 * Unicode Script Analysis & Verification Engine
 */
export function detectTranscriptScript(text = '') {
  if (!text || typeof text !== 'string') return { script: 'None', isNative: false, defaultLang: 'None', code: 'unknown' };
  if (/[\u0B80-\u0BFF]/.test(text)) return { script: 'Tamil', isNative: true, defaultLang: 'Tamil', code: 'ta-IN' };
  if (/[\u0900-\u097F]/.test(text)) return { script: 'Devanagari', isNative: true, defaultLang: 'Hindi', code: 'hi-IN' };
  if (/[\u0C00-\u0C7F]/.test(text)) return { script: 'Telugu', isNative: true, defaultLang: 'Telugu', code: 'te-IN' };
  if (/[\u0C80-\u0CFF]/.test(text)) return { script: 'Kannada', isNative: true, defaultLang: 'Kannada', code: 'kn-IN' };
  if (/[\u0D00-\u0D7F]/.test(text)) return { script: 'Malayalam', isNative: true, defaultLang: 'Malayalam', code: 'ml-IN' };
  if (/[\u0980-\u09FF]/.test(text)) return { script: 'Bengali', isNative: true, defaultLang: 'Bengali', code: 'bn-IN' };
  if (/[\u0A80-\u0AFF]/.test(text)) return { script: 'Gujarati', isNative: true, defaultLang: 'Gujarati', code: 'gu-IN' };
  if (/[\u0A00-\u0A7F]/.test(text)) return { script: 'Gurmukhi', isNative: true, defaultLang: 'Punjabi', code: 'pa-IN' };
  if (/[a-zA-Z]/.test(text)) return { script: 'Latin', isNative: false, defaultLang: 'English', code: 'en-IN' };
  return { script: 'Unknown', isNative: false, defaultLang: 'Unknown', code: 'unknown' };
}

/**
 * Automatic Language Detection Engine for Spoken Voice Telemetry
 */
export function detectSpokenLanguage(sampleText = '') {
  const text = (sampleText || '').trim();
  if (!text) {
    return { code: null, label: 'Language not detected', name: 'Language not detected', confidence: 0 };
  }

  // 1. Native Unicode Script Range Inspection
  const scriptInfo = detectTranscriptScript(text);
  if (scriptInfo.isNative) {
    return { code: scriptInfo.code, label: scriptInfo.defaultLang, name: scriptInfo.defaultLang, confidence: 0.99, script: scriptInfo.script };
  }

  // 2. Keyword & Phonetic Transliteration Signature Inspection
  const lower = text.toLowerCase();

  if (/\b(thanneer|thanni|kaapaaththen|kaapaathunga|thee|kaapango|maram|vanakkam|illai|kaapaadunga|eriyudhu|mazhai|vada|vanga|aama|amman|perumal|mudiyala|sarakku|veedu|kodu|varudhu|vannakam|velam|vellam|vellathil|vellathula|kapathu|sikkiyirukiren|neruppu|theepidithu|maatik|martik|non|naan)\b/i.test(lower)) {
    return { code: 'ta-IN', label: 'Tamil', name: 'Tamil', confidence: 0.95, script: 'Latin' };
  }

  if (/\b(paani|madad|bachao|aag|ghar|bhejo|samundar|pani|maddad|karo|jaldi|hai|bhai|sahayata|dukan|sadak|bada|chota|raha|hoga|gaya|gaye|lagi|fasa|phase|bachaye|baadh|doob)\b/i.test(lower)) {
    return { code: 'hi-IN', label: 'Hindi', name: 'Hindi', confidence: 0.95, script: 'Latin' };
  }

  if (/\b(sahayam|neeru|kaapaadandi|kaapandi|illu|manta|gaali|sahayamu|kapadandi|niru|vachindi|randi|ledu|emiti|ela|vachadu|nenu|unnadi|unnaru|varada|munigi|chikkuk)\b/i.test(lower)) {
    return { code: 'te-IN', label: 'Telugu', name: 'Telugu', confidence: 0.95, script: 'Latin' };
  }

  if (/\b(sahaya|neeru|kaapaadi|niru|kaapadi|mane|kedu|sahayavagi|banni|illa|yaake|enu|houdu|agide|madata|nanna|iddivi|idini|benki|pravaha|sikkikon)\b/i.test(lower)) {
    return { code: 'kn-IN', label: 'Kannada', name: 'Kannada', confidence: 0.95, script: 'Latin' };
  }

  if (/\b(sahayam|vellam|thee|sahayikkuka|veedu|sahayikku|varoo|illa|enthanu|evide|aano|poyi|valla|njan|pettupoyi|rakshikku|kudungi|mungi)\b/i.test(lower)) {
    return { code: 'ml-IN', label: 'Malayalam', name: 'Malayalam', confidence: 0.95, script: 'Latin' };
  }

  if (/\b(help|flood|water|fire|rescue|trapped|emergency|house|building|please|save|ambulance|police|danger|doctor|storm|earthquake|collapse|roof|rising|stuck|people|me|my|is|are|we|us|in|on|at|i am|there is)\b/i.test(lower)) {
    return { code: 'en-IN', label: 'English', name: 'English', confidence: 0.92, script: 'Latin' };
  }

  return { code: null, label: 'Language not detected', name: 'Language not detected', confidence: 0, script: 'Latin' };
}

export function getLanguageDisplayLabel(bcp47Input) {
  const code = typeof bcp47Input === 'object' && bcp47Input !== null ? bcp47Input.code || bcp47Input.locale || '' : String(bcp47Input || '');
  switch (code) {
    case 'ta-IN':
    case 'Tamil':
      return 'Tamil';
    case 'hi-IN':
    case 'Hindi':
      return 'Hindi';
    case 'te-IN':
    case 'Telugu':
      return 'Telugu';
    case 'kn-IN':
    case 'Kannada':
      return 'Kannada';
    case 'ml-IN':
    case 'Malayalam':
      return 'Malayalam';
    case 'bn-IN':
    case 'Bengali':
      return 'Bengali';
    case 'mr-IN':
    case 'Marathi':
      return 'Marathi';
    case 'gu-IN':
    case 'Gujarati':
      return 'Gujarati';
    case 'pa-IN':
    case 'Punjabi':
      return 'Punjabi';
    case 'en-US':
    case 'en-IN':
    case 'English':
      return 'English';
    default:
      if (!code || code === 'AUTO') {
        return 'Auto Detect';
      }
      return code;
  }
}

export default function EmergencyReportModal({ isOpen = true, isModal = true, onClose, onSubmitted, clientRequestId = null }) {
  const { citizenUser, isCitizenGuest } = useAuth();
  const { currentLanguage, activeLanguageObj } = useLanguage();
  const { settings, sosCountdownSeconds } = useSettings();

  // SOS Page 3-State Flow: 'READY' | 'COUNTDOWN' | 'DETAILS'
  const [sosPageState, setSosPageState] = useState(!isModal ? 'READY' : 'DETAILS');
  const [countdownRemaining, setCountdownRemaining] = useState(null);
  const countdownIntervalRef = useRef(null);
  const detailsSectionRef = useRef(null);

  // 1. ALL REACT HOOKS DECLARED UNCONDITIONALLY AT VERY TOP LEVEL
  const [primaryCategory, setPrimaryCategory] = useState('FLOOD');
  const [category, setCategory] = useState('FLOOD');
  const [description, setDescription] = useState('');
  const [selectedVoiceLanguage, setSelectedVoiceLanguage] = useState('AUTO');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [speechError, setSpeechError] = useState('');
  const [detectedLanguageInfo, setDetectedLanguageInfo] = useState(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState('');
  const [justSelectedCategory, setJustSelectedCategory] = useState(null);
  const [showSpecificHazards, setShowSpecificHazards] = useState(false);
  const [showAllHazards, setShowAllHazards] = useState(false);

  // Media references & transient storage (Ref-driven architecture for low-overhead audio processing)
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef('');
  const interimTranscriptRef = useRef('');
  const selectedLanguageRef = useRef(selectedVoiceLanguage);
  const recordingRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingSessionIdRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const audioObjectUrlRef = useRef(null);
  const isSubmittingRef = useRef(false);
  const submitTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const recordedAudioRef = useRef(null);

  // Photo & GPS Telemetry State
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoBase64, setPhotoBase64] = useState('');
  const [gpsData, setGpsData] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem('resonix_last_gps');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.latitude != null && parsed?.longitude != null) {
            return {
              latitude: Number(parsed.latitude),
              longitude: Number(parsed.longitude),
              accuracy: Number(parsed.accuracy) || 10,
              status: 'GPS_AVAILABLE',
            };
          }
        }
      }
    } catch (_) {}
    return {
      latitude: null,
      longitude: null,
      accuracy: null,
      status: 'ACQUIRING_GPS',
    };
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  // Recording Timer
  useEffect(() => {
    let interval = null;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  // Clean up countdown interval on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, []);

  // Reset all state when modal closes
  useEffect(() => {
    if (isModal && !isOpen) {
      recordingSessionIdRef.current = null;
      isSubmittingRef.current = false;
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
        submitTimeoutRef.current = null;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.stop();
        } catch (_) {}
        recognitionRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch (_) {}
      }
      if (mediaRecorderRef.current?.stream) {
        try { mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop()); } catch (_) {}
      }
      if (audioPlayerRef.current) {
        try {
          audioPlayerRef.current.pause();
          audioPlayerRef.current.currentTime = 0;
        } catch (_) {}
        audioPlayerRef.current = null;
      }
      if (audioObjectUrlRef.current) {
        try { URL.revokeObjectURL(audioObjectUrlRef.current); } catch (_) {}
        audioObjectUrlRef.current = null;
      }
      setIsRecording(false);
      setIsProcessingVoice(false);
      setRecordedAudio(null);
      setIsPlayingAudio(false);
      setLiveTranscript('');
      setEditedTranscript('');
      finalTranscriptRef.current = '';
      setIsEditingTranscript(false);
      setShowTranscript(false);
      setSpeechError('');
      setDetectedLanguageInfo(null);
      setRecordSeconds(0);
      setSelectedPhoto(null);
      setPhotoPreview(null);
      setPhotoBase64('');
      setDescription('');
      setSubmitting(false);
      setSubmitMessage('');
      setShowSpecificHazards(false);
      setShowAllHazards(false);
    }
  }, [isOpen, isModal]);

  // Capture real GPS snapshot on modal mount with error/permission-denial resilience
  useEffect(() => {
    if ((isOpen || !isModal) && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const snapshot = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy * 10) / 10,
            status: 'GPS_AVAILABLE',
          };
          setGpsData(snapshot);
          try {
            localStorage.setItem('resonix_last_gps', JSON.stringify(snapshot));
          } catch (_) {}
        },
        (err) => {
          console.warn('[EmergencyReportModal] Geolocation unavailable or permission denied:', err?.message);
          setGpsData((prev) => {
            if (prev?.latitude != null && prev?.longitude != null) {
              return { ...prev, status: 'LAST_KNOWN_OFFLINE' };
            }
            return {
              latitude: null,
              longitude: null,
              accuracy: null,
              status: err?.code === 1 ? 'GPS_PERMISSION_DENIED' : 'GPS_UNAVAILABLE',
            };
          });
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 }
      );
    }
  }, [isOpen]);

  // Start Voice Recording with Web Speech API and MediaRecorder
  const startRecording = async () => {
    const newSessionId = `rec_sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    recordingSessionIdRef.current = newSessionId;

    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      } catch (_) {}
      audioPlayerRef.current = null;
    }
    if (audioObjectUrlRef.current) {
      try { URL.revokeObjectURL(audioObjectUrlRef.current); } catch (_) {}
      audioObjectUrlRef.current = null;
    }

    setIsRecording(true);
    setIsProcessingVoice(false);
    setRecordedAudio(null);
    setIsPlayingAudio(false);
    setLiveTranscript('');
    setEditedTranscript('');
    finalTranscriptRef.current = '';
    setSpeechError('');
    setRecordSeconds(0);
    setShowTranscript(true);

    // 1. Resolve BCP47 Speech Recognition Locale
    let targetLocale = 'ta-IN';
    if (selectedVoiceLanguage && selectedVoiceLanguage !== 'AUTO') {
      targetLocale = LANGUAGE_LOCALE_MAP[selectedVoiceLanguage] || selectedVoiceLanguage;
    } else if (currentLanguage && currentLanguage !== 'en') {
      targetLocale = LANGUAGE_LOCALE_MAP[currentLanguage] || 'ta-IN';
    } else {
      targetLocale = 'ta-IN';
    }

    // 2. Stop any existing SpeechRecognition instance
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch (_) {}
      recognitionRef.current = null;
    }

    // 3. Initialize Web Speech API SpeechRecognition
    const SpeechRec = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
    if (SpeechRec) {
      try {
        const rec = new SpeechRec();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = targetLocale;
        rec.maxAlternatives = 1;

        rec.onresult = (event) => {
          let interim = '';
          let final = '';
          for (let i = 0; i < event.results.length; i++) {
            const item = event.results[i];
            const transcriptText = item[0]?.transcript || '';
            if (item.isFinal) {
              final += transcriptText + ' ';
            } else {
              interim += transcriptText;
            }
          }
          finalTranscriptRef.current = final.trim();
          const display = (final + (interim ? ' ' + interim : '')).trim();
          if (display) {
            setLiveTranscript(display);
            setEditedTranscript(display);
            setShowTranscript(true);
            const detected = detectSpokenLanguage(display);
            if (detected && detected.name !== 'Language not detected') {
              setDetectedLanguageInfo(detected);
            }
          }
        };

        rec.onerror = (event) => {
          console.warn('[Web Speech API error]:', event.error);
          if (event.error === 'not-allowed' || event.error === 'permission-denied') {
            setSpeechError('Microphone permission denied. You can try again or type your emergency.');
          } else if (event.error === 'no-speech') {
            // Normal pause, keep listening
          } else if (event.error === 'audio-capture') {
            setSpeechError('Microphone audio capture failed. Please check your microphone.');
          } else if (event.error !== 'aborted') {
            if (!finalTranscriptRef.current) {
              setSpeechError('Voice could not be captured. You can try again or type your emergency.');
            }
          }
        };

        rec.start();
        recognitionRef.current = rec;
      } catch (recErr) {
        console.warn('[EmergencyReportModal] SpeechRecognition start error:', recErr.message);
      }
    }

    // 4. MediaRecorder stream for audio playback and backup
    audioChunksRef.current = [];
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        let mimeType = 'audio/webm';
        if (typeof MediaRecorder !== 'undefined') {
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus';
          } else if (MediaRecorder.isTypeSupported('audio/webm')) {
            mimeType = 'audio/webm';
          } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4';
          }

          const mediaRecorder = new MediaRecorder(stream, { mimeType });
          mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
              audioChunksRef.current.push(event.data);
            }
          };
          mediaRecorder.start(200);
          mediaRecorderRef.current = mediaRecorder;
        }
      } catch (micErr) {
        console.warn('[MediaRecorder] Microphone access notice:', micErr.message);
      }
    }
  };

  // Stop Voice Recording & Process Native Report (Instant, non-blocking)
  const stopRecording = async () => {
    const currentSessionId = recordingSessionIdRef.current;
    setIsRecording(false);

    // 1. Stop Web Speech API recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }

    // 2. Stop MediaRecorder
    let audioBlob = null;
    let audioMimeType = 'audio/webm';
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      audioMimeType = mediaRecorderRef.current.mimeType || 'audio/webm';
      await new Promise((resolve) => {
        mediaRecorderRef.current.onstop = resolve;
        mediaRecorderRef.current.stop();
      });
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      }
    }

    if (audioChunksRef.current.length > 0) {
      audioBlob = new Blob(audioChunksRef.current, { type: audioMimeType });
      if (audioBlob.size > 0) {
        if (audioObjectUrlRef.current) {
          try { URL.revokeObjectURL(audioObjectUrlRef.current); } catch (_) {}
        }
        try {
          audioObjectUrlRef.current = URL.createObjectURL(audioBlob);
        } catch (_) {}
      }
    }

    let base64Audio = '';
    if (audioBlob) {
      base64Audio = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(audioBlob);
      });
    }

    const duration = recordSeconds || 5;
    const finalNativeText = (finalTranscriptRef.current || liveTranscript || editedTranscript || '').trim();

    if (recordingSessionIdRef.current !== currentSessionId) {
      setIsProcessingVoice(false);
      return;
    }

    const selectedVoiceLangName = selectedVoiceLanguage !== 'AUTO' ? getLanguageDisplayLabel(selectedVoiceLanguage) : (activeLanguageObj?.name || 'Tamil');
    const selectedVoiceCode = LANGUAGE_LOCALE_MAP[selectedVoiceLangName] || 'ta-IN';

    // If Web Speech API returned transcript, process script and quality immediately!
    if (finalNativeText && finalNativeText.length > 0) {
      const scriptInfo = detectTranscriptScript(finalNativeText);
      const detected = detectSpokenLanguage(finalNativeText);
      const detectedLangName = scriptInfo.isNative ? scriptInfo.defaultLang : (detected.name && detected.name !== 'Language not detected' ? detected.name : selectedVoiceLangName);
      const transcriptQuality = scriptInfo.isNative ? 'NATIVE' : (selectedVoiceLangName !== 'English' ? 'ROMANIZED' : 'LATIN');

      setLiveTranscript(finalNativeText);
      setEditedTranscript(finalNativeText);
      setShowTranscript(true);
      setDetectedLanguageInfo({
        language: detectedLangName,
        name: detectedLangName,
        code: scriptInfo.code || detected.code || selectedVoiceCode,
        confidence: scriptInfo.isNative ? 0.99 : 0.95,
        script: scriptInfo.script,
        quality: transcriptQuality,
      });

      const readyAudio = {
        hasAudio: true,
        durationSeconds: duration,
        audioId: `rec_${Date.now()}`,
        dataUrl: base64Audio,
        originalTranscript: finalNativeText,
        speechRecognitionTranscript: finalNativeText,
        transcriptScript: scriptInfo.script,
        transcriptQuality,
        selectedVoiceLanguage: selectedVoiceLangName,
        selectedVoiceLanguageCode: selectedVoiceCode,
        transcript: finalNativeText,
        voiceTranscript: finalNativeText,
        originalVoiceTranscript: finalNativeText,
        translatedTranscript: null,
        englishTranslation: null,
        language: detectedLangName,
        detectedLanguage: detectedLangName,
      };

      recordedAudioRef.current = readyAudio;
      setRecordedAudio(readyAudio);
      setIsProcessingVoice(false); // Instant release - zero blocking

      // Asynchronously query authoritative backend STT on actual audio recording (NEVER blocks SEND SOS)
      if (base64Audio) {
        (async () => {
          try {
            const apiBaseUrl = resolveConfiguredApiBaseUrl();

            const resp = await fetch(`${apiBaseUrl}/emergency/transcribe`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                audioData: base64Audio,
                mimeType: audioMimeType || 'audio/webm',
                durationSeconds: duration,
                languageHint: selectedVoiceCode || (selectedVoiceLanguage !== 'AUTO' ? selectedVoiceLanguage : 'ta-IN'),
                transcript: finalNativeText,
              }),
            });

            if (recordingSessionIdRef.current !== currentSessionId) return;

            if (resp.ok) {
              const data = await resp.json();
              const authoritativeNative = (data.nativeScriptTranscript || data.originalTranscript || data.transcript || '').trim();
              const officialLang = (data.language && data.language !== 'Unknown') ? data.language : detectedLangName;
              const officialCode = data.languageCode || scriptInfo.code || selectedVoiceCode;
              const officialScript = data.script || scriptInfo.script;

              if (authoritativeNative && authoritativeNative.length > 0) {
                setLiveTranscript(authoritativeNative);
                setEditedTranscript(authoritativeNative);
                setShowTranscript(true);

                setDetectedLanguageInfo({
                  language: officialLang,
                  name: officialLang,
                  code: officialCode,
                  confidence: data.confidence || 0.98,
                  script: officialScript,
                  quality: data.nativeScriptTranscript ? 'NATIVE' : transcriptQuality,
                });

                setRecordedAudio((prev) => {
                  if (!prev) return prev;
                  const updated = {
                    ...prev,
                    originalTranscript: authoritativeNative,
                    nativeScriptTranscript: data.nativeScriptTranscript || authoritativeNative,
                    transcript: authoritativeNative,
                    voiceTranscript: authoritativeNative,
                    originalVoiceTranscript: authoritativeNative,
                    speechRecognitionTranscript: finalNativeText,
                    language: officialLang,
                    detectedLanguage: officialLang,
                    selectedVoiceLanguageCode: officialCode,
                    transcriptScript: officialScript,
                    transcriptQuality: data.nativeScriptTranscript ? 'NATIVE' : transcriptQuality,
                    englishTranslation: data.englishTranslation || prev.englishTranslation || null,
                    translatedTranscript: data.englishTranslation || prev.translatedTranscript || null,
                    normalizedMeaning: data.normalizedMeaning || null,
                  };
                  recordedAudioRef.current = updated;
                  return updated;
                });
              }
            }
          } catch (_) {}
        })();
      }
      return;
    }

    // If Web Speech API produced no text (e.g. mobile browser or regional dialect):
    // IMMEDIATELY set recorded audio so SEND SOS is unblocked and audio is ready!
    const immediateAudio = {
      hasAudio: true,
      durationSeconds: duration,
      audioId: `rec_${Date.now()}`,
      dataUrl: base64Audio,
      originalTranscript: '',
      transcript: '',
      voiceTranscript: '',
      originalVoiceTranscript: '',
      language: selectedVoiceLangName || 'Voice Recorded',
      detectedLanguage: selectedVoiceLangName || 'Voice Recorded',
      selectedVoiceLanguage: selectedVoiceLangName,
      selectedVoiceLanguageCode: selectedVoiceCode,
    };
    recordedAudioRef.current = immediateAudio;
    setRecordedAudio(immediateAudio);
    setIsProcessingVoice(false); // Released immediately - zero blocking

    // Asynchronously query backend STT strictly in background (NEVER blocks SEND SOS!)
    if (base64Audio) {
      (async () => {
        try {
          setIsProcessingVoice(true); // subtle background indicator
          const apiBaseUrl = resolveConfiguredApiBaseUrl();

          const resp = await fetch(`${apiBaseUrl}/emergency/transcribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioData: base64Audio,
              mimeType: audioMimeType,
              durationSeconds: duration,
              languageHint: selectedVoiceLanguage !== 'AUTO' ? selectedVoiceLanguage : null,
            }),
          });

          if (recordingSessionIdRef.current !== currentSessionId) return;

          if (resp.ok) {
            const data = await resp.json();
            const officialTranscript = (data.originalTranscript || data.transcript || '').trim();

            if (officialTranscript && officialTranscript.length > 0) {
              setLiveTranscript(officialTranscript);
              setEditedTranscript(officialTranscript);
              setShowTranscript(true);

              const detected = detectSpokenLanguage(officialTranscript);
              const officialLang = (data.language && data.language !== 'Unknown' && data.language !== 'Unknown Language')
                ? data.language
                : (detected.name !== 'Language not detected' ? detected.name : 'Not detected');

              setDetectedLanguageInfo({
                language: officialLang,
                name: officialLang,
                code: data.languageCode || detected.code || 'unknown',
                confidence: data.confidence || detected.confidence || 0.98,
              });

              setRecordedAudio((prev) => {
                if (!prev) return prev;
                const updated = {
                  ...prev,
                  originalTranscript: officialTranscript,
                  transcript: officialTranscript,
                  voiceTranscript: officialTranscript,
                  originalVoiceTranscript: officialTranscript,
                  translatedTranscript: data.englishTranslation || null,
                  englishTranslation: data.englishTranslation || null,
                  language: officialLang,
                  detectedLanguage: officialLang,
                };
                recordedAudioRef.current = updated;
                return updated;
              });
            }
          }
        } catch (_) {} finally {
          if (recordingSessionIdRef.current === currentSessionId) {
            setIsProcessingVoice(false);
          }
        }
      })();
    }
  };

  const setAudioFallback = (base64Audio, duration) => {
    const text = editedTranscript || '';
    setShowTranscript(true);
    const fallbackObj = {
      hasAudio: true,
      durationSeconds: duration,
      audioId: `rec_${Date.now()}`,
      dataUrl: base64Audio,
      originalTranscript: text,
      transcript: text,
      voiceTranscript: text,
      language: 'Voice Recorded',
      detectedLanguage: 'Voice Recorded',
    };
    recordedAudioRef.current = fallbackObj;
    setRecordedAudio(fallbackObj);
  };

  const deleteRecording = () => {
    recordingSessionIdRef.current = null;
    recordedAudioRef.current = null;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (_) {}
    }
    if (mediaRecorderRef.current?.stream) {
      try { mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop()); } catch (_) {}
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
      recognitionRef.current = null;
    }
    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      } catch (_) {}
      audioPlayerRef.current = null;
    }
    if (audioObjectUrlRef.current) {
      try { URL.revokeObjectURL(audioObjectUrlRef.current); } catch (_) {}
      audioObjectUrlRef.current = null;
    }
    setIsPlayingAudio(false);
    audioChunksRef.current = [];
    setIsRecording(false);
    setIsProcessingVoice(false);
    setRecordSeconds(0);
    setRecordedAudio(null);
    setLiveTranscript('');
    setEditedTranscript('');
    setIsEditingTranscript(false);
    setShowTranscript(false);
    setSpeechError('');
    setDetectedLanguageInfo(null);
  };

  const togglePlayAudio = () => {
    const audioSrc = audioObjectUrlRef.current || recordedAudio?.dataUrl;
    if (!audioSrc) return;

    if (isPlayingAudio && audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setIsPlayingAudio(false);
      return;
    }

    if (!audioPlayerRef.current) {
      const player = new Audio(audioSrc);
      player.onended = () => setIsPlayingAudio(false);
      player.onerror = () => setIsPlayingAudio(false);
      audioPlayerRef.current = player;
    }
    audioPlayerRef.current.play().then(() => {
      setIsPlayingAudio(true);
    }).catch(() => {
      setIsPlayingAudio(false);
    });
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));

      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoBase64(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setSelectedPhoto(null);
    setPhotoPreview(null);
    setPhotoBase64('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    // Clean up any running countdown timer immediately
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdownRemaining(null);

    if (isSubmittingRef.current || submitting) {
      return;
    }

    const t_sosClick = performance.now();
    isSubmittingRef.current = true;
    setSubmitting(true);
    setSubmitMessage('🚨 Sending SOS...');

    let packet;
    try {
      if (isRecording) {
        try {
          if (recognitionRef.current) recognitionRef.current.stop();
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
        } catch (_) {}
        setIsRecording(false);
      }

      const activeAudio = recordedAudio || recordedAudioRef.current;
      const finalNative = activeAudio?.nativeScriptTranscript || null;
      const finalTranscript = (editedTranscript || finalNative || activeAudio?.originalTranscript || activeAudio?.voiceTranscript || activeAudio?.transcript || finalTranscriptRef.current || liveTranscript || '').trim();
      const activeReqId = clientRequestId || `RESONIX-SOS-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // Instant cached GPS check (zero blocking - uses existing in-memory / ref / localStorage snapshot)
      let activeGps = gpsData;
      if (!activeGps || activeGps.latitude == null) {
        try {
          const cached = localStorage.getItem('resonix_last_gps');
          if (cached) activeGps = JSON.parse(cached);
        } catch (_) {}
      }
      const t_gpsReady = performance.now();

      // 1. Build MINIMAL FAST SOS PAYLOAD (Includes instant voice transcript if recorded)
      const fastPayload = buildFastSosPayload({
        category: category || 'GENERAL_EMERGENCY',
        selectedCategory: category,
        citizenSelectedCategory: category,
        description: description || finalTranscript || `${category} emergency SOS report`,
        transcript: finalTranscript,
        voiceTranscript: finalTranscript,
        originalTranscript: finalTranscript,
        nativeScriptTranscript: finalNative,
        speechRecognitionTranscript: activeAudio?.speechRecognitionTranscript || finalTranscriptRef.current || '',
        englishTranslation: activeAudio?.englishTranslation || null,
        selectedVoiceLanguage: selectedVoiceLanguage !== 'AUTO' ? getLanguageDisplayLabel(selectedVoiceLanguage) : (activeLanguageObj?.name || 'Tamil'),
        selectedVoiceLanguageCode: LANGUAGE_LOCALE_MAP[selectedVoiceLanguage] || 'ta-IN',
        audio: activeAudio,
        gps: activeGps,
        clientRequestId: activeReqId,
        packetId: activeReqId,
      });
      const t_payloadReady = performance.now();

      // Keep full packet structure in memory for UI & offline local storage compatibility
      packet = buildEmergencyPacket({
        category: category,
        selectedCategory: category,
        citizenSelectedCategory: category,
        description: description || finalTranscript,
        transcript: finalTranscript,
        gps: activeGps,
        user: isCitizenGuest ? null : citizenUser,
        clientRequestId: activeReqId,
      });
      packet.clientRequestId = activeReqId;
      packet.category = category;
      packet.originalTranscript = finalTranscript;

      // 2. Submit Fast SOS payload to backend API immediately (with 4000ms short timeout)
      const t_apiStart = performance.now();
      const result = await transmitPacketToBackend(fastPayload, citizenApi.sendSOS, { timeout: 4000 });
      const t_apiEnd = performance.now();

      console.log('⏱️ [PERF AUDIT — CITIZEN SOS CRITICAL PATH]');
      console.log(`  • SOS_CLICK       → GPS_READY:         ${(t_gpsReady - t_sosClick).toFixed(2)} ms`);
      console.log(`  • GPS_READY       → PAYLOAD_READY:     ${(t_payloadReady - t_gpsReady).toFixed(2)} ms`);
      console.log(`  • PAYLOAD_READY   → API_REQUEST_START: ${(t_apiStart - t_payloadReady).toFixed(2)} ms`);
      console.log(`  • API_START       → API_END:           ${(t_apiEnd - t_apiStart).toFixed(2)} ms (HTTP RTT)`);
      console.log(`  • TOTAL SOS_CLICK → API_CONFIRMED:     ${(t_apiEnd - t_sosClick).toFixed(2)} ms`);

      const isOnlineSuccess = Boolean(
        result &&
          !result.offline &&
          (result.status === 'success' ||
            result.statusCode === 201 ||
            result.statusCode === 200 ||
            result.data?.success ||
            result.success)
      );

      if (result?.offline || !isOnlineSuccess) {
        setSubmitMessage('⚡ SOS SAVED LOCALLY. Report stored safely and will be sent when connection is available.');
      } else {
        setSubmitMessage('🚨 SOS SENT. Your emergency report has been sent to the responder center.');
      }
      setTimeout(() => {
        setSubmitMessage('');
      }, 6000);

      onSubmitted?.(packet, { ...result, isOnlineSuccess });

      // 3. Asynchronous Non-Blocking Follow-up Enrichment (Photo & Voice evidence)
      // Dispatched in background — NEVER delays initial SOS submission!
      const hasFollowupEvidence = Boolean(selectedPhoto || finalTranscript || recordedAudio);
      if (isOnlineSuccess && hasFollowupEvidence) {
        setTimeout(async () => {
          try {
            const enrichPayload = {};
            if (finalTranscript) {
              enrichPayload.originalTranscript = finalTranscript;
              enrichPayload.voiceTranscript = finalTranscript;
              enrichPayload.selectedVoiceLanguage = selectedVoiceLanguage !== 'AUTO' ? getLanguageDisplayLabel(selectedVoiceLanguage) : (activeLanguageObj?.name || 'Tamil');
            }
            if (selectedPhoto && photoBase64) {
              enrichPayload.photoReference = {
                hasPhoto: true,
                photoId: `photo_${Date.now()}`,
                dataUrl: photoBase64,
                formattedSize: `${(selectedPhoto.size / 1024).toFixed(0)} KB`,
              };
            }
            await citizenApi.enrichEmergency(activeReqId, enrichPayload);
          } catch (eErr) {
            console.debug('[EmergencyReportModal] Background enrichment note:', eErr.message);
          }
        }, 50);
      }

      if (submitTimeoutRef.current) clearTimeout(submitTimeoutRef.current);
      submitTimeoutRef.current = setTimeout(() => {
        isSubmittingRef.current = false;
        setSubmitting(false);
        if (isModal) {
          onClose?.();
        }
      }, 500);
    } catch (err) {
      console.warn('[EmergencyReportModal] Submit notice:', err.message);
      setSubmitMessage('⚡ SOS SAVED LOCALLY. Stored on device for dispatch.');
      if (packet) onSubmitted?.(packet, { offline: true, isOnlineSuccess: false, error: err.message });
      if (submitTimeoutRef.current) clearTimeout(submitTimeoutRef.current);
      submitTimeoutRef.current = setTimeout(() => {
        isSubmittingRef.current = false;
        setSubmitting(false);
        if (isModal) {
          onClose?.();
        }
      }, 500);
    }
  };

  const handleCancelCountdown = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdownRemaining(null);
    setSubmitMessage('');
    // Accidental-tap cancelled: Return to normal SOS screen with red SOS button
    setSosPageState('READY');
  };

  const handleRedSosPress = () => {
    if (submitting || isSubmittingRef.current) return;

    // Clear any stale feedback messages from previous attempts
    setSubmitMessage('');

    // Apply configured timer
    const timerSecs = typeof sosCountdownSeconds === 'number' ? sosCountdownSeconds : 0;

    if (timerSecs > 0) {
      // Step 2 & 3: Immediately enter accidental-tap protection COUNTDOWN state
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }

      setSosPageState('COUNTDOWN');
      setCountdownRemaining(timerSecs);

      countdownIntervalRef.current = setInterval(() => {
        setCountdownRemaining((prev) => {
          if (prev === null || prev <= 1) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            setCountdownRemaining(null);
            // Step 4: Timer reaches zero -> DO NOT SUBMIT! Show What happened? form!
            setSosPageState('DETAILS');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      // Timer is NONE: Skip countdown, immediately show "What happened?" form with manual send
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setCountdownRemaining(null);
      setSosPageState('DETAILS');
    }
  };

  if (isModal && !isOpen) return null;

  const isGpsReady = gpsData?.latitude != null && gpsData?.longitude != null;

  // Derive relevant secondary hazards based on selected primary category
  const relevantHazardIds = CATEGORY_HAZARD_MAP[primaryCategory] || [];
  const relevantHazards = showAllHazards
    ? SECONDARY_HAZARD_CATEGORIES
    : SECONDARY_HAZARD_CATEGORIES.filter((s) => relevantHazardIds.includes(s.id));
  const activeHazard = SECONDARY_HAZARD_CATEGORIES.find((s) => s.id === category);
  const isSpecificSelected = category !== primaryCategory && activeHazard != null;

  const renderEmergencyDetails = () => (
    <>
      {/* ============================================================ */}
          {/* 2. EMERGENCY CATEGORY SELECTION (2-Column Grid) */}
          {/* ============================================================ */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-primary text-xs block">
                What happened?
              </label>
              {isSpecificSelected && (
                <span className="text-[10.5px] text-secondary font-semibold">
                  Specific: {activeHazard.label} {activeHazard.badge}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => {
                const isSelected = primaryCategory === cat.id;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setPrimaryCategory(cat.id);
                      setCategory(cat.id);
                      setShowSpecificHazards(false);
                      setShowAllHazards(false);
                      setJustSelectedCategory(cat.id);
                      setTimeout(() => setJustSelectedCategory(null), 250);
                    }}
                    className={`p-2 sm:p-2.5 rounded-xl border text-left flex items-center justify-between gap-1.5 transition-all cursor-pointer min-h-[46px] active:scale-[0.98] ${
                      justSelectedCategory === cat.id ? 'animate-category-confirm' : ''
                    } ${
                      isSelected
                        ? 'bg-secondary text-white border-secondary font-bold shadow-sm ring-1 ring-secondary'
                        : 'bg-surface-container hover:bg-surface-container-high border-outline-variant/60 text-primary'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                      <span className="material-symbols-outlined text-lg shrink-0">{cat.icon}</span>
                      <span className="text-[11px] sm:text-xs font-bold leading-tight line-clamp-2">
                        {cat.shortLabel || cat.label}
                      </span>
                    </div>
                    <span className="text-sm shrink-0 select-none opacity-90 ml-0.5">{cat.badge}</span>
                  </button>
                );
              })}
            </div>

            {/* PROGRESSIVE DISCLOSURE: Specific Disaster / Hazard Type */}
            <div className="pt-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-on-surface-variant">
                  More specific? (Optional)
                </span>
                {isSpecificSelected && (
                  <button
                    type="button"
                    onClick={() => setCategory(primaryCategory)}
                    className="text-[10px] font-bold text-secondary hover:underline cursor-pointer flex items-center gap-0.5"
                  >
                    <span>Reset to {CATEGORIES.find((c) => c.id === primaryCategory)?.shortLabel}</span>
                    <span className="material-symbols-outlined text-xs">close</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowSpecificHazards((prev) => !prev)}
                className="mt-1 w-full py-2 px-3 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/60 text-primary text-xs font-semibold flex items-center justify-between cursor-pointer transition-all active:scale-[0.99]"
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="material-symbols-outlined text-base text-secondary shrink-0">
                    {showSpecificHazards ? 'expand_less' : 'tune'}
                  </span>
                  <span className="truncate">
                    {isSpecificSelected
                      ? `Specific: ${activeHazard.label} ${activeHazard.badge}`
                      : '+ Choose specific hazard'}
                  </span>
                </span>
                <span className="text-[10.5px] text-secondary font-bold shrink-0 ml-2">
                  {showSpecificHazards ? 'Hide' : 'Expand'}
                </span>
              </button>

              {showSpecificHazards && (
                <div className="mt-2 p-2.5 rounded-xl bg-surface-container-high border border-secondary/30 space-y-2 animate-fade-in">
                  {primaryCategory === 'OTHER' && (
                    <p className="text-[11px] text-on-surface-variant">
                      Tell responders what happened in voice or text below, or select an unlisted disaster:
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-1.5">
                    {relevantHazards.map((sub) => {
                      const isSubSelected = category === sub.id;
                      const resolvedIcon = sub.icon === 'radioactive' ? 'radio' : sub.icon;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            setCategory(sub.id);
                            setJustSelectedCategory(sub.id);
                            setTimeout(() => setJustSelectedCategory(null), 250);
                          }}
                          className={`p-2 rounded-lg border text-left flex items-center justify-between gap-1 transition-all cursor-pointer min-h-[38px] active:scale-[0.98] ${
                            isSubSelected
                              ? 'bg-secondary text-white border-secondary font-bold shadow-xs'
                              : 'bg-surface hover:bg-surface-container border-outline-variant/50 text-primary'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="material-symbols-outlined text-xs shrink-0 select-none">{resolvedIcon}</span>
                            <span className="text-[10.5px] sm:text-[11px] font-medium leading-tight line-clamp-2">
                              {sub.label}
                            </span>
                          </div>
                          <span className="text-xs shrink-0 select-none ml-0.5">{sub.badge}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-1 flex items-center justify-between text-[10.5px]">
                    <button
                      type="button"
                      onClick={() => setShowAllHazards((prev) => !prev)}
                      className="text-secondary hover:underline font-semibold cursor-pointer"
                    >
                      {showAllHazards ? '← Show category hazards' : '+ View all 15 hazard choices'}
                    </button>
                    {isSpecificSelected && (
                      <span className="text-on-surface-variant font-medium">
                        Selected: <strong className="text-secondary">{activeHazard.label}</strong>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ============================================================ */}
          {/* 3. VOICE INPUT (Optional) */}
          {/* ============================================================ */}
          <div className="pt-3 border-t border-outline-variant/40 space-y-2">
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="material-symbols-outlined text-base text-secondary shrink-0">mic</span>
                <span className="font-bold text-primary text-xs">Voice message</span>
                <span className="text-[10px] text-on-surface-variant font-normal">(Optional)</span>
              </div>
              {/* Voice Language Selector */}
              {!isRecording && !recordedAudio && (
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-on-surface-variant">Lang:</span>
                  <select
                    value={selectedVoiceLanguage}
                    onChange={(e) => setSelectedVoiceLanguage(e.target.value)}
                    aria-label="Voice language"
                    className="px-1.5 py-0.5 rounded bg-surface border border-outline-variant/60 text-[10px] font-bold text-secondary focus:outline-none focus:border-secondary cursor-pointer max-w-[95px] truncate"
                  >
                    {VOICE_LANGUAGES.map((v) => (
                      <option key={v.code} value={v.code}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {detectedLanguageInfo && (
                <span className="text-[10px] font-mono text-secondary font-bold shrink-0">
                  {detectedLanguageInfo.name}
                </span>
              )}
            </div>

            {speechError && (
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-[11px] font-semibold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm shrink-0">info</span>
                <span>{speechError}</span>
              </div>
            )}

            {/* Start Recording Button */}
            {!isRecording && !isProcessingVoice && !recordedAudio && (
              <button
                type="button"
                onClick={startRecording}
                className="w-full p-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/60 flex items-center justify-center gap-2 text-primary font-bold text-xs cursor-pointer active:scale-[0.99] transition-all min-h-[44px]"
              >
                <span className="material-symbols-outlined text-lg text-secondary">mic</span>
                <span>Start Voice Recording</span>
              </button>
            )}

            {/* Active Recording State */}
            {isRecording && (
              <div className="p-2.5 rounded-xl bg-error/10 border border-error/30 flex items-center justify-between gap-2 animate-fade-in">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-error animate-pulse shrink-0" />
                  <span className="font-bold text-error text-xs">Listening...</span>
                  <span className="font-mono font-bold text-primary text-xs">{formatTime(recordSeconds)}</span>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={stopRecording}
                  className="bg-error hover:brightness-110 font-bold text-xs px-3 py-1.5 min-h-[34px]"
                >
                  Stop Recording
                </Button>
              </div>
            )}

            {/* Processing Voice State */}
            {isProcessingVoice && (
              <div className="p-2.5 rounded-xl bg-secondary/10 border border-secondary/30 flex items-center gap-2 text-secondary text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-secondary animate-pulse shrink-0" />
                <span>AI transcribing voice in background...</span>
              </div>
            )}

            {/* Recorded Audio Controls */}
            {recordedAudio && (
              <div className="p-2.5 rounded-xl bg-surface-container border border-outline-variant/60 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-primary text-xs flex items-center gap-1.5 min-w-0">
                    <span className="material-symbols-outlined text-success text-base shrink-0">check_circle</span>
                    <span className="truncate">Voice recorded ({formatTime(recordedAudio.durationSeconds || recordSeconds)})</span>
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={togglePlayAudio}
                      className="px-2.5 py-1 rounded-lg bg-surface border border-outline-variant/60 text-primary hover:bg-surface-container text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">{isPlayingAudio ? 'pause' : 'play_arrow'}</span>
                      <span>{isPlayingAudio ? 'Pause' : 'Play'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        deleteRecording();
                        startRecording();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-surface border border-outline-variant/60 text-secondary hover:bg-surface-container text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">replay</span>
                      <span>Re-record</span>
                    </button>
                    <button
                      type="button"
                      onClick={deleteRecording}
                      title="Delete recording"
                      className="p-1 rounded-md text-on-surface-variant hover:text-error hover:bg-error/10 cursor-pointer transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                </div>

                {/* Collapsible Transcript */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowTranscript((prev) => !prev)}
                    className="text-[11px] font-semibold text-secondary flex items-center gap-1 cursor-pointer hover:underline"
                  >
                    <span>{showTranscript ? '▾ Hide transcript' : '▸ View transcript'}</span>
                  </button>

                  {showTranscript && (
                    <div className="mt-1.5 p-2 rounded-lg bg-surface border border-outline-variant/40 space-y-1">
                      {isEditingTranscript ? (
                        <div className="space-y-1">
                          <textarea
                            rows={2}
                            value={editedTranscript}
                            onChange={(e) => setEditedTranscript(e.target.value)}
                            className="w-full p-1.5 rounded bg-surface border border-outline-variant text-xs text-primary focus:outline-none focus:border-secondary"
                          />
                          <button
                            type="button"
                            onClick={() => setIsEditingTranscript(false)}
                            className="px-2 py-0.5 text-[10px] font-bold rounded bg-secondary text-white"
                          >
                            Done
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[11px] text-primary leading-relaxed italic">
                            "{editedTranscript || recordedAudio.originalTranscript || recordedAudio.voiceTranscript || 'Voice note recorded'}"
                          </p>
                          <button
                            type="button"
                            onClick={() => setIsEditingTranscript(true)}
                            className="text-[10px] text-secondary font-bold hover:underline shrink-0"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                      {recordedAudio?.englishTranslation && (
                        <div className="pt-1 mt-1 border-t border-outline-variant/30 text-[10px] text-on-surface-variant">
                          <span className="font-bold text-secondary">Meaning:</span> "{recordedAudio.englishTranslation}"
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ============================================================ */}
          {/* 4. ADDITIONAL DETAILS (Optional) */}
          {/* ============================================================ */}
          <div className="pt-3 border-t border-outline-variant/40 space-y-1.5">
            <label htmlFor="emergency-details-input" className="font-bold text-primary text-xs block">
              Anything responders should know? <span className="text-[10px] text-on-surface-variant font-normal">(Optional)</span>
            </label>
            <textarea
              id="emergency-details-input"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. 3 people trapped"
              className="w-full p-2.5 rounded-xl bg-surface-container border border-outline-variant/60 text-xs text-primary focus:outline-none focus:border-secondary placeholder:text-on-surface-variant/60 min-h-[46px]"
            />
          </div>

          {/* ============================================================ */}
          {/* 5. PHOTO (Optional) */}
          {/* ============================================================ */}
          <div className="pt-3 border-t border-outline-variant/40 flex items-center justify-between gap-3">
            <div>
              <p className="font-bold text-primary text-xs flex items-center gap-1">
                <span>📷 Add Photo</span>
                <span className="text-[10px] text-on-surface-variant font-normal">(Optional)</span>
              </p>
              <p className="text-[10.5px] text-on-surface-variant">Optional — only if safe</p>
            </div>

            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={fileInputRef}
              onChange={handlePhotoSelect}
              className="hidden"
            />

            {!selectedPhoto ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant/60 text-primary text-xs font-bold shrink-0 cursor-pointer transition-colors min-h-[36px]"
              >
                Choose Photo
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="w-10 h-10 object-cover rounded-lg border border-outline-variant/60"
                />
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="p-1 text-on-surface-variant hover:text-error rounded cursor-pointer"
                  title="Remove photo"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
            )}
          </div>
    </>
  );

  const renderSendSosButton = (customClass = '') => (
    <div className="space-y-2">
      {countdownActive && countdownRemaining !== null && countdownRemaining > 0 && (
        <div className="flex items-center justify-between text-xs px-1">
          <span className="font-mono font-extrabold text-error flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-error animate-ping" />
            SOS SENDS IN {countdownRemaining}s
          </span>
          <button
            type="button"
            onClick={handleCancelCountdown}
            className="text-[11px] font-bold text-on-surface-variant hover:text-error underline cursor-pointer"
          >
            Cancel Countdown
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className={`w-full py-3 sm:py-3.5 px-6 rounded-xl bg-error hover:brightness-110 active:scale-[0.98] text-white font-black text-base tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-error/25 cursor-pointer disabled:opacity-50 transition-all min-h-[50px] ${
          !submitting ? 'animate-sos-breathe' : ''
        } ${customClass}`}
        aria-label="Send Emergency SOS"
      >
        <span className="material-symbols-outlined text-2xl">emergency</span>
        <span>
          {submitting
            ? 'Sending SOS...'
            : countdownActive && countdownRemaining !== null && countdownRemaining > 0
            ? `🚨 SEND SOS NOW (${countdownRemaining}s)`
            : '🚨 SEND SOS'}
        </span>
      </button>
    </div>
  );

  const renderHelplines = () => (
    <div className="space-y-1.5 pt-1">
      <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider px-1">
        1-Tap Quick Dial Helplines
      </p>
      <div className="grid grid-cols-4 gap-1.5 text-center text-xs min-w-0">
        <a
          href="tel:112"
          className="p-2.5 rounded-xl bg-error/10 hover:bg-error/20 active:scale-[0.96] border border-error/30 text-error font-extrabold flex flex-col items-center gap-0.5 transition-all cursor-pointer min-h-[44px]"
          title="Call National Emergency Number 112"
        >
          <span className="material-symbols-outlined text-base">call</span>
          <span>112</span>
        </a>

        <a
          href="tel:108"
          className="p-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high active:scale-[0.96] border border-outline-variant text-primary font-extrabold flex flex-col items-center gap-0.5 transition-all cursor-pointer min-h-[44px]"
          title="Call Ambulance 108"
        >
          <span className="material-symbols-outlined text-base text-secondary">ambulance</span>
          <span>108</span>
        </a>

        <a
          href="tel:101"
          className="p-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high active:scale-[0.96] border border-outline-variant text-primary font-extrabold flex flex-col items-center gap-0.5 transition-all cursor-pointer min-h-[44px]"
          title="Call Fire Service 101"
        >
          <span className="material-symbols-outlined text-base text-error">local_fire_department</span>
          <span>101</span>
        </a>

        <a
          href="tel:100"
          className="p-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high active:scale-[0.96] border border-outline-variant text-primary font-extrabold flex flex-col items-center gap-0.5 transition-all cursor-pointer min-h-[44px]"
          title="Call Police 100"
        >
          <span className="material-symbols-outlined text-base text-secondary">local_police</span>
          <span>100</span>
        </a>
      </div>
    </div>
  );

  const renderHeroSosSection = () => (
    <div className="bg-surface border border-outline-variant/40 rounded-2xl py-8 px-6 text-center space-y-4 shadow-md relative overflow-hidden">
      <div className="relative z-10 flex flex-col items-center justify-center">
        {/* Outer Breathing Glow Ring */}
        <div className="relative flex items-center justify-center">
          <div className="absolute w-44 h-44 rounded-full border-2 border-error/20 animate-sos-glow-ring pointer-events-none" />

          {/* Main Circular SOS Button */}
          <button
            type="button"
            onClick={handleRedSosPress}
            disabled={submitting}
            className="w-36 h-36 rounded-full flex flex-col items-center justify-center transition-all duration-200 cursor-pointer border-4 bg-gradient-to-b from-red-500 to-red-700 text-white border-white/25 hover:shadow-[0_8px_32px_rgba(220,38,38,0.3)] hover:scale-[1.015] active:scale-95 animate-sos-breathe focus:outline-none focus-visible:ring-4 focus-visible:ring-error/50"
            aria-label="Tap for Emergency SOS"
          >
            <span className="material-symbols-outlined text-5xl font-black mb-0.5 drop-shadow-sm">
              emergency
            </span>
            <span className="text-2xl font-black tracking-tight leading-none drop-shadow-sm">
              {submitting ? '...' : 'SOS'}
            </span>
            <span className="text-[10px] font-bold tracking-wider mt-1 opacity-90">
              {submitting ? 'Sending...' : 'Emergency Alert'}
            </span>
          </button>
        </div>

        <p className="text-base sm:text-lg font-black text-primary mt-4 tracking-tight leading-tight">
          {submitting
            ? '🚨 Dispatching Emergency Alert...'
            : 'TAP SOS TO REPORT AN EMERGENCY'}
        </p>
        <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed max-w-[320px]">
          Immediate dispatch with automatic GPS location. Voice & details are optional.
        </p>
      </div>
    </div>
  );

  // Dedicated SOS Screen / Page Mode (isModal === false)
  if (!isModal) {
    return (
      <div className="w-full space-y-4 text-left pb-2 animate-fade-in">
        {/* Dynamic Feedback Status Banner (Only after actual submission) */}
        {submitMessage && (
          <div className="p-3 rounded-xl bg-secondary/15 border border-secondary/40 text-secondary text-xs font-bold flex items-center justify-between gap-2 animate-fade-in shadow-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-base shrink-0">emergency</span>
              <span className="break-words min-w-0">{submitMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSubmitMessage('')}
              className="text-secondary/70 hover:text-secondary p-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/* STATE 1: READY                                               */}
        {/* ============================================================ */}
        {sosPageState === 'READY' && (
          <>
            {/* 3. MAIN SOS AREA HEADER */}
            <div className="text-center py-1 space-y-1">
              <h2 className="text-xl sm:text-2xl font-black text-primary flex items-center justify-center gap-2 tracking-tight">
                <span>🚨 EMERGENCY SOS</span>
              </h2>
              <p className="text-xs sm:text-sm text-on-surface-variant font-medium">
                Report an emergency with your current location.
              </p>
            </div>

            {/* 3. MAIN SOS ACTION (LARGE RED CIRCULAR BUTTON) */}
            {renderHeroSosSection()}
          </>
        )}

        {/* ============================================================ */}
        {/* STATE 2: COUNTDOWN (Accidental-Tap Protection ONLY)           */}
        {/* ============================================================ */}
        {sosPageState === 'COUNTDOWN' && (
          <div className="bg-surface border border-outline-variant/60 rounded-2xl py-8 px-6 text-center space-y-5 shadow-md max-w-md mx-auto animate-fade-in">
            {/* Warning Badge */}
            <div className="w-16 h-16 rounded-full bg-amber-500/15 border-2 border-amber-500/40 text-amber-500 flex items-center justify-center mx-auto animate-pulse">
              <span className="material-symbols-outlined text-3xl">warning</span>
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl sm:text-2xl font-black text-primary tracking-tight">
                EMERGENCY SOS
              </h2>
              <p className="text-xs sm:text-sm text-on-surface-variant font-medium">
                Are you sure you want to start an emergency report?
              </p>
            </div>

            {/* Countdown Digit */}
            <div className="py-2">
              <div className="text-6xl sm:text-7xl font-mono font-black text-error animate-scale-in drop-shadow-sm select-none">
                {countdownRemaining}
              </div>
              <p className="text-xs font-bold text-on-surface-variant mt-2">
                SOS details will appear when the countdown finishes.
              </p>
            </div>

            {/* Cancel Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleCancelCountdown}
                className="w-full sm:w-auto px-8 py-3 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant text-sm font-extrabold text-error hover:border-error/40 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STATE 3: DETAILS ("What happened?" Form)                     */}
        {/* ============================================================ */}
        {sosPageState === 'DETAILS' && (
          <div ref={detailsSectionRef} className="space-y-3 animate-fade-in">
            {/* Back button allowing explicit return to red SOS button screen */}
            <div className="flex items-center justify-between pb-0.5">
              <button
                type="button"
                onClick={() => {
                  setSosPageState('READY');
                  setSubmitMessage('');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-on-surface-variant hover:text-primary transition-colors cursor-pointer py-1.5 px-2.5 rounded-lg bg-surface hover:bg-surface-container border border-outline-variant/60 shadow-2xs active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                <span>Back to SOS Button</span>
              </button>

              <span className="text-[11px] font-bold text-secondary uppercase tracking-wider">
                Emergency Details
              </span>
            </div>

            {/* 4-8. EMERGENCY DETAILS FORM ("What happened?") */}
            <form
              id="emergency-sos-form"
              onSubmit={handleSubmit}
              className="bg-surface border border-outline-variant/60 rounded-2xl p-4 sm:p-5 space-y-4 text-xs shadow-sm"
            >
              {renderEmergencyDetails()}

              {/* 9. SEND SOS BUTTON */}
              <div className="pt-2 border-t border-outline-variant/40">
                {renderSendSosButton('min-h-[52px]')}
              </div>
            </form>
          </div>
        )}

        {/* 10. QUICK-DIAL HELPLINES */}
        {renderHelplines()}
      </div>
    );
  }

  // Floating Emergency Report Modal Mode (isModal === true)
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 animate-fade-in overflow-hidden">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sos-modal-title"
        className="relative bg-surface border border-outline-variant/60 max-w-lg w-full max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] shadow-2xl text-left rounded-2xl flex flex-col overflow-hidden animate-scale-in"
      >
        {/* HEADER - Fixed / Non-scrolling */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-3.5 border-b border-outline-variant/40 shrink-0 bg-surface">
          <div>
            <h2 id="sos-modal-title" className="text-base sm:text-lg font-black text-primary leading-tight">
              Complete Emergency SOS
            </h2>
            <p className="text-[11px] sm:text-xs text-on-surface-variant mt-0.5">
              Tap SEND SOS at any time. All details are optional.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high border border-outline-variant/60 flex items-center justify-center text-primary cursor-pointer transition-all active:scale-95 shrink-0"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* FEEDBACK STATUS BANNER (Fixed below header if present) */}
        {submitMessage && (
          <div className="px-4 pt-2.5 sm:px-5 shrink-0 bg-surface">
            <div className="p-2.5 sm:p-3 rounded-xl bg-secondary/15 border border-secondary/40 text-secondary text-xs font-bold flex items-center gap-2 animate-fade-in">
              <span className="material-symbols-outlined text-base">emergency</span>
              <span>{submitMessage}</span>
            </div>
          </div>
        )}

        {/* SCROLLABLE BODY - Form scrolls independently, never under footer */}
        <form
          id="emergency-sos-form"
          onSubmit={handleSubmit}
          className="flex-1 min-h-0 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4 space-y-3.5 text-xs box-border overscroll-contain pb-6 bg-surface"
        >
          {/* 1. LOCATION STATUS (Compact) */}
          <div className="p-2.5 rounded-xl bg-surface-container border border-outline-variant/60 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`material-symbols-outlined text-lg shrink-0 transition-colors ${
                isGpsReady ? 'text-success' : (gpsData?.status === 'GPS_PERMISSION_DENIED' || gpsData?.status === 'GPS_UNAVAILABLE' ? 'text-amber-500' : 'text-amber-500')
              }`}>
                {isGpsReady ? 'check_circle' : (gpsData?.status === 'GPS_PERMISSION_DENIED' ? 'location_off' : (gpsData?.status === 'GPS_UNAVAILABLE' ? 'wrong_location' : 'location_searching'))}
              </span>
              <div className="min-w-0">
                <p className="font-bold text-primary text-xs leading-tight">
                  {isGpsReady
                    ? (gpsData?.status === 'LAST_KNOWN_OFFLINE' ? '✓ Last Known Location' : '✓ Location Ready')
                    : (gpsData?.status === 'GPS_PERMISSION_DENIED'
                        ? 'Location Permission Denied'
                        : (gpsData?.status === 'GPS_UNAVAILABLE' ? 'Location Unavailable' : 'Acquiring location...'))}
                </p>
                <p className="text-[10.5px] text-on-surface-variant font-mono truncate leading-tight mt-0.5">
                  {isGpsReady
                    ? `${gpsData.latitude.toFixed(4)}°, ${gpsData.longitude.toFixed(4)}°${gpsData.accuracy != null ? ` • Accuracy ±${gpsData.accuracy}m` : ''}`
                    : (gpsData?.status === 'GPS_PERMISSION_DENIED' || gpsData?.status === 'GPS_UNAVAILABLE'
                        ? 'Emergency SOS will dispatch with sector triage'
                        : 'Emergency SOS will send last known coordinates')}
                </p>
              </div>
            </div>
          </div>

          {renderEmergencyDetails()}
        </form>

        {/* 6. LARGE STICKY BOTTOM BUTTON: SEND SOS (Non-overlapping) */}
        <div className="shrink-0 p-3 sm:p-4 bg-surface border-t border-outline-variant/60 rounded-b-2xl">
          {renderSendSosButton()}
        </div>
      </div>
    </div>
  );
}
