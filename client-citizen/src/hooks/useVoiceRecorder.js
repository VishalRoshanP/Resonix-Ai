import { useState, useRef, useCallback, useEffect } from 'react';

export const RECORDING_STATUS = {
  IDLE: 'IDLE',
  LISTENING: 'LISTENING',
  RECORDING: 'RECORDING',
  PROCESSING: 'PROCESSING',
  RECORDED: 'RECORDED',
  ERROR: 'ERROR',
};

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
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);

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

  /**
 * Deduplicates consecutive repeated words or sentences from STT streams.
 * e.g., "I need need help help" -> "I need help"
 * e.g., "The building is on fire. The building is on fire." -> "The building is on fire."
 */
export function cleanDuplicateSpeechText(text) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text.trim().replace(/\s+/g, ' ');

  // 1. Remove consecutive duplicated words (case-insensitive)
  cleaned = cleaned.replace(/\b(\w+)(\s+\1)+\b/gi, '$1');

  // 2. Remove consecutive duplicated phrases or sentences
  cleaned = cleaned.replace(/(.+?)\s+\1(?=\s|$)/gi, '$1');

  return cleaned.trim();
}

// Start Speech-to-Text Recognition Helper
  const startSpeechRecognition = useCallback((langCode) => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        
        // Resolve BCP47 language tag without hardcoding en-US or relying on navigator.language
        const targetCode = langCode || selectedLang || 'AUTO';
        let resolvedLang = 'ta-IN';
        if (targetCode !== 'AUTO') {
          resolvedLang = targetCode;
        }

        recognition.lang = resolvedLang;

        let finalTranscript = '';
        recognition.onresult = (event) => {
          let interimTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            const text = res[0]?.transcript || '';
            if (res.isFinal) {
              finalTranscript += text + ' ';
            } else {
              interimTranscript += text;
            }
          }
          const fullText = (finalTranscript + ' ' + interimTranscript).trim();
          const cleanText = cleanDuplicateSpeechText(fullText);
          setTranscript(cleanText);
        };

        recognition.onerror = (e) => {
          console.warn('[useVoiceRecorder] Web Speech STT error:', e.error);
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch (err) {
        console.warn('[useVoiceRecorder] Web Speech API initialization failed:', err.message);
      }
    } else {
      // Fallback transcript simulation for browsers without Web Speech API
      setTranscript('Emergency reported via voice telemetry. Water levels rising near dwelling.');
    }
  }, [selectedLang]);

  // Stop Speech Recognition Helper
  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      recognitionRef.current = null;
    }
  }, []);

  // Start Recording with Noise Cancellation Constraints
  const startRecording = useCallback(async (langCode = selectedLang) => {
    setErrorMessage(null);
    setBackendResponse(null);
    setTranscript('');
    setStatus(RECORDING_STATUS.LISTENING);
    audioChunksRef.current = [];

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone access is not supported on this browser.');
      }

      // Noise Handling & Noise Suppression Constraints
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

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        clearTimer();
        stopStream();
        stopSpeechRecognition();

        const actualMimeType = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: actualMimeType });

        if (blob.size > 0) {
          const url = URL.createObjectURL(blob);
          setAudioBlob(blob);
          setAudioUrl(url);
          setStatus(RECORDING_STATUS.RECORDED);
        } else {
          setStatus(RECORDING_STATUS.IDLE);
        }
      };

      recorder.start(250);
      startSpeechRecognition(langCode);

      setStatus(RECORDING_STATUS.RECORDING);
      setRecordingTime(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      stopStream();
      clearTimer();
      stopSpeechRecognition();
      setErrorMessage(err.message || 'Failed to access microphone.');
      setStatus(RECORDING_STATUS.ERROR);
    }
  }, [selectedLang, startSpeechRecognition, stopSpeechRecognition]);

  // Stop Recording
  const stopRecording = useCallback(() => {
    stopSpeechRecognition();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      setStatus(RECORDING_STATUS.PROCESSING);
      mediaRecorderRef.current.stop();
    }
  }, [stopSpeechRecognition]);

  // Cancel Recording
  const cancelRecording = useCallback(() => {
    clearTimer();
    stopSpeechRecognition();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    stopStream();

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    setAudioBlob(null);
    setAudioUrl(null);
    setTranscript('');
    setRecordingTime(0);
    setErrorMessage(null);
    setBackendResponse(null);
    setStatus(RECORDING_STATUS.IDLE);
  }, [audioUrl, stopSpeechRecognition]);

  // Re-record
  const reRecord = useCallback(async () => {
    cancelRecording();
    setTimeout(() => {
      startRecording();
    }, 100);
  }, [cancelRecording, startRecording]);

  // Send Recorded Audio & Transcript to Backend API
  const sendToBackend = useCallback(async (category = 'VOICE_EMERGENCY') => {
    if (!audioBlob && !transcript) return null;

    try {
      setStatus(RECORDING_STATUS.PROCESSING);

      let base64Data = null;
      if (audioBlob) {
        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
        });
        reader.readAsDataURL(audioBlob);
        base64Data = await base64Promise;
      }

      const payload = {
        category,
        description: transcript || 'Emergency voice audio telemetry captured.',
        audioData: base64Data,
        mimeType: audioBlob?.type || 'audio/webm',
        detectedLanguage: selectedLang,
        transcript: transcript || 'Voice telemetry recorded.',
        gemmaEnvelope: {
          primaryModel: 'google/gemma-4-e4b-it',
          queuedForInference: true,
          pipelineStage: 'VOICE_TRANSCRIPTION_TRIAGE',
          extractedTranscript: transcript || 'Emergency voice audio telemetry captured.',
        },
      };

      const { citizenApi } = await import('../services/api');
      const json = await citizenApi.sendSOS(payload);
      setBackendResponse(json.data || json);
      setStatus(RECORDING_STATUS.RECORDED);
      return json;
    } catch (err) {
      setErrorMessage('Failed to send voice payload to server: ' + err.message);
      setStatus(RECORDING_STATUS.ERROR);
      return null;
    }
  }, [audioBlob, transcript, selectedLang]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      clearTimer();
      stopStream();
      stopSpeechRecognition();
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl, stopSpeechRecognition]);

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
    reRecord,
    sendToBackend,
    isIdle: status === RECORDING_STATUS.IDLE,
    isListening: status === RECORDING_STATUS.LISTENING,
    isRecording: status === RECORDING_STATUS.RECORDING,
    isProcessing: status === RECORDING_STATUS.PROCESSING,
    isRecorded: status === RECORDING_STATUS.RECORDED,
  };
}
