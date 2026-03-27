'use client';

import { designTokens } from '@megaconvert/design-system';
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';

import { useThemePreferences } from './theme-provider';

import type { PropsWithChildren } from 'react';



export function MotionProvider({ children }: PropsWithChildren) {
  const { resolvedMotionMode } = useThemePreferences();

  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig
        reducedMotion={resolvedMotionMode === 'reduced' ? 'always' : 'never'}
        transition={{
          duration: designTokens.motion.duration.normal,
          ease: designTokens.motion.easing.standard,
        }}
      >
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
