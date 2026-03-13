import React from 'react';
import { motion } from 'framer-motion';

const MotionGlassPanel = motion.div;

const baseClassName = [
  'bg-white/[0.02]',
  'backdrop-blur-3xl',
  'border border-white/[0.08]',
  'rounded-[40px]',
  'shadow-[0_0_80px_-20px_rgba(120,119,198,0.3)]',
].join(' ');

const GlassPanel = React.forwardRef(function GlassPanel(
  {
    className = '',
    children,
    ...props
  },
  ref,
) {
  return (
    <MotionGlassPanel
      ref={ref}
      className={[baseClassName, className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </MotionGlassPanel>
  );
});

export default GlassPanel;
