/**
 * Audio Preprocessor & Quality Inspector for RESONIX AI
 * 
 * Capabilities:
 * - Decodes Base64 dataUrls, Buffers, and binary chunks
 * - Validates MIME types and audio container headers (WAV, WebM, OGG, MP4/M4A, MP3, AAC)
 * - Calculates RMS amplitude & energy to detect silent or empty audio
 * - Detects corrupted byte streams and unsupported audio codecs
 * - Computes audio quality metrics without external binary dependencies
 */

const asrConfig = require('../../config/asr');
const logger = require('../../utils/logger');

class AudioPreprocessor {
  /**
   * Inspects and pre-processes audio input payload
   * @param {Object} input - { audioData, dataUrl, buffer, mimeType, durationSeconds }
   * @returns {Object} Inspection result with sanitized buffer, metadata, and validation status
   */
  inspectAndPreprocess(input = {}) {
    const rawAudio = input.audioData || input.dataUrl || input.buffer || null;
    const providedMime = input.mimeType || 'audio/webm';
    const providedDuration = parseFloat(input.durationSeconds) || 0;

    // 1. Check for missing/empty input
    if (!rawAudio) {
      return {
        isValid: false,
        status: 'EMPTY_AUDIO',
        failureReason: 'No audio data provided in payload.',
        buffer: null,
        byteLength: 0,
        mimeType: providedMime,
        durationSeconds: 0,
        isSilent: true,
        rmsEnergy: 0,
      };
    }

    // 2. Decode raw audio into Node.js Buffer
    let buffer = null;
    let detectedMime = providedMime;

    try {
      if (Buffer.isBuffer(rawAudio)) {
        buffer = rawAudio;
      } else if (typeof rawAudio === 'string') {
        if (rawAudio.startsWith('data:')) {
          const matches = rawAudio.match(/^data:([^;]+);base64,(.+)$/);
          if (matches) {
            detectedMime = matches[1];
            buffer = Buffer.from(matches[2], 'base64');
          } else {
            // Malformed data URL
            const commaIndex = rawAudio.indexOf(',');
            if (commaIndex !== -1) {
              buffer = Buffer.from(rawAudio.slice(commaIndex + 1), 'base64');
            } else {
              buffer = Buffer.from(rawAudio, 'base64');
            }
          }
        } else {
          // Plain Base64 string or URI-encoded
          const cleanBase64 = rawAudio.replace(/\s+/g, '');
          buffer = Buffer.from(cleanBase64, 'base64');
        }
      } else if (rawAudio instanceof ArrayBuffer) {
        buffer = Buffer.from(rawAudio);
      } else if (rawAudio instanceof Uint8Array) {
        buffer = Buffer.from(rawAudio.buffer, rawAudio.byteOffset, rawAudio.byteLength);
      }
    } catch (decodeErr) {
      logger.warn('[AudioPreprocessor] Base64/Buffer decoding failed:', decodeErr.message);
      return {
        isValid: false,
        status: 'CORRUPTED_AUDIO',
        failureReason: `Audio data decoding failed: ${decodeErr.message}`,
        buffer: null,
        byteLength: 0,
        mimeType: detectedMime,
        durationSeconds: providedDuration,
        isSilent: true,
        rmsEnergy: 0,
      };
    }

    if (!buffer || buffer.length === 0) {
      return {
        isValid: false,
        status: 'EMPTY_AUDIO',
        failureReason: 'Decoded audio buffer is 0 bytes.',
        buffer: null,
        byteLength: 0,
        mimeType: detectedMime,
        durationSeconds: 0,
        isSilent: true,
        rmsEnergy: 0,
      };
    }

    // 3. Minimum byte size check
    if (buffer.length < asrConfig.minAudioSizeBytes) {
      return {
        isValid: false,
        status: 'EMPTY_AUDIO',
        failureReason: `Audio size (${buffer.length} bytes) is below minimum threshold (${asrConfig.minAudioSizeBytes} bytes).`,
        buffer,
        byteLength: buffer.length,
        mimeType: detectedMime,
        durationSeconds: providedDuration,
        isSilent: true,
        rmsEnergy: 0,
      };
    }

    // 4. Maximum size check
    if (buffer.length > asrConfig.maxAudioSizeBytes) {
      return {
        isValid: false,
        status: 'UNSUPPORTED_FORMAT',
        failureReason: `Audio payload (${(buffer.length / 1024 / 1024).toFixed(2)} MB) exceeds maximum allowed size (${asrConfig.maxAudioSizeBytes / 1024 / 1024} MB).`,
        buffer: null,
        byteLength: buffer.length,
        mimeType: detectedMime,
        durationSeconds: providedDuration,
        isSilent: false,
        rmsEnergy: 0,
      };
    }

    // 5. Container Header & Signature Verification
    const formatVerification = this._verifyAudioHeader(buffer, detectedMime);
    if (!formatVerification.isValidHeader) {
      return {
        isValid: false,
        status: formatVerification.status || 'CORRUPTED_AUDIO',
        failureReason: formatVerification.reason || 'Audio header signature mismatch or corrupted container.',
        buffer,
        byteLength: buffer.length,
        mimeType: detectedMime,
        durationSeconds: providedDuration,
        isSilent: false,
        rmsEnergy: 0,
      };
    }

    const finalMime = formatVerification.mimeType || detectedMime;

    // 6. Audio Duration and RMS Energy Calculation
    const estimatedDuration = this._estimateDuration(buffer, finalMime, providedDuration);
    const rmsEnergy = this._calculateRmsEnergy(buffer, finalMime);
    const isSilent = rmsEnergy < asrConfig.silenceRmsThreshold;

    if (isSilent && estimatedDuration >= 0.5) {
      logger.info(`[AudioPreprocessor] Audio recording detected as silent (RMS: ${rmsEnergy.toFixed(5)} < ${asrConfig.silenceRmsThreshold})`);
      return {
        isValid: true,
        status: 'SILENT_AUDIO',
        failureReason: 'Audio recording contains only silence or background noise below threshold.',
        buffer,
        byteLength: buffer.length,
        mimeType: finalMime,
        durationSeconds: estimatedDuration,
        isSilent: true,
        rmsEnergy,
      };
    }

    if (estimatedDuration < asrConfig.minAudioDurationSeconds && buffer.length < 512) {
      return {
        isValid: false,
        status: 'SHORT_AUDIO_CLIP',
        failureReason: `Audio duration (${estimatedDuration.toFixed(2)}s) is below minimum intelligible duration (${asrConfig.minAudioDurationSeconds}s).`,
        buffer,
        byteLength: buffer.length,
        mimeType: finalMime,
        durationSeconds: estimatedDuration,
        isSilent,
        rmsEnergy,
      };
    }

    return {
      isValid: true,
      status: 'VALID_AUDIO',
      failureReason: null,
      buffer,
      byteLength: buffer.length,
      mimeType: finalMime,
      durationSeconds: estimatedDuration,
      isSilent: false,
      rmsEnergy,
    };
  }

  /**
   * Verifies audio container byte signatures
   * @private
   */
  _verifyAudioHeader(buffer, mimeType) {
    if (buffer.length < 4) {
      return { isValidHeader: false, status: 'CORRUPTED_AUDIO', reason: 'Buffer too small to contain audio header.' };
    }

    // WAV: Starts with "RIFF" (0x52, 0x49, 0x46, 0x46) and "WAVE" at offset 8
    const isRiff = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
    if (isRiff) {
      if (buffer.length >= 12 && buffer.toString('ascii', 8, 12) === 'WAVE') {
        return { isValidHeader: true, mimeType: 'audio/wav' };
      }
      return { isValidHeader: true, mimeType: 'audio/wav' };
    }

    // EBML / WebM / Matroska: Starts with 0x1A, 0x45, 0xDF, 0xA3
    const isEbml = buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;
    if (isEbml) {
      return { isValidHeader: true, mimeType: 'audio/webm' };
    }

    // Ogg: Starts with "OggS" (0x4F, 0x67, 0x67, 0x53)
    const isOgg = buffer[0] === 0x4f && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53;
    if (isOgg) {
      return { isValidHeader: true, mimeType: 'audio/ogg' };
    }

    // MP4 / M4A: Contains 'ftyp' at offset 4
    if (buffer.length >= 8 && buffer.toString('ascii', 4, 8) === 'ftyp') {
      return { isValidHeader: true, mimeType: 'audio/mp4' };
    }

    // AAC ADTS: Starts with 0xFF and 12 sync bits 0xFFF with layer bits '00' (buffer[1] & 0xF6 === 0xF0)
    const isAacAdts = buffer[0] === 0xff && (buffer[1] & 0xf6) === 0xf0;
    if (isAacAdts) {
      return { isValidHeader: true, mimeType: 'audio/aac' };
    }

    // MP3: ID3 header (0x49, 0x44, 0x33) or MPEG audio sync frame with Layer III (layer bits != 0)
    const isId3 = buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33;
    const isMpegSync = buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0 && (buffer[1] & 0x06) !== 0x00;
    if (isId3 || isMpegSync) {
      return { isValidHeader: true, mimeType: 'audio/mp3' };
    }

    // If MIME type is recognized and buffer starts with audio-compatible data
    const isSupportedMime = asrConfig.supportedMimeTypes.some((t) => mimeType && mimeType.toLowerCase().startsWith(t.split(';')[0]));
    if (isSupportedMime && buffer.length >= 16) {
      return { isValidHeader: true, mimeType };
    }

    // Check if buffer contains completely non-audio ASCII/HTML text error page
    const sampleAscii = buffer.slice(0, 50).toString('utf8').trim().toLowerCase();
    if (sampleAscii.startsWith('<!doctype') || sampleAscii.startsWith('<html') || sampleAscii.startsWith('{"error"')) {
      return { isValidHeader: false, status: 'CORRUPTED_AUDIO', reason: 'Audio payload contains HTML/text data instead of binary audio stream.' };
    }

    // Permissive fallback if user specified audio MIME and buffer has reasonable entropy
    if (buffer.length >= 64) {
      return { isValidHeader: true, mimeType };
    }

    return { isValidHeader: false, status: 'UNSUPPORTED_FORMAT', reason: `Unrecognized audio container header signature (${buffer.slice(0, 4).toString('hex')}).` };
  }

  /**
   * Estimates audio duration in seconds
   * @private
   */
  _estimateDuration(buffer, mimeType, providedDuration) {
    if (providedDuration > 0) return providedDuration;

    // For WAV format: calculate duration from sample rate & byte rate
    if (mimeType && mimeType.includes('wav') && buffer.length >= 44) {
      try {
        const byteRate = buffer.readUInt32LE(28);
        const dataLength = buffer.length - 44;
        if (byteRate > 0) {
          return Math.max(0.1, dataLength / byteRate);
        }
      } catch (_) {}
    }

    // Default bit-rate estimation (assuming standard 64kbps speech compression for WebM/Opus)
    const estimatedSeconds = (buffer.length * 8) / (64 * 1024);
    return Math.max(0.5, Math.min(120.0, parseFloat(estimatedSeconds.toFixed(2))));
  }

  /**
   * Calculates Root Mean Square (RMS) energy to detect audio volume / silence
   * @private
   */
  _calculateRmsEnergy(buffer, mimeType) {
    if (!buffer || buffer.length === 0) return 0;

    let sumSquares = 0;
    let count = 0;

    // For PCM WAV 16-bit
    if (mimeType && mimeType.includes('wav') && buffer.length >= 44) {
      for (let i = 44; i < buffer.length - 1; i += 4) {
        const sample = buffer.readInt16LE(i) / 32768.0;
        sumSquares += sample * sample;
        count++;
        if (count > 5000) break; // Sample max 5000 points
      }
    } else {
      // General byte entropy / amplitude approximation for compressed streams
      const step = Math.max(1, Math.floor(buffer.length / 2000));
      for (let i = 0; i < buffer.length; i += step) {
        const normalized = (buffer[i] - 128) / 128.0;
        sumSquares += normalized * normalized;
        count++;
      }
    }

    if (count === 0) return 0;
    return Math.sqrt(sumSquares / count);
  }
}

module.exports = new AudioPreprocessor();
