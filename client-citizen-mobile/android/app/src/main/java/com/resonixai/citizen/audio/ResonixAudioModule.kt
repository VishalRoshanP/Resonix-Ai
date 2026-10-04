package com.resonixai.citizen.audio

import android.media.MediaPlayer
import android.media.MediaRecorder
import android.os.Build
import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.*
import java.io.File

class ResonixAudioModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val TAG = "ResonixAudioModule"
    }

    private var mediaRecorder: MediaRecorder? = null
    private var mediaPlayer: MediaPlayer? = null
    private var currentRecordingFile: File? = null
    private var recordingStartTime: Long = 0
    private var isRecording: Boolean = false

    override fun getName(): String = "ResonixAudioModule"

    @ReactMethod
    fun startRecording(promise: Promise) {
        try {
            if (isRecording) {
                stopInternalRecorder()
            }

            val audioDir = reactContext.cacheDir
            val audioFile = File(audioDir, "emergency_voice_${System.currentTimeMillis()}.m4a")
            currentRecordingFile = audioFile

            val recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(reactContext)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }

            try {
                recorder.setAudioSource(MediaRecorder.AudioSource.VOICE_RECOGNITION)
            } catch (_: Exception) {
                try {
                    recorder.setAudioSource(MediaRecorder.AudioSource.MIC)
                } catch (_: Exception) {
                    recorder.setAudioSource(MediaRecorder.AudioSource.DEFAULT)
                }
            }
            recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            recorder.setAudioChannels(1)
            recorder.setAudioSamplingRate(16000)
            recorder.setAudioEncodingBitRate(64000)
            recorder.setOutputFile(audioFile.absolutePath)

            recorder.prepare()
            recorder.start()

            mediaRecorder = recorder
            isRecording = true
            recordingStartTime = System.currentTimeMillis()

            val map = Arguments.createMap().apply {
                putBoolean("success", true)
                putString("filePath", audioFile.absolutePath)
            }
            promise.resolve(map)
        } catch (e: Exception) {
            Log.e(TAG, "startRecording error: ${e.message}", e)
            isRecording = false
            currentRecordingFile = null
            promise.reject("RECORD_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopRecording(promise: Promise) {
        try {
            if (!isRecording || mediaRecorder == null || currentRecordingFile == null) {
                val map = Arguments.createMap().apply {
                    putBoolean("hasAudio", false)
                    putString("error", "No active recording")
                }
                promise.resolve(map)
                return
            }

            val durationMs = System.currentTimeMillis() - recordingStartTime
            val durationSeconds = Math.max(1, Math.round(durationMs / 1000.0).toInt())

            // Ensure minimal duration so MediaRecorder cleanly writes MPEG-4 container header & index (moov box)
            if (durationMs < 800) {
                try {
                    Thread.sleep(800 - durationMs)
                } catch (_: InterruptedException) {}
            }

            stopInternalRecorder()

            val file = currentRecordingFile
            if (file != null && file.exists() && file.length() > 0) {
                val bytes = file.readBytes()
                val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
                val dataUrl = "data:audio/mp4;base64,$base64"

                val map = Arguments.createMap().apply {
                    putBoolean("hasAudio", true)
                    putString("filePath", file.absolutePath)
                    putString("base64Audio", dataUrl)
                    putString("mimeType", "audio/mp4")
                    putInt("durationSeconds", durationSeconds)
                    putInt("fileSizeBytes", bytes.size)
                }
                promise.resolve(map)
            } else {
                val map = Arguments.createMap().apply {
                    putBoolean("hasAudio", false)
                    putString("error", "Recorded audio file is empty or missing")
                }
                promise.resolve(map)
            }
        } catch (e: Exception) {
            Log.e(TAG, "stopRecording error: ${e.message}", e)
            stopInternalRecorder()
            promise.reject("STOP_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun cancelRecording(promise: Promise) {
        try {
            stopInternalRecorder()
            currentRecordingFile?.let {
                if (it.exists()) it.delete()
            }
            currentRecordingFile = null
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CANCEL_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun playAudio(filePath: String?, promise: Promise) {
        try {
            stopInternalPlayer()

            val targetPath = filePath ?: currentRecordingFile?.absolutePath
            if (targetPath == null) {
                promise.reject("PLAY_ERROR", "No audio file path provided")
                return
            }

            val file = File(targetPath)
            if (!file.exists()) {
                promise.reject("PLAY_ERROR", "Audio file does not exist")
                return
            }

            val player = MediaPlayer().apply {
                setDataSource(targetPath)
                prepare()
                setOnCompletionListener {
                    stopInternalPlayer()
                }
                start()
            }
            mediaPlayer = player

            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "playAudio error: ${e.message}", e)
            promise.reject("PLAY_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopAudio(promise: Promise) {
        try {
            stopInternalPlayer()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_AUDIO_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun isPlayingAudio(promise: Promise) {
        val playing = mediaPlayer?.isPlaying ?: false
        promise.resolve(playing)
    }

    private fun stopInternalRecorder() {
        try {
            mediaRecorder?.apply {
                try {
                    stop()
                } catch (e: Exception) {
                    Log.w(TAG, "mediaRecorder.stop warning: ${e.message}")
                }
                try {
                    release()
                } catch (_: Exception) {}
            }
        } catch (_: Exception) {}
        mediaRecorder = null
        isRecording = false
    }

    private fun stopInternalPlayer() {
        try {
            mediaPlayer?.apply {
                if (isPlaying) {
                    stop()
                }
                release()
            }
        } catch (_: Exception) {}
        mediaPlayer = null
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        stopInternalRecorder()
        stopInternalPlayer()
    }
}
