'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Mic, MicOff, Check, Trash2 } from 'lucide-react';
import { sendRemoteCommand } from '@/app/actions';
import type { PenaltyTypeDefinition } from '@/types';

interface Message {
  id: string;
  type: 'user' | 'system';
  text: string;
  timestamp: Date;
  parsed?: {
    teamName: string | null;
    playerNumbers: string[];
    action: string;
    corrected: string;
  };
  event?: any;
  goalConfirmed?: boolean;
  penaltyConfirmed?: boolean;
}

interface Player {
  id: string;
  number: string;
  name: string;
  isPresent: boolean;
}

interface TeamData {
  name: string;
  players: Player[];
}

export default function MobileShotsV2Page() {
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [homeTeam, setHomeTeam] = useState<TeamData | null>(null);
  const [awayTeam, setAwayTeam] = useState<TeamData | null>(null);
  const [isContinuousMode, setIsContinuousMode] = useState(true);
  const [penaltyTypes, setPenaltyTypes] = useState<PenaltyTypeDefinition[]>([]);

  // Load config from localStorage on mount, with defaults
  const getInitialSilenceDuration = () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('voice-config-silence-duration');
      if (saved) return parseInt(saved);
    }
    return 1500;
  };

  const getInitialVolumeThreshold = () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('voice-config-volume-threshold');
      if (saved) return parseInt(saved);
    }
    return 25;
  };

  const [silenceDuration, setSilenceDuration] = useState(getInitialSilenceDuration());
  const [volumeThreshold, setVolumeThreshold] = useState(getInitialVolumeThreshold());
  const [currentVolume, setCurrentVolume] = useState(0);
  const [isDetectingSpeech, setIsDetectingSpeech] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceDetectionRef = useRef<number | null>(null);
  const silenceDurationRef = useRef(silenceDuration);
  const volumeThresholdRef = useRef(volumeThreshold);
  const currentRecorderRef = useRef<MediaRecorder | null>(null);
  const isCurrentlyRecordingRef = useRef(false);
  const isShuttingDownRef = useRef(false);

  useEffect(() => {
    silenceDurationRef.current = silenceDuration;
    volumeThresholdRef.current = volumeThreshold;
  }, [silenceDuration, volumeThreshold]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('voice-config-silence-duration', silenceDuration.toString());
    }
  }, [silenceDuration]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('voice-config-volume-threshold', volumeThreshold.toString());
    }
  }, [volumeThreshold]);

  // Load team data and penalty types on mount
  useEffect(() => {
    fetch('/api/voice/teams')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setHomeTeam(data.homeTeam);
          setAwayTeam(data.awayTeam);
        }
      })
      .catch(err => console.error('[VoiceRemote] Error loading teams:', err));

    fetch('/api/game-state')
      .then(r => r.json())
      .then((data: any) => {
        const types: PenaltyTypeDefinition[] = data?.penaltyConfig?.penaltyTypes || [];
        setPenaltyTypes(types);
      })
      .catch(err => console.error('[VoiceRemote] Error loading game state:', err));
  }, []);

  // Load messages from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMessages = localStorage.getItem('voice-remote-messages');
      if (savedMessages) {
        try {
          const parsed = JSON.parse(savedMessages);
          setMessages(parsed.map((msg: any) => ({ ...msg, timestamp: new Date(msg.timestamp) })));
        } catch {}
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && messages.length > 0) {
      localStorage.setItem('voice-remote-messages', JSON.stringify(messages));
    }
  }, [messages]);

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /** Returns the best supported mimeType for MediaRecorder, or undefined to use browser default */
  const getSupportedMimeType = (): string | undefined => {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
    return candidates.find(t => MediaRecorder.isTypeSupported(t));
  };

  /** Returns true if microphone access is available in this context */
  const isMicAvailable = (): boolean => {
    if (typeof navigator === 'undefined') return false;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
    if (window.isSecureContext === false) return false;
    return true;
  };

  // ─── Recording logic (identical to /voice) ───────────────────────────────

  const detectSilenceAndProcess = (
    analyser: AnalyserNode,
    onSilence: () => void,
    onSpeechDetected?: (isSpeaking: boolean) => void
  ) => {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let silenceStart = Date.now();
    let wasSpeaking = false;

    const checkAudioLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
      const volumePercent = Math.min(100, Math.round((average / 255) * 100));
      setCurrentVolume(volumePercent);
      const threshold = (volumeThresholdRef.current / 100) * 255;
      const isSpeaking = average >= threshold;

      if (!isSpeaking) {
        if (wasSpeaking) {
          wasSpeaking = false;
          silenceStart = Date.now();
          onSpeechDetected?.(false);
        }
        if (Date.now() - silenceStart > silenceDurationRef.current) {
          onSilence();
        }
      } else {
        if (!wasSpeaking) {
          wasSpeaking = true;
          onSpeechDetected?.(true);
        }
        silenceStart = Date.now();
      }

      silenceDetectionRef.current = requestAnimationFrame(checkAudioLevel);
    };

    checkAudioLevel();
  };

  const performCleanup = () => {
    setIsDetectingSpeech(false);
    setCurrentVolume(0);
    if (silenceDetectionRef.current) {
      cancelAnimationFrame(silenceDetectionRef.current);
      silenceDetectionRef.current = null;
    }
    chunksRef.current = [];
    mediaRecorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    isShuttingDownRef.current = false;
    setIsRecording(false);
    addMessage('system', '⏸️ Modo continuo desactivado');
  };

  const startContinuousRecording = async () => {
    if (!isMicAvailable()) {
      addMessage('system', '❌ Micrófono no disponible. Esta página requiere HTTPS. Si estás en la red local, accedé por la URL de Vercel (https://...).');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyserRef.current = analyser;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;

      chunksRef.current = [];
      isCurrentlyRecordingRef.current = false;
      currentRecorderRef.current = null;
      isShuttingDownRef.current = false;

      const startRecordingCommand = () => {
        if (!streamRef.current || isCurrentlyRecordingRef.current) return;
        chunksRef.current = [];
        isCurrentlyRecordingRef.current = true;

        const mimeType = getSupportedMimeType();
        const recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        recorder.onstop = () => {
          const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const chunkCount = chunksRef.current.length;

          if (audioBlob.size > 5000 && chunkCount >= 5) {
            addMessage('system', `📤 Enviando audio (${(audioBlob.size / 1000).toFixed(1)}KB)`);
            sendAudio(audioBlob);
          } else {
            addMessage('system', `⏭️ Audio muy corto - ignorado`);
          }

          chunksRef.current = [];
          isCurrentlyRecordingRef.current = false;
          currentRecorderRef.current = null;

          if (isShuttingDownRef.current) {
            performCleanup();
          }
        };

        currentRecorderRef.current = recorder;
        recorder.start(100);
      };

      const stopRecordingCommand = () => {
        if (!isCurrentlyRecordingRef.current || !currentRecorderRef.current) return;
        currentRecorderRef.current.stop();
      };

      mediaRecorderRef.current = new MediaRecorder(stream); // unused sentinel, real recorders created per-command
      setIsRecording(true);

      detectSilenceAndProcess(
        analyser,
        () => {
          if (isCurrentlyRecordingRef.current) {
            stopRecordingCommand();
            setIsDetectingSpeech(false);
          }
        },
        (isSpeaking) => {
          if (isSpeaking && !isCurrentlyRecordingRef.current) {
            setIsDetectingSpeech(true);
            addMessage('system', '🎤 Detectando habla...');
            startRecordingCommand();
          }
        }
      );

      addMessage('system', '🎤 Modo continuo activado - Hablá con pausas naturales');
    } catch (error) {
      addMessage('system', 'Error: No se pudo acceder al micrófono');
    }
  };

  const stopContinuousRecording = () => {
    if (isCurrentlyRecordingRef.current && currentRecorderRef.current) {
      isShuttingDownRef.current = true;
      if (silenceDetectionRef.current) {
        cancelAnimationFrame(silenceDetectionRef.current);
        silenceDetectionRef.current = null;
      }
      setIsDetectingSpeech(false);
      currentRecorderRef.current.stop();
      return;
    }
    performCleanup();
  };

  const startRecording = async () => {
    if (!isMicAvailable()) {
      addMessage('system', '❌ Micrófono no disponible. Esta página requiere HTTPS. Si estás en la red local, accedé por la URL de Vercel (https://...).');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await sendAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      addMessage('user', 'Grabando...');
    } catch {
      addMessage('system', 'Error: No se pudo acceder al micrófono');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isContinuousMode) {
      isRecording ? stopContinuousRecording() : startContinuousRecording();
    } else {
      isRecording ? stopRecording() : startRecording();
    }
  };

  // ─── Audio → Whisper → Event ──────────────────────────────────────────────

  const sendAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob);
      const response = await fetch('/api/voice/transcribe', { method: 'POST', body: formData });
      const result = await response.json();

      if (result.success) {
        const parsed = {
          teamName: result.teamName,
          playerNumbers: result.playerNumbers || [],
          action: result.action,
          corrected: result.corrected,
        };
        let displayText = `"${result.raw}"`;
        if (result.corrected !== result.raw) displayText += ` → "${result.corrected}"`;
        addMessage('system', displayText, parsed, result.event);
      } else {
        addMessage('system', `Error: ${result.error || 'No se pudo transcribir'}`);
      }
    } catch {
      addMessage('system', 'Error al procesar el audio');
    } finally {
      setIsProcessing(false);
    }
  };

  const addMessage = (type: 'user' | 'system', text: string, parsed?: Message['parsed'], event?: any) => {
    const message: Message = { id: Date.now().toString(), type, text, timestamp: new Date(), parsed, event };
    setMessages(prev => [...prev, message]);

    // Auto-register shots immediately via remote command
    if (event?.action === 'shot' && event.data?.team && event.data?.playerNumber) {
      sendRemoteCommand({ type: 'ADD_SHOT', payload: { team: event.data.team, playerNumber: event.data.playerNumber } });
    }
  };

  const clearMessages = () => {
    setMessages([]);
    if (typeof window !== 'undefined') localStorage.removeItem('voice-remote-messages');
  };

  // ─── Event confirmation → remote commands ────────────────────────────────

  const confirmGoal = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message?.event || message.event.action !== 'goal') return;

    const { team, scorer, assists = [] } = message.event.data;
    sendRemoteCommand({
      type: 'ADD_GOAL',
      payload: {
        team,
        scorerNumber: scorer,
        ...(assists[0] ? { assistNumber: assists[0] } : {}),
        ...(assists[1] ? { assist2Number: assists[1] } : {}),
      },
    });

    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, goalConfirmed: true } : m));
  };

  const deleteGoalFromLog = (messageId: string) => {
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, goalConfirmed: false } : m));
  };

  const confirmPenalty = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message?.event || message.event.action !== 'penalty') return;

    const { team, playerNumber } = message.event.data;
    // Use first non-bench penalty type as "minor", fallback to first available
    const defaultType = penaltyTypes.find(p => !p.isBenchPenalty) ?? penaltyTypes[0];
    sendRemoteCommand({
      type: 'ADD_PENALTY',
      payload: { team, playerNumber, ...(defaultType ? { penaltyTypeId: defaultType.id } : {}) },
    });

    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, penaltyConfirmed: true } : m));
  };

  const deletePenaltyFromLog = (messageId: string) => {
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, penaltyConfirmed: false } : m));
  };

  // ─── UI ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center py-4">
          <h1 className="text-2xl font-bold">🎤 Control por Voz (Remoto)</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[250px_1fr_250px] gap-4">
          {/* Left: Home Team */}
          <Card className="p-4 h-[calc(100vh-200px)] overflow-y-auto">
            <h2 className="font-bold text-lg mb-3 text-center border-b pb-2">
              {homeTeam?.name || 'Equipo Local'}
            </h2>
            <div className="space-y-1">
              {homeTeam ? homeTeam.players.map(player => (
                <div key={player.id} className={`flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 ${!player.isPresent ? 'opacity-40' : ''}`}>
                  <span className="font-bold text-sm w-8">{player.number || '-'}</span>
                  <span className="text-xs truncate">{player.name}</span>
                  {!player.isPresent && <span className="text-[10px] text-muted-foreground ml-auto">ausente</span>}
                </div>
              )) : <p className="text-sm text-muted-foreground text-center py-4">Cargando...</p>}
            </div>
          </Card>

          {/* Center: Controls + Log */}
          <div className="flex flex-col gap-4">
            {/* Mode Toggle + Config */}
            <Card className="p-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="continuous-mode" className="text-sm font-medium">
                  Modo Continuo {isContinuousMode && '(Recomendado)'}
                </Label>
                <button
                  id="continuous-mode"
                  onClick={() => {
                    if (isRecording) isContinuousMode ? stopContinuousRecording() : stopRecording();
                    setIsContinuousMode(!isContinuousMode);
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isContinuousMode ? 'bg-primary' : 'bg-muted'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isContinuousMode ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {isContinuousMode
                  ? 'Click para activar → hablá con pausas → click para desactivar'
                  : 'Mantén presionado para grabar → suelta para enviar'}
              </p>

              {isContinuousMode && (
                <div className="mt-3 pt-3 border-t space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="silence-duration" className="text-xs font-medium">Pausa para procesar</Label>
                      <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{(silenceDuration / 1000).toFixed(1)}s</span>
                    </div>
                    <input
                      id="silence-duration"
                      type="range" min="500" max="3000" step="100"
                      value={silenceDuration}
                      onChange={(e) => setSilenceDuration(parseInt(e.target.value))}
                      disabled={isRecording}
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                      <span>0.5s (rápido)</span><span>3s (lento)</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="volume-threshold" className="text-xs font-medium">Filtro de ruido</Label>
                      <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{volumeThreshold}%</span>
                    </div>
                    <input
                      id="volume-threshold"
                      type="range" min="5" max="50" step="1"
                      value={volumeThreshold}
                      onChange={(e) => setVolumeThreshold(parseInt(e.target.value))}
                      disabled={isRecording}
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                      <span>5% (muy sensible)</span><span>50% (solo voz alta)</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      💡 Si procesa ruidos de fondo → subir. Si no detecta tu voz → bajar.
                    </p>
                  </div>
                </div>
              )}
            </Card>

            {/* Record Button */}
            <div className="flex flex-col items-center gap-3">
              <button
                {...(isContinuousMode
                  ? { onClick: toggleRecording }
                  : { onMouseDown: startRecording, onMouseUp: stopRecording, onTouchStart: startRecording, onTouchEnd: stopRecording })}
                disabled={isProcessing}
                className={`w-24 h-24 rounded-full text-white font-bold transition-all duration-200 active:scale-95 shadow-lg ${
                  isRecording
                    ? 'bg-green-600 scale-110 shadow-green-500/50 ' + (isContinuousMode ? 'animate-pulse' : '')
                    : isProcessing
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-red-500 hover:bg-red-600 active:bg-red-700'
                }`}
              >
                {isRecording ? <Mic className="w-10 h-10 mx-auto" /> : isProcessing ? <div className="text-xs">Procesando...</div> : <MicOff className="w-10 h-10 mx-auto" />}
              </button>

              <p className="text-sm text-muted-foreground text-center">
                {isRecording
                  ? isContinuousMode ? '🟢 Escuchando... (click para detener)' : 'Suelta para enviar'
                  : isProcessing ? 'Transcribiendo audio...'
                  : isContinuousMode ? 'Click para activar modo continuo' : 'Mantén presionado para grabar'}
              </p>

              {isContinuousMode && isRecording && (
                <Card className="w-full max-w-xs p-3">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium">Estado:</span>
                    <div className="flex items-center gap-2">
                      {isDetectingSpeech ? (
                        <><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /><span className="text-xs font-medium text-green-600">🎤 Grabando</span></>
                      ) : (
                        <><div className="w-2 h-2 bg-gray-400 rounded-full" /><span className="text-xs text-muted-foreground">⏸️ Esperando habla</span></>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">Volumen:</span>
                      <span className="text-xs font-mono">{currentVolume}%</span>
                    </div>
                    <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                      <div className={`absolute top-0 left-0 h-full transition-all duration-75 ${currentVolume >= volumeThreshold ? 'bg-green-500' : 'bg-gray-400'}`} style={{ width: `${currentVolume}%` }} />
                      <div className="absolute top-0 h-full w-0.5 bg-red-500" style={{ left: `${volumeThreshold}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                      <span>0%</span>
                      <span className="text-red-600">← {volumeThreshold}% threshold</span>
                      <span>100%</span>
                    </div>
                  </div>
                </Card>
              )}

              {messages.length > 0 && (
                <Button variant="outline" size="sm" onClick={clearMessages}>Limpiar mensajes</Button>
              )}
            </div>

            {/* Messages Log */}
            <div className="grid grid-cols-2 gap-3 h-[calc(100vh-350px)]">
              {/* Left: Full log */}
              <Card className="p-3 flex flex-col">
                <h3 className="font-semibold text-sm mb-2">Log Completo</h3>
                <div className="flex-1 overflow-y-auto space-y-2">
                  {messages.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No hay mensajes aún</p>
                  ) : (
                    [...messages].reverse().map((msg) => {
                      if (
                        msg.text.includes('Modo continuo activado') ||
                        msg.text.includes('Modo continuo desactivado') ||
                        msg.text.includes('Detectando habla') ||
                        msg.text.includes('Escuchando...') ||
                        msg.text.includes('Enviando audio') ||
                        msg.text.includes('acceder al micrófono')
                      ) return null;

                      const isGoal = msg.event?.action === 'goal' && msg.event?.data?.team && msg.event?.data?.scorer;
                      const isPenalty = msg.event?.action === 'penalty' && msg.event?.data?.team && msg.event?.data?.playerNumber;
                      if (isGoal && msg.goalConfirmed === false) return null;
                      if (isPenalty && msg.penaltyConfirmed === false) return null;

                      const isValidEvent = msg.event && msg.event.data?.team && (
                        (msg.event.action === 'shot' && msg.event.data?.playerNumber) ||
                        (msg.event.action === 'goal' && msg.event.data?.scorer) ||
                        (msg.event.action === 'penalty' && msg.event.data?.playerNumber)
                      );
                      const isInvalidAttempt = msg.type === 'system' && !isValidEvent && !isGoal;

                      return (
                        <div key={msg.id} className={`text-xs p-2 rounded ${isInvalidAttempt ? 'bg-muted border-2 border-orange-500' : msg.type === 'system' ? 'bg-muted' : 'bg-primary/10'}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex-1 break-words">{msg.text}</span>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{msg.timestamp.toLocaleTimeString()}</span>
                          </div>
                          {msg.parsed && (
                            <div className="mt-1 text-[10px] text-muted-foreground">
                              {msg.parsed.teamName && `Equipo: ${msg.parsed.teamName} | `}
                              {msg.parsed.playerNumbers.length > 0 && `Jugadores: #${msg.parsed.playerNumbers.join(', #')} | `}
                              {msg.parsed.action && `Acción: ${msg.parsed.action}`}
                            </div>
                          )}
                          {msg.event && (
                            <details className="mt-1 text-[10px]">
                              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ver JSON</summary>
                              <pre className="text-[9px] bg-black/20 p-1 rounded overflow-x-auto mt-1">{JSON.stringify(msg.event, null, 2)}</pre>
                            </details>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>

              {/* Right: Valid events only */}
              <Card className="p-3 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm">Eventos Registrados</h3>
                  <span className="text-[10px] text-muted-foreground">
                    {messages.filter(msg => {
                      if (!msg.event?.data?.team) return false;
                      const a = msg.event.action;
                      return (a === 'shot' && msg.event.data?.playerNumber) || (a === 'goal' && msg.event.data?.scorer) || (a === 'penalty' && msg.event.data?.playerNumber);
                    }).length} válidos
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2">
                  {(() => {
                    const validEvents = [...messages].reverse().filter(msg => {
                      if (!msg.event?.data?.team) return false;
                      const a = msg.event.action;
                      return (a === 'shot' && msg.event.data?.playerNumber) || (a === 'goal' && msg.event.data?.scorer) || (a === 'penalty' && msg.event.data?.playerNumber);
                    });

                    if (validEvents.length === 0) {
                      return <p className="text-xs text-muted-foreground text-center py-4">Aún no hay eventos registrados</p>;
                    }

                    return validEvents.map((msg) => {
                      const event = msg.event;
                      const action = event.action;
                      const team = event.data.team;
                      const teamName = event.data.teamName || (team === 'home' ? 'Local' : 'Visitante');
                      const playerNumber = action === 'goal' ? event.data.scorer : event.data.playerNumber;
                      const isGoal = action === 'goal';
                      const isPenalty = action === 'penalty';
                      const isShot = action === 'shot';
                      const assists = isGoal ? (event.data.assists ?? []) : [];

                      if (isGoal && msg.goalConfirmed === false) return null;
                      if (isPenalty && msg.penaltyConfirmed === false) return null;

                      return (
                        <div key={msg.id} className={`text-xs p-2 rounded bg-muted ${team === 'home' ? 'border-l-4' : 'border-r-4'} ${isGoal ? 'border-green-600 dark:border-green-500' : isPenalty ? 'border-red-600 dark:border-red-500' : 'border-blue-600 dark:border-blue-500'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className={`font-semibold ${isGoal ? 'text-green-600 dark:text-green-400' : isPenalty ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                {isGoal ? '🥅 GOL' : isPenalty ? '⚠️ PENALIDAD' : '🎯 TIRO'}
                              </div>
                              <div className="mt-1 text-[11px]">
                                <span className="font-medium">{teamName}</span>
                                {' - Jugador '}
                                <span className="font-bold">#{playerNumber}</span>
                                {assists.length > 0 && (
                                  <> - Asistencia{assists.length > 1 && 's'} <span className="font-bold">#{assists.join(', #')}</span></>
                                )}
                                {isPenalty && <span className="text-muted-foreground"> (Menor - 2 min)</span>}
                              </div>

                              {isGoal && msg.goalConfirmed === undefined && (
                                <div className="flex gap-2 mt-2">
                                  <Button size="sm" variant="default" className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700" onClick={() => confirmGoal(msg.id)}>
                                    <Check className="h-3 w-3 mr-1" />OK
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => deleteGoalFromLog(msg.id)}>
                                    <Trash2 className="h-3 w-3 mr-1" />Eliminar
                                  </Button>
                                </div>
                              )}
                              {isGoal && msg.goalConfirmed === true && <div className="mt-1 text-[10px] text-green-600 dark:text-green-400 font-medium">✅ Gol confirmado</div>}

                              {isPenalty && msg.penaltyConfirmed === undefined && (
                                <div className="flex gap-2 mt-2">
                                  <Button size="sm" variant="default" className="h-6 px-2 text-xs bg-red-600 hover:bg-red-700" onClick={() => confirmPenalty(msg.id)}>
                                    <Check className="h-3 w-3 mr-1" />OK
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => deletePenaltyFromLog(msg.id)}>
                                    <Trash2 className="h-3 w-3 mr-1" />Eliminar
                                  </Button>
                                </div>
                              )}
                              {isPenalty && msg.penaltyConfirmed === true && <div className="mt-1 text-[10px] text-red-600 dark:text-red-400 font-medium">✅ Penalidad confirmada</div>}
                              {isShot && <div className="mt-1 text-[10px] text-blue-600 dark:text-blue-400 font-medium">✅ Tiro registrado</div>}
                            </div>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{msg.timestamp.toLocaleTimeString()}</span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </Card>
            </div>
          </div>

          {/* Right: Away Team */}
          <Card className="p-4 h-[calc(100vh-200px)] overflow-y-auto">
            <h2 className="font-bold text-lg mb-3 text-center border-b pb-2">
              {awayTeam?.name || 'Equipo Visitante'}
            </h2>
            <div className="space-y-1">
              {awayTeam ? awayTeam.players.map(player => (
                <div key={player.id} className={`flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 ${!player.isPresent ? 'opacity-40' : ''}`}>
                  <span className="font-bold text-sm w-8">{player.number || '-'}</span>
                  <span className="text-xs truncate">{player.name}</span>
                  {!player.isPresent && <span className="text-[10px] text-muted-foreground ml-auto">ausente</span>}
                </div>
              )) : <p className="text-sm text-muted-foreground text-center py-4">Cargando...</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
