import { useState, useRef, useCallback, useEffect } from 'react';
import { resolveConfiguredApiBaseUrl } from '../utils/env';

export const RECORDING_STATUS = {
  IDLE: 'IDLE',
  LISTENING: 'LISTENING',
  RECORDING: 'RECORDING',
  PROCESSING: 'PROCESSING',
  RECORDED: 'RECORDED',
  ERROR: 'ERROR',
};

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

/**
 * Deduplicates consecutive repeated words or sentences from STT streams.
 */
export function cleanDuplicateSpeechText(text) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text.trim().replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/\b(\w+)(\s+\1)+\b/gi, '$1');
  cleaned = cleaned.replace(/(.+?)\s+\1(?=\s|$)/gi, '$1');
  return cleaned.trim();
}

export function useVoiceRecorder() {
  const [status, setStatus] = useState(RECORDING_STATUS.IDLE);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [selectedLang, setSelectedLang] = useState('AUTO');
  const [errorMessage, setErrorMessage] = useState(null);
  const [backendResponse, setBackendResponse] = useState(null);

  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef('');
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaRecorderActiveRef = useRef(false);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const reRecordTimeoutRef = useRef(null);
  const selectedLangRef = useRef(selectedLang);
  const transcriptRef = useRef(transcript);
  const audioBlobRef = useRef(audioBlob);
  const isMountedRef = useRef(true);

  useEffect(() => {
    selectedLangRef.current = selectedLang;
  }, [selectedLang]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    audioBlobRef.current = audioBlob;
  }, [audioBlob]);

  const clearTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch (_) {}
      mediaStreamRef.current = null;
    }
  }, []);

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch (_) {}
      recognitionRef.current = null;
    }
  }, []);

  const getSupportedMimeType = useCallback(() => {
    if (typeof MediaRecorder === 'undefined') return '';
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/aac',
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return '';
  }, []);

  // Production Speech-to-Text via Backend ASR (Fallback if Web Speech API returns empty)
  const transcribeRecordedBlob = useCallback(async (blob, mimeType, duration) => {
    if (!blob || blob.size === 0) return;
    try {
      if (isMountedRef.current) {
        setStatus(RECORDING_STATUS.PROCESSING);
      }

      const reader = new FileReader();
      const base64Audio = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const apiBaseUrl = resolveConfiguredApiBaseUrl();

      const resp = await fetch(`${apiBaseUrl}/emergency/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioData: base64Audio,
          mimeType,
          durationSeconds: duration,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.success === false) {
          // Backend transcription failed but not a network error; keep audio available
          console.warn('[useVoiceRecorder] Backend STT returned failure:', data.error || data.message);
          if (isMountedRef.current) {
            setStatus(RECORDING_STATUS.RECORDED);
          }
          return;
        }
        const officialTranscript = (data.nativeScriptTranscript || data.originalTranscript || data.transcript || '').trim();
        if (officialTranscript && isMountedRef.current) {
          transcriptRef.current = officialTranscript;
          setTranscript(officialTranscript);
          if (data.language && data.language !== 'Unknown') {
            setSelectedLang(data.language);
          }
          // Store complete backend transcription response
          setBackendResponse({
            originalTranscript: officialTranscript,
            nativeScriptTranscript: data.nativeScriptTranscript || null,
            englishTranslation: data.englishTranslation || null,
            normalizedMeaning: data.normalizedMeaning || null,
            language: data.language || data.sourceLanguage || 'Unknown',
            languageCode: data.languageCode || data.sourceLanguageCode || 'unknown',
            sourceLanguage: data.sourceLanguage || data.language || 'Unknown',
            confidence: data.confidence || 0,
            needsReview: Boolean(data.needsReview),
            transcriptionProvider: data.transcriptionProvider || null,
          });
        }
      }
    } catch (err) {
      console.warn('[useVoiceRecorder] Backend STT notice:', err.message);
    } finally {
      // Always transition to RECORDED after backend STT completes or fails
      if (isMountedRef.current) {
        setStatus(RECORDING_STATUS.RECORDED);
      }
    }
  }, []);

  // Start Recording with Web Speech API and MediaRecorder
  const startRecording = useCallback(async (langCode) => {
    setErrorMessage(null);
    setBackendResponse(null);
    setTranscript('');
    transcriptRef.current = '';
    finalTranscriptRef.current = '';
    setStatus(RECORDING_STATUS.LISTENING);
    audioChunksRef.current = [];

    // Stop existing recognition if active
    stopRecognition();

    const targetLang = langCode || selectedLangRef.current || 'ta-IN';
    const targetLocale = LANGUAGE_LOCALE_MAP[targetLang] || LANGUAGE_LOCALE_MAP[selectedLangRef.current] || 'ta-IN';

    // 1. Initialize Web Speech API
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
            const text = item[0]?.transcript || '';
            if (item.isFinal) {
              final += text + ' ';
            } else {
              interim += text;
            }
          }
          finalTranscriptRef.current = final.trim();
          const currentText = (final + (interim ? ' ' + interim : '')).trim();
          if (currentText && isMountedRef.current) {
            transcriptRef.current = currentText;
            setTranscript(currentText);
          }
        };

        rec.onerror = (event) => {
          console.warn('[useVoiceRecorder Web Speech API error]:', event.error);
          if (event.error === 'not-allowed' || event.error === 'permission-denied') {
            // Permission errors affect both Web Speech API and MediaRecorder
            if (isMountedRef.current) {
              setErrorMessage('Microphone access permission was denied.');
            }
          } else if (event.error === 'no-speech') {
            // Normal pause in speech, not a real error
          } else if (event.error !== 'aborted') {
            // Only show error if MediaRecorder is also not actively recording audio.
            // Web Speech API can fail independently (network issues, unsupported locale, etc.)
            // while MediaRecorder continues capturing audio for backend STT.
            if (isMountedRef.current && !finalTranscriptRef.current && !mediaRecorderActiveRef.current) {
              setErrorMessage('Voice could not be captured. You can try again or type your emergency.');
            }
          }
        };

        rec.start();
        recognitionRef.current = rec;
      } catch (recErr) {
        console.warn('[useVoiceRecorder] SpeechRecognition start error:', recErr.message);
      }
    }

    // 2. Initialize MediaRecorder Stream
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone access is not supported on this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const recorderOptions = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = recorder;
      mediaRecorderActiveRef.current = true;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        mediaRecorderActiveRef.current = false;
        clearTimer();
        stopStream();
        stopRecognition();

        const actualMimeType = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: actualMimeType });

        if (blob.size > 0) {
          const url = URL.createObjectURL(blob);
          audioBlobRef.current = blob;
          if (isMountedRef.current) {
            setAudioBlob(blob);
            setAudioUrl(url);
          }
          // If Web Speech API returned text, go directly to RECORDED.
          // Otherwise, keep PROCESSING and invoke backend STT.
          if (finalTranscriptRef.current) {
            if (isMountedRef.current) {
              setStatus(RECORDING_STATUS.RECORDED);
            }
          } else {
            // Backend STT handles its own PROCESSING → RECORDED transition
            await transcribeRecordedBlob(blob, actualMimeType, 5);
          }
        } else if (isMountedRef.current) {
          setStatus(RECORDING_STATUS.IDLE);
        }
      };

      recorder.start(250);

      setStatus(RECORDING_STATUS.RECORDING);
      setRecordingTime(0);

      timerIntervalRef.current = setInterval(() => {
        if (isMountedRef.current) {
          setRecordingTime((prev) => prev + 1);
        }
      }, 1000);
    } catch (err) {
      stopStream();
      stopRecognition();
      clearTimer();
      if (isMountedRef.current) {
        setErrorMessage(err.message || 'Failed to access microphone.');
        setStatus(RECORDING_STATUS.ERROR);
      }
    }
  }, [clearTimer, getSupportedMimeType, stopStream, stopRecognition, transcribeRecordedBlob]);

  // Stop Recording
  const stopRecording = useCallback(() => {
    stopRecognition();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      setStatus(RECORDING_STATUS.PROCESSING);
      mediaRecorderRef.current.stop();
    }
  }, [stopRecognition]);

  // Cancel Recording
  const cancelRecording = useCallback(() => {
    clearTimer();
    stopRecognition();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    stopStream();

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    audioBlobRef.current = null;
    transcriptRef.current = '';
    finalTranscriptRef.current = '';
    setAudioBlob(null);
    setAudioUrl(null);
    setTranscript('');
    setRecordingTime(0);
    setErrorMessage(null);
    setBackendResponse(null);
    setStatus(RECORDING_STATUS.IDLE);
  }, [audioUrl, clearTimer, stopStream, stopRecognition]);

  // Re-record
  const reRecord = useCallback(async () => {
    cancelRecording();
    if (reRecordTimeoutRef.current) clearTimeout(reRecordTimeoutRef.current);
    reRecordTimeoutRef.current = setTimeout(() => {
      startRecording();
    }, 100);
  }, [cancelRecording, startRecording]);

  // Send Recorded Audio & Transcript to Backend API
  const sendToBackend = useCallback(async (category = 'VOICE_EMERGENCY') => {
    const currentBlob = audioBlobRef.current || audioBlob;
    const currentTranscript = (finalTranscriptRef.current || transcriptRef.current || transcript || '').trim();
    if (!currentBlob && !currentTranscript) return null;

    try {
      setStatus(RECORDING_STATUS.PROCESSING);

      let base64Data = null;
      if (currentBlob) {
        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
        });
        reader.readAsDataURL(currentBlob);
        base64Data = await base64Promise;
      }

      const activeLang = selectedLangRef.current || selectedLang;
      const payload = {
        category,
        citizenSelectedCategory: category,
        selectedCategory: category,
        description: currentTranscript || 'Emergency voice audio telemetry captured.',
        audioData: base64Data,
        mimeType: currentBlob?.type || 'audio/webm',
        detectedLanguage: activeLang !== 'AUTO' ? activeLang : 'Language not detected',
        transcript: currentTranscript || '',
        originalTranscript: currentTranscript || '',
        voiceTranscript: currentTranscript || '',
      };

      const { citizenApi } = await import('../services/api');
      const json = await citizenApi.sendSOS(payload);
      if (isMountedRef.current) {
        setBackendResponse(json.data || json);
        setStatus(RECORDING_STATUS.RECORDED);
      }
      return json;
    } catch (err) {
      if (isMountedRef.current) {
        setErrorMessage('Failed to send voice payload to server: ' + err.message);
        setStatus(RECORDING_STATUS.ERROR);
      }
      return null;
    }
  }, [audioBlob, transcript, selectedLang]);

  // Clean up on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearTimer();
      stopRecognition();
      stopStream();
      if (reRecordTimeoutRef.current) {
        clearTimeout(reRecordTimeoutRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl, clearTimer, stopStream, stopRecognition]);

  // Formatter for MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    status,
    recordingTime,
    formattedTime: formatTime(recordingTime),
    audioBlob,
    audioUrl,
    transcript,
    setTranscript,
    selectedLang,
    setSelectedLang,
    errorMessage,
    backendResponse,
    startRecording,
    stopRecording,
    cancelRecording,
    deleteRecording: cancelRecording,
    reRecord,
    sendToBackend,
    isIdle: status === RECORDING_STATUS.IDLE,
    isListening: status === RECORDING_STATUS.LISTENING,
    isRecording: status === RECORDING_STATUS.RECORDING,
    isProcessing: status === RECORDING_STATUS.PROCESSING,
    isRecorded: status === RECORDING_STATUS.RECORDED,
  };
}
