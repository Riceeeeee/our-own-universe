'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Heart } from 'lucide-react';

interface FloatingHeartsProps {
  hearts: { id: number; x: number }[];
}

export function FloatingHearts({ hearts }: FloatingHeartsProps) {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      <AnimatePresence>
        {hearts.map((heart) => (
          <motion.div
            key={heart.id}
            initial={{ opacity: 1, y: '100vh', x: `${heart.x}vw`, scale: 0.5 }}
            animate={{ opacity: 0, y: '-10vh', scale: 1.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 4, ease: 'easeOut' }}
            className="absolute bottom-0"
          >
            <Heart className="h-12 w-12 text-pink-500 fill-pink-500 drop-shadow-lg" />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
