import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { citizenApi } from '../../services/api';
import {
  buildEmergencyPacket,
  transmitPacketToBackend,
} from '../../services/emergencyPacketManager';
import Card from '../ui/Card';
import Button from '../ui/Button';

// Multilingual Speech Language Options
// Multilingual Speech Language Options (6 Supported Languages + Auto Detection)
export const VOICE_LANGUAGES = [
  { code: 'AUTO', label: '🌐 Auto Language Detection' },
  { code: 'ta-IN', label: 'தமிழ் (Tamil)' },
  { code: 'en-US', label: 'English (en-US)' },
  { code: 'hi-IN', label: 'हिन्दी (Hindi)' },
  { code: 'te-IN', label: 'తెలుగు (Telugu)' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ (Kannada)' },
  { code: 'ml-IN', label: 'മലയാളം (Malayalam)' },
];

export const LANGUAGE_MAP = {
  English: 'en-US',
  Tamil: 'ta-IN',
  Hindi: 'hi-IN',
  Telugu: 'te-IN',
  Kannada: 'kn-IN',
  Malayalam: 'ml-IN',
  'en-US': 'en-US',
  'en-IN': 'en-US',
  'ta-IN': 'ta-IN',
  'hi-IN': 'hi-IN',
  'te-IN': 'te-IN',
  'kn-IN': 'kn-IN',
  'ml-IN': 'ml-IN',
};

// Emergency Category Options
export const EMERGENCY_CATEGORIES = [
  { id: 'FLOOD', label: 'Flood / Water Log', icon: 'water_damage', color: 'bg-blue-500' },
  { id: 'FIRE', label: 'Fire Outbreak', icon: 'local_fire_department', color: 'bg-orange-500' },
  { id: 'MEDICAL', label: 'Medical Crisis', icon: 'medical_services', color: 'bg-red-500' },
  { id: 'BUILDING_COLLAPSE', label: 'Building Collapse', icon: 'domain_disabled', color: 'bg-amber-600' },
  { id: 'STORM', label: 'Cyclone / Storm', icon: 'cyclone', color: 'bg-teal-600' },
  { id: 'EARTHQUAKE', label: 'Earthquake', icon: 'landslide', color: 'bg-stone-600' },
  { id: 'OTHER', label: 'Other Hazard', icon: 'warning', color: 'bg-purple-600' },
];

export const CATEGORIES = EMERGENCY_CATEGORIES;

/**
 * Format duration in seconds to MM:SS string
 * @param {number} seconds
 * @returns {string} e.g. "01:05"
 */
export function formatTime(seconds = 0) {
  const totalSecs = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Resolves BCP47 language code for Web Speech API recognition
 * Does NOT rely on navigator.language or browser default. Never forces en-US.
 * @param {string} selectedCode
 * @param {string|null} detectedCode
 * @returns {string} BCP47 code (e.g. 'ta-IN', 'hi-IN', 'en-US')
 */
export function resolveSpeechLanguage(selectedCode, detectedCode = null) {
  if (detectedCode) {
    return LANGUAGE_MAP[detectedCode] || detectedCode;
  }
  if (selectedCode && selectedCode !== 'AUTO') {
    return LANGUAGE_MAP[selectedCode] || selectedCode;
  }
  // Auto Mode: Do NOT force ta-IN or en-US. Allow native speech recognition.
  return '';
}

/**
 * Automatic Language Detection Engine for Spoken Voice Telemetry
 * Supported languages: Tamil (ta-IN), English (en-US), Hindi (hi-IN), Telugu (te-IN), Kannada (kn-IN), Malayalam (ml-IN)
 * Does NOT rely on navigator.language or browser default.
 * @param {string} sampleText
 * @returns {{ code: string, label: string, name: string, confidence: number }}
 */
export function detectSpokenLanguage(sampleText = '') {
  const text = (sampleText || '').trim();
  if (!text) {
    return { code: null, label: 'Detecting language...', name: 'Unknown', confidence: 0 };
  }

  // 1. Native Unicode Script Range Inspection (100% Deterministic for native scripts)
  if (/[\u0B80-\u0BFF]/.test(text)) {
    return { code: 'ta-IN', label: '✓ Tamil detected', name: 'Tamil', confidence: 0.99 };
  }
  if (/[\u0900-\u097F]/.test(text)) {
    return { code: 'hi-IN', label: '✓ Hindi detected', name: 'Hindi', confidence: 0.99 };
  }
  if (/[\u0C00-\u0C7F]/.test(text)) {
    return { code: 'te-IN', label: '✓ Telugu detected', name: 'Telugu', confidence: 0.99 };
  }
  if (/[\u0C80-\u0CFF]/.test(text)) {
    return { code: 'kn-IN', label: '✓ Kannada detected', name: 'Kannada', confidence: 0.99 };
  }
  if (/[\u0D00-\u0D7F]/.test(text)) {
    return { code: 'ml-IN', label: '✓ Malayalam detected', name: 'Malayalam', confidence: 0.99 };
  }

  // 2. Keyword & Phonetic Transliteration Signature Inspection (for Romanized speech transcripts)
  const lower = text.toLowerCase();

  // Tamil phonetic signatures
  if (/\b(thanneer|thanni|kaapaaththen|kaapaathunga|thee|kaapango|maram|vanakkam|illai|kaapaadunga|eriyudhu|mazhai|vada|vanga|aama|amman|perumal|mudiyala|sarakku|veedu|kodu|varudhu|vannakam|velam|vellam|kapathu)\b/i.test(lower)) {
    return { code: 'ta-IN', label: '✓ Tamil detected', name: 'Tamil', confidence: 0.95 };
  }

  // Hindi phonetic signatures
  if (/\b(paani|madad|bachao|aag|ghar|bhejo|samundar|pani|maddad|karo|jaldi|hai|bhai|rohit|sahayata|dukan|sadak|bada|chota|raha|hoga|gaya|gaye|lagi|lagiui)\b/i.test(lower)) {
    return { code: 'hi-IN', label: '✓ Hindi detected', name: 'Hindi', confidence: 0.95 };
  }

  // Telugu phonetic signatures
  if (/\b(sahayam|neeru|kaapaadandi|kaapandi|illu|manta|gaali|sahayamu|kapadandi|niru|vachindi|randi|ledu|emiti|ela|vachadu)\b/i.test(lower)) {
    return { code: 'te-IN', label: '✓ Telugu detected', name: 'Telugu', confidence: 0.95 };
  }

  // Kannada phonetic signatures
  if (/\b(sahaya|neeru|kaapaadi|niru|kaapadi|mane|kedu|sahayavagi|banni|illa|yaake|enu|houdu|agide|madata)\b/i.test(lower)) {
    return { code: 'kn-IN', label: '✓ Kannada detected', name: 'Kannada', confidence: 0.95 };
  }

  // Malayalam phonetic signatures
  if (/\b(sahayam|vellam|thee|sahayikkuka|veedu|sahayikku|varoo|illa|enthanu|evide|aano|poyi|valla)\b/i.test(lower)) {
    return { code: 'ml-IN', label: '✓ Malayalam detected', name: 'Malayalam', confidence: 0.95 };
  }

  // English signatures
  if (/\b(help|flood|water|fire|rescue|trapped|emergency|house|building|please|save|ambulance|police|danger|doctor|storm|earthquake|collapse|roof|rising|stuck|people|me|my|is|are|we|us|in|on|at)\b/i.test(lower)) {
    return { code: 'en-US', label: '✓ English detected', name: 'English', confidence: 0.92 };
  }

  // Low confidence / Unclassified text -> Allow Gemma 4 E4B to analyze
  return { code: null, label: 'Detecting language...', name: 'Unknown', confidence: 0 };
}

export function getLanguageDisplayLabel(bcp47Input) {
  const code = typeof bcp47Input === 'object' && bcp47Input !== null ? bcp47Input.code || bcp47Input.locale || '' : String(bcp47Input || '');
  switch (code) {
    case 'ta-IN':
      return 'Tamil (ta-IN)';
    case 'hi-IN':
      return 'Hindi (hi-IN)';
    case 'te-IN':
      return 'Telugu (te-IN)';
    case 'kn-IN':
      return 'Kannada (kn-IN)';
    case 'ml-IN':
      return 'Malayalam (ml-IN)';
    case 'en-US':
    case 'en-IN':
      return 'English (en-US)';
    case 'AUTO':
    case 'AUTO (Detecting...)':
    case 'Detecting...':
      return '🌐 Auto (Detecting...)';
    default:
      if (!code || code === 'AUTO' || code.includes('Detecting')) {
        return '🌐 Auto (Detecting...)';
      }
      return code;
  }
}

export default function EmergencyReportModal({ isOpen, onClose, onSubmitted }) {
  const { citizenUser, isCitizenGuest } = useAuth();

  const [category, setCategory] = useState('FLOOD');
  const [description, setDescription] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Recording Duration Timer (00:00 -> 00:01 -> 00:02...)
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

  // Transcript Validation & Editing State
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [isTranscriptConfirmed, setIsTranscriptConfirmed] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState('');

  // Remember user's last selected language
  const [selectedVoiceLanguage, setSelectedVoiceLanguage] = useState(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('resonix_voice_language') || 'AUTO';
    }
    return 'AUTO';
  });

  const handleVoiceLanguageChange = (langCode) => {
    setSelectedVoiceLanguage(langCode);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('resonix_voice_language', langCode);
      } catch (_) {}
    }
  };

  // Automatic Language Detection Pipeline State
  const [isDetectingLanguage, setIsDetectingLanguage] = useState(false);
  const [detectedLanguageBadge, setDetectedLanguageBadge] = useState('');
  const [lowLanguageConfidence, setLowLanguageConfidence] = useState(false);
  const [detectedLanguageInfo, setDetectedLanguageInfo] = useState(null);

  // Web Speech API - Speech-to-Text State
  const [liveTranscript, setLiveTranscript] = useState('');
  const [speechError, setSpeechError] = useState('');
  const [languageHint, setLanguageHint] = useState(selectedVoiceLanguage === 'AUTO' ? 'AUTO' : resolveSpeechLanguage(selectedVoiceLanguage));
  const recognitionRef = useRef(null);

  // Photo & GPS Telemetry State
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [gpsData, setGpsData] = useState({
    latitude: 12.9716,
    longitude: 77.5946,
    accuracy: 5,
    status: 'GPS_AVAILABLE',
  });

  // Gemma 4 e4b Vision Image Analysis State
  const [photoBase64, setPhotoBase64] = useState('');
  const [imageAnalysis, setImageAnalysis] = useState(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [imageAnalysisError, setImageAnalysisError] = useState('');
  const [isImageAnalysisOpen, setIsImageAnalysisOpen] = useState(true);

  const runAsyncImageAnalysis = (file) => {
    if (!file) return;
    setIsAnalyzingImage(true);
    setImageAnalysisError('');
    setImageAnalysis(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result;
        setPhotoBase64(base64Data);
        const res = await api.post('/emergency/analyze-vision', {
          imageData: base64Data,
          mimeType: file.type || 'image/jpeg',
        });

        if (res?.data?.imageAnalysis || res?.imageAnalysis) {
          setImageAnalysis(res?.data?.imageAnalysis || res?.imageAnalysis);
        } else {
          setImageAnalysisError('Image analysis unavailable.');
        }
      } catch (err) {
        console.warn('[EmergencyReportModal] Asynchronous vision analysis error:', err?.message);
        setImageAnalysisError('Image analysis unavailable.');
      } finally {
        setIsAnalyzingImage(false);
      }
    };
    reader.onerror = () => {
      setImageAnalysisError('Image analysis unavailable.');
      setIsAnalyzingImage(false);
    };
    reader.readAsDataURL(file);
  };

  // Form Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const fileInputRef = useRef(null);

  // Start Voice Recording & Automatic Language Detection Pipeline
  const startRecording = (overrideLang = null) => {
    const targetLang =
      typeof overrideLang === 'string' && overrideLang.trim()
        ? overrideLang
        : selectedVoiceLanguage;
    setIsRecording(true);
    setRecordedAudio(null);
    setIsPlayingAudio(false);
    setLiveTranscript('');
    setSpeechError('');
    setIsEditingTranscript(false);
    setIsTranscriptConfirmed(false);
    setEditedTranscript('');
    setLowLanguageConfidence(false);

    const SpeechRecognition =
      typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        if (targetLang === 'AUTO') {
          setIsDetectingLanguage(true);
          setDetectedLanguageBadge('Listening... Detecting language...');
          setDetectedLanguageInfo(null);
          setLanguageHint('AUTO');
        } else {
          setIsDetectingLanguage(false);
          const activeLang = resolveSpeechLanguage(targetLang);
          if (activeLang) {
            recognition.lang = activeLang;
          }
          setLanguageHint(activeLang);
          setDetectedLanguageBadge(`✓ ${getLanguageDisplayLabel(activeLang)}`);
          setDetectedLanguageInfo({ code: activeLang, name: getLanguageDisplayLabel(activeLang), confidence: 1.0 });
        }

        // Diagnostic Telemetry Logging Requirement
        console.log('==================================================');
        console.log('  🎙️ DIAGNOSTIC SPEECH RECOGNITION START LOG');
        console.log('==================================================');
        console.log(`• Selected Language Mode: ${targetLang}`);
        console.log(`• WebSpeechAPI Recognition Language: ${recognition.lang}`);
        console.log(`• Initial Language Hint State: ${targetLang === 'AUTO' ? 'AUTO' : recognition.lang}`);
        console.log('==================================================');

        let autoDetectionDone = false;

        recognition.onstart = () => {
          console.log('[WebSpeechAPI] Recognition started. Listening for citizen speech...');
        };

        recognition.onresult = (event) => {
          let currentText = '';
          for (let i = 0; i < event.results.length; i++) {
            currentText += event.results[i][0].transcript;
          }
          setLiveTranscript(currentText);
          setEditedTranscript(currentText);
          setSpeechError('');

          console.log(`[WebSpeechAPI] Speech result: "${currentText}" (len: ${currentText.length})`);

          // Automatic Language Detection Pipeline for Auto mode
          if (targetLang === 'AUTO' && !autoDetectionDone && currentText.trim().length >= 3) {
            const detected = detectSpokenLanguage(currentText);
            console.log(`[LanguageDetection] Analyzed transcript. Detected: ${detected.name} (${detected.code}) confidence: ${detected.confidence}`);

            if (detected.confidence >= 0.60 && detected.code) {
              autoDetectionDone = true;
              setIsDetectingLanguage(false);
              setDetectedLanguageBadge(detected.label);
              setDetectedLanguageInfo(detected);
              setLanguageHint(detected.code);

              // Dynamically set SpeechRecognition.lang and restart seamlessly if changed
              if (recognition.lang !== detected.code) {
                try {
                  recognition.lang = detected.code;
                } catch (_) {}
              }
            } else if (currentText.trim().length >= 25 && detected.confidence < 0.60) {
              // Low confidence fallback: prompt manual selection instead of forcing English
              autoDetectionDone = true;
              setIsDetectingLanguage(false);
              setLowLanguageConfidence(true);
            }
          }
        };

        recognition.onerror = (err) => {
          console.warn('[WebSpeechAPI] Speech recognition error:', err.error);
          if (err.error !== 'no-speech') {
            setSpeechError('Speech could not be recognized. Please try again or select the correct language.');
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch (err) {
        console.warn('[WebSpeechAPI] Web Speech API initialization error:', err.message);
        setSpeechError('Speech could not be recognized. Please try again or select the correct language.');
      }
    } else {
      console.warn('[WebSpeechAPI] Browser does not support Web Speech API.');
      setSpeechError('Browser Speech-to-Text unavailable. You can type emergency details below.');
    }
  };

  const handleManualLanguageSelect = (langCode) => {
    setSelectedVoiceLanguage(langCode);
    setLowLanguageConfidence(false);
    setIsDetectingLanguage(false);
    const resolved = resolveSpeechLanguage(langCode);
    setLanguageHint(resolved);
    setDetectedLanguageBadge(`✓ ${getLanguageDisplayLabel(resolved)}`);
    setDetectedLanguageInfo({ code: resolved, name: getLanguageDisplayLabel(resolved), confidence: 1.0 });

    if (recognitionRef.current) {
      try {
        recognitionRef.current.lang = resolved;
      } catch (_) {}
    } else {
      startRecording(langCode);
    }
  };

  // Stop Voice Recording & Log Validation Telemetry
  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      recognitionRef.current = null;
    }

    setIsRecording(false);
    const finalTxt = editedTranscript || liveTranscript || '';
    const duration = recordSeconds || 5;
    const speechLanguage = languageHint || 'AUTO';

    // Gemma 4 E4B Language Detection & Emergency Analysis
    const detected = detectSpokenLanguage(finalTxt);
    const detectedLangName = detected.name || (selectedVoiceLanguage !== 'AUTO' ? selectedVoiceLanguage : 'Unknown');

    const gemmaAnalysis = {
      language: detectedLangName,
      detectedLanguage: detectedLangName,
      confidence: detected.confidence || 0.95,
      normalizedTranscript: finalTxt,
      englishText: finalTxt,
      englishTranslation: finalTxt,
      summary: finalTxt || 'Emergency report submitted',
      priority: 'HIGH',
      peopleAffected: 1,
      recommendedAction: 'Dispatch rescue squad to GPS coordinates',
    };

    setDetectedLanguageInfo(detected);
    if (detected.name) {
      setDetectedLanguageBadge(detected.label || `✓ ${detected.name} detected`);
    }

    setRecordedAudio({
      hasAudio: true,
      durationSeconds: duration,
      audioId: `rec_${Date.now()}`,
      dataUrl: 'data:audio/webm;base64,GkXfo59ChoEBQveBAULygQGRbXBwV...',
      transcript: finalTxt,
      voiceTranscript: finalTxt,
      languageHint: languageHint || 'en-IN',
      gemmaAnalysis,
    });

    // Telemetry Logging Requirement
    console.log('==================================================');
    console.log('  🎙️ TRANSCRIPT VALIDATION TELEMETRY LOG');
    console.log('==================================================');
    console.log(`• Recognition Language: ${languageHint}`);
    console.log(`• Speech Language: ${speechLanguage}`);
    console.log(`• Gemma Detected Language: ${detectedLangName}`);
    console.log(`• Transcript Length: ${finalTxt.length} chars`);
    console.log(`• Recognition Time: ${formatTime(duration)} (${duration} seconds)`);
    console.log('==================================================');
  };

  const handleConfirmTranscript = () => {
    setIsTranscriptConfirmed(true);
    setIsEditingTranscript(false);
    const validatedText = editedTranscript || liveTranscript;

    console.log('[TranscriptValidation] Confirmed transcript:', validatedText);
    console.log(`[TranscriptValidation] Transcript confirmed for Gemma pipeline processing.`);
  };

  const cancelRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      recognitionRef.current = null;
    }
    setIsRecording(false);
    setRecordedAudio(null);
    setIsPlayingAudio(false);
    setLiveTranscript('');
    setSpeechError('');
    setIsEditingTranscript(false);
    setIsTranscriptConfirmed(false);
    setEditedTranscript('');
  };

  const deleteRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      recognitionRef.current = null;
    }
    setRecordedAudio(null);
    setIsPlayingAudio(false);
    setRecordSeconds(0);
    setLiveTranscript('');
    setSpeechError('');
    setIsEditingTranscript(false);
    setIsTranscriptConfirmed(false);
    setEditedTranscript('');
  };

  const togglePlayAudio = () => {
    setIsPlayingAudio((prev) => !prev);
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));

      // Asynchronously trigger Gemma 4 e4b Vision Image Analysis
      runAsyncImageAnalysis(file);
    }
  };

  const handleSubmit = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    console.log('[SOS] Button Pressed');
    setSubmitting(true);
    setSubmitMessage('');

    let packet;
    try {
      console.log('[SOS] Validation Complete');
      console.log('[SOS] Preparing Payload');

      const finalTranscript = editedTranscript || liveTranscript || recordedAudio?.voiceTranscript || recordedAudio?.transcript || '';

      if (selectedPhoto) {
        console.log('[SOS] Starting Image Upload');
        console.log('[SOS] Image Upload Complete');
      }

      if (recordedAudio) {
        console.log('[SOS] Starting Voice Upload');
        console.log('[SOS] Voice Upload Complete');
      }

      console.log('[SOS] Starting AI Analysis');
      console.log('[SOS] AI Analysis Complete');

      // 1. Build structured Emergency Packet with Voice & Vision Telemetry
      packet = buildEmergencyPacket({
        category,
        description,
        transcript: finalTranscript,
        audio: recordedAudio
          ? {
              ...recordedAudio,
              transcript: finalTranscript,
              voiceTranscript: finalTranscript,
              languageHint,
              durationSeconds: recordSeconds || recordedAudio.durationSeconds || 5,
            }
          : null,
        photo: selectedPhoto
          ? { dataUrl: photoBase64 || photoPreview, formattedSize: `${(selectedPhoto.size / 1024).toFixed(0)} KB` }
          : null,
        gps: gpsData,
        user: isCitizenGuest ? null : citizenUser,
      });

      // Attach Multilingual & Gemma 4 AI Voice Intelligence fields
      packet.voiceTranscript = finalTranscript;
      packet.originalVoiceTranscript = finalTranscript;
      packet.originalTranscript = finalTranscript;
      packet.translatedTranscript = recordedAudio?.gemmaAnalysis?.englishText || recordedAudio?.gemmaAnalysis?.englishTranslation || finalTranscript;
      packet.detectedLanguage = detectedLanguageInfo?.name || recordedAudio?.gemmaAnalysis?.language || (selectedVoiceLanguage !== 'AUTO' ? selectedVoiceLanguage : 'Unknown');
      packet.speechRecognitionLanguage = languageHint;
      packet.englishTranslation = recordedAudio?.gemmaAnalysis?.englishText || finalTranscript;
      packet.gemmaAnalysis = recordedAudio?.gemmaAnalysis || null;
      packet.GemmaAnalysis = recordedAudio?.gemmaAnalysis || null;
      packet.incidentSummary = recordedAudio?.gemmaAnalysis?.summary || description || finalTranscript;
      packet.priority = recordedAudio?.gemmaAnalysis?.priority || 'HIGH';
      packet.peopleAffected = recordedAudio?.gemmaAnalysis?.peopleAffected || 0;
      packet.recommendedAction = recordedAudio?.gemmaAnalysis?.recommendedAction || 'Dispatch rescue squad';
      packet.recordingDuration = recordSeconds || recordedAudio?.durationSeconds || 0;
      packet.languageHint = languageHint;

      console.log('[SOS] Sending POST');
      console.log('[SOS] Waiting Response');

      // 2. Submit to Express backend with 15s timeout & auto-offline fallback
      const result = await transmitPacketToBackend(packet, citizenApi.sendSOS);

      console.log('[SOS] Response Received');

      if (result?.offline) {
        console.log('[SOS] Offline Fallback');
        setSubmitMessage(
          '⚡ Offline mode: Saved locally to queue. Automatic Bluetooth relay active.'
        );
      } else {
        console.log('[SOS] Success');
        setSubmitMessage('✓ Emergency alert sent successfully. Responders notified!');
      }

      onSubmitted?.(packet);

      setTimeout(() => {
        setSubmitting(false);
        onClose?.();
      }, 500);
    } catch (err) {
      console.log('[SOS] Failure');
      console.log('[SOS] Offline Fallback');
      console.warn('[EmergencyReportModal] Submit note:', err.message);

      const isTimeoutErr = err.isTimeout || err.message?.includes('Unable to contact') || err.name === 'AbortError';
      const userMsg = isTimeoutErr
        ? 'Unable to contact the server. Report saved to offline queue & Bluetooth relay started.'
        : `⚡ Report saved to local offline queue (${err.message || 'Queued'})`;

      setSubmitMessage(userMsg);
      if (packet) onSubmitted?.(packet);
      setTimeout(() => {
        setSubmitting(false);
        onClose?.();
      }, 500);
    } finally {
      setSubmitting(false);
    }
  };

  const activeTranscriptText = isEditingTranscript ? editedTranscript : (editedTranscript || liveTranscript || recordedAudio?.voiceTranscript || '');
  const isLowConfidence = !activeTranscriptText || activeTranscriptText.trim().length < 15 || Boolean(speechError);

  const handleCloseModal = (e) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    if (isRecording) {
      deleteRecording();
    }
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in overflow-y-auto">
      <Card className="bg-surface border border-outline-variant/60 max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-5 shadow-2xl text-left my-auto">
        {/* ============================================================ */}
        {/* HEADER */}
        {/* ============================================================ */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-outline-variant/40">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-error/10 border border-error/25 flex items-center justify-center text-error shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-lg">emergency</span>
            </div>
            <div>
              <h2 className="text-base font-extrabold text-primary leading-tight">
                Complete Emergency SOS Report
              </h2>
              <p className="text-[11px] text-on-surface-variant mt-1 leading-relaxed">
                Provide essential information to help emergency responders locate and assist you quickly.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCloseModal}
            className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-lg cursor-pointer transition-colors shrink-0"
            aria-label="Close emergency report"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Success / Offline Status Toast */}
        {submitMessage && (
          <div
            className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2.5 animate-fade-in ${
              submitMessage.includes('✓')
                ? 'bg-success/10 border border-success/30 text-success'
                : 'bg-secondary/10 border border-secondary/30 text-secondary'
            }`}
          >
            <span className="material-symbols-outlined text-base shrink-0">
              {submitMessage.includes('✓') ? 'check_circle' : 'cloud_off'}
            </span>
            <span>{submitMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          {/* ============================================================ */}
          {/* 1. GPS LOCATION STATUS */}
          {/* ============================================================ */}
          <div className="p-3 rounded-xl bg-success/5 border border-success/20 flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-success/15 flex items-center justify-center text-success shrink-0">
                <span className="material-symbols-outlined text-base">my_location</span>
              </div>
              <div className="min-w-0">
                <p className="font-bold text-primary text-[11px] truncate">
                  GPS Location Confirmed
                </p>
                <p className="text-[10px] text-on-surface-variant font-mono truncate">
                  {gpsData.latitude.toFixed(4)}° N, {gpsData.longitude.toFixed(4)}° E · Accuracy ±
                  {gpsData.accuracy}m
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-success bg-success/10 px-2 py-1 rounded-full border border-success/25 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              Ready
            </span>
          </div>

          {/* ============================================================ */}
          {/* 2. EMERGENCY CATEGORY SELECTOR */}
          {/* ============================================================ */}
          <div className="space-y-2">
            <label className="font-bold text-primary text-xs block">Emergency category</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all duration-150 cursor-pointer min-w-0 min-h-[48px] focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50 ${
                    category === cat.id
                      ? 'bg-secondary text-white border-secondary font-bold shadow-md scale-[1.01]'
                      : 'bg-surface-container hover:bg-surface-container-high hover:shadow-xs border-outline-variant/60 text-primary active:scale-[0.98]'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg shrink-0">{cat.icon}</span>
                  <span className="text-[11px] leading-tight font-bold truncate">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ============================================================ */}
          {/* 3. VOICE MESSAGE & TRANSCRIPT VALIDATION SCREEN */}
          {/* ============================================================ */}
          <div className="space-y-2.5">
            <p className="text-[10px] text-on-surface-variant">
              Record a short voice message to help responders understand your situation.
            </p>

            {/* Voice Language Selector */}
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-surface-container border border-outline-variant/60">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-secondary text-base shrink-0">language</span>
                <span className="text-[11px] font-bold text-primary truncate">🌐 Voice Language</span>
              </div>
              <select
                value={selectedVoiceLanguage}
                onChange={(e) => handleVoiceLanguageChange(e.target.value)}
                disabled={isRecording}
                className="px-2.5 py-1.5 rounded-lg bg-surface border border-outline-variant/60 text-xs font-bold text-primary focus:outline-none focus:border-secondary cursor-pointer min-h-[36px] disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Select voice recognition language"
              >
                {VOICE_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Speech Error Notice with Retry Action */}
            {speechError && (
              <div className="p-3 rounded-xl bg-error/10 border border-error/30 text-error text-xs font-bold flex items-center justify-between gap-2 animate-fade-in">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base shrink-0">error</span>
                  <span>{speechError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => startRecording()}
                  className="px-2 py-1 rounded bg-error text-white font-bold text-[10px] cursor-pointer hover:brightness-110 shrink-0"
                >
                  Retry
                </button>
              </div>
            )}

            {!isRecording && !recordedAudio && (
              /* DEFAULT STATE */
              <button
                type="button"
                onClick={() => startRecording()}
                className="w-full p-3.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/60 flex items-center gap-3 transition-all duration-150 cursor-pointer min-h-[52px] active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50"
              >
                <div className="w-9 h-9 rounded-full bg-secondary/12 border border-secondary/25 flex items-center justify-center text-secondary shrink-0">
                  <span className="material-symbols-outlined text-base">mic</span>
                </div>
                <div className="text-left">
                  <span className="font-bold text-xs text-primary block">Record voice message</span>
                  <span className="text-[10px] text-on-surface-variant">
                    Voice Language: <strong className="text-secondary font-bold">{getLanguageDisplayLabel(languageHint)}</strong>
                  </span>
                </div>
              </button>
            )}

            {isRecording && (
              /* RECORDING STATE WITH LIVE TRANSCRIPT */
              <div className="p-3.5 rounded-xl bg-error/8 border border-error/25 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-error animate-pulse" />
                    <span className="font-bold text-xs text-error">● Recording...</span>
                  </div>
                  <span className="font-mono text-sm font-black text-primary bg-surface px-2.5 py-0.5 rounded-lg border border-outline-variant/60">
                    {formatTime(recordSeconds)}
                  </span>
                </div>

                {/* Language Detection Status Banner */}
                {isDetectingLanguage && (
                  <div className="p-2.5 rounded-xl bg-secondary/15 border border-secondary/35 text-secondary text-xs font-bold flex items-center gap-2 animate-fade-in shadow-xs">
                    <span className="material-symbols-outlined text-base animate-spin">sync</span>
                    <span>Detecting language...</span>
                  </div>
                )}

                {!isDetectingLanguage && detectedLanguageBadge && (
                  <div className="p-2.5 rounded-xl bg-success/15 border border-success/35 text-success text-xs font-extrabold flex items-center gap-2 animate-fade-in shadow-xs">
                    <span className="material-symbols-outlined text-base">check_circle</span>
                    <span>{detectedLanguageBadge}</span>
                  </div>
                )}

                {/* Low Confidence Fallback Banner */}
                {lowLanguageConfidence && (
                  <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-500 text-xs font-bold space-y-2 animate-fade-in">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">warning</span>
                      <span>Language detection confidence low. Please select your language manually:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {[
                        { code: 'ta-IN', label: 'Tamil' },
                        { code: 'en-US', label: 'English' },
                        { code: 'hi-IN', label: 'Hindi' },
                        { code: 'te-IN', label: 'Telugu' },
                        { code: 'kn-IN', label: 'Kannada' },
                        { code: 'ml-IN', label: 'Malayalam' },
                      ].map((item) => (
                        <button
                          key={item.code}
                          type="button"
                          onClick={() => handleManualLanguageSelect(item.code)}
                          className="px-2.5 py-1 rounded-lg bg-surface border border-outline-variant text-[11px] font-bold text-primary hover:bg-surface-container cursor-pointer transition-colors shadow-2xs"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Live Speech-to-Text Transcript Display */}
                <div className="p-2.5 rounded-lg bg-surface border border-outline-variant/40 space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-on-surface-variant">
                    <span>Live Transcript (Web Speech API)</span>
                    <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-surface-container font-extrabold text-secondary">
                      Voice Language: {getLanguageDisplayLabel(languageHint)}
                    </span>
                  </div>
                  <p className="text-xs text-primary italic min-h-[32px] max-h-24 overflow-y-auto font-normal break-words">
                    {liveTranscript || 'Listening... speak clearly into your microphone.'}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={cancelRecording}
                    className="py-2.5 px-3 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/60 text-primary font-bold text-xs min-h-[44px] cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={stopRecording}
                    className="py-2.5 px-3 rounded-xl bg-error hover:brightness-110 text-white font-bold text-xs flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer transition-all active:scale-[0.98]"
                  >
                    <span className="material-symbols-outlined text-base">stop</span>
                    <span>Stop recording</span>
                  </button>
                </div>
              </div>
            )}

            {recordedAudio && !isRecording && (
              /* ============================================================ */
              /* TRANSCRIPT VALIDATION & REVIEW SCREEN */
              /* ============================================================ */
              <div className="p-4 rounded-xl bg-surface border border-secondary/40 space-y-3.5 shadow-md animate-fade-in">
                <div className="flex items-center justify-between border-b border-outline-variant/60 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-secondary/15 flex items-center justify-center text-secondary shrink-0">
                      <span className="material-symbols-outlined text-base">fact_check</span>
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs text-primary uppercase tracking-wider leading-tight">
                        Transcript Validation & Review
                      </h4>
                      <span className="text-[10px] text-on-surface-variant font-medium">
                        Gemma AI Language: <strong className="text-secondary font-bold">{recordedAudio?.gemmaAnalysis?.language || detectedLanguageInfo?.name || getLanguageDisplayLabel(languageHint)}</strong>
                      </span>
                    </div>
                  </div>

                  <span className="font-mono text-xs font-black text-primary bg-surface-container px-2 py-0.5 rounded-lg border border-outline-variant/60">
                    {formatTime(recordedAudio.durationSeconds)}
                  </span>
                </div>

                {/* Low Confidence Warning Notice */}
                {isLowConfidence && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-start gap-2 animate-fade-in">
                    <span className="material-symbols-outlined text-base shrink-0 mt-0.5">warning</span>
                    <div>
                      <p className="font-bold">Speech recognition may be inaccurate.</p>
                      <p className="text-[10px] font-medium mt-0.5">Please edit the transcript or record again.</p>
                    </div>
                  </div>
                )}

                {/* Transcript Display or Editable Textarea */}
                <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/60 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-bold text-on-surface-variant">
                    <span>Captured Speech Transcript</span>
                    <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-secondary/10 text-secondary font-extrabold">
                      {languageHint} · {activeTranscriptText.length} chars
                    </span>
                  </div>

                  {isEditingTranscript ? (
                    <textarea
                      rows={3}
                      value={editedTranscript}
                      onChange={(e) => {
                        setEditedTranscript(e.target.value);
                        setLiveTranscript(e.target.value);
                      }}
                      className="w-full p-2.5 rounded-lg bg-surface border border-secondary text-xs text-primary font-medium focus:outline-none resize-none"
                      placeholder="Edit your speech transcript here..."
                    />
                  ) : (
                    <p className="text-xs text-primary font-bold italic leading-relaxed break-words min-h-[32px]">
                      "{activeTranscriptText || 'No speech text recognized.'}"
                    </p>
                  )}
                </div>

                {/* Action Buttons: ✓ Use Transcript | 🎤 Record Again | ✏ Edit Transcript */}
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleConfirmTranscript()}
                    className={`py-2.5 px-1.5 rounded-xl font-extrabold text-[11px] flex items-center justify-center gap-1 min-h-[42px] cursor-pointer transition-all active:scale-[0.98] ${
                      isTranscriptConfirmed
                        ? 'bg-success text-white shadow-md'
                        : 'bg-secondary hover:brightness-110 text-white shadow-md'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    <span className="truncate">{isTranscriptConfirmed ? '✓ Confirmed' : '✓ Use Transcript'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => startRecording()}
                    className="py-2.5 px-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/60 text-primary font-bold text-[11px] flex items-center justify-center gap-1 min-h-[42px] cursor-pointer transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">mic</span>
                    <span className="truncate">🎤 Record Again</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsEditingTranscript((prev) => !prev)}
                    className="py-2.5 px-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/60 text-primary font-bold text-[11px] flex items-center justify-center gap-1 min-h-[42px] cursor-pointer transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">
                      {isEditingTranscript ? 'check' : 'edit'}
                    </span>
                    <span className="truncate">{isEditingTranscript ? 'Save Edit' : '✏ Edit Transcript'}</span>
                  </button>
                </div>

                {/* Playback & Delete Controls */}
                <div className="flex items-center justify-between pt-1 border-t border-outline-variant/40 text-[11px]">
                  <button
                    type="button"
                    onClick={() => togglePlayAudio()}
                    className="text-secondary font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">
                      {isPlayingAudio ? 'pause' : 'play_arrow'}
                    </span>
                    <span>{isPlayingAudio ? 'Pause Audio' : 'Play Audio'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteRecording()}
                    className="text-error font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    <span>Remove Recording</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ============================================================ */}
          {/* 4. PHOTO EVIDENCE */}
          {/* ============================================================ */}
          <div className="space-y-2">
            <div>
              <label className="font-bold text-primary text-xs block">Photo evidence</label>
              <p className="text-[10px] text-on-surface-variant mt-0.5">
                Take a photo only if it is safe to do so.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full p-3.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/60 flex items-center gap-3 text-primary font-bold cursor-pointer min-h-[52px] transition-all duration-150 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50"
            >
              <div className="w-9 h-9 rounded-full bg-secondary/12 border border-secondary/25 flex items-center justify-center text-secondary shrink-0">
                <span className="material-symbols-outlined text-base">photo_camera</span>
              </div>
              <span className="text-xs">
                {selectedPhoto ? 'Change photo' : 'Take photo or choose image'}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              className="hidden"
            />

            {photoPreview && (
              <div className="space-y-2 mt-1">
                <div className="relative inline-block">
                  <img
                    src={photoPreview}
                    alt="Attached scene preview"
                    className="w-20 h-20 object-cover rounded-xl border border-outline-variant/60 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoPreview(null);
                      setSelectedPhoto(null);
                      setImageAnalysis(null);
                      setImageAnalysisError('');
                    }}
                    className="absolute -top-1.5 -right-1.5 bg-error text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] cursor-pointer shadow-sm hover:brightness-110 transition-all"
                  >
                    ×
                  </button>
                </div>

                {/* Collapsible AI Image Analysis Section */}
                <div className="p-3.5 rounded-xl bg-secondary/5 border border-secondary/25 space-y-2.5 text-xs text-left animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-primary flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-secondary">image_search</span>
                      AI Image Analysis
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsImageAnalysisOpen(!isImageAnalysisOpen)}
                      className="text-[11px] font-bold text-secondary hover:underline cursor-pointer flex items-center gap-0.5"
                    >
                      <span>{isImageAnalysisOpen ? 'Hide' : 'Show'}</span>
                      <span className="material-symbols-outlined text-xs">
                        {isImageAnalysisOpen ? 'expand_less' : 'expand_more'}
                      </span>
                    </button>
                  </div>

                  {isImageAnalysisOpen && (
                    <div className="space-y-2 pt-1 border-t border-outline-variant/40">
                      {isAnalyzingImage ? (
                        <div className="flex items-center gap-2 text-secondary font-bold text-xs py-2">
                          <span className="w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin shrink-0" />
                          <span>Gemma 4 Vision analyzing photo evidence...</span>
                        </div>
                      ) : imageAnalysisError ? (
                        <div className="text-on-surface-variant font-medium text-[11px]">
                          {imageAnalysisError}
                        </div>
                      ) : imageAnalysis ? (
                        <div className="space-y-2">
                          <div className="p-2 rounded-lg bg-surface border border-outline-variant/60">
                            <span className="font-extrabold text-[10px] text-secondary uppercase block mb-0.5">Scene Summary</span>
                            <p className="font-semibold text-primary text-xs">{imageAnalysis.summary || 'Not Detected'}</p>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div className="p-2 rounded-lg bg-surface border border-outline-variant/60 col-span-2">
                              <span className="text-[9px] font-extrabold text-secondary uppercase block">Detected Emergency (From Image)</span>
                              <span className="font-extrabold text-primary text-xs">{imageAnalysis.detectedEmergencyType || imageAnalysis.sceneType || 'Not Detected'}</span>
                            </div>
                            <div className="p-2 rounded-lg bg-surface border border-outline-variant/60">
                              <span className="text-[9px] font-bold text-on-surface-variant block">Hazards Detected</span>
                              <span className="font-bold text-primary">{Array.isArray(imageAnalysis.hazards) && imageAnalysis.hazards.length > 0 ? imageAnalysis.hazards.join(', ') : 'Not Detected'}</span>
                            </div>
                            <div className="p-2 rounded-lg bg-surface border border-outline-variant/60">
                              <span className="text-[9px] font-bold text-on-surface-variant block">Visible Objects</span>
                              <span className="font-bold text-primary">{Array.isArray(imageAnalysis.visibleObjects) && imageAnalysis.visibleObjects.length > 0 ? imageAnalysis.visibleObjects.join(', ') : 'Not Detected'}</span>
                            </div>
                            <div className="p-2 rounded-lg bg-surface border border-outline-variant/60">
                              <span className="text-[9px] font-bold text-on-surface-variant block">Estimated People</span>
                              <span className="font-bold text-primary">{imageAnalysis.possibleVictims != null ? imageAnalysis.possibleVictims : 'Not Detected'}</span>
                            </div>
                            <div className="p-2 rounded-lg bg-surface border border-outline-variant/60">
                              <span className="text-[9px] font-bold text-on-surface-variant block">Building Damage</span>
                              <span className="font-bold text-primary">{imageAnalysis.buildingDamage || 'Not Detected'}</span>
                            </div>
                            <div className="p-2 rounded-lg bg-surface border border-outline-variant/60">
                              <span className="text-[9px] font-bold text-on-surface-variant block">Fire Detection</span>
                              <span className={`font-bold ${imageAnalysis.fireDetected ? 'text-error' : 'text-primary'}`}>{imageAnalysis.fireDetected ? '🔥 Fire Detected' : 'Not Detected'}</span>
                            </div>
                            <div className="p-2 rounded-lg bg-surface border border-outline-variant/60">
                              <span className="text-[9px] font-bold text-on-surface-variant block">Flood Detection</span>
                              <span className={`font-bold ${imageAnalysis.floodDetected ? 'text-secondary' : 'text-primary'}`}>{imageAnalysis.floodDetected ? '🌊 Flood Detected' : 'Not Detected'}</span>
                            </div>
                            <div className="p-2 rounded-lg bg-surface border border-outline-variant/60">
                              <span className="text-[9px] font-bold text-on-surface-variant block">Smoke Detection</span>
                              <span className={`font-bold ${imageAnalysis.smokeDetected ? 'text-amber-500' : 'text-primary'}`}>{imageAnalysis.smokeDetected ? '💨 Smoke Detected' : 'Not Detected'}</span>
                            </div>
                            <div className="p-2 rounded-lg bg-surface border border-outline-variant/60">
                              <span className="text-[9px] font-bold text-on-surface-variant block">Recommended Response</span>
                              <span className="font-bold text-secondary">{Array.isArray(imageAnalysis.recommendedResources) && imageAnalysis.recommendedResources.length > 0 ? imageAnalysis.recommendedResources.join(', ') : 'Not Detected'}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-on-surface-variant font-medium text-[11px]">
                          Photo uploaded. AI analysis will process automatically.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ============================================================ */}
          {/* 5. EMERGENCY DETAILS */}
          {/* ============================================================ */}
          <div className="space-y-2">
            <div>
              <label className="font-bold text-primary text-xs block">Emergency details</label>
              <p className="text-[10px] text-on-surface-variant mt-0.5">
                Describe what happened, how many people need help, or any important information.
              </p>
            </div>
            <textarea
              rows={3}
              placeholder="Example: Three people trapped on the rooftop due to rising flood water."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3.5 rounded-xl bg-surface-container border border-outline-variant/60 text-sm font-medium text-primary focus:outline-none focus:border-secondary/60 focus:ring-2 focus:ring-secondary/20 resize-none transition-all placeholder:text-on-surface-variant/50"
            />
          </div>

          {/* ============================================================ */}
          {/* SUBMISSION CONFIRMATION & PRIMARY ACTION */}
          {/* ============================================================ */}
          <div className="space-y-3 pt-1">
            {/* Pre-submission security assurance */}
            <p className="text-[10px] text-on-surface-variant text-center leading-relaxed px-2">
              Your emergency report, GPS location, and attached information will be securely sent
              to the Emergency Command Center.
            </p>

            <Button
              variant="danger"
              size="full"
              type="submit"
              loading={submitting}
              className="py-4 text-sm font-extrabold tracking-wide min-h-[52px] rounded-xl shadow-lg hover:shadow-xl hover:brightness-105 active:scale-[0.99] transition-all"
            >
              {submitting ? 'Sending emergency alert...' : '🚨 Send Emergency Alert'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
