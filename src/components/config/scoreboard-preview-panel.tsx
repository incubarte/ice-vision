"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Monitor, ChevronDown, ChevronUp } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DEFAULT_RESOLUTION = 2000;
const MIN_RESOLUTION = 800;
const MAX_RESOLUTION = 4000;

export function ScoreboardPreviewPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [resolution, setResolution] = useState(DEFAULT_RESOLUTION);
  const [inputValue, setInputValue] = useState(String(DEFAULT_RESOLUTION));
  const [scale, setScale] = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);

  const updateScale = useCallback(() => {
    if (containerRef.current) {
      const width = containerRef.current.offsetWidth;
      setScale(width / resolution);
    }
  }, [resolution]);

  useEffect(() => {
    if (!isOpen) return;
    updateScale();
    const observer = new ResizeObserver(updateScale);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isOpen, updateScale]);

  const applyResolution = () => {
    const parsed = parseInt(inputValue, 10);
    if (!isNaN(parsed) && parsed >= MIN_RESOLUTION && parsed <= MAX_RESOLUTION) {
      setResolution(parsed);
    } else {
      setInputValue(String(resolution));
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Preview en pantalla cuadrada</span>
        </div>
        {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {isOpen && (
        <div className="p-4 space-y-4 border-t">
          {/* Resolution control */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Resolución (px):</Label>
            <Input
              type="number"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onBlur={applyResolution}
              onKeyDown={e => e.key === 'Enter' && applyResolution()}
              className="h-7 w-28 text-sm"
              min={MIN_RESOLUTION}
              max={MAX_RESOLUTION}
            />
            <span className="text-xs text-muted-foreground">× {resolution}</span>
            <span className="text-xs text-muted-foreground ml-auto">
              Escala: {(scale * 100).toFixed(0)}%
            </span>
          </div>

          {/* Preview container — square aspect ratio, clips the scaled iframe */}
          <div
            ref={containerRef}
            className={cn(
              "w-full relative bg-black rounded overflow-hidden border border-border",
              "ring-1 ring-inset ring-white/10"
            )}
            style={{ aspectRatio: '1 / 1' }}
          >
            <iframe
              src="/"
              title="Scoreboard preview"
              style={{
                width: `${resolution}px`,
                height: `${resolution}px`,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                border: 'none',
                pointerEvents: 'none',
                display: 'block',
              }}
            />
            {/* Overlay label */}
            <div className="absolute bottom-2 right-2 bg-black/60 text-white/70 text-[10px] px-1.5 py-0.5 rounded pointer-events-none">
              {resolution}×{resolution}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Los cambios de diseño se reflejan en tiempo real. La pantalla de scoreboard usa esta resolución exacta como viewport.
          </p>
        </div>
      )}
    </div>
  );
}
