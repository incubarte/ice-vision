'use client';

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Mic, MicOff, ChevronDown, Settings, Check, Trash2, Target, Info } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useGoals } from '@/hooks/use-goals';
import { useGameState, getActualPeriodText, formatTime, type Team } from '@/contexts/game-state-context';
import { usePenalties } from '@/hooks/use-penalties';
import { useToast } from '@/hooks/use-toast';
import { safeUUID } from '@/lib/utils';

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
  goalConfirmed?: boolean; // true if confirmed, false if deleted, undefined if pending
  penaltyConfirmed?: boolean; // true if confirmed, false if deleted, undefined if pending
  shotId?: string; // ID of the shot in shotsLog, for deletion
  shotCancelled?: boolean; // true if shot was voided
  matchTime?: { periodText: string; clockTimeCs: number }; // match clock at time of event
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

interface VoiceControlsProps {
  onToggleRecording?: (isRecording: boolean) => void;
}

export interface VoiceControlsHandle {
  toggleRecording: () => void;
}

export const VoiceControls = forwardRef<VoiceControlsHandle, VoiceControlsProps>(function VoiceControls({ onToggleRecording }, ref) {
  const { addGoal } = useGoals();
  const { state, dispatch } = useGameState();
  const { addPenalty } = usePenalties();
  const { toast } = useToast();

  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [homeTeam, setHomeTeam] = useState<TeamData | null>(null);
  const [awayTeam, setAwayTeam] = useState<TeamData | null>(null);
  const [isContinuousMode, setIsContinuousMode] = useState(true);

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
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isHomeAbsentOpen, setIsHomeAbsentOpen] = useState(false);
  const [isAwayAbsentOpen, setIsAwayAbsentOpen] = useState(false);
  const [shotDeleteConfirmId, setShotDeleteConfirmId] = useState<string | null>(null);
  const [isMicEnabled, setIsMicEnabled] = useState(true);

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

  // Update refs when state changes
  useEffect(() => {
    silenceDurationRef.current = silenceDuration;
    volumeThresholdRef.current = volumeThreshold;
  }, [silenceDuration, volumeThreshold]);

  // Persist silence duration to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('voice-config-silence-duration', silenceDuration.toString());
    }
  }, [silenceDuration]);

  // Persist volume threshold to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('voice-config-volume-threshold', volumeThreshold.toString());
    }
  }, [volumeThreshold]);

  // Notify parent when recording state changes
  useEffect(() => {
    if (onToggleRecording) {
      onToggleRecording(isRecording);
    }
  }, [isRecording, onToggleRecording]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    toggleRecording: () => {
      if (isRecording) {
        stopContinuousRecording();
      } else {
        startContinuousRecording();
      }
    }
  }));

  const startContinuousRecording = async () => {
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
        if (!streamRef.current || isCurrentlyRecordingRef.current) {
          console.log('[Voice] ❌ Cannot start - no stream or already recording');
          return;
        }

        console.log('[Voice] 🎤 Starting to record command');
        chunksRef.current = [];
        isCurrentlyRecordingRef.current = true;

        const recorder = new MediaRecorder(streamRef.current, { mimeType: 'audio/webm' });

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };

        recorder.onstop = () => {
          console.log('[Voice] 🛑 Recorder stopped, processing...');

          const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const chunkCount = chunksRef.current.length;

          console.log(`[Voice] 📊 Audio captured: ${audioBlob.size} bytes, ${chunkCount} chunks`);

          const MIN_SIZE = 5000;
          const MIN_CHUNKS = 5;

          if (audioBlob.size > MIN_SIZE && chunkCount >= MIN_CHUNKS) {
            console.log(`[Voice] ✅ Audio valid - sending to Whisper`);
            addMessage('system', `📤 Enviando audio (${(audioBlob.size / 1000).toFixed(1)}KB)`);
            sendAudio(audioBlob);
          } else {
            console.log(`[Voice] ⏭️ Audio too small - skipped (${audioBlob.size} bytes, ${chunkCount} chunks)`);
            addMessage('system', `⏭️ Audio muy corto - ignorado`);
          }

          chunksRef.current = [];
          isCurrentlyRecordingRef.current = false;
          currentRecorderRef.current = null;

          // If we were shutting down, complete the cleanup now
          if (isShuttingDownRef.current) {
            console.log('[Voice] 🔄 Completing shutdown after processing final audio');
            performCleanup();
          } else {
            console.log('[Voice] ⏸️ Back to WAITING state - discarding all audio until next speech');
          }
        };

        currentRecorderRef.current = recorder;
        recorder.start(100);
      };

      const stopRecordingCommand = () => {
        if (!isCurrentlyRecordingRef.current || !currentRecorderRef.current) {
          console.log('[Voice] ⚠️ Cannot stop - not recording');
          return;
        }

        console.log('[Voice] Silence detected - stopping recording');
        currentRecorderRef.current.stop();
      };

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
            console.log('[Voice] 🎤 Speech detected - will start recording');
            setIsDetectingSpeech(true);
            addMessage('system', '🎤 Detectando habla...');
            startRecordingCommand();
          }
        }
      );

      addMessage('system', '🎤 Modo continuo activado - Hablá con pausas naturales');

    } catch (error) {
      console.error('Error accessing microphone:', error);
      addMessage('system', 'Error: No se pudo acceder al micrófono');
    }
  };

  const performCleanup = () => {
    console.log('[Voice] 🧹 Performing cleanup');

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

  const stopContinuousRecording = () => {
    // If currently recording a command, stop it and send the audio
    if (isCurrentlyRecordingRef.current && currentRecorderRef.current) {
      console.log('[Voice] 📤 Mic turned off while recording - stopping and sending audio');
      isShuttingDownRef.current = true;

      // Stop silence detection immediately to prevent new recordings
      if (silenceDetectionRef.current) {
        cancelAnimationFrame(silenceDetectionRef.current);
        silenceDetectionRef.current = null;
      }

      setIsDetectingSpeech(false);

      // Stop the recorder - the onstop callback will handle cleanup
      currentRecorderRef.current.stop();
      return; // Don't cleanup yet, let onstop handle it
    }

    // No active recording, cleanup immediately
    performCleanup();
  };

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
          if (onSpeechDetected) {
            onSpeechDetected(false);
          }
        }

        if (Date.now() - silenceStart > silenceDurationRef.current) {
          onSilence();
        }
      } else {
        if (!wasSpeaking) {
          wasSpeaking = true;
          if (onSpeechDetected) {
            onSpeechDetected(true);
          }
        }
        silenceStart = Date.now();
      }

      silenceDetectionRef.current = requestAnimationFrame(checkAudioLevel);
    };

    checkAudioLevel();
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopContinuousRecording();
    } else {
      startContinuousRecording();
    }
  };

  const sendAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob);

      const response = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        const parsed = {
          teamName: result.teamName,
          playerNumbers: result.playerNumbers || [],
          action: result.action,
          corrected: result.corrected
        };

        let displayText = `"${result.raw}"`;
        if (result.corrected !== result.raw) {
          displayText += ` → "${result.corrected}"`;
        }

        addMessage('system', displayText, parsed, result.event);
      } else {
        addMessage('system', `Error: ${result.error || 'No se pudo transcribir'}`);
      }

    } catch (error) {
      console.error('Error sending audio:', error);
      addMessage('system', 'Error al procesar el audio');
    } finally {
      setIsProcessing(false);
    }
  };

  const addMessage = (type: 'user' | 'system', text: string, parsed?: Message['parsed'], event?: any) => {
    let shotId: string | undefined;

    // Pre-generate shot ID so we can track it for deletion
    if (event && event.action === 'shot' && event.data?.team && event.data?.playerNumber) {
      const shotTeam = event.data.team;
      const shotNumber = event.data.playerNumber;
      const shotRoster = state.live.matchContext ? (shotTeam === 'home' ? state.live.matchContext.homeRoster : state.live.matchContext.awayRoster) : [];
      if (!shotRoster.some(p => p.number === shotNumber)) {
        console.warn(`[Voice] Player #${shotNumber} not found in ${shotTeam} roster. Ignoring shot.`);
      } else {
        shotId = safeUUID();
        dispatch({
          type: 'ADD_PLAYER_SHOT',
          payload: { team: shotTeam, playerNumber: shotNumber, id: shotId }
        });
      }
    }

    const matchTime = state.live ? {
      periodText: getActualPeriodText(state.live.clock.currentPeriod, state.live.clock.periodDisplayOverride, state.config?.numberOfRegularPeriods ?? 3, state.live.shootout),
      clockTimeCs: state.live.clock.currentTime,
    } : undefined;

    const message: Message = {
      id: Date.now().toString(),
      type,
      text,
      timestamp: new Date(),
      parsed,
      event,
      shotId,
      matchTime: event ? matchTime : undefined,
    };
    setMessages(prev => [...prev, message]);
  };

  const clearMessages = () => {
    setMessages([]);
    // Clear from localStorage too
    if (typeof window !== 'undefined') {
      localStorage.removeItem('voice-control-messages');
    }
  };

  const handlePlayerClick = (team: Team, playerNumber: string) => {
    // Validate player exists in roster
    const clickRoster = state.live.matchContext ? (team === 'home' ? state.live.matchContext.homeRoster : state.live.matchContext.awayRoster) : [];
    if (!clickRoster.some(p => p.number === playerNumber)) return;

    // Pre-generate shot ID so we can track it for deletion
    const shotId = safeUUID();
    dispatch({ type: 'ADD_PLAYER_SHOT', payload: { team, playerNumber, id: shotId } });

    // Get team name
    const teamName = team === 'home' ? (homeTeam?.name || 'Local') : (awayTeam?.name || 'Visitante');

    // Get player name
    const teamData = team === 'home' ? homeTeam : awayTeam;
    const player = teamData?.players.find(p => p.number === playerNumber);
    const playerName = player?.name || `Jugador #${playerNumber}`;

    const matchTime = state.live ? {
      periodText: getActualPeriodText(state.live.clock.currentPeriod, state.live.clock.periodDisplayOverride, state.config?.numberOfRegularPeriods ?? 3, state.live.shootout),
      clockTimeCs: state.live.clock.currentTime,
    } : undefined;

    // Add message to log (same format as voice events)
    const shotMessage: Message = {
      id: `shot-${Date.now()}-${Math.random()}`,
      type: 'system',
      text: `Tiro registrado: ${teamName} - Jugador #${playerNumber}`,
      timestamp: new Date(),
      shotId,
      matchTime,
      event: {
        action: 'shot',
        data: {
          team,
          teamName,
          playerNumber,
          playerName
        }
      }
    };

    setMessages(prev => [...prev, shotMessage]);

    toast({
      title: "Tiro Registrado",
      description: `Tiro para el jugador #${playerNumber}`,
      duration: 1500,
    });
  };

  const deleteShot = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message || !message.shotId || !message.event) return;
    const team: Team = message.event.data.team;
    dispatch({ type: 'DELETE_PLAYER_SHOT', payload: { team, shotId: message.shotId } });
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, shotCancelled: true } : m));
    setShotDeleteConfirmId(null);
  };

  const confirmGoal = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message || !message.event || message.event.action !== 'goal') return;

    const event = message.event;
    const team = event.data.team; // 'home' or 'away'
    const playerNumber = event.data.scorer; // Goals use 'scorer' field
    const playerName = event.data.playerName;
    const assists = event.data.assists || []; // Array of assist player numbers

    // Get team data to find player IDs
    const teamData = team === 'home' ? homeTeam : awayTeam;
    const scorerPlayer = teamData?.players.find(p => p.number === playerNumber);
    const assistPlayer1 = assists.length > 0 ? teamData?.players.find(p => p.number === assists[0]) : undefined;
    const assistPlayer2 = assists.length > 1 ? teamData?.players.find(p => p.number === assists[1]) : undefined;

    // Get current game time and period
    const gameTime = state.live.clock.currentTime;
    const currentPeriod = state.live.clock.currentPeriod;
    const periodText = getActualPeriodText(
      currentPeriod,
      state.live.clock.periodDisplayOverride,
      state.config.numberOfRegularPeriods,
      state.live.shootout
    );

    // Build goal data
    const goalData: any = {
      team,
      timestamp: Date.now(),
      gameTime,
      periodText,
      scorer: {
        playerNumber,
      }
    };

    // Add assists if present
    if (assists.length > 0) {
      goalData.assist = {
        playerNumber: assists[0]
      };
      if (assists.length > 1) {
        goalData.assist2 = {
          playerNumber: assists[1]
        };
      }
    }

    // Add goal using the hook
    addGoal(goalData);

    // Mark message as confirmed
    setMessages(prev =>
      prev.map(m =>
        m.id === messageId ? { ...m, goalConfirmed: true } : m
      )
    );

    console.log('[Voice] ✅ Goal confirmed and added:', { team, playerNumber, playerName });
  };

  const deleteGoalFromLog = (messageId: string) => {
    // Mark message as deleted (removed from view)
    setMessages(prev =>
      prev.map(m =>
        m.id === messageId ? { ...m, goalConfirmed: false } : m
      )
    );

    console.log('[Voice] 🗑️ Goal removed from log');
  };

  const confirmPenalty = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message || !message.event || message.event.action !== 'penalty') return;

    const event = message.event;
    const team = event.data.team; // 'home' or 'away'
    const playerNumber = event.data.playerNumber;

    // Add penalty as minor (2 minutes)
    addPenalty({
      team,
      playerNumber,
      initialDuration: 12000, // 2 minutes in centiseconds
      reducesPlayerCount: true,
      clearsOnGoal: true
    });

    // Mark message as confirmed
    setMessages(prev =>
      prev.map(m =>
        m.id === messageId ? { ...m, penaltyConfirmed: true } : m
      )
    );

    console.log('[Voice] ✅ Penalty confirmed and added:', { team, playerNumber });
  };

  const deletePenaltyFromLog = (messageId: string) => {
    // Mark message as deleted (removed from view)
    setMessages(prev =>
      prev.map(m =>
        m.id === messageId ? { ...m, penaltyConfirmed: false } : m
      )
    );

    console.log('[Voice] 🗑️ Penalty removed from log');
  };

  // Load messages from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMessages = localStorage.getItem('voice-control-messages');
      if (savedMessages) {
        try {
          const parsed = JSON.parse(savedMessages);
          // Convert timestamp strings back to Date objects
          const messagesWithDates = parsed.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));
          setMessages(messagesWithDates);
        } catch (error) {
          console.error('[VoiceControls] Error loading saved messages:', error);
        }
      }
    }
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined' && messages.length > 0) {
      localStorage.setItem('voice-control-messages', JSON.stringify(messages));
    }
  }, [messages]);

  // Load team data on mount
  useEffect(() => {
    const loadTeamData = async () => {
      try {
        const response = await fetch('/api/voice/teams');
        const data = await response.json();
        if (data.success) {
          setHomeTeam(data.homeTeam);
          setAwayTeam(data.awayTeam);
        }
      } catch (error) {
        console.error('Error loading team data:', error);
      }
    };
    loadTeamData();
  }, []);

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <Card className="bg-primary/5 border-primary/20">
        <div className="px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="font-semibold text-sm">Registrar Eventos</span>
            <span className="hidden sm:inline text-xs text-muted-foreground">
              — Click en jugador para tiros
              {isMicEnabled && ' · Ctrl o botón rojo para voz'}
            </span>
          </div>
          <Button
            variant={isMicEnabled ? 'default' : 'outline'}
            size="sm"
            className="h-7 px-2.5 gap-1.5 shrink-0"
            onClick={() => setIsMicEnabled(v => !v)}
          >
            {isMicEnabled ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
            <span className="text-xs">{isMicEnabled ? 'Voz ON' : 'Voz OFF'}</span>
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-[250px_1fr_250px] gap-4">
        {/* Left: Home Team Players */}
        <Card className="p-4 max-h-[500px] overflow-y-auto">
        <h2 className="font-bold text-lg mb-3 text-center border-b pb-2 relative">
          {homeTeam?.name || 'Equipo Local'}
          {(state.live?.shotsLog?.home?.length ?? 0) > 0 && (
            <span className="absolute right-0 top-1/2 -translate-y-1/2 text-sm font-normal text-blue-500 tabular-nums">{state.live.shotsLog.home.length}T</span>
          )}
        </h2>
        <div className="space-y-1">
          {homeTeam ? (
            <>
              {/* Present Players */}
              {homeTeam.players
                .filter(p => p.isPresent)
                .map((player) => {
                  const shotCount = state.live?.shotsLog?.home?.filter(s => s.playerNumber === player.number).length ?? 0;
                  return (
                    <div
                      key={player.id}
                      onClick={() => handlePlayerClick('home', player.number)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-primary/20 cursor-pointer transition-colors group"
                      title={`Click para registrar tiro de ${player.name}`}
                    >
                      <Target className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                      <span className="font-bold text-sm w-8">
                        {player.number || '-'}
                      </span>
                      <span className="text-xs truncate flex-1">
                        {player.name}
                      </span>
                      {shotCount > 0 && (
                        <span className="text-[10px] font-bold text-blue-500 tabular-nums shrink-0">
                          {shotCount}T
                        </span>
                      )}
                    </div>
                  );
                })}

              {/* Absent Players - Collapsible - Always show if there are absent players */}
              {(() => {
                const absentPlayers = homeTeam.players.filter(p => !p.isPresent);
                if (absentPlayers.length === 0) {
                  return null;
                }

                return (
                  <div className="mt-3 pt-2 border-t border-border/50">
                    <Collapsible open={isHomeAbsentOpen} onOpenChange={setIsHomeAbsentOpen}>
                      <CollapsibleTrigger asChild>
                        <button className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted text-xs font-medium text-muted-foreground transition-colors">
                          <span>Ausentes ({absentPlayers.length})</span>
                          <ChevronDown className={`h-3 w-3 transition-transform ${isHomeAbsentOpen ? 'rotate-180' : ''}`} />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="space-y-1 mt-1">
                          {absentPlayers.map((player) => (
                            <div
                              key={player.id}
                              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 opacity-40"
                            >
                              <span className="font-bold text-sm w-8">
                                {player.number || '-'}
                              </span>
                              <span className="text-xs truncate">
                                {player.name}
                              </span>
                              <span className="text-[10px] text-muted-foreground ml-auto">ausente</span>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                );
              })()}
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Cargando...
            </p>
          )}
        </div>
      </Card>

      {/* Center: Controls and Messages */}
      <div className="flex flex-col gap-4">
        {/* Controls Card - only when mic enabled */}
        {isMicEnabled && <Collapsible open={isConfigOpen} onOpenChange={setIsConfigOpen}>
          <Card className="p-3">
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between text-sm font-medium hover:bg-muted/50 rounded px-2 py-1 transition-colors">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span>Configuración</span>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${isConfigOpen ? 'rotate-180' : ''}`} />
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="space-y-3 pt-3">
                {/* Silence Duration */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="silence-duration" className="text-xs font-medium">
                      Pausa para procesar
                    </Label>
                    <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                      {(silenceDuration / 1000).toFixed(1)}s
                    </span>
                  </div>
                  <input
                    id="silence-duration"
                    type="range"
                    min="500"
                    max="3000"
                    step="100"
                    value={silenceDuration}
                    onChange={(e) => setSilenceDuration(parseInt(e.target.value))}
                    disabled={isRecording}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>0.5s (rápido)</span>
                    <span>3s (lento)</span>
                  </div>
                </div>

                {/* Volume Threshold */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="volume-threshold" className="text-xs font-medium">
                      Filtro de ruido
                    </Label>
                    <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                      {volumeThreshold}%
                    </span>
                  </div>
                  <input
                    id="volume-threshold"
                    type="range"
                    min="5"
                    max="50"
                    step="1"
                    value={volumeThreshold}
                    onChange={(e) => setVolumeThreshold(parseInt(e.target.value))}
                    disabled={isRecording}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>5% (muy sensible)</span>
                    <span>50% (solo voz alta)</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    💡 Si procesa ruidos de fondo → subir. Si no detecta tu voz → bajar.
                  </p>
                </div>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>}

        {/* Record Button - only when mic enabled */}
        {isMicEnabled && <div className="flex flex-col items-center gap-3">
          <button
            onClick={toggleRecording}
            disabled={isProcessing}
            className={`
              w-24 h-24 rounded-full text-white font-bold
              transition-all duration-200 active:scale-95
              shadow-lg
              ${isRecording
                ? 'bg-green-600 scale-110 shadow-green-500/50 animate-pulse'
                : isProcessing
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-red-500 hover:bg-red-600 active:bg-red-700'
              }
            `}
          >
            {isRecording ? (
              <Mic className="w-10 h-10 mx-auto" />
            ) : isProcessing ? (
              <div className="text-xs">Procesando...</div>
            ) : (
              <MicOff className="w-10 h-10 mx-auto" />
            )}
          </button>

          <p className="text-sm text-muted-foreground text-center">
            {isRecording
              ? '🟢 Escuchando... (click o Ctrl para detener)'
              : isProcessing
              ? 'Transcribiendo audio...'
              : 'Click o presiona Ctrl para activar'
            }
          </p>

          {/* Visual Indicators */}
          {isRecording && (
            <Card className="w-full max-w-xs p-3">
              {/* Status Indicator */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium">Estado:</span>
                <div className="flex items-center gap-2">
                  {isDetectingSpeech ? (
                    <>
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-xs font-medium text-green-600">🎤 Grabando</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 bg-gray-400 rounded-full" />
                      <span className="text-xs text-muted-foreground">⏸️ Esperando habla</span>
                    </>
                  )}
                </div>
              </div>

              {/* Volume Meter */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Volumen:</span>
                  <span className="text-xs font-mono">{currentVolume}%</span>
                </div>
                <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`absolute top-0 left-0 h-full transition-all duration-75 ${
                      currentVolume >= volumeThreshold
                        ? 'bg-green-500'
                        : 'bg-gray-400'
                    }`}
                    style={{ width: `${currentVolume}%` }}
                  />
                  <div
                    className="absolute top-0 h-full w-0.5 bg-red-500"
                    style={{ left: `${volumeThreshold}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>0%</span>
                  <span className="text-red-600">← {volumeThreshold}% threshold</span>
                  <span>100%</span>
                </div>
              </div>
            </Card>
          )}
        </div>}

        {/* Messages Log */}
        <div className={isMicEnabled ? "grid grid-cols-2 gap-3" : "flex flex-col gap-3"}>
          {/* Left Column: All Events - only when mic enabled */}
          {isMicEnabled && <Card className="p-3 h-[400px] flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">Log Completo</h3>
              <Button variant="ghost" size="sm" onClick={clearMessages}>
                Limpiar
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {messages.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Activa el micrófono para comenzar
                </p>
              ) : (
                [...messages].reverse().map((msg) => {
                  // Filter out mic on/off and system status messages
                  if (msg.text.includes('Modo continuo activado') ||
                      msg.text.includes('Modo continuo desactivado') ||
                      msg.text.includes('Detectando habla') ||
                      msg.text.includes('Escuchando...') ||
                      msg.text.includes('Enviando audio') ||
                      msg.text.includes('acceder al micrófono')) {
                    return null;
                  }

                  // Check if this is a goal event (goals use 'scorer' field)
                  const isGoal = msg.event?.action === 'goal' && msg.event?.data?.team && msg.event?.data?.scorer;

                  // Check if this is a penalty event
                  const isPenalty = msg.event?.action === 'penalty' && msg.event?.data?.team && msg.event?.data?.playerNumber;

                  // Don't render if goal was deleted
                  if (isGoal && msg.goalConfirmed === false) {
                    return null;
                  }

                  // Don't render if penalty was deleted
                  if (isPenalty && msg.penaltyConfirmed === false) {
                    return null;
                  }

                  // Check if this is a valid registrable event (shot, goal, or penalty with team and player)
                  // Note: goals use 'scorer' field, shots and penalties use 'playerNumber' field
                  const isValidEvent = msg.event && msg.event.data?.team && (
                    (msg.event.action === 'shot' && msg.event.data?.playerNumber) ||
                    (msg.event.action === 'goal' && msg.event.data?.scorer) ||
                    (msg.event.action === 'penalty' && msg.event.data?.playerNumber)
                  );

                  // If it's NOT a valid event and it's a system message, add orange border
                  const isInvalidAttempt = msg.type === 'system' && !isValidEvent && !isGoal;

                  return (
                    <div
                      key={msg.id}
                      className={`text-xs p-2 rounded ${
                        isInvalidAttempt
                          ? 'bg-muted border-2 border-orange-500'
                          : msg.type === 'system'
                          ? 'bg-muted'
                          : 'bg-primary/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex-1 break-words">
                          {msg.text}
                        </span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {msg.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      {msg.parsed && (
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          {msg.parsed.teamName && `Equipo: ${msg.parsed.teamName} | `}
                          {msg.parsed.playerNumbers.length > 0 && `Jugadores: #${msg.parsed.playerNumbers.join(', #')} | `}
                          {msg.parsed.action && `Acción: ${msg.parsed.action}`}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Card>}

          {/* Right Column: Valid Events Only */}
          <Card className={`p-3 flex flex-col ${isMicEnabled ? 'h-[400px]' : 'h-[500px]'}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">Eventos Registrados</h3>
              <span className="text-[10px] text-muted-foreground">
                {messages.filter(msg => {
                  if (!msg.event || !msg.event.data?.team) return false;
                  const action = msg.event.action;
                  // Goals use 'scorer', shots and penalties use 'playerNumber'
                  const hasPlayer = (action === 'goal' && msg.event.data?.scorer) ||
                                   (action === 'shot' && msg.event.data?.playerNumber) ||
                                   (action === 'penalty' && msg.event.data?.playerNumber);
                  return (action === 'shot' || action === 'goal' || action === 'penalty') && hasPlayer;
                }).length} válidos
              </span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {(() => {
                const validEvents = messages.filter(msg => {
                  if (!msg.event || !msg.event.data?.team) return false;
                  const action = msg.event.action;
                  // Goals use 'scorer', shots and penalties use 'playerNumber'
                  const hasPlayer = (action === 'goal' && msg.event.data?.scorer) ||
                                   (action === 'shot' && msg.event.data?.playerNumber) ||
                                   (action === 'penalty' && msg.event.data?.playerNumber);
                  return (action === 'shot' || action === 'goal' || action === 'penalty') && hasPlayer;
                });

                if (validEvents.length === 0) {
                  return (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Aún no hay eventos registrados
                    </p>
                  );
                }

                return validEvents.reverse().map((msg) => {
                  const event = msg.event;
                  const action = event.action;
                  const team = event.data.team;
                  const teamName = event.data.teamName || (team === 'home' ? 'Local' : 'Visitante');
                  // Goals use 'scorer', shots and penalties use 'playerNumber'
                  const playerNumber = action === 'goal' ? event.data.scorer : event.data.playerNumber;
                  const isGoal = action === 'goal';
                  const isPenalty = action === 'penalty';
                  const isShot = action === 'shot';
                  const assists = isGoal ? event.data.assists : [];

                  // Don't show goals that were deleted
                  if (isGoal && msg.goalConfirmed === false) {
                    return null;
                  }

                  // Don't show penalties that were deleted
                  if (isPenalty && msg.penaltyConfirmed === false) {
                    return null;
                  }

                  // Don't show shots that were cancelled
                  if (isShot && msg.shotCancelled === true) {
                    return null;
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`text-xs p-2 rounded bg-muted ${
                        team === 'home' ? 'border-l-4' : 'border-r-4'
                      } ${
                        isGoal
                          ? 'border-green-600 dark:border-green-500'
                          : isPenalty
                          ? 'border-red-600 dark:border-red-500'
                          : 'border-blue-600 dark:border-blue-500'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className={`font-semibold ${
                            isGoal ? 'text-green-600 dark:text-green-400' :
                            isPenalty ? 'text-red-600 dark:text-red-400' :
                            'text-blue-600 dark:text-blue-400'
                          }`}>
                            {isGoal ? '🥅 GOL' : isPenalty ? '⚠️ PENALIDAD' : '🎯 TIRO'}
                          </div>
                          <div className="mt-1 text-[11px]">
                            <span className="font-medium">{teamName}</span>
                            {' - Jugador '}
                            <span className="font-bold">#{playerNumber}</span>
                            {assists && assists.length > 0 && (
                              <>
                                {' - Asistencia'}
                                {assists.length > 1 && 's'}
                                {' '}
                                <span className="font-bold">#{assists.join(', #')}</span>
                              </>
                            )}
                            {isPenalty && (
                              <span className="text-muted-foreground"> (Menor - 2 min)</span>
                            )}
                          </div>

                          {/* Goal action buttons */}
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
                          {isGoal && msg.goalConfirmed === true && (
                            <div className="mt-1 text-[10px] text-green-600 dark:text-green-400 font-medium">✅ Gol confirmado</div>
                          )}

                          {/* Penalty action buttons */}
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
                          {isPenalty && msg.penaltyConfirmed === true && (
                            <div className="mt-1 text-[10px] text-red-600 dark:text-red-400 font-medium">✅ Penalidad confirmada</div>
                          )}
                        </div>

                        {/* Right side: match time + shot delete */}
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
                            {msg.matchTime
                              ? `${msg.matchTime.periodText} · ${formatTime(msg.matchTime.clockTimeCs, { showTenths: false, rounding: 'up' })}`
                              : msg.timestamp.toLocaleTimeString()}
                          </span>
                          {isShot && msg.shotId && (
                            shotDeleteConfirmId === msg.id ? (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-muted-foreground">¿Anular?</span>
                                <Button size="sm" variant="destructive" className="h-5 px-1.5 text-[10px]" onClick={() => deleteShot(msg.id)}>Sí</Button>
                                <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px]" onClick={() => setShotDeleteConfirmId(null)}>No</Button>
                              </div>
                            ) : (
                              <button className="text-muted-foreground/40 hover:text-destructive transition-colors" onClick={() => setShotDeleteConfirmId(msg.id)} title="Anular tiro">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </Card>
        </div>
      </div>

      {/* Right: Away Team Players */}
      <Card className="p-4 max-h-[500px] overflow-y-auto">
        <h2 className="font-bold text-lg mb-3 text-center border-b pb-2 relative">
          {awayTeam?.name || 'Equipo Visitante'}
          {(state.live?.shotsLog?.away?.length ?? 0) > 0 && (
            <span className="absolute right-0 top-1/2 -translate-y-1/2 text-sm font-normal text-blue-500 tabular-nums">{state.live.shotsLog.away.length}T</span>
          )}
        </h2>
        <div className="space-y-1">
          {awayTeam ? (
            <>
              {/* Present Players */}
              {awayTeam.players
                .filter(p => p.isPresent)
                .map((player) => {
                  const shotCount = state.live?.shotsLog?.away?.filter(s => s.playerNumber === player.number).length ?? 0;
                  return (
                    <div
                      key={player.id}
                      onClick={() => handlePlayerClick('away', player.number)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-primary/20 cursor-pointer transition-colors group"
                      title={`Click para registrar tiro de ${player.name}`}
                    >
                      <Target className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                      <span className="font-bold text-sm w-8">
                        {player.number || '-'}
                      </span>
                      <span className="text-xs truncate flex-1">
                        {player.name}
                      </span>
                      {shotCount > 0 && (
                        <span className="text-[10px] font-bold text-blue-500 tabular-nums shrink-0">
                          {shotCount}T
                        </span>
                      )}
                    </div>
                  );
                })}

              {/* Absent Players - Collapsible - Always show if there are absent players */}
              {(() => {
                const absentPlayers = awayTeam.players.filter(p => !p.isPresent);
                if (absentPlayers.length === 0) {
                  return null;
                }

                return (
                  <div className="mt-3 pt-2 border-t border-border/50">
                    <Collapsible open={isAwayAbsentOpen} onOpenChange={setIsAwayAbsentOpen}>
                      <CollapsibleTrigger asChild>
                        <button className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted text-xs font-medium text-muted-foreground transition-colors">
                          <span>Ausentes ({absentPlayers.length})</span>
                          <ChevronDown className={`h-3 w-3 transition-transform ${isAwayAbsentOpen ? 'rotate-180' : ''}`} />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="space-y-1 mt-1">
                          {absentPlayers.map((player) => (
                            <div
                              key={player.id}
                              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 opacity-40"
                            >
                              <span className="font-bold text-sm w-8">
                                {player.number || '-'}
                              </span>
                              <span className="text-xs truncate">
                                {player.name}
                              </span>
                              <span className="text-[10px] text-muted-foreground ml-auto">ausente</span>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                );
              })()}
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Cargando...
            </p>
          )}
        </div>
      </Card>
      </div>
    </div>
  );
});
