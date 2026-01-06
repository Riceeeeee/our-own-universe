'use client';

import * as SliderPrimitive from '@radix-ui/react-slider';
import { clsx } from 'clsx';
import { forwardRef } from 'react';

const MoodSlider = forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={clsx(
      'relative flex w-full touch-none select-none items-center',
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-3 w-full grow overflow-hidden rounded-full bg-slate-200/30 backdrop-blur-sm border border-white/40 shadow-inner">
      <SliderPrimitive.Range className="absolute h-full bg-gradient-to-r from-rose-300 to-purple-400" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-7 w-7 rounded-full border-[3px] border-white bg-gradient-to-br from-white to-rose-50 shadow-lg shadow-rose-200/50 ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:scale-110 active:scale-95 cursor-grab active:cursor-grabbing" />
  </SliderPrimitive.Root>
));
MoodSlider.displayName = SliderPrimitive.Root.displayName;

export { MoodSlider };
