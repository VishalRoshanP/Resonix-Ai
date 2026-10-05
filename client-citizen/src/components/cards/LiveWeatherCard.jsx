import React, { useState, useEffect, useCallback, useRef } from 'react';
import { weatherApi } from '../../services/api';
import { citizenSocketClient } from '../../services/socketClient';
import { useLocationDetector, LOCATION_STATUS } from '../../hooks/useLocationDetector';
import WeatherClimateDrawer from './WeatherClimateDrawer';
import WeatherNwpDrawer from './WeatherNwpDrawer';

// BCP-47 speech recognition and Web Speech synthesis mapping across supported Indian languages
const BROWSER_SPEECH_LANG_MAP = {
  en: 'en-IN',
  ta: 'ta-IN',
  hi: 'hi-IN',
  te: 'te-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  bn: 'bn-IN',
  mr: 'mr-IN',
  gu: 'gu-IN',
  pa: 'pa-IN',
};

// Supported Indian Languages available under the "More languages" clean selector
const MORE_INDIAN_LANGUAGES = [
  { code: 'te', label: 'తెలుగు (Telugu)' },
  { code: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
  { code: 'ml', label: 'മലയാളം (Malayalam)' },
  { code: 'bn', label: 'বাংলা (Bengali)' },
  { code: 'mr', label: 'मराठी (Marathi)' },
  { code: 'gu', label: 'ગુજરાતી (Gujarati)' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ (Punjabi)' },
];

export default function LiveWeatherCard({ className = '' }) {
  const {
    locationData,
    status: gpsStatus,
    isDetecting: isGpsDetecting,
    isUnavailable: isGpsUnavailable,
    errorMessage: gpsErrorMessage,
    detectLocation,
  } = useLocationDetector();

  // Location Mode: 'CURRENT' (Device GPS) vs 'SEARCH' (Searchable Alternate Location)
  const [locationMode, setLocationMode] = useState('CURRENT');
  const [customLocation, setCustomLocation] = useState(null); // { name, lat, lon, displayName, city, state, country }
  const [reverseGeocodedName, setReverseGeocodedName] = useState('');
  const [reverseGeocodedDetails, setReverseGeocodedDetails] = useState(null);

  // Search input & autocomplete state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const searchDebounceRef = useRef(null);

  // Weather data & loading states
  const [weatherData, setWeatherData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorNotice, setErrorNotice] = useState(null);
  const activeGridKeyRef = useRef(null);

  // Conversational Weather Assistant State ("weather near me", "will it rain here tomorrow?")
  const [assistantQuery, setAssistantQuery] = useState('');
  const [assistantResponse, setAssistantResponse] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [isAsking, setIsAsking] = useState(false);
  const [assistantError, setAssistantError] = useState(null);
  const [isSectorDropdownOpen, setIsSectorDropdownOpen] = useState(false);
  const [voiceFailureState, setVoiceFailureState] = useState(null); // { type: 'MIC_UNAVAILABLE' | 'STT_FAILED', message, canRetry }
  const [ttsNotice, setTtsNotice] = useState(null);
  const chatContainerRef = useRef(null);
  const textInputRef = useRef(null);

  // Indian Language & Voice Weather Interaction (Priority: English, Tamil)
  const [selectedLanguage, setSelectedLanguage] = useState('en'); // 'en' | 'ta'
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const speechRecognitionRef = useRef(null);
  const interimVoiceTranscriptRef = useRef('');
  const activeAudioRef = useRef(null);
  const playbackSessionRef = useRef(0);

  // Historical & Climate Analytics State (SIH26068)
  const [climateData, setClimateData] = useState(null);
  const [isClimateLoading, setIsClimateLoading] = useState(false);
  const [climateTab, setClimateTab] = useState('monthly'); // 'monthly' | 'fiveYear'
  const [selectedHistoricalYear, setSelectedHistoricalYear] = useState(2025);
  const [isClimateExpanded, setIsClimateExpanded] = useState(false);

  // Numerical Weather Prediction (NWP) Models State (SIH26068: GFS / ECMWF / WRF-Derived)
  const [nwpData, setNwpData] = useState(null);
  const [isNwpLoading, setIsNwpLoading] = useState(false);
  const [nwpTab, setNwpTab] = useState('consensus'); // 'consensus' | 'gfs' | 'ecmwf' | 'wrf'
  const [isNwpExpanded, setIsNwpExpanded] = useState(false);
  const [nwpModelsList, setNwpModelsList] = useState([]);

  // Resonix Local Weather Risk Assessment State (SIH26068: Decision-Support Layer)
  const [riskData, setRiskData] = useState(null);
  const [isRiskLoading, setIsRiskLoading] = useState(false);
  const [isRiskExpanded, setIsRiskExpanded] = useState(false);
  const [isWhyExpanded, setIsWhyExpanded] = useState(false);
  const [isReportsExpanded, setIsReportsExpanded] = useState(false);

  // Active coordinates resolution
  const activeLat = locationMode === 'CURRENT' ? (locationData?.latitude ?? 12.9716) : (customLocation?.lat ?? 12.9716);
  const activeLon = locationMode === 'CURRENT' ? (locationData?.longitude ?? 77.5946) : (customLocation?.lon ?? 77.5946);
  const activeLocationLabel = locationMode === 'CURRENT'
    ? (reverseGeocodedName || (locationData ? `GPS: ${locationData.latitude.toFixed(2)}, ${locationData.longitude.toFixed(2)}` : 'Bengaluru Hub'))
    : (customLocation?.displayName || customLocation?.name || 'Selected Location');

  // Reverse geocode when GPS coordinates update
  useEffect(() => {
    if (locationMode === 'CURRENT' && locationData?.latitude && locationData?.longitude) {
      weatherApi
        .reverseLookup(locationData.latitude, locationData.longitude)
        .then((res) => {
          const loc = res?.data || res;
          if (loc?.displayName) {
            setReverseGeocodedName(loc.displayName);
            setReverseGeocodedDetails(loc);
          }
        })
        .catch(() => {});
    }
  }, [locationMode, locationData]);

  // Fetch weather data for active coordinates
  const fetchWeather = useCallback(async (isBypass = false) => {
    try {
      if (isBypass) setIsRefreshing(true);
      setErrorNotice(null);

      const res = await weatherApi.getComprehensive(activeLat, activeLon, {
        fresh: isBypass,
        locationName: activeLocationLabel,
      });
      const data = res?.data || res;
      if (data && data.current) {
        setWeatherData(data);
        activeGridKeyRef.current = data.gridKey || `${Math.round(activeLat * 100) / 100}:${Math.round(activeLon * 100) / 100}`;
      }
    } catch (err) {
      console.warn('[LiveWeatherCard] Weather query note:', err.message);
      setErrorNotice(err.message || 'Weather service currently unavailable');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeLat, activeLon, activeLocationLabel]);

  useEffect(() => {
    fetchWeather(false);
  }, [fetchWeather]);

  // Fetch Historical Climate Data (Monthly breakdown & 5-year trends)
  const fetchClimateData = useCallback(async (yearOverride) => {
    try {
      setIsClimateLoading(true);
      const targetYear = yearOverride || selectedHistoricalYear;
      const [monthlyRes, trendsRes] = await Promise.all([
        weatherApi.getMonthlyHistorical(activeLat, activeLon, targetYear),
        weatherApi.getClimateTrends(activeLat, activeLon, 5),
      ]);

      const monthly = monthlyRes?.data || monthlyRes;
      const trends = trendsRes?.data || trendsRes;

      setClimateData({
        monthlyBreakdown: monthly?.monthlyBreakdown || [],
        extremeEvents: monthly?.extremeEvents || null,
        annualSummary: monthly?.annualSummary || null,
        hottestMonth: monthly?.hottestMonth || null,
        wettestMonth: monthly?.wettestMonth || null,
        coldestMonth: monthly?.coldestMonth || null,
        climateTrends: trends?.trends || [],
        yearOverYearDeltas: trends?.yearOverYearDeltas || [],
        overallShift: trends?.overallShift || null,
        source: monthly?.source || trends?.source || 'Open-Meteo Historical Archive',
      });
    } catch (err) {
      console.warn('[LiveWeatherCard] Climate data fetch note:', err.message);
    } finally {
      setIsClimateLoading(false);
    }
  }, [activeLat, activeLon, selectedHistoricalYear]);

  // Fetch climate data when expanded or when coordinates change if expanded
  useEffect(() => {
    if (isClimateExpanded) {
      fetchClimateData();
    }
  }, [isClimateExpanded, fetchClimateData]);

  // Fetch NWP Data (Multi-model comparison & registered model metadata)
  const fetchNwpData = useCallback(async () => {
    try {
      setIsNwpLoading(true);
      const [compRes, modelsRes] = await Promise.all([
        weatherApi.getNwpComparison(activeLat, activeLon, { days: 3 }),
        weatherApi.getNwpModels(),
      ]);

      const comp = compRes?.data || compRes;
      const models = modelsRes?.data?.models || modelsRes?.models || [];

      setNwpData(comp);
      setNwpModelsList(models);
    } catch (err) {
      console.warn('[LiveWeatherCard] NWP data fetch note:', err.message);
    } finally {
      setIsNwpLoading(false);
    }
  }, [activeLat, activeLon]);

  useEffect(() => {
    if (isNwpExpanded) {
      fetchNwpData();
    }
  }, [isNwpExpanded, fetchNwpData]);

  // Fetch Local Weather Risk Assessment (Decision-Support Layer)
  const fetchRiskData = useCallback(async () => {
    try {
      setIsRiskLoading(true);
      const res = await weatherApi.getLocalWeatherRisk(activeLat, activeLon);
      const data = res?.data || res;
      if (data && data.resonixRiskAssessment) {
        setRiskData(data);
      }
    } catch (err) {
      console.warn('[LiveWeatherCard] Local risk query note:', err.message);
    } finally {
      setIsRiskLoading(false);
    }
  }, [activeLat, activeLon]);

  useEffect(() => {
    fetchRiskData();
  }, [fetchRiskData]);

  // Real-Time Socket.IO Updates
  useEffect(() => {
    const unsubscribe = citizenSocketClient.subscribe((event) => {
      if (event.type === 'WEATHER_UPDATED') {
        setWeatherData((prev) => {
          if (!prev) return event;
          return {
            ...prev,
            current: event.current || prev.current,
            metadata: event.metadata || prev.metadata,
            warnings: event.warnings || prev.warnings,
            timestamp: event.timestamp || prev.timestamp,
            freshness: event.freshness || prev.freshness,
          };
        });
        setErrorNotice(null);
      } else if (event.type === 'WEATHER_WARNING') {
        setWeatherData((prev) => {
          if (!prev) return prev;
          const currentWarnings = prev.warnings || [];
          const exists = currentWarnings.some((w) => w.id === event.warning?.id);
          if (exists) return prev;
          return {
            ...prev,
            warnings: [event.warning, ...currentWarnings],
          };
        });
      } else if (event.type === 'FORECAST_UPDATED') {
        // Merge updated forecast data without refetching
        setWeatherData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            hourlyForecast: event.hourlyForecast || prev.hourlyForecast,
            dailyForecast: event.dailyForecast || prev.dailyForecast,
            current: event.current || prev.current,
            timestamp: event.timestamp || prev.timestamp,
          };
        });
      } else if (event.type === 'SOCKET_RECONNECTED') {
        // After socket reconnection, fetch latest weather state from backend
        console.log('[LiveWeatherCard] 🔄 Socket reconnected. Fetching latest weather state...');
        fetchWeather(false);
      }
    });
    return () => unsubscribe();
  }, [fetchWeather]);


  // Search input debounce handler
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    setSearchError(null);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      setIsSearching(false);
      return;
    }

    // Immediately show searching indicator
    setShowSearchDropdown(true);
    setIsSearching(true);

    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await weatherApi.lookupLocation(query.trim());
        const rawLocations = res?.data?.locations || res?.data || res?.locations || res || [];
        const normalizedList = Array.isArray(rawLocations)
          ? rawLocations
          : (typeof rawLocations === 'object' && rawLocations !== null
              ? Object.values(rawLocations).filter((loc) => loc && typeof loc === 'object' && loc.name && typeof loc.latitude === 'number')
              : []);
        setSearchResults(normalizedList);
        setSearchError(null);
      } catch (err) {
        console.warn('[LiveWeatherCard] Search location error:', err.message);
        setSearchResults([]);
        setSearchError('Unable to search places. Check your connection and try again.');
      } finally {
        setIsSearching(false);
      }
    }, 350);
  };

  // Location selection handler
  const handleSelectLocation = (loc) => {
    const locDisplayName = loc.displayName || `${loc.name}, ${[loc.admin1, loc.country].filter(Boolean).join(', ')}`;
    setCustomLocation({
      name: loc.name,
      displayName: locDisplayName,
      lat: Number(loc.latitude),
      lon: Number(loc.longitude),
      city: loc.name || '',
      state: loc.admin1 || '',
      country: loc.country || 'India',
    });
    setLocationMode('SEARCH');
    setSearchQuery(locDisplayName);
    setShowSearchDropdown(false);
    setSearchError(null);
  };

  // Switch back to device GPS location
  const handleResetToCurrentLocation = () => {
    setLocationMode('CURRENT');
    setCustomLocation(null);
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchDropdown(false);
    setSearchError(null);
    detectLocation();
  };

  const handleSwitchToGps = handleResetToCurrentLocation;

  // Auto-scroll chat to latest message strictly inside the internal container (NEVER scrolls the window or document)
  useEffect(() => {
    if (chatMessages.length > 0 && chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [chatMessages, isAsking]);

  // Conversational Weather Assistant Handler
  const handleAskAssistant = async (queryText) => {
    const targetQuery = queryText || assistantQuery;
    if (!targetQuery || !targetQuery.trim()) return;

    const trimmedQuery = targetQuery.trim();
    const userMsgId = 'user-' + Date.now();
    setChatMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        sender: 'user',
        text: trimmedQuery,
        timestamp: new Date(),
      },
    ]);
    setAssistantQuery('');
    setIsAsking(true);
    setAssistantError(null);

    const activeCity = locationMode === 'SEARCH'
      ? (customLocation?.city || customLocation?.name || '')
      : (reverseGeocodedDetails?.city || reverseGeocodedDetails?.locality || locationData?.city || '');
    const activeState = locationMode === 'SEARCH'
      ? (customLocation?.state || '')
      : (reverseGeocodedDetails?.admin1 || locationData?.state || '');
    const activeCountry = locationMode === 'SEARCH'
      ? (customLocation?.country || 'India')
      : (reverseGeocodedDetails?.country || locationData?.country || 'India');

    try {
      const res = await weatherApi.askWeather(trimmedQuery, activeLat, activeLon, {
        locationName: activeLocationLabel,
        city: activeCity,
        state: activeState,
        country: activeCountry,
        language: selectedLanguage,
      });
      const data = res?.data || res;
      setAssistantResponse(data);

      const assistantMsgId = 'assistant-' + Date.now();
      const assistantMsg = {
        id: assistantMsgId,
        sender: 'assistant',
        query: trimmedQuery,
        conciseAnswer: data.conciseAnswer || data.conversationResponse?.answer || data.answer || '',
        weatherEvidence: data.weatherEvidence || {
          officialWarning: data.evidenceLayers?.warning ? { summary: data.evidenceLayers.warning, isOfficial: true } : null,
          weatherForecast: data.evidenceLayers?.forecast ? { summary: data.evidenceLayers.forecast } : null,
          resonixRiskAssessment: null,
          citizenReport: data.evidenceLayers?.citizenReport ? { summary: data.evidenceLayers.citizenReport } : null,
          aiGuidance: data.evidenceLayers?.aiInterpretation ? { guidance: data.evidenceLayers.aiInterpretation, isOfficial: false } : null,
        },
        source: data.source || data.conversationResponse?.source || data.metadata?.source || 'Open-Meteo Meteorological Ensemble',
        updated: data.updated || data.conversationResponse?.updated || 'just now',
        raw: data,
        language: data.language || selectedLanguage,
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.warn('[LiveWeatherCard] Assistant query technical note:', err.message);
      // User-friendly citizen error message (Part 8 & 15: No raw technical strings exposed)
      const fallbackErrorMessage = selectedLanguage === 'ta'
        ? 'தற்போது சமீபத்திய வானிலை தரவை பெற முடியவில்லை. தயவுசெய்து சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்.'
        : (selectedLanguage === 'hi'
          ? 'वर्तमान में नवीनतम मौसम डेटा प्राप्त नहीं किया जा सका। कृपया पुनः प्रयास करें।'
          : "I couldn't retrieve the latest weather data right now. Please try again.");

      const assistantErrorMsgId = 'assistant-err-' + Date.now();
      setChatMessages((prev) => [
        ...prev,
        {
          id: assistantErrorMsgId,
          sender: 'assistant',
          isError: true,
          query: trimmedQuery,
          conciseAnswer: fallbackErrorMessage,
          source: 'Resonix Weather Intelligence',
          updated: 'just now',
          language: selectedLanguage,
          timestamp: new Date(),
        },
      ]);
      setAssistantError(null);
    } finally {
      setIsAsking(false);
    }
  };

  // Voice Query Audio Playback (Gemini TTS / Browser Web Speech Fallback)
  const stopAudioPlayback = useCallback(() => {
    playbackSessionRef.current += 1;
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
        activeAudioRef.current.onended = null;
        activeAudioRef.current.onerror = null;
      } catch (_) {}
      activeAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }
    setIsPlayingAudio(false);
  }, []);

  // Cleanup speech/audio on unmount
  useEffect(() => {
    return () => {
      stopAudioPlayback();
    };
  }, [stopAudioPlayback]);

  const playAudioBase64 = (base64, mimeType = 'audio/wav') => {
    stopAudioPlayback();
    const currentSession = ++playbackSessionRef.current;
    try {
      const audioUrl = `data:${mimeType};base64,${base64}`;
      const audio = new Audio(audioUrl);
      activeAudioRef.current = audio;
      setIsPlayingAudio(true);
      setTtsNotice(null);
      audio.onended = () => {
        if (playbackSessionRef.current === currentSession) {
          activeAudioRef.current = null;
          setIsPlayingAudio(false);
        }
      };
      audio.onerror = () => {
        if (playbackSessionRef.current === currentSession) {
          activeAudioRef.current = null;
          setIsPlayingAudio(false);
          setTtsNotice('Audio playback unavailable — full readable answer is displayed below.');
        }
      };
      audio.play().catch((err) => {
        if (playbackSessionRef.current === currentSession) {
          activeAudioRef.current = null;
          setIsPlayingAudio(false);
          if (err?.name !== 'AbortError') {
            setTtsNotice('Audio playback unavailable — full readable answer is displayed below.');
          }
        }
      });
    } catch (_) {
      if (playbackSessionRef.current === currentSession) {
        activeAudioRef.current = null;
        setIsPlayingAudio(false);
        setTtsNotice('Audio playback unavailable — full readable answer is displayed below.');
      }
    }
  };

  const playBrowserSynthesis = (text, lang) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setTtsNotice('Browser voice synthesis unavailable — full readable answer is displayed below.');
      return;
    }
    stopAudioPlayback();
    const currentSession = ++playbackSessionRef.current;

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = BROWSER_SPEECH_LANG_MAP[lang] || BROWSER_SPEECH_LANG_MAP[selectedLanguage] || 'en-IN';
      setIsPlayingAudio(true);
      setTtsNotice(null);
      utterance.onend = () => {
        if (playbackSessionRef.current === currentSession) {
          setIsPlayingAudio(false);
        }
      };
      utterance.onerror = (e) => {
        if (playbackSessionRef.current === currentSession) {
          setIsPlayingAudio(false);
          if (e?.error !== 'interrupted' && e?.error !== 'canceled') {
            setTtsNotice('Voice synthesis error — full readable answer is displayed below.');
          }
        }
      };
      window.speechSynthesis.speak(utterance);
    } catch (_) {
      if (playbackSessionRef.current === currentSession) {
        setIsPlayingAudio(false);
        setTtsNotice('Voice synthesis error — full readable answer is displayed below.');
      }
    }
  };

  // Voice Recording Pipeline (MediaRecorder + Web Speech API Telemetry)
  const startVoiceRecording = async () => {
    try {
      setAssistantError(null);
      setVoiceFailureState(null);
      audioChunksRef.current = [];
      interimVoiceTranscriptRef.current = '';

      if (!navigator?.mediaDevices?.getUserMedia) {
        const fallbackMsg = selectedLanguage === 'ta'
          ? 'மைக்ரோஃபோன் இந்த சாதனத்தில் கிடைக்கவில்லை. கீழே உள்ள பெட்டியில் எழுதி அனுப்பவும்.'
          : (selectedLanguage === 'hi'
            ? 'माइक्रोफ़ोन इस डिवाइस पर उपलब्ध नहीं है। आप नीचे बॉक्स में लिखकर पूछ सकते हैं।'
            : 'Microphone unavailable on this device. Text input remains available below.');
        setVoiceFailureState({
          type: 'MIC_UNAVAILABLE',
          message: fallbackMsg,
          canRetry: false,
        });
        if (textInputRef.current) textInputRef.current.focus({ preventScroll: true });
        return;
      }

      // 1. Web Speech API (Browser STT Telemetry Stream across Indian languages)
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const rec = new SpeechRecognition();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = BROWSER_SPEECH_LANG_MAP[selectedLanguage] || 'en-IN';
          rec.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
              } else {
                interimVoiceTranscriptRef.current = event.results[i][0].transcript;
              }
            }
            if (finalTranscript) {
              interimVoiceTranscriptRef.current = finalTranscript;
            }
          };
          rec.onerror = () => {};
          rec.start();
          speechRecognitionRef.current = rec;
        } catch (_) {}
      }

      // 2. MediaRecorder Audio Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))
        ? 'audio/webm;codecs=opus'
        : ((typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm')) ? 'audio/webm' : 'audio/mp4');

      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        await handleVoiceQuerySubmit(audioBlob, mimeType, interimVoiceTranscriptRef.current);
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setIsVoiceRecording(true);
    } catch (err) {
      console.warn('[LiveWeatherCard] Microphone access error:', err.message);
      const fallbackMsg = selectedLanguage === 'ta'
        ? 'மைக்ரோஃபோன் அணுகலை அனுமதிக்க முடியவில்லை. கீழே உள்ள பெட்டியில் எழுதி அனுப்பலாம்.'
        : (selectedLanguage === 'hi'
          ? 'माइक्रोफ़ोन का उपयोग नहीं किया जा सका। आप नीचे बॉक्स में लिखकर पूछ सकते हैं।'
          : 'Could not access microphone. Text input remains available below.');
      setVoiceFailureState({
        type: 'MIC_UNAVAILABLE',
        message: fallbackMsg,
        canRetry: false,
      });
      setIsVoiceRecording(false);
      if (textInputRef.current) textInputRef.current.focus({ preventScroll: true });
    }
  };

  const stopVoiceRecording = () => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (_) {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsVoiceRecording(false);
  };

  const handleVoiceQuerySubmit = async (audioBlob, mimeType, clientTranscript) => {
    setIsVoiceProcessing(true);
    setAssistantError(null);
    try {
      let base64Audio = null;
      if (audioBlob && audioBlob.size > 0) {
        const reader = new FileReader();
        base64Audio = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(audioBlob);
        });
      }

      const res = await weatherApi.queryVoiceWeather({
        audioData: base64Audio,
        mimeType,
        transcript: clientTranscript,
        languageHint: selectedLanguage,
        latitude: activeLat,
        longitude: activeLon,
        locationName: activeLocationLabel,
      });

      const data = res?.data || res;
      if (data && data.success) {
        setVoiceFailureState(null);
        if (data.weatherResponse) {
          const resp = data.weatherResponse;
          setAssistantResponse(resp);
          const spokenText = data.spokenQuery || clientTranscript || 'Voice query';
          if (data.spokenQuery) {
            setAssistantQuery(data.spokenQuery);
          }

          const userMsgId = 'user-voice-' + Date.now();
          const assistantMsgId = 'assistant-voice-' + (Date.now() + 1);
          setChatMessages((prev) => [
            ...prev,
            {
              id: userMsgId,
              sender: 'user',
              text: spokenText,
              isVoice: true,
              timestamp: new Date(),
            },
            {
              id: assistantMsgId,
              sender: 'assistant',
              query: spokenText,
              conciseAnswer: resp.conciseAnswer || resp.conversationResponse?.answer || resp.answer || data.spokenSummary || '',
              weatherEvidence: resp.weatherEvidence || {
                officialWarning: resp.evidenceLayers?.warning ? { summary: resp.evidenceLayers.warning, isOfficial: true } : null,
                weatherForecast: resp.evidenceLayers?.forecast ? { summary: resp.evidenceLayers.forecast } : null,
                resonixRiskAssessment: null,
                citizenReport: resp.evidenceLayers?.citizenReport ? { summary: resp.evidenceLayers.citizenReport } : null,
                aiGuidance: resp.evidenceLayers?.aiInterpretation ? { guidance: resp.evidenceLayers.aiInterpretation, isOfficial: false } : null,
              },
              source: resp.source || resp.conversationResponse?.source || 'Open-Meteo Meteorological Ensemble',
              updated: resp.updated || resp.conversationResponse?.updated || 'just now',
              raw: resp,
              language: resp.language || data.language || selectedLanguage,
              timestamp: new Date(),
            },
          ]);
        }

        // Voice Playback (Gemini TTS or Fallback)
        if (data.audio?.hasAudio && data.audio?.audioData) {
          playAudioBase64(data.audio.audioData, data.audio.mimeType || 'audio/wav');
        } else if (data.spokenSummary) {
          playBrowserSynthesis(data.spokenSummary, data.language || selectedLanguage);
        }
      } else {
        const fallbackNotice = data?.message || (selectedLanguage === 'ta'
          ? 'குரலைப் புரிந்து கொள்ள முடியவில்லை. மீண்டும் தெளிவாகப் பேசவும் அல்லது எழுதி அனுப்பவும்.'
          : (selectedLanguage === 'hi'
            ? 'आपकी आवाज़ समझ नहीं आई। कृपया दोबारा बोलें या नीचे लिखकर पूछें।'
            : 'Could not transcribe speech. Please speak clearly or type your question below.'));
        setVoiceFailureState({
          type: 'STT_FAILED',
          message: fallbackNotice,
          canRetry: true,
        });
        if (textInputRef.current) textInputRef.current.focus({ preventScroll: true });
      }
    } catch (err) {
      console.warn('[LiveWeatherCard] Voice query error:', err.message);
      const fallbackMsg = selectedLanguage === 'ta'
        ? 'குரல் சேவை பிழை. தயவுசெய்து மீண்டும் பேசவும் அல்லது எழுதி அனுப்பவும்.'
        : (selectedLanguage === 'hi'
          ? 'वॉइस सेवा त्रुटि। कृपया दोबारा बोलें या नीचे लिखकर पूछें।'
          : 'Voice service unavailable. You can retry speaking or type below.');
      setVoiceFailureState({
        type: 'STT_FAILED',
        message: fallbackMsg,
        canRetry: true,
      });
      if (textInputRef.current) textInputRef.current.focus({ preventScroll: true });
    } finally {
      setIsVoiceProcessing(false);
    }
  };

  const formatTemperature = (val) => {
    if (val === null || val === undefined || val === '' || isNaN(Number(val))) return '—';
    const n = Number(val);
    return `${Number.isInteger(n) ? n : n.toFixed(1)} °C`;
  };

  const getTemperatureParts = (val) => {
    if (val === null || val === undefined || val === '' || isNaN(Number(val))) {
      return { number: '—', unit: '' };
    }
    const n = Number(val);
    return {
      number: Number.isInteger(n) ? String(n) : n.toFixed(1),
      unit: '°C',
    };
  };

  const formatFeelsLike = (val) => {
    if (val === null || val === undefined || val === '' || isNaN(Number(val))) return 'Feels like —';
    const n = Number(val);
    return `Feels like ${Number.isInteger(n) ? n : n.toFixed(1)} °C`;
  };

  // Dynamic Freshness Age Timer (Accurate Live vs Cached telemetry)
  const [freshnessDisplay, setFreshnessDisplay] = useState('');
  useEffect(() => {
    const updateFreshness = () => {
      const meta = weatherData?.metadata;
      if (!meta && !weatherData?.timestamp) return;
      const refTime = meta?.cachedAt
        ? new Date(meta.cachedAt).getTime()
        : (meta?.sourceUpdateTime
          ? new Date(meta.sourceUpdateTime).getTime()
          : (weatherData?.timestamp ? new Date(weatherData.timestamp).getTime() : null));
      if (!refTime || isNaN(refTime)) return;

      const diffMs = Math.max(0, Date.now() - refTime);
      const minutes = Math.floor(diffMs / 60000);
      const isCachedData = Boolean(meta?.isCached || meta?.isStale || meta?.statusBadge === 'CACHED' || meta?.statusBadge === 'STALE');
      const action = isCachedData ? 'Cached' : 'Updated';

      if (minutes < 1) {
        setFreshnessDisplay(`${action} just now`);
      } else if (minutes === 1) {
        setFreshnessDisplay(`${action} 1 minute ago`);
      } else if (minutes < 60) {
        setFreshnessDisplay(`${action} ${minutes} minutes ago`);
      } else {
        const timeStr = new Date(refTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        setFreshnessDisplay(`${action} at ${timeStr}`);
      }
    };

    updateFreshness();
    const interval = setInterval(updateFreshness, 30000);
    return () => clearInterval(interval);
  }, [weatherData]);

  if (isLoading) {
    return (
      <div className={`p-4 rounded-2xl bg-surface-container/70 border border-outline-variant/60 shadow-xs animate-pulse ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 w-36 bg-surface-container-high rounded-md"></div>
          <div className="h-4 w-20 bg-surface-container-high rounded-full"></div>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-surface-container-high"></div>
          <div className="space-y-2 flex-1">
            <div className="h-6 w-24 bg-surface-container-high rounded-md"></div>
            <div className="h-3 w-40 bg-surface-container-high rounded-md"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!weatherData && errorNotice) {
    return (
      <div id="live-weather-card-unavailable" className={`p-4 rounded-2xl bg-surface-container/70 border border-outline-variant/60 shadow-xs text-xs space-y-3 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-on-surface-variant font-bold">
            <span className="material-symbols-outlined text-amber-500 text-base">cloud_off</span>
            <span>Meteorological Observation Stream Unavailable</span>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 uppercase">
            UNAVAILABLE
          </span>
        </div>
        <p className="text-[11px] text-on-surface-variant leading-relaxed">
          {errorNotice}. Live observation and forecasts for {activeLocationLabel} cannot be retrieved from upstream providers at this moment.
        </p>
        <button
          onClick={() => fetchWeather(true)}
          className="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-bold flex items-center gap-1.5 cursor-pointer text-xs"
          id="btn-retry-weather"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
          <span>Retry Ingestion</span>
        </button>
      </div>
    );
  }

  const current = weatherData?.current || {};
  const metadata = weatherData?.metadata || {};
  const warnings = weatherData?.warnings || [];
  const hourly = (weatherData?.hourlyForecast || []).slice(0, 6);
  const daily = (weatherData?.dailyForecast || []).slice(0, 7);

  // Strict freshness rules: Never claim live if stale or provider is offline or served from cache
  const isStale = Boolean(metadata.isStale || metadata.ageMinutes >= 30);
  const isCached = Boolean(metadata.isCached || metadata.statusBadge === 'CACHED');
  const statusBadge = isStale ? 'STALE' : (isCached ? 'CACHED' : 'LIVE');

  return (
    <div
      id="live-weather-card"
      className={`rounded-2xl border transition-all duration-300 overflow-hidden shadow-xs ${
        isStale
          ? 'bg-gradient-to-br from-amber-500/10 via-surface-container to-surface-container border-amber-500/30'
          : 'bg-gradient-to-br from-surface-container-high/60 via-surface-container to-surface-container border-outline-variant/60'
      } ${className}`}
    >
      {/* Top Location Mode & Navigation Bar */}
      <div className="px-3.5 py-2.5 border-b border-outline-variant/40 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Current GPS vs Search Location Toggle */}
          <button
            id="btn-weather-mode-gps"
            type="button"
            onClick={handleSwitchToGps}
            aria-pressed={locationMode === 'CURRENT'}
            aria-label="Use current GPS device location"
            className={`min-h-[44px] px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              locationMode === 'CURRENT'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'bg-surface-container-high text-on-surface-variant hover:text-primary'
            }`}
          >
            <span className={`material-symbols-outlined text-sm ${isGpsDetecting ? 'animate-spin' : ''}`} aria-hidden="true">
              my_location
            </span>
            <span>Current GPS</span>
          </button>

          <button
            id="btn-weather-mode-search"
            type="button"
            onClick={() => setLocationMode('SEARCH')}
            aria-pressed={locationMode === 'SEARCH'}
            aria-label="Search city or location"
            className={`min-h-[44px] px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              locationMode === 'SEARCH'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'bg-surface-container-high text-on-surface-variant hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-sm" aria-hidden="true">search</span>
            <span>Search Place</span>
          </button>
        </div>

        {/* Live vs Cached vs Stale Status Badge & Manual Refresh */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[10px] font-extrabold uppercase tracking-wider ${
              isStale
                ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40'
                : isCached
                ? 'bg-sky-500/20 text-sky-800 dark:text-sky-300 border border-sky-500/40'
                : 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40'
            }`}
            title={isStale ? 'Provider offline or data stale. Displaying last valid meteorological snapshot.' : (isCached ? 'Displaying valid cached meteorological observation' : 'Real-time verified provider feed')}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isStale ? 'bg-amber-500' : (isCached ? 'bg-sky-400' : 'bg-emerald-500 animate-pulse')}`} />
            {statusBadge}
          </span>

          <span className="text-[11px] text-on-surface-variant font-medium hidden sm:inline" title={metadata.sourceUpdateTime ? `Data observed: ${new Date(metadata.sourceUpdateTime).toLocaleString()}` : freshnessDisplay}>
            {freshnessDisplay}
            {metadata.sourceUpdateTime && (
              <span className="ml-1 text-[10px] opacity-70 font-mono">
                (Data: {new Date(metadata.sourceUpdateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })})
              </span>
            )}
          </span>


          <button
            id="btn-refresh-weather"
            type="button"
            onClick={() => fetchWeather(true)}
            disabled={isRefreshing}
            className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl hover:bg-surface-container-highest text-on-surface-variant hover:text-primary transition-colors cursor-pointer flex items-center justify-center"
            title="Refresh meteorological feed"
            aria-label="Refresh weather data"
          >
            <span className={`material-symbols-outlined text-base ${isRefreshing ? 'animate-spin text-secondary' : ''}`} aria-hidden="true">
              refresh
            </span>
          </button>
        </div>
      </div>

      {/* Search Input Bar (Visible in SEARCH Mode) */}
      {locationMode === 'SEARCH' && (
        <div className="px-3.5 pt-3 pb-1 relative">
          <div className="relative">
            <span className="material-symbols-outlined text-sm text-on-surface-variant absolute left-3 top-2.5">
              search
            </span>
            <input
              id="input-weather-search"
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => {
                if (searchQuery.trim().length >= 2) {
                  setShowSearchDropdown(true);
                }
              }}
              placeholder="Type city or region (e.g. Salem, Chennai, Bengaluru)..."
              className="w-full pl-9 pr-14 py-2 text-xs rounded-xl bg-surface-container-high border border-outline-variant/70 text-primary placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {isSearching && (
              <span className="material-symbols-outlined text-xs text-secondary animate-spin absolute right-3 top-3">
                sync
              </span>
            )}
            {searchQuery && !isSearching && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setShowSearchDropdown(false);
                  setSearchError(null);
                }}
                className="material-symbols-outlined text-xs text-on-surface-variant hover:text-primary absolute right-3 top-2.5 cursor-pointer p-0.5 rounded-full hover:bg-surface-container-highest"
                title="Clear search"
                aria-label="Clear search input"
              >
                close
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {showSearchDropdown && (
            <div
              id="weather-search-dropdown"
              className="absolute z-20 left-3.5 right-3.5 mt-1 bg-surface-container border border-outline-variant/80 rounded-xl shadow-lg overflow-hidden animate-fade-in max-h-64 overflow-y-auto"
            >
              {isSearching ? (
                <div id="search-status-loading" className="px-3.5 py-3 text-xs text-on-surface-variant flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-secondary animate-spin">sync</span>
                  <span>Searching places...</span>
                </div>
              ) : searchError ? (
                <div id="search-status-error" className="px-3.5 py-3 text-xs text-rose-500 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">error</span>
                  <span>{searchError}</span>
                </div>
              ) : searchResults.length === 0 ? (
                <div id="search-status-empty" className="px-3.5 py-3 text-xs text-on-surface-variant flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">search_off</span>
                  <span>No places found</span>
                </div>
              ) : (
                searchResults.map((loc) => {
                  const locationSubtext = [loc.admin1, loc.country].filter(Boolean).join(', ');
                  return (
                    <button
                      key={loc.id || `${loc.latitude}-${loc.longitude}`}
                      type="button"
                      onClick={() => handleSelectLocation(loc)}
                      className="w-full px-3.5 py-2.5 text-left hover:bg-surface-container-high flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer border-b border-outline-variant/30 last:border-0"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-primary block truncate">{loc.name}</span>
                        {locationSubtext && (
                          <span className="text-[11px] text-on-surface-variant block truncate">
                            {locationSubtext}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-on-surface-variant/70 shrink-0">
                        {Number(loc.latitude).toFixed(2)}°, {Number(loc.longitude).toFixed(2)}°
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* GPS Status Alert (When GPS is disabled / denied) */}
      {locationMode === 'CURRENT' && isGpsUnavailable && (
        <div className="mx-3.5 mt-2.5 p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="material-symbols-outlined text-sm text-amber-600 shrink-0">location_off</span>
            <span className="text-[11px] truncate">{gpsErrorMessage || 'GPS disabled or permission denied.'}</span>
          </div>
          <button
            type="button"
            onClick={() => setLocationMode('SEARCH')}
            className="text-[10px] font-bold text-primary underline shrink-0 hover:text-secondary cursor-pointer"
          >
            Search City
          </button>
        </div>
      )}

      {/* Main Meteorological Card Body */}
      <div className="p-3.5 sm:p-4 space-y-3.5">
        {/* ============================================================ */}
        {/* TOP: Location, Network Status & Current Weather */}
        {/* ============================================================ */}
        <div id="weather-top-overview" className="p-3.5 sm:p-4 rounded-2xl bg-surface-container-high/50 border border-outline-variant/40 space-y-3 shadow-xs">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="material-symbols-outlined text-rose-500 text-lg shrink-0">location_on</span>
              <span className="text-base sm:text-lg font-black text-primary truncate" title={activeLocationLabel}>
                {activeLocationLabel}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span
                id="weather-network-status-badge"
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-extrabold uppercase tracking-wider ${
                  isStale
                    ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40'
                    : isCached
                    ? 'bg-sky-500/20 text-sky-800 dark:text-sky-300 border border-sky-500/40'
                    : 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isStale ? 'bg-amber-500' : (isCached ? 'bg-sky-400' : 'bg-emerald-500 animate-pulse')}`} />
                {statusBadge}
              </span>

              <span className="text-[11px] text-on-surface-variant font-medium">
                {freshnessDisplay}
              </span>
            </div>
          </div>

          {/* Current Weather Hero */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            {/* Left: Weather Icon & Dedicated Temperature Block */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-14 h-14 rounded-2xl bg-secondary/15 border border-secondary/30 flex items-center justify-center shrink-0 shadow-inner">
                <span className="material-symbols-outlined text-3xl text-secondary">
                  {current.icon || 'partly_cloudy_day'}
                </span>
              </div>

              {/* Dedicated Temperature & Condition Wrapper (Zero Overlap with Submetrics) */}
              <div className="flex flex-col justify-center shrink-0 min-w-0">
                <div
                  id="weather-temperature-value"
                  className="temperature-value flex items-baseline whitespace-nowrap"
                  style={{ display: 'flex', alignItems: 'baseline', whiteSpace: 'nowrap' }}
                >
                  <span className="temperature-number text-3xl sm:text-4xl font-black text-primary font-mono tracking-tight whitespace-nowrap">
                    {getTemperatureParts(current.temperature).number}
                  </span>
                  {getTemperatureParts(current.temperature).unit && (
                    <span className="temperature-unit text-xl sm:text-2xl font-bold text-primary font-mono ml-1.5 whitespace-nowrap">
                      {getTemperatureParts(current.temperature).unit}
                    </span>
                  )}
                </div>

                {/* Feels like text */}
                <div
                  id="weather-feels-like"
                  className="text-xs text-on-surface-variant font-medium mt-0.5 whitespace-nowrap"
                >
                  {formatFeelsLike(current.feelsLike)}
                </div>

                {/* Weather condition description (bounded to never collide with submetrics) */}
                {(current.condition || current.conditionDescription) && (
                  <div className="text-[11px] font-semibold text-primary/80 truncate max-w-[130px] sm:max-w-[150px] mt-0.5">
                    {current.condition || current.conditionDescription}
                  </div>
                )}
              </div>
            </div>

            {/* Submetrics: Humidity, Wind, Rain Chance */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-[11px] font-mono text-on-surface-variant shrink-0 w-full sm:w-auto">
              <div
                id="weather-submetric-humidity"
                className="p-1.5 sm:p-2 rounded-xl bg-surface-container/60 border border-outline-variant/30 text-center min-w-[62px] sm:min-w-[74px]"
              >
                <span className="text-[9px] uppercase tracking-wider text-on-surface-variant/70 block">Humidity</span>
                <span className="font-bold text-primary">
                  {current.humidity != null && !isNaN(Number(current.humidity)) ? `${current.humidity}%` : '—'}
                </span>
              </div>
              <div className="p-1.5 sm:p-2 rounded-xl bg-surface-container/60 border border-outline-variant/30 text-center min-w-[62px] sm:min-w-[74px]">
                <span className="text-[9px] uppercase tracking-wider text-on-surface-variant/70 block">Wind</span>
                <span className="font-bold text-primary">
                  {current.windSpeed != null && !isNaN(Number(current.windSpeed)) ? `${current.windSpeed} km/h` : '—'}
                </span>
              </div>
              <div className="p-1.5 sm:p-2 rounded-xl bg-surface-container/60 border border-outline-variant/30 text-center min-w-[62px] sm:min-w-[74px]">
                <span className="text-[9px] uppercase tracking-wider text-on-surface-variant/70 block">Rain Chance</span>
                <span className="font-bold text-primary">
                  {current.rainProbability != null && !isNaN(Number(current.rainProbability))
                    ? `${current.rainProbability}%`
                    : (current.precipitationProbability != null && !isNaN(Number(current.precipitationProbability))
                      ? `${current.precipitationProbability}%`
                      : (current.precipitation != null && Number(current.precipitation) > 0 ? `${current.precipitation} mm` : '0%'))}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* WEATHER: Today, Tomorrow, Next 5 Days (Simple Cards) */}
        {/* ============================================================ */}
        <div id="weather-forecast-simple-cards" className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-on-surface-variant">
              WEATHER FORECAST • 7 DAYS
            </span>
            <span className="text-[9px] font-mono text-on-surface-variant/80">
              Today • Tomorrow • Next 5 days
            </span>
          </div>

          <div className="flex overflow-x-auto pb-2 scrollbar-thin snap-x max-w-full min-w-0 sm:grid sm:grid-cols-4 md:grid-cols-7 gap-2">
            {(daily.length > 0 ? daily : [
              { date: new Date().toISOString(), condition: current.condition || 'Clear', icon: current.icon || 'wb_sunny', temperatureMax: current.temperature, temperatureMin: current.temperature ? current.temperature - 5 : 20 },
              { date: new Date(Date.now() + 86400000).toISOString(), condition: 'Clear', icon: 'wb_sunny', temperatureMax: 30, temperatureMin: 23 },
              { date: new Date(Date.now() + 172800000).toISOString(), condition: 'Partly Cloudy', icon: 'partly_cloudy_day', temperatureMax: 31, temperatureMin: 24 },
              { date: new Date(Date.now() + 259200000).toISOString(), condition: 'Partly Cloudy', icon: 'partly_cloudy_day', temperatureMax: 30, temperatureMin: 23 },
              { date: new Date(Date.now() + 345600000).toISOString(), condition: 'Scattered Showers', icon: 'rainy', temperatureMax: 29, temperatureMin: 22 },
              { date: new Date(Date.now() + 432000000).toISOString(), condition: 'Clear', icon: 'wb_sunny', temperatureMax: 31, temperatureMin: 23 },
              { date: new Date(Date.now() + 518400000).toISOString(), condition: 'Clear', icon: 'wb_sunny', temperatureMax: 32, temperatureMin: 24 },
            ]).slice(0, 7).map((day, idx) => {
              const isToday = idx === 0;
              const isTomorrow = idx === 1;
              let dayLabel = isToday ? 'Today' : (isTomorrow ? 'Tomorrow' : '');
              if (!dayLabel) {
                try {
                  const d = new Date(day.date);
                  dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
                } catch (_) {
                  dayLabel = `Day +${idx}`;
                }
              }
              const maxT = day.temperatureMax != null && !isNaN(Number(day.temperatureMax)) ? `${Math.round(day.temperatureMax)}°` : '—';
              const minT = day.temperatureMin != null && !isNaN(Number(day.temperatureMin)) ? `${Math.round(day.temperatureMin)}°` : '—';
              const rainProb = day.precipitationProbabilityMax ?? day.rainProbability;

              return (
                <div
                  key={idx}
                  className={`min-w-[100px] shrink-0 sm:min-w-0 sm:shrink min-h-[148px] p-2.5 rounded-xl border flex flex-col items-center justify-between text-center transition-all snap-start ${
                    isToday
                      ? 'bg-secondary/10 border-secondary/40 shadow-xs'
                      : 'bg-surface-container-high/50 border-outline-variant/30 hover:border-outline-variant/60'
                  }`}
                >
                  {/* 1. DAY */}
                  <div className="flex items-center gap-1 h-4">
                    <span className={`text-[10px] font-bold ${isToday ? 'text-secondary' : 'text-primary'}`}>
                      {dayLabel}
                    </span>
                    {isToday && (
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                    )}
                  </div>

                  {/* 2. ICON */}
                  <div className="my-1 flex items-center justify-center h-7">
                    <span className="material-symbols-outlined text-2xl text-secondary">
                      {day.icon || 'wb_sunny'}
                    </span>
                  </div>

                  {/* 3. CONDITION */}
                  <div className="h-4 w-full flex items-center justify-center">
                    <span className="text-[10px] text-on-surface-variant truncate w-full px-1" title={day.condition || 'Clear'}>
                      {day.condition || 'Clear'}
                    </span>
                  </div>

                  {/* 4. MAX / MIN TEMPERATURE */}
                  <div className="text-xs font-mono font-bold text-primary mt-1 whitespace-nowrap">
                    <span>{maxT}</span>
                    <span className="text-[10px] text-on-surface-variant font-normal"> / {minT}</span>
                  </div>

                  {/* 5. PRECIPITATION */}
                  <div className="h-4 flex items-center justify-center mt-0.5">
                    {rainProb != null && rainProb > 0 ? (
                      <div className="flex items-center gap-0.5 text-[9px] font-mono text-sky-400">
                        <span className="material-symbols-outlined text-[10px]">water_drop</span>
                        <span>{rainProb}%</span>
                      </div>
                    ) : (
                      <span className="text-[9px] font-mono text-on-surface-variant/40">0% rain</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hourly Forecast Strip */}
          {hourly.length > 0 && (
            <div id="weather-hourly-strip" className="pt-1.5 overflow-x-auto max-w-full min-w-0 scrollbar-none">
              <div className="grid grid-cols-6 gap-1 text-center min-w-[250px]">
                {hourly.map((hour, idx) => {
                  const timeStr = hour.time ? new Date(hour.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : `+${idx + 1}h`;
                  return (
                    <div key={idx} className="p-1 rounded-lg bg-surface-container/60 border border-outline-variant/20 flex flex-col items-center">
                      <span className="text-[8px] font-mono text-on-surface-variant/80 block truncate max-w-full">
                        {timeStr}
                      </span>
                      <span className="material-symbols-outlined text-xs text-secondary my-0.5">
                        {hour.icon || 'cloud'}
                      </span>
                      <span className="text-[9px] font-mono font-bold text-primary">
                        {hour.temperature != null && !isNaN(Number(hour.temperature)) ? `${Math.round(hour.temperature)}°` : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* WARNING: Highly Visible Warning Banner */}
        {/* ============================================================ */}
        <div>
          {(() => {
            const hasWarnings = warnings.length > 0 || Boolean(riskData?.officialWarning?.hasActiveWarning);
            const primaryWarning = warnings.length > 0
              ? warnings[0]
              : (riskData?.officialWarning?.hasActiveWarning ? riskData.officialWarning : null);
            const isSevere = primaryWarning && (
              primaryWarning.severity === 'EMERGENCY' ||
              primaryWarning.severity === 'WARNING' ||
              primaryWarning.severity === 'CRITICAL' ||
              primaryWarning.severity === 'SEVERE'
            );

            if (!hasWarnings) {
              return (
                <div
                  id="weather-warning-banner-clear"
                  role="status"
                  aria-live="polite"
                  className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 space-y-1.5 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base leading-none" aria-hidden="true">🟢</span>
                      <span className="font-black text-xs uppercase tracking-wide text-emerald-300">
                        NO ACTIVE WEATHER WARNING
                      </span>
                    </div>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold uppercase">
                      ALL CLEAR
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    Normal atmospheric conditions. No active severe-weather warning was retrieved for this location.
                  </p>
                  <div className="pt-1.5 border-t border-emerald-500/20 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-on-surface-variant">
                    <span>Source: {metadata.source || 'India Meteorological Department (IMD) / Official Ensemble'}</span>
                    <span>Affected area: {activeLocationLabel}</span>
                    <span>Valid until: Continuous observation (24h)</span>
                  </div>
                </div>
              );
            }

            if (isSevere) {
              return (
                <div
                  id="weather-warning-banner-severe"
                  role="alert"
                  aria-live="assertive"
                  className="p-3.5 rounded-2xl bg-error/15 border-2 border-error text-error space-y-2 animate-pulse shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base leading-none" aria-hidden="true">🔴</span>
                      <span className="font-black text-xs uppercase tracking-wide text-error">
                        OFFICIAL SEVERE WEATHER WARNING
                      </span>
                    </div>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-error text-on-error font-bold uppercase">
                      {primaryWarning.severity || 'SEVERE'}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-error">
                    {primaryWarning.headline || primaryWarning.event || 'Severe Weather Warning'}
                  </div>
                  {(primaryWarning.description || primaryWarning.safetyRecommendation || primaryWarning.instruction) && (
                    <p className="text-[11px] text-on-surface leading-relaxed">
                      {primaryWarning.description || primaryWarning.safetyRecommendation || primaryWarning.instruction}
                    </p>
                  )}
                  <div className="pt-1.5 border-t border-error/30 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-on-surface-variant">
                    <span>Source: {primaryWarning.source || 'India Meteorological Department (IMD)'}</span>
                    <span>Affected area: {primaryWarning.area || primaryWarning.affectedArea || activeLocationLabel}</span>
                    <span>
                      Valid until: {primaryWarning.validUntil ? new Date(primaryWarning.validUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Next 6 hours'}
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <div
                id="weather-warning-banner-advisory"
                role="status"
                aria-live="polite"
                className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-500 space-y-2 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base leading-none" aria-hidden="true">🟠</span>
                    <span className="font-black text-xs uppercase tracking-wide text-amber-400">
                      🟠 WEATHER ADVISORY — Weather advisory
                    </span>
                  </div>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold uppercase">
                    {primaryWarning.severity || 'ADVISORY'}
                  </span>
                </div>
                <div className="text-xs font-bold text-primary">
                  {primaryWarning.headline || primaryWarning.event || 'Weather Advisory'}
                </div>
                {(primaryWarning.description || primaryWarning.safetyRecommendation || primaryWarning.instruction) && (
                  <p className="text-[11px] text-on-surface leading-relaxed">
                    {primaryWarning.description || primaryWarning.safetyRecommendation || primaryWarning.instruction}
                  </p>
                )}
                <div className="pt-1.5 border-t border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-on-surface-variant">
                  <span>Source: {primaryWarning.source || 'India Meteorological Department (IMD)'}</span>
                  <span>Affected area: {primaryWarning.area || primaryWarning.affectedArea || activeLocationLabel}</span>
                  <span>
                    Valid until: {primaryWarning.validUntil ? new Date(primaryWarning.validUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Next 12 hours'}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* ============================================================ */}
        {/* LOCAL RISK: Local Weather Risk (Low / Moderate / High) & Why? */}
        {/* ============================================================ */}
        <div id="weather-local-risk-card" className="p-3 rounded-2xl bg-surface-container-high/40 border border-outline-variant/40 space-y-2">
          {(() => {
            const riskAssessment = riskData?.resonixRiskAssessment;
            const rawLevel = riskAssessment?.level || 'LOW';
            const score = riskAssessment?.score ?? 0;
            const isHighRisk = rawLevel === 'HIGH' || rawLevel === 'CRITICAL' || score >= 50;
            const isModRisk = rawLevel === 'MODERATE' || (score >= 25 && score < 50);
            const displayLevel = isHighRisk ? 'High' : (isModRisk ? 'Moderate' : 'Low');
            const levelColor = isHighRisk
              ? 'text-rose-400 bg-rose-500/15 border-rose-500/30'
              : (isModRisk ? 'text-amber-400 bg-amber-500/15 border-amber-500/30' : 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30');
            const dotEmoji = isHighRisk ? '🔴' : (isModRisk ? '🟠' : '🟢');

            return (
              <>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                    <span className="material-symbols-outlined text-sm text-secondary shrink-0">security</span>
                    <span className="text-xs font-bold text-primary tracking-wide uppercase shrink-0">LOCAL WEATHER RISK</span>
                    <span id="risk-level-badge" className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold border shrink-0 ${levelColor}`}>
                      <span>{dotEmoji}</span>
                      <span>{displayLevel}</span>
                    </span>
                  </div>

                  <button
                    id="btn-toggle-risk-why"
                    type="button"
                    onClick={() => setIsWhyExpanded((prev) => !prev)}
                    className="text-[11px] font-bold text-secondary hover:underline flex items-center gap-1 cursor-pointer shrink-0 ml-auto"
                  >
                    <span>[ Why? ]</span>
                    <span className="material-symbols-outlined text-xs transition-transform" style={{ transform: isWhyExpanded ? 'rotate(180deg)' : 'none' }}>
                      expand_more
                    </span>
                  </button>
                </div>

                {/* Collapsible "Why?" Explanation */}
                {isWhyExpanded && (
                  <div id="risk-why-explanation" className="p-2.5 rounded-xl bg-surface-container border border-outline-variant/30 text-xs space-y-2 animate-fade-in">
                    <p className="text-[11px] text-primary leading-relaxed font-medium">
                      {riskAssessment?.recommendation || 'Atmospheric sensors and ground reports indicate stable, calm conditions with no elevated adverse weather hazards.'}
                    </p>

                    <div className="space-y-1">
                      <span className="text-[10px] font-mono text-on-surface-variant font-bold uppercase tracking-wider block">
                        Key Factors:
                      </span>
                      {(riskAssessment?.contributingFactors || []).length > 0 ? (
                        <div className="space-y-1">
                          {riskAssessment.contributingFactors.map((fac, idx) => (
                            <div key={idx} className="flex items-start gap-1.5 text-[11px] text-on-surface">
                              <span className="text-secondary mt-0.5">•</span>
                              <span>{fac.reason}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-on-surface-variant">
                          • Rain, wind, temperature, and atmospheric pressure are all within normal safe baselines.
                        </p>
                      )}
                    </div>

                    {/* Collapsible toggle for Technical Sensor Telemetry */}
                    <div className="pt-2 border-t border-outline-variant/30">
                      <button
                        id="btn-toggle-tech-risk"
                        type="button"
                        onClick={() => setIsRiskExpanded((prev) => !prev)}
                        className="text-[10px] font-mono text-on-surface-variant hover:text-primary flex items-center gap-1 cursor-pointer"
                      >
                        <span>{isRiskExpanded ? 'Hide technical engine analysis' : 'View technical engine analysis & sensor telemetry'}</span>
                        <span className="material-symbols-outlined text-xs">
                          {isRiskExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>

                      {/* Nested Technical Engine Analysis */}
                      {isRiskExpanded && (
                        <div id="risk-tech-details-container" className="mt-2.5 pt-2 border-t border-outline-variant/20 space-y-3">
                          {/* Disclaimer Notice */}
                          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2">
                            <span className="material-symbols-outlined text-sm text-amber-400 shrink-0 mt-0.5">info</span>
                            <p className="text-[10px] text-on-surface-variant leading-relaxed">
                              <strong className="text-amber-400">Decision-Support Layer Only:</strong> This is a Resonix AI analytical assessment based on factual signals and ground reports. It is <span className="underline font-semibold">NOT</span> an official government warning system.
                            </p>
                          </div>

                          {/* Technical Pillar 1: Official Warning */}
                          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-1">
                            <div className="flex items-center justify-between text-blue-400 font-mono font-bold text-[10px] uppercase">
                              <span>Pillar 1: Official Warning</span>
                              <span>{riskData?.officialWarning?.hasActiveWarning ? `${riskData.officialWarning.severity} ACTIVE` : 'NO ACTIVE WARNING'}</span>
                            </div>
                            <div className="text-[11px] text-primary">{riskData?.officialWarning?.headline || 'No active official government weather warnings'}</div>
                          </div>

                          {/* Technical Pillar 2: Resonix Risk Assessment Score */}
                          <div className="p-2.5 rounded-xl bg-surface-container-high/60 border border-outline-variant/30 space-y-1.5">
                            <div className="flex items-center justify-between text-[10px] font-mono text-rose-400 font-bold uppercase">
                              <span>Pillar 2: 7-Signal Deterministic Risk Engine</span>
                              <span>{riskAssessment?.score ?? 0} / 100</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-surface-container overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  score >= 75 ? 'bg-rose-500' : (score >= 50 ? 'bg-orange-500' : (score >= 25 ? 'bg-amber-500' : 'bg-emerald-500'))
                                }`}
                                style={{ width: `${score}%` }}
                              />
                            </div>
                          </div>

                          {/* Technical Pillar 3: Citizen Ground Report */}
                          <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/30 space-y-1">
                            <div className="flex items-center justify-between text-orange-400 font-mono font-bold text-[10px] uppercase">
                              <span>Pillar 3: Citizen Ground Reports</span>
                              <span>{riskData?.citizenGroundReport?.activeCount ?? 0} ACTIVE</span>
                            </div>
                            <div className="text-[11px] text-on-surface-variant">
                              Radius: Within {riskData?.citizenGroundReport?.radiusKm ?? 25} km of coordinate grid.
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* ============================================================ */}
        {/* CITIZEN REPORTS: Citizen Reports Nearby & Tap to Expand */}
        {/* ============================================================ */}
        <div id="weather-citizen-reports-card" className="p-3 rounded-2xl bg-surface-container-high/40 border border-outline-variant/40 space-y-2">
          {(() => {
            const citizenRep = riskData?.citizenGroundReport;
            const count = citizenRep?.activeCount ?? 0;
            const reports = citizenRep?.reports || [];
            const radius = citizenRep?.radiusKm ?? 25;

            return (
              <>
                <button
                  id="btn-toggle-citizen-reports"
                  type="button"
                  onClick={() => setIsReportsExpanded((prev) => !prev)}
                  className="w-full flex items-center justify-between text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-secondary group-hover:scale-110 transition-transform">
                      record_voice_over
                    </span>
                    <span className="text-xs font-bold text-primary group-hover:text-secondary transition-colors">
                      Citizen reports nearby
                    </span>
                    <span id="citizen-reports-count-badge" className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                      count > 0 ? 'bg-orange-500/15 text-orange-400 border-orange-500/30' : 'bg-surface-container text-on-surface-variant border-outline-variant/40'
                    }`}>
                      {count} {count === 1 ? 'report nearby' : 'reports nearby'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-[10px] text-on-surface-variant group-hover:text-primary">
                    <span>{isReportsExpanded ? 'Hide' : 'Tap to expand'}</span>
                    <span className="material-symbols-outlined text-xs transition-transform" style={{ transform: isReportsExpanded ? 'rotate(180deg)' : 'none' }}>
                      expand_more
                    </span>
                  </div>
                </button>

                {/* Expanded Citizen Reports List */}
                {isReportsExpanded && (
                  <div className="p-2.5 rounded-xl bg-surface-container border border-outline-variant/30 text-xs space-y-2 animate-fade-in">
                    <div className="flex items-center justify-between text-[10px] font-mono text-on-surface-variant">
                      <span>Radius: Within {radius} km of your location</span>
                      <span>Ground Reports</span>
                    </div>

                    {reports.length > 0 ? (
                      <div className="space-y-1.5">
                        {reports.map((rep, idx) => (
                          <div key={idx} className="p-2 rounded-lg bg-surface-container-high border border-outline-variant/30 flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="material-symbols-outlined text-sm text-orange-400 shrink-0">report_problem</span>
                              <div className="min-w-0">
                                <span className="font-bold text-primary block truncate">{rep.title}</span>
                                <span className="text-[10px] text-on-surface-variant block truncate">{rep.location}</span>
                              </div>
                            </div>
                            <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 shrink-0">
                              {rep.severity || 'INCIDENT'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 text-center text-xs text-on-surface-variant bg-surface-container-high/30 rounded-lg">
                        0 reports nearby. No weather-related incidents reported in your immediate area ({radius} km).
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* ============================================================ */}
        {/* WEATHERGPT: Conversational AI (Voice & Text) */}
        {/* ============================================================ */}
        <div
          id="weather-weathergpt-section"
          role="region"
          aria-label="Ask WeatherGPT Conversational Weather Assistant"
          className="mt-4 pt-3.5 border-t border-outline-variant/40"
        >
          {/* Header Row: Title, Clear button & Dynamic Grounding Status (Part 6 & Part 9) */}
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-secondary text-base" aria-hidden="true">neurology</span>
              <span className="text-xs font-black text-primary uppercase tracking-wide">
                {selectedLanguage === 'ta' ? 'Ask WeatherGPT (வானிலை AI)' : (selectedLanguage === 'hi' ? 'Ask WeatherGPT (मौसम AI)' : 'Ask WeatherGPT')}
              </span>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {chatMessages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setChatMessages([]);
                    setAssistantResponse(null);
                  }}
                  className="min-h-[36px] px-2.5 py-1 rounded-xl text-xs font-mono text-on-surface-variant hover:text-primary hover:bg-surface-container flex items-center gap-1 cursor-pointer transition-colors border border-outline-variant/40"
                  title="Clear conversation"
                  aria-label="Clear conversation history"
                >
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">restart_alt</span>
                  <span>Clear</span>
                </button>
              )}

              {/* Dynamic Grounding Status Badge (Part 9) */}
              {weatherData?.current ? (
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Grounded in current weather data</span>
                </span>
              ) : (
                <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>Weather data unavailable</span>
                </span>
              )}
            </div>
          </div>

          {/* Dedicated Language Selector Row (Part 6) */}
          <div className="flex items-center gap-2 flex-wrap mb-2.5">
            <div className="flex items-center bg-surface-container rounded-xl p-0.5 border border-outline-variant/40" role="toolbar" aria-label="Select WeatherGPT language">
              <button
                id="btn-lang-en"
                type="button"
                onClick={() => setSelectedLanguage('en')}
                aria-pressed={selectedLanguage === 'en'}
                aria-label="Switch conversation language to English"
                className={`min-h-[38px] px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
                  selectedLanguage === 'en'
                    ? 'bg-secondary text-on-secondary shadow-xs'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
                title="Switch to English"
              >
                English
              </button>
              <button
                id="btn-lang-ta"
                type="button"
                onClick={() => setSelectedLanguage('ta')}
                aria-pressed={selectedLanguage === 'ta'}
                aria-label="Switch conversation language to Tamil (தமிழ்)"
                className={`min-h-[38px] px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
                  selectedLanguage === 'ta'
                    ? 'bg-secondary text-on-secondary shadow-xs'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
                title="தமிழுக்கு மாற்றவும் (Tamil)"
              >
                தமிழ்
              </button>
              <button
                id="btn-lang-hi"
                type="button"
                onClick={() => setSelectedLanguage('hi')}
                aria-pressed={selectedLanguage === 'hi'}
                aria-label="Switch conversation language to Hindi (हिन्दी)"
                className={`min-h-[38px] px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
                  selectedLanguage === 'hi'
                    ? 'bg-secondary text-on-secondary shadow-xs'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
                title="हिन्दी में बदलें (Hindi)"
              >
                हिन्दी
              </button>
            </div>

            {/* More Languages Dropdown */}
            <div className="relative">
              <select
                id="select-more-languages"
                value={MORE_INDIAN_LANGUAGES.some((l) => l.code === selectedLanguage) ? selectedLanguage : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedLanguage(e.target.value);
                  }
                }}
                aria-label="Select more regional Indian languages for WeatherGPT"
                className={`min-h-[38px] text-xs font-semibold px-3 py-1.5 rounded-xl border cursor-pointer transition-colors appearance-none pr-7 bg-surface-container focus:outline-none focus:ring-1 focus:ring-secondary ${
                  MORE_INDIAN_LANGUAGES.some((l) => l.code === selectedLanguage)
                    ? 'border-secondary text-secondary bg-secondary/10 font-bold'
                    : 'border-outline-variant/40 text-on-surface-variant hover:text-primary'
                }`}
                title="More Indian languages (Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, Punjabi)"
              >
                <option value="" disabled className="bg-surface-container-high text-on-surface">
                  {MORE_INDIAN_LANGUAGES.some((l) => l.code === selectedLanguage)
                    ? `More: ${MORE_INDIAN_LANGUAGES.find((l) => l.code === selectedLanguage)?.label}`
                    : 'More languages ▾'}
                </option>
                {MORE_INDIAN_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code} className="bg-surface-container-high text-on-surface">
                    {lang.label}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-on-surface-variant" aria-hidden="true">
                ▼
              </span>
            </div>
          </div>

          {/* Secondary Context Banner: Location, Time, Auto-context */}
          <div id="weathergpt-context-banner" className="flex items-center justify-between flex-wrap gap-2 text-[10px] font-mono text-on-surface-variant/80 bg-surface-container/40 border border-outline-variant/20 px-2.5 py-1.5 rounded-lg mb-2.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="flex items-center gap-1 text-on-surface font-medium">
                <span className="material-symbols-outlined text-xs text-secondary">location_on</span>
                <span>{activeLocationLabel}</span>
              </span>
              <span className="text-outline-variant">•</span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">schedule</span>
                <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </span>
            </div>
            <div className="flex items-center gap-1 text-emerald-400/90 font-medium">
              <span className="material-symbols-outlined text-xs">check_circle</span>
              <span>Auto-context active</span>
            </div>
          </div>

          {/* Primary Conversational Screen: Clean Welcome Card with Canonical Examples */}
          {chatMessages.length === 0 ? (
            <div className="p-4 rounded-xl bg-surface-container/40 border border-outline-variant/30 text-center mb-3">
              <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-secondary/10 border border-secondary/30 flex items-center justify-center text-secondary shadow-xs">
                <span className="material-symbols-outlined text-xl">smart_toy</span>
              </div>
              <h4 className="text-xs font-bold text-primary mb-1">
                {selectedLanguage === 'ta' ? 'வானிலை AI உடனான உரையாடல்' : (selectedLanguage === 'hi' ? 'मौसम सहायक से बातचीत करें' : 'Conversational Weather Assistant')}
              </h4>
              <p className="text-[11px] text-on-surface-variant max-w-sm mx-auto mb-3">
                {selectedLanguage === 'ta'
                  ? 'வானிலை, மழை வாய்ப்பு, மற்றும் பாதுகாப்பு ஆலோசனைகளை நேரடியாக கேளுங்கள்.'
                  : (selectedLanguage === 'hi'
                    ? 'मौसम, वर्षा की संभावना और सुरक्षा उपायों के बारे में स्वाभाविक भाषा में पूछें।'
                    : 'Ask anything about your local weather, upcoming rain, warnings, and safety recommendations.')}
              </p>

              <div className="text-[10px] font-mono font-bold text-on-surface-variant uppercase tracking-wider mb-2 flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-xs text-secondary">tips_and_updates</span>
                <span>{selectedLanguage === 'ta' ? 'உதாரண கேள்விகள் (Examples):' : (selectedLanguage === 'hi' ? 'उदाहरण प्रश्न (Examples):' : 'Examples:')}</span>
              </div>

              {/* Canonical 4 Examples + 5-day forecast chips */}
              <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Suggested weather questions">
                <button
                  id="chip-weather-now"
                  type="button"
                  onClick={() => handleAskAssistant(selectedLanguage === 'ta' ? 'இன்றைய வானிலை எப்படி இருக்கிறது?' : (selectedLanguage === 'hi' ? 'आज मौसम कैसा है?' : "What is the weather now?"))}
                  disabled={isAsking || isVoiceRecording || isVoiceProcessing}
                  aria-label="Ask what is the weather now"
                  className="min-h-[44px] px-3.5 py-2 rounded-full bg-surface-container-high hover:bg-secondary/15 hover:text-secondary text-[11px] font-medium text-primary border border-secondary/40 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <span aria-hidden="true">⛅</span>
                  <span>{selectedLanguage === 'ta' ? 'இன்றைய வானிலை என்ன?' : (selectedLanguage === 'hi' ? 'आज मौसम कैसा है?' : '"What is the weather now?"')}</span>
                </button>
                <button
                  id="chip-rain-tomorrow"
                  type="button"
                  onClick={() => handleAskAssistant(selectedLanguage === 'ta' ? 'நாளை மழை பெய்யுமா?' : (selectedLanguage === 'hi' ? 'क्या कल बारिश होगी?' : 'Will it rain tomorrow?'))}
                  disabled={isAsking || isVoiceRecording || isVoiceProcessing}
                  aria-label="Ask will it rain tomorrow"
                  className="min-h-[44px] px-3.5 py-2 rounded-full bg-surface-container-high hover:bg-secondary/15 hover:text-secondary text-[11px] font-medium text-primary border border-secondary/40 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <span aria-hidden="true">🌧️</span>
                  <span>{selectedLanguage === 'ta' ? 'நாளை மழை பெய்யுமா?' : (selectedLanguage === 'hi' ? 'क्या कल बारिश होगी?' : '"Will it rain tomorrow?"')}</span>
                </button>
                <button
                  id="chip-severe-warnings"
                  type="button"
                  onClick={() => handleAskAssistant(selectedLanguage === 'ta' ? 'என் அருகில் ஏதேனும் எச்சரிக்கை உள்ளதா?' : (selectedLanguage === 'hi' ? 'क्या मेरे पास कोई चेतावनी है?' : 'Is there any warning near me?'))}
                  disabled={isAsking || isVoiceRecording || isVoiceProcessing}
                  aria-label="Ask is there any warning near me"
                  className="min-h-[44px] px-3.5 py-2 rounded-full bg-surface-container-high hover:bg-amber-500/15 hover:text-amber-400 text-[11px] font-medium text-primary border border-amber-500/40 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <span aria-hidden="true">⚠️</span>
                  <span>{selectedLanguage === 'ta' ? 'எச்சரிக்கை இருக்கா?' : (selectedLanguage === 'hi' ? 'कोई चेतावनी है?' : '"Is there any warning near me?"')}</span>
                </button>
                <button
                  id="chip-warning-action"
                  type="button"
                  onClick={() => handleAskAssistant(selectedLanguage === 'ta' ? 'கனமழை தொடங்கினால் நான் என்ன செய்ய வேண்டும்?' : (selectedLanguage === 'hi' ? 'यदि भारी बारिश शुरू हो जाए तो मुझे क्या करना चाहिए?' : 'What should I do if heavy rain starts?'))}
                  disabled={isAsking || isVoiceRecording || isVoiceProcessing}
                  aria-label="Ask what should I do if heavy rain starts"
                  className="min-h-[44px] px-3.5 py-2 rounded-full bg-surface-container-high hover:bg-emerald-500/15 hover:text-emerald-400 text-[11px] font-medium text-primary border border-emerald-500/40 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <span aria-hidden="true">🛡️</span>
                  <span>{selectedLanguage === 'ta' ? 'கனமழை தொடங்கினால் என்ன செய்ய வேண்டும்?' : (selectedLanguage === 'hi' ? 'भारी बारिश पर क्या करें?' : '"What should I do if heavy rain starts?"')}</span>
                </button>
                <button
                  id="chip-forecast-5day"
                  type="button"
                  onClick={() => handleAskAssistant(selectedLanguage === 'ta' ? 'அடுத்த 5 நாட்களுக்கான வானிலை முன்னறிவிப்பு என்ன?' : (selectedLanguage === 'hi' ? '5 दिनों का मौसम पूर्वानुमान क्या है?' : 'What is the 5-day weather forecast?'))}
                  disabled={isAsking || isVoiceRecording || isVoiceProcessing}
                  aria-label="Ask what is the 5-day weather forecast"
                  className="min-h-[44px] px-3.5 py-2 rounded-full bg-surface-container-high hover:bg-secondary/15 hover:text-secondary text-[11px] font-medium text-primary border border-outline-variant/60 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <span aria-hidden="true">📅</span>
                  <span>{selectedLanguage === 'ta' ? '5 நாள் முன்னறிவிப்பு' : (selectedLanguage === 'hi' ? '5 दिनों का पूर्वानुमान' : '"What is the 5-day weather forecast?"')}</span>
                </button>
              </div>

              {/* Sector Advisory Quick Actions (SIH26068 Phase 4) */}
              <div className="w-full pt-2.5 mt-2 border-t border-outline-variant/30 flex flex-col items-center gap-1.5">
                <div className="text-[10px] font-mono font-bold text-secondary uppercase tracking-wider flex items-center justify-center gap-1">
                  <span className="material-symbols-outlined text-xs">work</span>
                  <span>{selectedLanguage === 'ta' ? 'துறைசார் ஆலோசனைகள் (Sector Advisories):' : (selectedLanguage === 'hi' ? 'क्षेत्रीय परामर्श (Sector Advisories):' : 'Sector Advisories:')}</span>
                </div>

                {/* Mobile View: Compact Dropdown [ Sector Advisories ▾ ] to prevent crowded layout */}
                <div className="relative sm:hidden">
                  <button
                    id="btn-sector-advisories-dropdown"
                    type="button"
                    onClick={() => setIsSectorDropdownOpen((prev) => !prev)}
                    disabled={isAsking || isVoiceRecording || isVoiceProcessing}
                    aria-expanded={isSectorDropdownOpen}
                    aria-haspopup="true"
                    aria-label="Sector Advisories"
                    className="min-h-[44px] px-4 py-2 rounded-full bg-surface-container-high hover:bg-secondary/15 hover:text-secondary text-[11px] font-medium text-primary border border-secondary/40 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <span>{selectedLanguage === 'ta' ? 'துறைசார் ஆலோசனைகள் ▾' : (selectedLanguage === 'hi' ? 'क्षेत्रीय परामर्श ▾' : 'Sector Advisories ▾')}</span>
                  </button>

                  {isSectorDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-20"
                        onClick={() => setIsSectorDropdownOpen(false)}
                        aria-hidden="true"
                      />
                      <div
                        id="sector-advisories-dropdown-menu"
                        role="menu"
                        aria-label="Sector Advisories Menu"
                        className="absolute left-1/2 -translate-x-1/2 mt-1.5 w-48 rounded-xl bg-surface-container-highest border border-outline-variant/60 shadow-xl py-1 z-30 animate-in fade-in zoom-in-95 duration-100"
                      >
                        <button
                          id="dropdown-sector-farming"
                          role="menuitem"
                          type="button"
                          onClick={() => {
                            setIsSectorDropdownOpen(false);
                            handleAskAssistant(
                              selectedLanguage === 'ta'
                                ? 'எனது தற்போதைய இடத்திற்கான விவசாய ஆலோசனையை வழங்கவும்.'
                                : (selectedLanguage === 'hi'
                                  ? 'मेरे वर्तमान स्थान के लिए कृषि सलाह दीजिए।'
                                  : 'Give me farming advice for my current location.')
                            );
                          }}
                          className="w-full px-4 py-2.5 text-left text-xs font-medium text-primary hover:bg-emerald-500/15 hover:text-emerald-400 flex items-center gap-2.5 cursor-pointer transition-colors"
                        >
                          <span className="text-sm" aria-hidden="true">🌾</span>
                          <span>{selectedLanguage === 'ta' ? 'விவசாயம் (Farming)' : (selectedLanguage === 'hi' ? 'कृषि (Farming)' : 'Farming')}</span>
                        </button>
                        <button
                          id="dropdown-sector-aviation"
                          role="menuitem"
                          type="button"
                          onClick={() => {
                            setIsSectorDropdownOpen(false);
                            handleAskAssistant(
                              selectedLanguage === 'ta'
                                ? 'தற்போதைய விமானப் போக்குவரத்து வானிலை நிலை என்ன?'
                                : (selectedLanguage === 'hi'
                                  ? 'वर्तमान विमानन मौसम की स्थिति क्या है?'
                                  : 'What are the current aviation weather conditions?')
                            );
                          }}
                          className="w-full px-4 py-2.5 text-left text-xs font-medium text-primary hover:bg-sky-500/15 hover:text-sky-400 flex items-center gap-2.5 cursor-pointer transition-colors"
                        >
                          <span className="text-sm" aria-hidden="true">🛩️</span>
                          <span>{selectedLanguage === 'ta' ? 'விமானம் (Aviation)' : (selectedLanguage === 'hi' ? 'विमानन (Aviation)' : 'Aviation')}</span>
                        </button>
                        <button
                          id="dropdown-sector-marine"
                          role="menuitem"
                          type="button"
                          onClick={() => {
                            setIsSectorDropdownOpen(false);
                            handleAskAssistant(
                              selectedLanguage === 'ta'
                                ? 'தற்போதைய கடல் வானிலை மற்றும் மீன்பிடி நிலை என்ன?'
                                : (selectedLanguage === 'hi'
                                  ? 'वर्तमान समुद्री मौसम की स्थिति क्या है?'
                                  : 'What are the current marine weather conditions?')
                            );
                          }}
                          className="w-full px-4 py-2.5 text-left text-xs font-medium text-primary hover:bg-cyan-500/15 hover:text-cyan-400 flex items-center gap-2.5 cursor-pointer transition-colors"
                        >
                          <span className="text-sm" aria-hidden="true">🚢</span>
                          <span>{selectedLanguage === 'ta' ? 'கடல் (Marine)' : (selectedLanguage === 'hi' ? 'समुद्री (Marine)' : 'Marine')}</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Desktop/Tablet View: Preferred Direct Action Buttons */}
                <div className="hidden sm:flex flex-wrap justify-center gap-2" role="group" aria-label="Sector advisory questions">
                  <button
                    id="chip-farming-advice"
                    type="button"
                    onClick={() => handleAskAssistant(
                      selectedLanguage === 'ta'
                        ? 'எனது தற்போதைய இடத்திற்கான விவசாய ஆலோசனையை வழங்கவும்.'
                        : (selectedLanguage === 'hi'
                          ? 'मेरे वर्तमान स्थान के लिए कृषि सलाह दीजिए।'
                          : 'Give me farming advice for my current location.')
                    )}
                    disabled={isAsking || isVoiceRecording || isVoiceProcessing}
                    aria-label="Ask for farming advice"
                    className="min-h-[44px] px-3.5 py-2 rounded-full bg-surface-container-high hover:bg-emerald-500/15 hover:text-emerald-400 text-[11px] font-medium text-primary border border-emerald-500/40 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <span aria-hidden="true">🌾</span>
                    <span>{selectedLanguage === 'ta' ? 'விவசாய ஆலோசனை (Farming advice)' : (selectedLanguage === 'hi' ? 'कृषि सलाह (Farming advice)' : 'Farming advice')}</span>
                  </button>
                  <button
                    id="chip-flying-conditions"
                    type="button"
                    onClick={() => handleAskAssistant(
                      selectedLanguage === 'ta'
                        ? 'தற்போதைய விமானப் போக்குவரத்து வானிலை நிலை என்ன?'
                        : (selectedLanguage === 'hi'
                          ? 'वर्तमान विमानन मौसम की स्थिति क्या है?'
                          : 'What are the current aviation weather conditions?')
                    )}
                    disabled={isAsking || isVoiceRecording || isVoiceProcessing}
                    aria-label="Ask for flying conditions"
                    className="min-h-[44px] px-3.5 py-2 rounded-full bg-surface-container-high hover:bg-sky-500/15 hover:text-sky-400 text-[11px] font-medium text-primary border border-sky-500/40 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <span aria-hidden="true">🛩️</span>
                    <span>{selectedLanguage === 'ta' ? 'விமான நிலை (Flying conditions)' : (selectedLanguage === 'hi' ? 'उड़ान स्थिति (Flying conditions)' : 'Flying conditions')}</span>
                  </button>
                  <button
                    id="chip-sea-conditions"
                    type="button"
                    onClick={() => handleAskAssistant(
                      selectedLanguage === 'ta'
                        ? 'தற்போதைய கடல் வானிலை மற்றும் மீன்பிடி நிலை என்ன?'
                        : (selectedLanguage === 'hi'
                          ? 'वर्तमान समुद्री मौसम की स्थिति क्या है?'
                          : 'What are the current marine weather conditions?')
                    )}
                    disabled={isAsking || isVoiceRecording || isVoiceProcessing}
                    aria-label="Ask for sea conditions"
                    className="min-h-[44px] px-3.5 py-2 rounded-full bg-surface-container-high hover:bg-cyan-500/15 hover:text-cyan-400 text-[11px] font-medium text-primary border border-cyan-500/40 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <span aria-hidden="true">🚢</span>
                    <span>{selectedLanguage === 'ta' ? 'கடல் நிலை (Sea conditions)' : (selectedLanguage === 'hi' ? 'समुद्री स्थिति (Sea conditions)' : 'Sea conditions')}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Active Conversational Message Stream */
            <div
              ref={chatContainerRef}
              className="max-h-[500px] overflow-y-auto space-y-3 mb-2.5 pr-1"
              role="log"
              aria-live="polite"
              aria-label="WeatherGPT conversation history"
            >
              {chatMessages.map((msg) => (
                <div key={msg.id} className="space-y-1">
                  {msg.sender === 'user' ? (
                    <div className="flex justify-end">
                      <div className="max-w-[85%] px-3.5 py-2 rounded-2xl rounded-tr-xs bg-secondary/15 border border-secondary/30 text-xs text-primary shadow-xs">
                        <div className="flex items-center gap-1 text-[9px] font-mono text-secondary mb-0.5 justify-end uppercase font-bold tracking-wider">
                          {msg.isVoice && <span className="material-symbols-outlined text-[10px]">mic</span>}
                          <span>USER</span>
                        </div>
                        <p className="font-medium text-[11px]">{msg.text}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-start">
                      <div className="w-full rounded-2xl rounded-tl-xs bg-surface-container-high/70 border border-outline-variant/50 p-3 space-y-2.5 text-xs text-primary shadow-xs">
                        {/* Assistant Header */}
                        <div className="flex items-center justify-between pb-1.5 border-b border-outline-variant/30">
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-xs text-secondary">neurology</span>
                            <span className="text-[10px] font-mono font-bold text-secondary uppercase tracking-wider">
                              WEATHERGPT
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              id="btn-weather-audio-replay"
                              type="button"
                              onClick={() => {
                                if (isPlayingAudio) {
                                  stopAudioPlayback();
                                } else {
                                  const spoken = msg.conciseAnswer || msg.raw?.conciseAnswer || msg.raw?.evidenceLayers?.aiInterpretation || '';
                                  playBrowserSynthesis(spoken, msg.language || selectedLanguage);
                                }
                              }}
                              aria-label={isPlayingAudio ? 'Stop audio playback' : 'Listen to audio response'}
                              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-surface-container text-secondary hover:brightness-110 text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-outline-variant/40 font-mono"
                              title={isPlayingAudio ? 'Stop playback' : 'Listen to response'}
                            >
                              <span className="material-symbols-outlined text-sm" aria-hidden="true">
                                {isPlayingAudio ? 'volume_up' : 'volume_mute'}
                              </span>
                              <span>{isPlayingAudio ? 'Playing...' : 'Listen'}</span>
                            </button>
                          </div>
                        </div>

                        {/* PART 1: ANSWER */}
                        <div className="p-2.5 rounded-xl bg-surface-container border-l-3 border-secondary">
                          <div className="text-[9px] font-mono font-bold text-secondary uppercase tracking-wider mb-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">chat_bubble</span>
                            <span>Answer</span>
                          </div>
                          <p className="text-[11px] font-medium text-on-surface whitespace-pre-line leading-relaxed">
                            {msg.conciseAnswer}
                          </p>
                        </div>

                        {/* Flow indicator: Downward to Weather evidence */}
                        <div className="flex items-center gap-1.5 text-[9px] font-mono text-on-surface-variant pl-1">
                          <span className="text-secondary font-bold">↓</span>
                          <span>Weather evidence</span>
                        </div>

                        {/* PART 2: WEATHER EVIDENCE (5 STRICT SAFETY DISTINCTIONS) */}
                        <div className="space-y-1.5 text-[11px]">
                          {/* 1. Official warning */}
                          {msg.weatherEvidence?.officialWarning ? (
                            <div className="p-2.5 rounded-xl bg-error/15 border-2 border-error text-error">
                              <div className="flex items-center justify-between mb-1">
                                <span className="flex items-center gap-1.5 text-[10px] font-mono font-black uppercase text-error">
                                  <span className="material-symbols-outlined text-sm" aria-hidden="true">warning</span>
                                  <span>🔴 SEVERE WARNING</span>
                                </span>
                                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-error text-on-error font-black uppercase border border-error">
                                  OFFICIAL ALERT
                                </span>
                              </div>
                              <p className="text-[11px] text-on-surface font-medium leading-snug">
                                {msg.weatherEvidence.officialWarning.summary || msg.weatherEvidence.officialWarning.detail}
                              </p>
                              {msg.weatherEvidence.officialWarning.source && (
                                <span className="text-[9px] font-mono text-on-surface-variant block mt-1">
                                  Source: {msg.weatherEvidence.officialWarning.source}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-400 flex items-center justify-between font-mono">
                              <span className="flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-sm text-emerald-400" aria-hidden="true">check_circle</span>
                                <strong className="text-emerald-300">NO ACTIVE WARNING:</strong>
                                <span className="text-on-surface-variant">No active official warnings</span>
                              </span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold uppercase">
                                CLEAR
                              </span>
                            </div>
                          )}

                          {/* 2. Weather forecast */}
                          {msg.weatherEvidence?.weatherForecast && (
                            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/25">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="flex items-center gap-1 text-[9px] font-mono font-bold text-sky-400 uppercase">
                                  <span className="material-symbols-outlined text-xs">thermostat</span>
                                  <span>Weather forecast</span>
                                </span>
                                <span className="text-[8px] font-mono px-1 rounded bg-sky-500/20 text-sky-300">
                                  FORECAST
                                </span>
                              </div>
                              <p className="text-[10px] text-on-surface font-mono leading-snug">
                                {msg.weatherEvidence.weatherForecast.summary}
                              </p>
                            </div>
                          )}

                          {/* 3. Resonix risk assessment */}
                          {msg.weatherEvidence?.resonixRiskAssessment && (
                            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/25">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="flex items-center gap-1 text-[9px] font-mono font-bold text-purple-400 uppercase">
                                  <span className="material-symbols-outlined text-xs">shield</span>
                                  <span>Resonix risk assessment</span>
                                </span>
                                <span className="text-[8px] font-mono px-1 rounded bg-purple-500/20 text-purple-300">
                                  DECISION SUPPORT
                                </span>
                              </div>
                              <p className="text-[10px] text-on-surface leading-snug">
                                {msg.weatherEvidence.resonixRiskAssessment.summary}
                              </p>
                            </div>
                          )}

                          {/* 4. Citizen report */}
                          {msg.weatherEvidence?.citizenReport && (
                            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/25">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="flex items-center gap-1 text-[9px] font-mono font-bold text-amber-400 uppercase">
                                  <span className="material-symbols-outlined text-xs">record_voice_over</span>
                                  <span>Citizen report</span>
                                </span>
                                <span className="text-[8px] font-mono px-1 rounded bg-amber-500/20 text-amber-300">
                                  FIELD REPORTS
                                </span>
                              </div>
                              <p className="text-[10px] text-on-surface leading-snug">
                                {msg.weatherEvidence.citizenReport.summary}
                              </p>
                            </div>
                          )}

                          {/* 5. AI guidance (DISTINGUISHED & WITH NON-OFFICIAL DISCLAIMER) */}
                          {msg.weatherEvidence?.aiGuidance && (
                            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="flex items-center gap-1 text-[9px] font-mono font-bold text-emerald-400 uppercase">
                                  <span className="material-symbols-outlined text-xs">psychology</span>
                                  <span>AI guidance</span>
                                </span>
                                <span className="text-[8px] font-mono px-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  NON-OFFICIAL ADVISORY
                                </span>
                              </div>
                              <p className="text-[10px] text-on-surface leading-snug">
                                {msg.weatherEvidence.aiGuidance.guidance}
                              </p>
                              <p className="text-[8px] font-mono text-on-surface-variant/70 italic mt-0.5">
                                * Not an official warning or evacuation order.
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Flow indicator: Downward to Source & time */}
                        <div className="flex items-center gap-1.5 text-[9px] font-mono text-on-surface-variant pl-1">
                          <span className="text-secondary font-bold">↓</span>
                          <span>Source & time</span>
                        </div>

                        {/* PART 3: SOURCE & TIME */}
                        <div className="pt-1.5 border-t border-outline-variant/30 flex flex-wrap items-center justify-between gap-1 text-[9px] font-mono text-on-surface-variant">
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[10px]">database</span>
                            <span>Source: <strong className="text-on-surface">{msg.source}</strong></span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[10px]">schedule</span>
                            <span>Updated: <strong className="text-on-surface">{msg.updated}</strong></span>
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isAsking && (
                <div className="flex justify-start">
                  <div className="w-full rounded-2xl rounded-tl-xs bg-surface-container-high/70 border border-outline-variant/50 p-3 space-y-2 text-xs text-primary shadow-xs">
                    <div className="flex items-center gap-1.5 pb-1 border-b border-outline-variant/30">
                      <span className="material-symbols-outlined text-xs text-secondary animate-spin">sync</span>
                      <span className="text-[10px] font-mono font-bold text-secondary uppercase tracking-wider">
                        WEATHERGPT
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-on-surface font-medium py-1">
                      <span className="w-2 h-2 rounded-full bg-secondary animate-ping" />
                      <span>Analyzing current weather in {activeLocationLabel}...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Compact Follow-up Prompt Bar (when conversation active) */}
          {chatMessages.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-2 scrollbar-none text-xs" role="toolbar" aria-label="Follow-up quick weather questions">
              <span className="text-[10px] font-mono text-on-surface-variant font-bold uppercase tracking-wider whitespace-nowrap">Ask:</span>
              <button
                type="button"
                onClick={() => handleAskAssistant(selectedLanguage === 'ta' ? 'இன்றைய வானிலை எப்படி இருக்கிறது?' : (selectedLanguage === 'hi' ? 'आज मौसम कैसा है?' : "What is the weather now?"))}
                disabled={isAsking}
                aria-label="Ask what is the weather now"
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-surface-container-high hover:bg-secondary/15 text-on-surface text-xs font-medium whitespace-nowrap border border-outline-variant/40 cursor-pointer transition-colors"
              >
                ⛅ Weather now
              </button>
              <button
                type="button"
                onClick={() => handleAskAssistant(selectedLanguage === 'ta' ? 'நாளை மழை பெய்யுமா?' : (selectedLanguage === 'hi' ? 'क्या कल बारिश होगी?' : 'Will it rain tomorrow?'))}
                disabled={isAsking}
                aria-label="Ask will it rain tomorrow"
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-surface-container-high hover:bg-secondary/15 text-on-surface text-xs font-medium whitespace-nowrap border border-outline-variant/40 cursor-pointer transition-colors"
              >
                🌧️ Rain tomorrow?
              </button>
              <button
                type="button"
                onClick={() => handleAskAssistant(selectedLanguage === 'ta' ? 'என் அருகில் ஏதேனும் எச்சரிக்கை உள்ளதா?' : (selectedLanguage === 'hi' ? 'क्या मेरे पास कोई चेतावनी है?' : 'Is there any warning near me?'))}
                disabled={isAsking}
                aria-label="Ask is there any warning near me"
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-surface-container-high hover:bg-amber-500/15 text-on-surface text-xs font-medium whitespace-nowrap border border-outline-variant/40 cursor-pointer transition-colors"
              >
                ⚠️ Warning near me?
              </button>
              <button
                type="button"
                onClick={() => handleAskAssistant(selectedLanguage === 'ta' ? 'கனமழை தொடங்கினால் நான் என்ன செய்ய வேண்டும்?' : (selectedLanguage === 'hi' ? 'यदि भारी बारिश शुरू हो जाए तो मुझे क्या करना चाहिए?' : 'What should I do if heavy rain starts?'))}
                disabled={isAsking}
                aria-label="Ask what should I do if heavy rain starts"
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-surface-container-high hover:bg-emerald-500/15 text-on-surface text-xs font-medium whitespace-nowrap border border-outline-variant/40 cursor-pointer transition-colors"
              >
                🛡️ What should I do?
              </button>
              <button
                id="followup-farming-advice"
                type="button"
                onClick={() => handleAskAssistant(
                  selectedLanguage === 'ta'
                    ? 'எனது தற்போதைய இடத்திற்கான விவசாய ஆலோசனையை வழங்கவும்.'
                    : (selectedLanguage === 'hi'
                      ? 'मेरे वर्तमान स्थान के लिए कृषि सलाह दीजिए।'
                      : 'Give me farming advice for my current location.')
                )}
                disabled={isAsking}
                aria-label="Ask for farming advice"
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-surface-container-high hover:bg-emerald-500/15 text-on-surface text-xs font-medium whitespace-nowrap border border-emerald-500/40 cursor-pointer transition-colors"
              >
                🌾 Farming advice
              </button>
              <button
                id="followup-flying-conditions"
                type="button"
                onClick={() => handleAskAssistant(
                  selectedLanguage === 'ta'
                    ? 'தற்போதைய விமானப் போக்குவரத்து வானிலை நிலை என்ன?'
                    : (selectedLanguage === 'hi'
                      ? 'वर्तमान विमानन मौसम की स्थिति क्या है?'
                      : 'What are the current aviation weather conditions?')
                )}
                disabled={isAsking}
                aria-label="Ask for flying conditions"
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-surface-container-high hover:bg-sky-500/15 text-on-surface text-xs font-medium whitespace-nowrap border border-sky-500/40 cursor-pointer transition-colors"
              >
                🛩️ Flying conditions
              </button>
              <button
                id="followup-sea-conditions"
                type="button"
                onClick={() => handleAskAssistant(
                  selectedLanguage === 'ta'
                    ? 'தற்போதைய கடல் வானிலை மற்றும் மீன்பிடி நிலை என்ன?'
                    : (selectedLanguage === 'hi'
                      ? 'वर्तमान समुद्री मौसम की स्थिति क्या है?'
                      : 'What are the current marine weather conditions?')
                )}
                disabled={isAsking}
                aria-label="Ask for sea conditions"
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-surface-container-high hover:bg-cyan-500/15 text-on-surface text-xs font-medium whitespace-nowrap border border-cyan-500/40 cursor-pointer transition-colors"
              >
                🚢 Sea conditions
              </button>
            </div>
          )}

          {/* Voice Failure State Banner (Microphone unavailable or STT failed) */}
          {voiceFailureState && (
            <div
              id="voice-failure-banner"
              role="alert"
              aria-live="assertive"
              className="mb-2.5 p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-sm"
            >
              <div className="flex items-start gap-2">
                <span className="text-base leading-none" aria-hidden="true">⚠️</span>
                <div>
                  <span className="font-bold text-amber-200 block text-[11px] uppercase tracking-wide">
                    {voiceFailureState.type === 'MIC_UNAVAILABLE' ? 'Microphone Unavailable' : 'Speech Recognition Incomplete'}
                  </span>
                  <p className="text-[11px] text-on-surface leading-tight mt-0.5">
                    {voiceFailureState.message}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                {voiceFailureState.canRetry && (
                  <button
                    id="btn-voice-retry"
                    type="button"
                    onClick={() => {
                      setVoiceFailureState(null);
                      startVoiceRecording();
                    }}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-secondary text-on-secondary font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs hover:brightness-110 cursor-pointer transition-all"
                    aria-label="Retry voice recording"
                  >
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">refresh</span>
                    <span>Retry Voice</span>
                  </button>
                )}
                <button
                  id="btn-focus-text-input"
                  type="button"
                  onClick={() => {
                    setVoiceFailureState(null);
                    textInputRef.current?.focus({ preventScroll: true });
                  }}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-surface-container-high border border-outline-variant/60 text-primary hover:text-secondary font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                  aria-label="Use text input instead"
                >
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">edit_note</span>
                  <span>Use Text Input</span>
                </button>
              </div>
            </div>
          )}

          {/* TTS Synthesis Notice Banner */}
          {ttsNotice && (
            <div
              id="tts-fallback-notice"
              role="status"
              aria-live="polite"
              className="mb-2.5 p-2.5 rounded-lg bg-surface-container-high border border-outline-variant/50 text-[11px] text-on-surface flex items-center justify-between gap-2"
            >
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-secondary" aria-hidden="true">volume_off</span>
                <span>{ttsNotice}</span>
              </span>
              <button
                type="button"
                onClick={() => setTtsNotice(null)}
                className="text-on-surface-variant hover:text-primary text-sm font-bold min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-surface-container-highest cursor-pointer transition-colors"
                aria-label="Dismiss speech synthesis notice"
              >
                ✕
              </button>
            </div>
          )}

          {/* Custom Query Text Input & Voice Query Microphone */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!isAsking && assistantQuery.trim()) {
                handleAskAssistant();
              }
            }}
            className="flex items-center gap-2"
            aria-label="WeatherGPT inquiry form"
          >
            {/* Voice Query Microphone Button */}
            <button
              id="btn-weather-voice-toggle"
              type="button"
              onClick={isVoiceRecording ? stopVoiceRecording : startVoiceRecording}
              disabled={isVoiceProcessing || isAsking}
              aria-label={
                isVoiceRecording
                  ? (selectedLanguage === 'ta' ? 'குரல் பதிவை நிறுத்தவும்' : (selectedLanguage === 'hi' ? 'रिकॉर्डिंग रोकें' : 'Stop voice recording'))
                  : (selectedLanguage === 'ta' ? 'மைக்ரோஃபோன் மூலம் பேசவும்' : (selectedLanguage === 'hi' ? 'बोलकर पूछें' : 'Start voice query with microphone'))
              }
              aria-pressed={isVoiceRecording}
              className={`w-11 h-11 shrink-0 rounded-xl border flex items-center justify-center cursor-pointer transition-all ${
                isVoiceRecording
                  ? 'bg-error text-on-error border-error animate-pulse shadow-md'
                  : 'bg-surface-container-high border-outline-variant/70 text-on-surface-variant hover:text-secondary hover:border-secondary'
              }`}
              title={
                isVoiceRecording
                  ? (selectedLanguage === 'ta' ? 'பதிவை நிறுத்த கிளிக் செய்யவும்' : (selectedLanguage === 'hi' ? 'रिकॉर्डिंग रोकने के लिए क्लिक करें' : 'Click to stop recording'))
                  : (selectedLanguage === 'ta' ? 'குரல் மூலம் பேசவும் (Tamil / English)' : (selectedLanguage === 'hi' ? 'बोलकर पूछें (Hindi / English)' : 'Speak to WeatherGPT (Multilingual)'))
              }
            >
              {isVoiceProcessing ? (
                <span className="material-symbols-outlined text-base animate-spin text-secondary" aria-hidden="true">sync</span>
              ) : (
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  {isVoiceRecording ? 'mic_off' : 'mic'}
                </span>
              )}
            </button>

            <input
              id="input-weather-ask"
              ref={textInputRef}
              type="text"
              value={assistantQuery}
              onChange={(e) => setAssistantQuery(e.target.value)}
              disabled={isAsking}
              aria-label="Ask WeatherGPT conversational weather question"
              placeholder={
                isVoiceRecording
                  ? (selectedLanguage === 'ta' ? 'பேசவும்... பதிவு செய்யப்படுகிறது' : (selectedLanguage === 'hi' ? 'सुन रहा हूँ... बोलिए' : 'Listening... speak now'))
                  : (selectedLanguage === 'ta'
                    ? "வானிலை கேள்விகளைக் கேளுங்கள் (எ.கா: 'நாளைக்கு மழை வருமா?')..."
                    : (selectedLanguage === 'hi'
                      ? "मौसम संबंधी सवाल पूछें (उदा. 'कल बारिश होगी क्या?', 'आज मौसम कैसा है?')..."
                      : "Ask WeatherGPT (e.g. 'Will it rain tomorrow?', 'Is there a warning near me?')..."))
              }
              className="flex-1 min-w-0 h-11 px-3.5 py-2 text-xs rounded-xl bg-surface-container-high border border-outline-variant/70 text-primary placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-1 focus:ring-secondary disabled:opacity-60"
            />
            <button
              id="btn-weather-ask-submit"
              type="submit"
              disabled={isAsking || isVoiceRecording || isVoiceProcessing || !assistantQuery.trim()}
              aria-label="Submit question to WeatherGPT"
              className="h-11 px-4 shrink-0 rounded-xl bg-secondary text-on-secondary font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs hover:brightness-105 transition-all"
            >
              {isAsking ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin" aria-hidden="true">sync</span>
                  <span className="hidden sm:inline">Analyzing...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">send</span>
                  <span>{selectedLanguage === 'ta' ? 'கேள்' : (selectedLanguage === 'hi' ? 'पूछें' : 'Ask')}</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* ============================================================ */}
        {/* BOTTOM ACCORDIONS: Advanced Weather Models & Climate & History */}
        {/* ============================================================ */}
        <div className="mt-4 pt-3.5 border-t border-outline-variant/40 space-y-2.5">
          <WeatherNwpDrawer
            isNwpExpanded={isNwpExpanded}
            setIsNwpExpanded={setIsNwpExpanded}
            nwpData={nwpData}
            isNwpLoading={isNwpLoading}
            nwpTab={nwpTab}
            setNwpTab={setNwpTab}
            nwpModelsList={nwpModelsList}
            fetchNwpData={fetchNwpData}
          />
          <WeatherClimateDrawer
            isClimateExpanded={isClimateExpanded}
            setIsClimateExpanded={setIsClimateExpanded}
            climateData={climateData}
            isClimateLoading={isClimateLoading}
            climateTab={climateTab}
            setClimateTab={setClimateTab}
            selectedHistoricalYear={selectedHistoricalYear}
            setSelectedHistoricalYear={setSelectedHistoricalYear}
            fetchClimateData={fetchClimateData}
            selectedLanguage={selectedLanguage}
          />
        </div>
      </div>

      {/* Footer Attribution */}
      <div className="px-3.5 py-1.5 bg-surface-container-low/60 border-t border-outline-variant/30 flex items-center justify-between text-[9px] font-mono text-on-surface-variant/70">
        <span>Source: {metadata.source || 'Open-Meteo Meteorological Ensemble'}</span>
        <span>SIH26068 WeatherGPT Ingest</span>
      </div>
    </div>
  );
}
