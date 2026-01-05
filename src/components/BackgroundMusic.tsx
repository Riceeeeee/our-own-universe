'use client';

import { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Music } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MUSIC_URL = 'https://xapkuolecixkjmzwcope.supabase.co/storage/v1/object/public/memories_assets/0.9523935818320307.mp3';

export function BackgroundMusic() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initialize audio object if not already done
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = "anonymous"; // Enable CORS for caching
      audioRef.current.src = MUSIC_URL;
      audioRef.current.loop = true;
      audioRef.current.volume = 0.3; // Default volume 30%
    }

    return () => {
      // Cleanup is tricky with persistence requirements, 
      // but if the component truly unmounts (app close), we pause.
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      // Handle browser autoplay policies
      const playPromise = audioRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch((error) => {
            console.error("Playback failed:", error);
            setIsPlaying(false);
          });
      }
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <motion.button
        onClick={togglePlay}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className={`
          relative flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-colors
          ${isPlaying ? 'bg-rose-500 text-white' : 'bg-white/80 text-rose-500 backdrop-blur-sm border border-rose-200'}
        `}
        title={isPlaying ? "Tắt nhạc" : "Bật nhạc nền"}
      >
        {/* Pulse animation ring when playing */}
        {isPlaying && (
          <motion.div
            initial={{ opacity: 0.5, scale: 1 }}
            animate={{ opacity: 0, scale: 1.5 }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute inset-0 rounded-full bg-rose-500 z-[-1]"
          />
        )}

        <AnimatePresence mode="wait">
          {isPlaying ? (
            <motion.div
              key="playing"
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 90 }}
              className="relative"
            >
              {/* Rotating music note when playing */}
               <motion.div
                 animate={{ rotate: 360 }}
                 transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
               >
                 <Music className="w-5 h-5" />
               </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="paused"
              initial={{ scale: 0, rotate: 90 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: -90 }}
            >
              <VolumeX className="w-5 h-5" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
