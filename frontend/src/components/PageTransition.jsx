import React from 'react';
import { motion } from 'framer-motion';

const PAGE_EASE = [0.22, 1, 0.36, 1];
const MotionDiv = motion.div;

export default function PageTransition({ children, pageKey }) {
  return (
    <MotionDiv
      key={pageKey}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{
        duration: 0.42,
        ease: PAGE_EASE
      }}
    >
      {children}
    </MotionDiv>
  );
}
