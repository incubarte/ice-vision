"use client";

import React, { useRef } from 'react';
import { motion } from 'framer-motion';

interface ReplayOverlayProps {
  url: string;
  startTimeSeconds?: number;
  onFinish: () => void;
}

export function ReplayOverlay({ url, startTimeSeconds = 4, onFinish }: ReplayOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 overflow-hidden"
    >
      <video
        ref={videoRef}
        key={url}
        onEnded={onFinish}
        onLoadedMetadata={(e) => {
          e.currentTarget.currentTime = startTimeSeconds;
        }}
        className="w-full h-full object-contain"
        autoPlay
        muted
        playsInline 
      >
        <source src={url} type="video/mp4" />
        Tu navegador no soporta el tag de video.
      </video>
    </motion.div>
  );
}
