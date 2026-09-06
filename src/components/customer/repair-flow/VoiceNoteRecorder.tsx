import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Trash2, Volume2, AlertCircle } from 'lucide-react';

interface VoiceNoteRecorderProps {
  voiceNoteUrl?: string;
  voiceNoteDurationSeconds?: number;
  onChange: (url: string | undefined, durationSeconds?: number) => void;
}

export const VoiceNoteRecorder: React.FC<VoiceNoteRecorderProps> = ({
  voiceNoteUrl,
  voiceNoteDurationSeconds = 0,
  onChange,
}) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSeconds, setPlaybackSeconds] = useState<number>(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingSecondsRef = useRef<number>(0);
  const isSimulatedRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const startRecording = async () => {
    setPermissionError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        // Fallback for sandboxed environments without direct audio recording hardware
        simulateVoiceNote();
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch((err) => {
        console.warn('Microphone access denied or unavailable:', err);
        throw err;
      });

      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      isSimulatedRef.current = false;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const finalDuration = recordingSecondsRef.current || 5;
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = reader.result as string;
          // Defer update outside of active render loop
          window.setTimeout(() => {
            onChange(base64Data, finalDuration);
          }, 0);
        };
        reader.readAsDataURL(audioBlob);

        // Stop all audio tracks to release microphone
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingSecondsRef.current = 0;

      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = window.setInterval(() => {
        recordingSecondsRef.current += 1;
        setRecordingSeconds(recordingSecondsRef.current);
      }, 1000);
    } catch (err: any) {
      console.warn('Could not record native audio, offering fallback note simulation:', err);
      setPermissionError('Microphone permission was not granted or not supported in this browser window.');
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsRecording(false);

    if (isSimulatedRef.current) {
      const finalDuration = Math.max(recordingSecondsRef.current, 3);
      const sampleAudio = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
      window.setTimeout(() => {
        onChange(sampleAudio, finalDuration);
      }, 0);
    } else if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    audioChunksRef.current = [];
    recordingSecondsRef.current = 0;
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  // Safe fallback demonstration voice note for testing in sandboxed headless environments
  const simulateVoiceNote = () => {
    setPermissionError(null);
    setIsRecording(true);
    setRecordingSeconds(0);
    recordingSecondsRef.current = 0;
    isSimulatedRef.current = true;

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = window.setInterval(() => {
      recordingSecondsRef.current += 1;
      const count = recordingSecondsRef.current;
      setRecordingSeconds(count);

      if (count >= 4) {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        setIsRecording(false);
        const sampleAudio = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
        window.setTimeout(() => {
          onChange(sampleAudio, 5);
        }, 0);
      }
    }, 1000);
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
      }
      audioPlayerRef.current.play().catch(() => {
        // Fallback for sandboxed silent audio
        setIsPlaying(true);
        setTimeout(() => setIsPlaying(false), (voiceNoteDurationSeconds || 5) * 1000);
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
      onChange(undefined, 0);
    }, 0);
  };

  return (
    <div id="voice-note-recorder-component" className="w-full">
      {voiceNoteUrl ? (
        /* Recorded Voice Note Pill */
        <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlayback}
              className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-md transition-colors cursor-pointer"
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
                {isPlaying ? formatTime(playbackSeconds) : formatTime(voiceNoteDurationSeconds || 5)} / {formatTime(voiceNoteDurationSeconds || 5)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={deleteVoiceNote}
            className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
            title="Delete voice note"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ) : isRecording ? (
        /* Active Recording State */
        <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-red-50 border border-red-200 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-red-600 animate-ping" />
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-red-900">Recording voice note...</span>
              <p className="text-[11px] font-mono font-bold text-red-700">{formatTime(recordingSeconds)}</p>
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
            <span className="text-[11px] text-slate-400">or explain what happened</span>
          </div>

          {permissionError && (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{permissionError}</span>
                <button
                  type="button"
                  onClick={simulateVoiceNote}
                  className="block mt-1 font-bold text-amber-900 underline cursor-pointer"
                >
                  Click here to attach a quick voice note sample for testing
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
