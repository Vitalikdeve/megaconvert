import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const VIEWPORT_EASE = [0.22, 1, 0.36, 1];
const MotionDiv = motion.div;

export default function FadeIn({
  children,
  className = '',
  delay = 0,
  duration = 0.55,
  y = 24,
  once = true
}) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <MotionDiv
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount: 0.2 }}
      transition={{
        duration,
        delay,
        ease: VIEWPORT_EASE
      }}
    >
      {children}
    </MotionDiv>
  );
}
