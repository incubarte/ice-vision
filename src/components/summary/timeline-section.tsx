"use client";

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Goal, Siren, Coffee, Flag, Play, Pause } from "lucide-react";
import type { GameSummary, GoalLog, PenaltyLog, SummaryGoalEntry, SummaryPenaltyEntry, Team, TeamData } from "@/types";
import { cn } from "@/lib/utils";

interface TimelineEvent {
  id: string;
  type: 'goal' | 'penalty' | 'timeout' | 'break' | 'period-start';
  time: number; // Game time in centiseconds (already inverted from countdown)
  team?: Team;
  label: string;
  details?: string;
  subDetails?: string;
  periodText: string;
  logoDataUrl?: string;
  data?: GoalLog | PenaltyLog | SummaryGoalEntry | SummaryPenaltyEntry;
  branchId?: string; // For penalties that create a branch
  branchEndTime?: number; // When the penalty branch ends (already inverted from countdown)
  actualDuration?: number; // Actual duration in centiseconds for width calculation
}

interface TimelineSectionProps {
  summary: GameSummary;
  homeTeam?: TeamData;
  awayTeam?: TeamData;
}

export const TimelineSection = ({ summary, homeTeam, awayTeam }: TimelineSectionProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = normal, 2 = 2x zoom, etc.

  // Draggable marker state
  const [markerPosition, setMarkerPosition] = useState<number | null>(null); // Position in pixels from left
  const [isMarkerDragging, setIsMarkerDragging] = useState(false);
  const autoScrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 2x, 3x
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate total timeline width from played periods
  // Note: Game time is countdown within each period, but periods are ordered chronologically
  const totalDuration = useMemo(() => {
    if (!summary.statsByPeriod) return 0;
    return summary.statsByPeriod.reduce((total, period) => {
      return total + (period.periodDuration || 0);
    }, 0);
  }, [summary.statsByPeriod]);

  // Build timeline events and period boundaries from summary data
  const { events, periodBoundaries, penaltyLanes, maxHomeLane, maxAwayLane } = useMemo(() => {
    const timelineEvents: TimelineEvent[] = [];
    const boundaries: Array<{ time: number; label: string; isStart: boolean }> = [];
    const lanes = new Map<string, number>(); // penaltyId -> lane number
    let cumulativeTime = 0;

    if (!summary.statsByPeriod) return { events: timelineEvents, periodBoundaries: boundaries, penaltyLanes: lanes, maxHomeLane: 0, maxAwayLane: 0 };

    // Helper to look up player name from attendance by playerId
    const lookupPlayerName = (team: Team, playerId?: string): string | undefined => {
      if (!playerId) return undefined;
      const roster = team === 'home' ? summary.attendance?.home : summary.attendance?.away;
      return roster?.find(r => r.id === playerId)?.name;
    };

    summary.statsByPeriod.forEach((periodSummary, periodIndex) => {
      const periodDuration = periodSummary.periodDuration || 0;

      // Add period boundary markers
      if (periodIndex > 0) {
        // End of previous period / Start of current period
        boundaries.push({
          time: cumulativeTime,
          label: `Fin ${summary.statsByPeriod![periodIndex - 1].period} / Inicio ${periodSummary.period}`,
          isStart: true,
        });
      }

      // Add goals
      // IMPORTANT: gameTime is COUNTDOWN within the period
      // So we need to invert it: (periodDuration - gameTime) gives us time from start of period
      ['home', 'away'].forEach(teamStr => {
        const team = teamStr as Team;
        const teamData = team === 'home' ? homeTeam : awayTeam;
        (periodSummary.stats.goals[team] || []).forEach(goal => {
          // Invert the game time: if period is 90000cs and goal is at 80000cs (10 seconds in)
          // Position should be cumulativeTime + (90000 - 80000) = cumulativeTime + 10000
          const timeFromPeriodStart = periodDuration - goal.gameTime;

          timelineEvents.push({
            id: goal.id,
            type: 'goal',
            time: cumulativeTime + timeFromPeriodStart,
            team,
            label: 'GOL',
            details: lookupPlayerName(team, goal.scorer?.playerId) || `#${goal.scorer?.playerNumber || '?'}`,
            subDetails: (() => {
              const assistName = lookupPlayerName(team, goal.assist?.playerId);
              if (!assistName) return undefined;
              const assist2Name = lookupPlayerName(team, goal.assist2?.playerId);
              return `Asist: ${assistName}${assist2Name ? ', ' + assist2Name : ''}`;
            })(),
            periodText: goal.periodText,
            logoDataUrl: teamData?.logoDataUrl || undefined,
            data: goal,
          });
        });
      });

      // Add penalties (ignore deleted ones)
      ['home', 'away'].forEach(teamStr => {
        const team = teamStr as Team;
        const teamData = team === 'home' ? homeTeam : awayTeam;
        (periodSummary.stats.penalties[team] || []).forEach(penalty => {
          // Skip deleted penalties (not ended by goal)
          if (penalty.endReason === 'deleted') {
            return;
          }

          // addGameTime is COUNTDOWN time within the period
          // Invert it: (periodDuration - addGameTime) = time from period start
          const timeFromPeriodStart = periodDuration - penalty.addGameTime;
          const penaltyStartTime = cumulativeTime + timeFromPeriodStart;

          // Calculate end time using endGameTime if available
          let penaltyEndTime: number | undefined;

          if (penalty.endGameTime !== undefined && penalty.endPeriodText) {
            // Check if penalty ended in the same period or a different one
            if (penalty.endPeriodText === penalty.addPeriodText) {
              // Same period: invert endGameTime too
              const endTimeFromPeriodStart = periodDuration - penalty.endGameTime;
              penaltyEndTime = cumulativeTime + endTimeFromPeriodStart;
            } else {
              // Different period: find the period where it ended and invert there
              let endCumulativeTime = 0;
              for (const ps of summary.statsByPeriod || []) {
                if (ps.period === penalty.endPeriodText) {
                  const endPeriodDuration = ps.periodDuration || 0;
                  const endTimeFromPeriodStart = endPeriodDuration - penalty.endGameTime;
                  penaltyEndTime = endCumulativeTime + endTimeFromPeriodStart;
                  break;
                }
                endCumulativeTime += (ps.periodDuration || 0);
              }
            }
          }

          // Fallback: if no valid endGameTime, calculate from start + duration
          if (!penaltyEndTime || penaltyEndTime <= penaltyStartTime) {
            const durationInSeconds = penalty.timeServed !== undefined ? penalty.timeServed : penalty.initialDuration;
            penaltyEndTime = penaltyStartTime + (durationInSeconds * 100);
          }

          // DEBUG: Log penalty data
          console.log('Penalty:', {
            id: penalty.id,
            player: penalty.playerNumber,
            addGameTime: penalty.addGameTime,
            endGameTime: penalty.endGameTime,
            endPeriodText: penalty.endPeriodText,
            addPeriodText: penalty.addPeriodText,
            endReason: penalty.endReason,
            timeServed: penalty.timeServed,
            initialDuration: penalty.initialDuration,
            periodDuration,
            cumulativeTime,
            penaltyStartTime,
            penaltyEndTime,
            duration: penaltyEndTime - penaltyStartTime,
            startCountdown: periodDuration - (penaltyStartTime - cumulativeTime),
            endCountdown: penalty.endGameTime ? penalty.endGameTime : 'N/A'
          });

          // If ended by goal, let's also log the goals to compare
          if (penalty.endReason === 'goal_on_pp') {
            console.log('  -> Goals in period:', periodSummary.stats.goals);
          }

          // Final validation
          if (!penaltyEndTime || penaltyEndTime <= penaltyStartTime) {
            console.log('Skipping penalty - still invalid after fallback');
            return;
          }

          const durationInSeconds = penalty.timeServed !== undefined ? penalty.timeServed : penalty.initialDuration;

          // Calculate EXACT duration from countdown times for pixel-perfect alignment
          // If we have endGameTime, use the exact difference, otherwise use timeServed
          const actualDuration = penalty.endGameTime !== undefined
            ? Math.abs(penalty.addGameTime - penalty.endGameTime) // Exact countdown difference
            : durationInSeconds * 100; // Fallback to timeServed

          timelineEvents.push({
            id: penalty.id,
            type: 'penalty',
            time: penaltyStartTime,
            team,
            label: penalty.penaltyName || 'PENALIDAD',
            details: lookupPlayerName(team, penalty.playerId) || `#${penalty.playerNumber || '?'}`,
            subDetails: penalty.endReason === 'goal_on_pp'
              ? '⚡ Terminó por gol'
              : `${Math.floor(durationInSeconds / 60)}'${String(durationInSeconds % 60).padStart(2, '0')}"`,
            periodText: penalty.addPeriodText,
            logoDataUrl: teamData?.logoDataUrl || undefined,
            data: penalty,
            branchId: penalty.id,
            branchEndTime: penaltyEndTime,
            actualDuration: actualDuration,
          });
        });
      });

      cumulativeTime += periodDuration;
    });

    // Sort events by time
    const sortedEvents = timelineEvents.sort((a, b) => a.time - b.time);

    // Assign lanes to penalties (lane reuse algorithm)
    const homePenalties = sortedEvents.filter(e => e.type === 'penalty' && e.team === 'home' && e.branchEndTime);
    const awayPenalties = sortedEvents.filter(e => e.type === 'penalty' && e.team === 'away' && e.branchEndTime);

    [
      { penalties: homePenalties, team: 'home' },
      { penalties: awayPenalties, team: 'away' }
    ].forEach(({ penalties: teamPenalties, team }) => {
      const activeLanes: Array<{ id: string; lane: number; endTime: number }> = [];

      teamPenalties.forEach(penalty => {
        // Remove lanes that have ended (with small buffer to avoid overlap)
        const currentActiveLanes = activeLanes.filter(al => al.endTime > penalty.time + 100);

        // Find first available lane
        const usedLanes = new Set(currentActiveLanes.map(al => al.lane));
        let lane = 0;
        while (usedLanes.has(lane)) lane++;

        // Assign lane
        lanes.set(penalty.id, lane);

        // Add this penalty to active lanes
        currentActiveLanes.push({ id: penalty.id, lane, endTime: penalty.branchEndTime! });

        // Update activeLanes reference
        activeLanes.length = 0;
        activeLanes.push(...currentActiveLanes);
      });
    });

    // Calculate max lanes used per team to position event cards correctly
    const maxHomeLane = Math.max(-1, ...Array.from(lanes.entries())
      .filter(([id]) => sortedEvents.find(e => e.id === id)?.team === 'home')
      .map(([, lane]) => lane));
    const maxAwayLane = Math.max(-1, ...Array.from(lanes.entries())
      .filter(([id]) => sortedEvents.find(e => e.id === id)?.team === 'away')
      .map(([, lane]) => lane));

    return {
      events: sortedEvents,
      periodBoundaries: boundaries,
      penaltyLanes: lanes,
      maxHomeLane: maxHomeLane + 1, // +1 to convert to count
      maxAwayLane: maxAwayLane + 1,
    };
  }, [summary, homeTeam, awayTeam]);

  // Handle drag to scroll (desktop)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Scroll speed multiplier
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  // Zoom controls
  const handleZoomIn = () => {
    setZoomLevel(prev => {
      if (prev < 1) return prev + 0.15; // Smaller increments below 1x
      return Math.min(prev + 0.5, 3); // Max 3x zoom
    });
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => {
      if (prev <= 1) return Math.max(prev - 0.15, 0.1); // Min 0.1x (10%)
      return Math.max(prev - 0.5, 1);
    });
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
  };

  // Calculate position percentage for an event
  // Note: We already invert countdown times when building events, so this is straightforward
  const getEventPosition = (time: number) => {
    if (totalDuration === 0) return 0;
    return (time / totalDuration) * 100;
  };

  // Calculate width in pixels for a duration
  const getWidthForDuration = (duration: number) => {
    if (totalDuration === 0) return 0;
    // width = (duration / 500) * 40 * zoomLevel (same formula as total width)
    return (duration / 500) * 40 * zoomLevel;
  };

  // Format time display as COUNTDOWN
  // Input is time from start of timeline, we need to show countdown clock value
  const formatTime = (timeFromStart: number) => {
    // Find which period this time falls in and calculate countdown
    let cumulative = 0;
    for (const period of summary.statsByPeriod || []) {
      const periodDur = period.periodDuration || 0;
      if (timeFromStart <= cumulative + periodDur) {
        // This event is in this period
        const timeIntoPeriod = timeFromStart - cumulative;
        // Countdown: remaining time in period
        const countdown = periodDur - timeIntoPeriod;
        const totalSeconds = Math.floor(countdown / 100);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
      }
      cumulative += periodDur;
    }
    // Fallback
    return '0:00';
  };

  // Get period name at a given time
  const getPeriodAtTime = (timeFromStart: number): string => {
    let cumulative = 0;
    for (const period of summary.statsByPeriod || []) {
      const periodDur = period.periodDuration || 0;
      if (timeFromStart <= cumulative + periodDur) {
        return period.period;
      }
      cumulative += periodDur;
    }
    return summary.statsByPeriod?.[summary.statsByPeriod.length - 1]?.period || '';
  };

  // Calculate score at a given time
  const getScoreAtTime = (timeFromStart: number): { home: number; away: number } => {
    let homeScore = 0;
    let awayScore = 0;

    // Count goals that happened before this time
    events.forEach(event => {
      if (event.type === 'goal' && event.time <= timeFromStart) {
        if (event.team === 'home') homeScore++;
        else if (event.team === 'away') awayScore++;
      }
    });

    return { home: homeScore, away: awayScore };
  };

  // Handle marker dragging
  const handleMarkerMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMarkerDragging(true);
  };

  const handleMarkerMouseMove = (e: React.MouseEvent) => {
    if (!isMarkerDragging || !timelineContainerRef.current || !scrollContainerRef.current) return;

    const scrollContainer = scrollContainerRef.current;
    const scrollRect = scrollContainer.getBoundingClientRect();

    // The mouse position relative to the scroll container viewport
    const mouseXRelativeToContainer = e.clientX - scrollRect.left;

    // Add the scroll offset to get the position within the full timeline
    const positionInTimeline = mouseXRelativeToContainer + scrollContainer.scrollLeft;

    // Clamp to timeline bounds
    const timelineWidth = Math.max(1200, (totalDuration / 500) * 40 * zoomLevel);
    const clampedX = Math.max(0, Math.min(positionInTimeline, timelineWidth));

    setMarkerPosition(clampedX);

    // Auto-scroll logic when near edges
    const edgeThreshold = 100; // pixels from edge to trigger scroll
    const scrollSpeed = 10;

    const distanceFromLeftEdge = e.clientX - scrollRect.left;
    const distanceFromRightEdge = scrollRect.right - e.clientX;

    // Clear existing interval
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }

    // Scroll left if near left edge
    if (distanceFromLeftEdge < edgeThreshold && scrollContainer.scrollLeft > 0) {
      autoScrollIntervalRef.current = setInterval(() => {
        scrollContainer.scrollLeft -= scrollSpeed;
      }, 16);
    }
    // Scroll right if near right edge
    else if (distanceFromRightEdge < edgeThreshold) {
      autoScrollIntervalRef.current = setInterval(() => {
        scrollContainer.scrollLeft += scrollSpeed;
      }, 16);
    }
  };

  const handleMarkerMouseUp = () => {
    setIsMarkerDragging(false);
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }
  };

  // Keep marker visible by scrolling at the same speed when near edges
  const updateScrollPosition = (pixelsPerFrame: number) => {
    if (!scrollContainerRef.current || markerPosition === null) return;

    const scrollContainer = scrollContainerRef.current;
    const containerWidth = scrollContainer.clientWidth;
    const scrollLeft = scrollContainer.scrollLeft;

    // Calculate where the marker is relative to the viewport
    const markerViewportPosition = markerPosition - scrollLeft;

    // Define safe zone (25% from left edge, 75% from left edge = 50% in the middle)
    const leftThreshold = containerWidth * 0.25;
    const rightThreshold = containerWidth * 0.75;

    // Only scroll if marker is outside the safe zone
    if (markerViewportPosition < leftThreshold) {
      // Too close to left edge - shouldn't happen during forward playback
      scrollContainer.scrollLeft = Math.max(0, scrollLeft - pixelsPerFrame);
    } else if (markerViewportPosition > rightThreshold) {
      // Too close to right edge - scroll forward at the same speed as the marker
      scrollContainer.scrollLeft = scrollLeft + pixelsPerFrame;
    }
    // If marker is in the safe zone (between 25% and 75%), don't scroll
  };

  // Playback effect with requestAnimationFrame for smoother animation
  useEffect(() => {
    if (!isPlaying || markerPosition === null) {
      return;
    }

    const timelineWidth = Math.max(1200, (totalDuration / 500) * 40 * zoomLevel);

    // Base speed: 1.5 pixels per frame at 60fps
    // Speed 1x = 1.5 pixels per frame
    // Speed 3x = 4.5 pixels per frame (3 * 1.5)
    // Speed 9x = 13.5 pixels per frame (9 * 1.5)
    const baseSpeed = playbackSpeed * 1.5;

    let animationFrameId: number;
    let lastTimestamp = performance.now();
    let currentPosition = markerPosition;

    const animate = (timestamp: number) => {
      const deltaTime = timestamp - lastTimestamp;
      lastTimestamp = timestamp;

      // Calculate pixels to move based on time elapsed (target 60fps = ~16.67ms per frame)
      const pixelsToMove = baseSpeed * (deltaTime / 16.67);

      currentPosition += pixelsToMove;

      // Stop if we reach the end
      if (currentPosition >= timelineWidth) {
        setIsPlaying(false);
        setMarkerPosition(timelineWidth);
        return;
      }

      setMarkerPosition(currentPosition);

      // Update scroll position smoothly to keep marker at a target position
      if (scrollContainerRef.current) {
        const scrollContainer = scrollContainerRef.current;
        const containerWidth = scrollContainer.clientWidth;
        const scrollLeft = scrollContainer.scrollLeft;
        const markerViewportPosition = currentPosition - scrollLeft;

        // Target position: 60% from left (comfortable viewing position)
        const targetViewportPosition = containerWidth * 0.6;

        // Calculate how far the marker is from the target position
        const distanceFromTarget = markerViewportPosition - targetViewportPosition;

        // If marker is drifting from target, scroll proportionally to correct
        // The further it drifts, the faster we correct
        if (Math.abs(distanceFromTarget) > 10) { // 10px tolerance
          // Scroll a fraction of the distance to create smooth correction
          // Also move at the base speed of the marker to keep up
          const correctionSpeed = distanceFromTarget * 0.1; // 10% of the distance each frame
          scrollContainer.scrollLeft = scrollLeft + pixelsToMove + correctionSpeed;
        } else {
          // Within tolerance, just follow the marker at its speed
          scrollContainer.scrollLeft = scrollLeft + pixelsToMove;
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isPlaying, playbackSpeed, totalDuration, zoomLevel]);

  // Cleanup auto-scroll on unmount
  useEffect(() => {
    return () => {
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current);
      }
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="w-full space-y-4">
      {/* Zoom controls - Desktop only */}
      <div className="hidden md:flex items-center justify-between px-4 py-2 bg-card rounded-lg border">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          <span className="font-semibold">Cronología del Partido</span>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant={markerPosition !== null ? "default" : "outline"}
            size="sm"
            onClick={() => {
              if (markerPosition === null) {
                // Activate marker at the start (position 0)
                setMarkerPosition(0);
              } else {
                // Deactivate marker
                setMarkerPosition(null);
              }
            }}
            className="h-8 px-3 text-xs font-semibold"
          >
            {markerPosition !== null ? "Ocultar Marcador" : "Mostrar Marcador"}
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground mr-2">Zoom:</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 0.1}
              className="h-8 w-8 p-0"
            >
              <span className="text-lg">−</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetZoom}
              className="h-8 px-3 text-xs font-semibold"
            >
              {Math.round(zoomLevel * 100)}%
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 3}
              className="h-8 w-8 p-0"
            >
              <span className="text-lg">+</span>
            </Button>
          </div>
        </div>
      </div>

      <Card className="w-full overflow-hidden">
        <CardContent className="pt-6 relative">
        {/* Marker info display - fixed in top right corner of card */}
        {markerPosition !== null && (() => {
          const timelineWidth = Math.max(1200, (totalDuration / 500) * 40 * zoomLevel);
          const timeAtMarker = (markerPosition / timelineWidth) * totalDuration;
          const scoreAtMarker = getScoreAtTime(timeAtMarker);
          const periodAtMarker = getPeriodAtTime(timeAtMarker);
          const timeText = formatTime(timeAtMarker);

          return (
            <div className="absolute top-4 right-4 z-40 flex flex-col gap-2">
              {/* Playback controls */}
              <div className="bg-background/95 backdrop-blur-sm p-2 rounded-lg border-2 border-accent shadow-xl pointer-events-auto">
                <div className="flex items-center gap-2">
                  <Button
                    variant={isPlaying ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="h-8 w-8 p-0"
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <div className="flex gap-1">
                    {[1, 3, 6].map(speed => (
                      <Button
                        key={speed}
                        variant={playbackSpeed === speed ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPlaybackSpeed(speed)}
                        className="h-8 px-2 text-xs font-semibold"
                      >
                        {speed}x
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Score display */}
              <div className="bg-background/95 backdrop-blur-sm p-3 rounded-lg border-2 border-accent shadow-xl pointer-events-none">
                <div className="text-xs font-semibold text-muted-foreground mb-2">
                  {timeText} • {periodAtMarker}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {homeTeam?.logoDataUrl && (
                      <img src={homeTeam.logoDataUrl} alt={homeTeam.name} className="w-6 h-6 object-contain" />
                    )}
                    <span className="text-xl font-bold">{scoreAtMarker.home}</span>
                  </div>
                  <span className="text-lg text-muted-foreground">-</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold">{scoreAtMarker.away}</span>
                    {awayTeam?.logoDataUrl && (
                      <img src={awayTeam.logoDataUrl} alt={awayTeam.name} className="w-6 h-6 object-contain" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Desktop: Horizontal Timeline */}
        <div className="hidden md:block w-full">
          {/* Scrollable container with visible scrollbar */}
          <div
            ref={scrollContainerRef}
            className="overflow-x-auto p-4 border-2 rounded-lg bg-muted/20 timeline-scrollbar w-full relative"
            style={{
              scrollbarWidth: 'auto', // Firefox
              scrollbarColor: 'hsl(var(--accent)) hsl(var(--muted))', // Firefox
              minHeight: '580px',
              maxWidth: '100%',
            }}
          >
            {/* Fixed team logos in corners */}
            {/* Home team logo - top left corner */}
            {homeTeam?.logoDataUrl && (
              <div className="absolute top-4 left-4 z-20 pointer-events-none">
                <div className="bg-background/90 backdrop-blur-sm p-3 rounded-lg border-2 shadow-lg">
                  <img
                    src={homeTeam.logoDataUrl}
                    alt={homeTeam.name}
                    className="w-16 h-16 object-contain"
                  />
                  <div className="text-xs text-center text-muted-foreground font-semibold mt-2 max-w-[80px] leading-tight">
                    {homeTeam.name}
                  </div>
                </div>
              </div>
            )}

            {/* Away team logo - bottom left corner */}
            {awayTeam?.logoDataUrl && (
              <div className="absolute bottom-4 left-4 z-20 pointer-events-none">
                <div className="bg-background/90 backdrop-blur-sm p-3 rounded-lg border-2 shadow-lg">
                  <img
                    src={awayTeam.logoDataUrl}
                    alt={awayTeam.name}
                    className="w-16 h-16 object-contain"
                  />
                  <div className="text-xs text-center text-muted-foreground font-semibold mt-2 max-w-[80px] leading-tight">
                    {awayTeam.name}
                  </div>
                </div>
              </div>
            )}
            {/* Timeline content - draggable */}
            <div
              ref={timelineContainerRef}
              className={cn(
                "select-none inline-block min-w-full",
                isDragging ? "cursor-grabbing" : "cursor-grab"
              )}
              onMouseDown={handleMouseDown}
              onMouseMove={(e) => {
                handleMouseMove(e);
                handleMarkerMouseMove(e);
              }}
              onMouseUp={() => {
                handleMouseUp();
                handleMarkerMouseUp();
              }}
              onMouseLeave={() => {
                handleMouseLeave();
                handleMarkerMouseUp();
              }}
            >
              {/* Each 5 seconds = ~40px * zoomLevel, so duration in centiseconds / 500 * 40 */}
              <div className="relative h-[500px] py-8" style={{ width: `${Math.max(1200, (totalDuration / 500) * 40 * zoomLevel)}px` }}>
              {/* Main timeline line */}
              <div className="absolute top-1/2 left-0 right-0 h-2 bg-primary/30 -translate-y-1/2" />

              {/* Draggable time marker */}
              {markerPosition !== null && (() => {
                const timelineWidth = Math.max(1200, (totalDuration / 500) * 40 * zoomLevel);
                const timeAtMarker = (markerPosition / timelineWidth) * totalDuration;
                const scoreAtMarker = getScoreAtTime(timeAtMarker);
                const periodAtMarker = getPeriodAtTime(timeAtMarker);
                const timeText = formatTime(timeAtMarker);

                return (
                  <>
                    {/* Vertical line */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-accent pointer-events-none"
                      style={{
                        left: `${markerPosition}px`,
                        willChange: isPlaying ? 'left' : 'auto'
                      }}
                    />

                    {/* Draggable marker circle */}
                    <div
                      className="absolute top-1/2 w-6 h-6 rounded-full bg-accent border-2 border-background shadow-lg cursor-grab active:cursor-grabbing z-30"
                      style={{
                        left: `${markerPosition}px`,
                        transform: 'translate(-50%, -50%)',
                        willChange: isPlaying ? 'left' : 'auto'
                      }}
                      onMouseDown={handleMarkerMouseDown}
                    />
                  </>
                );
              })()}

              {/* Start marker - shows first period start time */}
              <div className="absolute top-1/2 left-0 -translate-y-1/2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <div className="text-xs text-muted-foreground mt-2 -ml-4">
                  {formatTime(0)}
                </div>
              </div>

              {/* End marker */}
              <div className="absolute top-1/2 right-0 -translate-y-1/2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <div className="text-xs text-muted-foreground mt-2 -mr-2">
                  {formatTime(totalDuration)}
                </div>
              </div>

              {/* Time markers every 30 seconds */}
              {Array.from({ length: Math.ceil(totalDuration / 3000) }).map((_, index) => {
                const timeInCs = index * 3000;
                if (timeInCs === 0 || timeInCs >= totalDuration) return null;
                const position = getEventPosition(timeInCs);
                return (
                  <div
                    key={`time-marker-${index}`}
                    className="absolute top-1/2 -translate-y-1/2"
                    style={{ left: `${position}%` }}
                  >
                    <div className="w-px h-4 bg-muted-foreground/20" />
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground font-mono">
                      {formatTime(timeInCs)}
                    </div>
                  </div>
                );
              })}

              {/* Period boundaries (vertical dashed lines) */}
              {periodBoundaries.map((boundary, index) => {
                const position = getEventPosition(boundary.time);
                return (
                  <div
                    key={`boundary-${index}`}
                    className="absolute top-0 bottom-0"
                    style={{ left: `${position}%` }}
                  >
                    <div className="h-full border-l-2 border-dashed border-muted-foreground/40" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 py-1.5 text-xs text-muted-foreground whitespace-nowrap rounded border border-muted-foreground/30 shadow-sm font-semibold">
                      {boundary.label}
                    </div>
                  </div>
                );
              })}

              {/* Events */}
              {events.map((event, index) => {
                const position = getEventPosition(event.time);
                const isGoal = event.type === 'goal';
                const isPenalty = event.type === 'penalty';
                const isHome = event.team === 'home';

                // Calculate dynamic spacing based on max penalty lanes
                // Each penalty lane takes less space now: 20px base + 35px per lane
                // Add minimal padding (10px) to keep cards close to penalty lanes
                const maxLanes = isHome ? maxHomeLane : maxAwayLane;
                const penaltyLaneHeight = 20 + (maxLanes * 35); // Base offset + lanes (must match line 543)
                const cardOffset = penaltyLaneHeight + 10; // Add minimal padding
                const lineHeight = cardOffset; // Line should end exactly where the card starts

                return (
                  <React.Fragment key={event.id}>
                    {/* Event marker on timeline */}
                    <div
                      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${position}%` }}
                    >
                      {/* Vertical line to event card */}
                      <div
                        className={cn(
                          "absolute left-1/2 -translate-x-1/2 w-0.5",
                          isHome ? "bottom-0 bg-primary/40" : "top-0 bg-accent/40"
                        )}
                        style={{
                          [isHome ? 'bottom' : 'top']: '0.5rem',
                          height: `${lineHeight}px`
                        }}
                      />

                      {/* Marker dot */}
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2 bg-background absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                        isGoal && "border-primary",
                        isPenalty && "border-destructive"
                      )} />

                      {/* Event card */}
                      <div
                        className={cn(
                          "absolute left-1/2 -translate-x-1/2 w-36 p-2.5 rounded-lg border-2 bg-card shadow-md",
                          isGoal && "border-primary/50",
                          isPenalty && "border-destructive/50"
                        )}
                        style={{
                          [isHome ? 'bottom' : 'top']: `${cardOffset}px`
                        }}
                      >
                        {/* Small team logo in corner */}
                        {event.logoDataUrl && (
                          <img
                            src={event.logoDataUrl}
                            alt="Team logo"
                            className="absolute top-1.5 left-1.5 w-5 h-5 object-contain"
                          />
                        )}
                        <div className={cn(
                          "text-sm font-bold text-center mb-1",
                          isGoal && "text-primary",
                          isPenalty && "text-destructive"
                        )}>
                          {event.label}
                        </div>
                        {event.details && (
                          <div className="text-xs text-center text-foreground mb-1">
                            {event.details}
                          </div>
                        )}
                        {event.subDetails && (
                          <div className="text-xs text-center text-muted-foreground mb-1">
                            {event.subDetails}
                          </div>
                        )}
                        <div className="text-xs text-center text-muted-foreground font-mono mt-1.5 pt-1.5 border-t">
                          {formatTime(event.time)}
                        </div>
                      </div>

                      {/* Penalty branch (like git branch visualization) */}
                      {isPenalty && event.branchEndTime && event.branchEndTime > event.time && (() => {
                        // Calculate where the end marker should be (at branchEndTime position)
                        const endPosition = getEventPosition(event.branchEndTime);
                        const endPositionPx = (endPosition / 100) * Math.max(1200, (totalDuration / 500) * 40 * zoomLevel);
                        const startPositionPx = (position / 100) * Math.max(1200, (totalDuration / 500) * 40 * zoomLevel);
                        const distanceToEnd = endPositionPx - startPositionPx;

                        // Get pre-calculated lane for this penalty
                        const assignedLane = penaltyLanes.get(event.id) || 0;
                        const verticalOffset = 20 + (assignedLane * 35); // Reduced spacing: 20px base + 35px per lane

                        return (
                        <>
                          {/* Branch visualization - separated parallel line */}
                          <div
                            className="absolute left-0 top-1/2"
                          >
                            {/* Single SVG path that draws the entire branch with dynamic vertical offset */}
                            <svg
                              className="absolute"
                              width={distanceToEnd}
                              height={verticalOffset + 25}
                              viewBox={`0 0 ${distanceToEnd} ${verticalOffset + 25}`}
                              style={{
                                left: '0px',
                                // Home (above): SVG grows upward from main line (negative top to go up)
                                // Away (below): SVG grows downward from main line
                                ...(isHome
                                  ? { top: `${-(verticalOffset + 25)}px` }
                                  : { top: '0px' }
                                ),
                              }}
                            >
                              <path
                                d={isHome
                                  // Home (above): start at bottom of SVG (y=verticalOffset+25) where main line is, curve up to y=25
                                  ? `M 0 ${verticalOffset + 25} Q 0 ${(verticalOffset + 25) - (12.5 + (verticalOffset / 2))}, 20 25 L ${distanceToEnd - 20} 25 Q ${distanceToEnd} ${(verticalOffset + 25) - (12.5 + (verticalOffset / 2))}, ${distanceToEnd} ${verticalOffset + 25}`
                                  // Away (below): start at top of SVG (y=0) where main line is, curve down to verticalOffset
                                  : `M 0 0 Q 0 ${12.5 + (verticalOffset / 2)}, 20 ${verticalOffset} L ${distanceToEnd - 20} ${verticalOffset} Q ${distanceToEnd} ${12.5 + (verticalOffset / 2)}, ${distanceToEnd} 0`
                                }
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="text-destructive/30"
                              />
                            </svg>
                          </div>

                          {/* Branch end marker on main timeline - at the exact end position */}
                          <div
                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-destructive/50 border border-background"
                            style={{
                              left: `${distanceToEnd}px`,
                            }}
                          />
                        </>
                        );
                      })()}
                    </div>
                  </React.Fragment>
                );
              })}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile: Vertical Timeline */}
        <div className="md:hidden">
          <div className="relative pl-8">
            {/* Vertical line */}
            <div className="absolute left-3 top-0 bottom-0 w-1 bg-primary/30" />

            {/* Events */}
            <div className="space-y-6">
              {events.map((event, index) => {
                const isGoal = event.type === 'goal';
                const isPenalty = event.type === 'penalty';

                return (
                  <div key={event.id} className="relative">
                    {/* Marker dot */}
                    <div className={cn(
                      "absolute -left-5 top-2 w-4 h-4 rounded-full border-2 bg-background",
                      isGoal && "border-primary",
                      isPenalty && "border-destructive"
                    )} />

                    {/* Event card */}
                    <div className="p-3 rounded-lg border bg-card shadow-sm">
                      <div className="flex items-start gap-2">
                        {event.logoDataUrl && (
                          <img
                            src={event.logoDataUrl}
                            alt="Team logo"
                            className="w-8 h-8 object-contain opacity-50 flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className={cn(
                            "text-sm font-bold",
                            isGoal && "text-primary",
                            isPenalty && "text-destructive"
                          )}>
                            {event.label}
                          </div>
                          {event.details && (
                            <div className="text-sm text-muted-foreground">
                              {event.details}
                            </div>
                          )}
                          {event.subDetails && (
                            <div className="text-xs text-muted-foreground">
                              {event.subDetails}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex-shrink-0">
                          {formatTime(event.time)}
                        </div>
                      </div>

                      {/* Penalty duration indicator */}
                      {isPenalty && event.branchEndTime && (
                        <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                          Finaliza: {formatTime(event.branchEndTime)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {events.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            No hay eventos registrados en la cronología.
          </div>
        )}
        </CardContent>
      </Card>
    </div>
  );
};
