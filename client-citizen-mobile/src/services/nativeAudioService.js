/**
 * Native Audio Service for RESONIX AI Citizen Mobile (React Native)
 * 
 * Interacts with NativeModules.ResonixAudioModule (Android MediaRecorder & MediaPlayer).
 * Zero Mock Data:
 * - Records real audio from device microphone (AAC in MP4 container).
 * - Produces real audio bytes, real duration, and real Base64 dataUrl.
 * - Plays back real recorded audio.
 */

const { PermissionsAndroid, Platform, NativeModules } = require('react-native');

const ResonixAudioModule = NativeModules?.ResonixAudioModule;

class NativeAudioService {
  constructor() {
    this.isSupported = Platform.OS === 'android' && Boolean(ResonixAudioModule);
  }

  /**
   * Request Android Microphone Permission
   */
  async requestAudioPermission() {
    if (Platform.OS !== 'android') return true;

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message: 'Resonix AI needs access to your microphone to record emergency voice messages.',
          buttonPositive: 'Grant',
          buttonNegative: 'Cancel',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn('[NativeAudioService] Permission error:', err.message);
      return false;
    }
  }

  /**
   * Start recording real audio via native MediaRecorder
   */
  async startRecording() {
    const hasPermission = await this.requestAudioPermission();
    if (!hasPermission) {
      throw new Error('Microphone permission was denied.');
    }

    if (this.isSupported && ResonixAudioModule?.startRecording) {
      return await ResonixAudioModule.startRecording();
    }

    throw new Error('Native audio recording is not supported on this platform.');
  }

  /**
   * Stop recording real audio and retrieve Base64 audio payload
   */
  async stopRecording() {
    if (this.isSupported && ResonixAudioModule?.stopRecording) {
      const res = await ResonixAudioModule.stopRecording();
      if (!res.hasAudio) {
        throw new Error(res.error || 'No audio recorded.');
      }
      const rawPath = res.filePath || '';
      const fileUri = rawPath ? (rawPath.startsWith('file://') ? rawPath : `file://${rawPath}`) : null;
      const fileName = rawPath ? rawPath.split(/[\/\\]/).pop() : 'emergency_voice.m4a';
      return {
        hasAudio: true,
        filePath: rawPath,
        uri: fileUri,
        name: fileName,
        fileName,
        type: res.mimeType || 'audio/mp4',
        mimeType: res.mimeType || 'audio/mp4',
        base64Audio: res.base64Audio,
        audioData: res.base64Audio,
        dataUrl: res.base64Audio,
        durationSeconds: Number(res.durationSeconds) || 1,
        fileSizeBytes: Number(res.fileSizeBytes) || 0,
      };
    }

    throw new Error('Native audio recording is not supported on this platform.');
  }

  /**
   * Cancel and discard current recording
   */
  async cancelRecording() {
    if (this.isSupported && ResonixAudioModule?.cancelRecording) {
      try {
        await ResonixAudioModule.cancelRecording();
      } catch (_) {}
    }
  }

  /**
   * Play recorded audio file via native MediaPlayer
   */
  async playAudio(filePath) {
    if (this.isSupported && ResonixAudioModule?.playAudio) {
      return await ResonixAudioModule.playAudio(filePath);
    }
    return false;
  }

  /**
   * Stop audio playback
   */
  async stopAudio() {
    if (this.isSupported && ResonixAudioModule?.stopAudio) {
      return await ResonixAudioModule.stopAudio();
    }
    return false;
  }

  /**
   * Check if audio is currently playing
   */
  async isPlayingAudio() {
    if (this.isSupported && ResonixAudioModule?.isPlayingAudio) {
      return await ResonixAudioModule.isPlayingAudio();
    }
    return false;
  }
}

const nativeAudioService = new NativeAudioService();
module.exports = nativeAudioService;
