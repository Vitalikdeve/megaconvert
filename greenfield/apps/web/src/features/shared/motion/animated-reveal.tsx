'use client';

import { designTokens } from '@megaconvert/design-system';
import { m } from 'motion/react';

import type { PropsWithChildren } from 'react';


export interface AnimatedRevealProps extends PropsWithChildren {
  className?: string;
  delay?: number;
}

export function AnimatedReveal({ children, className, delay = 0 }: AnimatedRevealProps) {
  return (
    <m.div
      animate={{
        opacity: 1,
        y: 0,
      }}
      className={className}
      initial={{
        opacity: 0,
        y: designTokens.motion.distance.cardEnter,
      }}
      transition={{
        delay,
        duration: designTokens.motion.duration.normal,
        ease: designTokens.motion.easing.emphasized,
      }}
    >
      {children}
    </m.div>
  );
}
