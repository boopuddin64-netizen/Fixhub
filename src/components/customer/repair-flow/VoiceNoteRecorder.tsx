import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Trash2, Volume2, AlertCircle, Loader2 } from 'lucide-react';
import { ApiClient } from '../../../api/client';

interface VoiceNoteRecorderProps {
  voiceNoteUrl?: string;
  voiceNoteDurationSeconds?: number;
  onChange: (url: string | undefined, durationSeconds?: number) => void;
}

const CANDIDATE_MIME_TYPES = [
  'audio/mp4',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
];

/**
 * Returns the first MIME format supported by the current browser's MediaRecorder implementation.
 */
function getSupportedAudioMimeType(): string | undefined {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') {
    return undefined;
  }
  if (typeof window.MediaRecorder.isTypeSupported !== 'function') {
    return undefined;
  }
  for (const mime of CANDIDATE_MIME_TYPES) {
    if (window.MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return undefined;
}

export const VoiceNotePlayer: React.FC<{
  url: string;
  durationSeconds?: number;
  onDelete?: () => void;
  className?: string;
}> = ({ url, durationSeconds = 0, onDelete, className = '' }) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSeconds, setPlaybackSeconds] = useState<number>(0);
  const [hasError, setHasError] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [url]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const togglePlay = () => {
    if (hasError) setHasError(false);
    
    if (!audioRef.current) {
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setIsPlaying(false);
        setPlaybackSeconds(0);
      };
      audio.ontimeupdate = () => {
        setPlaybackSeconds(Math.floor(audio.currentTime));
      };
      audio.onerror = () => {
        setIsPlaying(false);
        setHasError(true);
      };
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn('Audio playback not permitted or failed:', err);
        setIsPlaying(false);
        setHasError(true);
      });
    }
  };

  return (
    <div className={`flex items-center justify-between gap-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 ${className}`}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-md transition-colors cursor-pointer shrink-0"
          title={isPlaying ? 'Pause' : 'Play voice note'}
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 ml-0.5 fill-current" />}
        </button>

        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-emerald-700" />
            <span className="text-xs font-bold text-emerald-900">Voice Note Attached</span>
          </div>
          <p className="text-[11px] text-emerald-700 font-mono font-medium">
            {hasError
              ? 'Playback unavailable'
              : `${formatTime(isPlaying ? playbackSeconds : (durationSeconds || 5))} / ${formatTime(durationSeconds || 5)}`}
          </p>
        </div>
      </div>

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
          title="Delete voice note"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export const VoiceNoteRecorder: React.FC<VoiceNoteRecorderProps> = ({
  voiceNoteUrl,
  voiceNoteDurationSeconds = 0,
  onChange,
}) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSeconds, setPlaybackSeconds] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingSecondsRef = useRef<number>(0);
  const selectedMimeTypeRef = useRef<string>('audio/webm');

  const releaseStreamTracks = () => {
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      } catch (err) {
        console.warn('Error releasing audio track:', err);
      }
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      releaseStreamTracks();
    };
  }, []);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const startRecording = async () => {
    setErrorMessage(null);

    // 1. Feature Detection: MediaRecorder & getUserMedia check
    const isMediaRecorderSupported =
      typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined';
    const isGetUserMediaSupported =
      typeof navigator !== 'undefined' &&
      Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

    if (!isMediaRecorderSupported || !isGetUserMediaSupported) {
      setErrorMessage("Voice recording isn’t supported on this device/browser. You can continue without a voice note.");
      return;
    }

    // 2. Request Microphone Access
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage("Microphone permission wasn’t granted. You can continue without a voice note.");
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage("Microphone unavailable or not detected. You can continue without a voice note.");
      } else {
        setErrorMessage("Voice recording isn’t supported on this device/browser. You can continue without a voice note.");
      }
      return;
    }

    streamRef.current = stream;

    // 3. Dynamic MIME Type Resolution
    const supportedMime = getSupportedAudioMimeType();
    selectedMimeTypeRef.current = supportedMime || 'audio/webm';

    let mediaRecorder: MediaRecorder;
    try {
      if (supportedMime) {
        mediaRecorder = new MediaRecorder(stream, { mimeType: supportedMime });
      } else {
        mediaRecorder = new MediaRecorder(stream);
      }
    } catch (recorderErr) {
      try {
        mediaRecorder = new MediaRecorder(stream);
      } catch (finalErr) {
        releaseStreamTracks();
        setErrorMessage("Unsupported audio recording format. You can continue without a voice note.");
        return;
      }
    }

    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onerror = () => {
      releaseStreamTracks();
      setErrorMessage("Recording encountered an issue. You can continue without a voice note.");
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };

    mediaRecorder.onstop = () => {
      const finalMime = selectedMimeTypeRef.current || mediaRecorder.mimeType || 'audio/webm';
      const audioBlob = new Blob(audioChunksRef.current, { type: finalMime });
      const finalDuration = recordingSecondsRef.current || 1;

      setIsProcessing(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result as string;
        try {
          const res = await ApiClient.uploadAttachment({
            fileData: base64Data,
            type: 'AUDIO',
            mimeType: finalMime,
            durationSeconds: finalDuration
          });
          onChange(res.url, finalDuration);
        } catch (err) {
          console.error("Upload failed", err);
          setErrorMessage("Failed to upload voice note. You can try again.");
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsDataURL(audioBlob);

      releaseStreamTracks();
    };

    // 4. Start recording and manage 120-second cap
    try {
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingSecondsRef.current = 0;

      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = window.setInterval(() => {
        recordingSecondsRef.current += 1;
        const currentSecs = recordingSecondsRef.current;
        setRecordingSeconds(currentSecs);

        // Maximum recording duration capped at 120 seconds
        if (currentSecs >= 120) {
          stopRecording();
        }
      }, 1000);
    } catch (startErr) {
      releaseStreamTracks();
      setErrorMessage("Could not start recording on this device. You can continue without a voice note.");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsRecording(false);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.warn('Error stopping MediaRecorder:', err);
        releaseStreamTracks();
      }
    }
  };

  const cancelRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        // ignore
      }
    }
    releaseStreamTracks();
    audioChunksRef.current = [];
    recordingSecondsRef.current = 0;
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const togglePlayback = () => {
    if (!voiceNoteUrl) return;

    if (isPlaying) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      setIsPlaying(false);
    } else {
      if (!audioPlayerRef.current) {
        const audio = new Audio(voiceNoteUrl);
        audioPlayerRef.current = audio;
        audio.onended = () => {
          setIsPlaying(false);
          setPlaybackSeconds(0);
        };
        audio.ontimeupdate = () => {
          setPlaybackSeconds(Math.floor(audio.currentTime));
        };
        audio.onerror = () => {
          setIsPlaying(false);
          setErrorMessage("Playback failed on this device. You can re-record or continue.");
        };
      }
      audioPlayerRef.current.play().catch((playErr) => {
        console.warn('Audio playback not permitted or failed:', playErr);
        setIsPlaying(false);
      });
      setIsPlaying(true);
    }
  };

  const deleteVoiceNote = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    setIsPlaying(false);
    setPlaybackSeconds(0);
    window.setTimeout(() => {
      onChange(undefined, undefined);
    }, 0);
  };

  return (
    <div id="voice-note-recorder-component" className="w-full">
      {voiceNoteUrl ? (
        /* Recorded Voice Note Pill */
        <VoiceNotePlayer
          url={voiceNoteUrl}
          durationSeconds={voiceNoteDurationSeconds}
          onDelete={deleteVoiceNote}
        />
      ) : isProcessing ? (
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
           <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
           <span className="text-xs font-bold text-slate-700">Uploading voice note...</span>
        </div>
      ) : isRecording ? (
        /* Active Recording State */
        <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-red-50 border border-red-200 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-red-600 animate-ping" />
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-red-900">Recording voice note...</span>
              <p className="text-[11px] font-mono font-bold text-red-700">
                {formatTime(recordingSeconds)} / 2:00
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelRecording}
              className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={stopRecording}
              className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Done</span>
            </button>
          </div>
        </div>
      ) : (
        /* Idle Mic Button */
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={startRecording}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 text-xs font-bold border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer"
            >
              <Mic className="w-4 h-4 text-emerald-600" />
              <span>Record voice note</span>
            </button>
            <span className="text-[11px] text-slate-400">or explain what happened (max 2 mins)</span>
          </div>

          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{errorMessage}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

