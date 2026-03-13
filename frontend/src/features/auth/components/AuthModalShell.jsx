import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

export const authInputClassName = [
  'w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white',
  'placeholder:text-white/28 focus:border-indigo-500/50 outline-none transition-colors',
].join(' ');

export const authLabelClassName = 'mb-2 block text-sm font-medium text-white/68';
export const authPrimaryButtonClassName = [
  'inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3',
  'text-sm font-medium text-black transition-transform duration-300 hover:scale-[1.01] hover:bg-white/90',
  'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100',
].join(' ');
export const authInlineLinkClassName = 'text-sm text-white/58 transition-colors duration-300 hover:text-white';

const overlayTransition = {
  duration: 0.2,
  ease: [0.22, 1, 0.36, 1],
};

const panelTransition = {
  duration: 0.24,
  ease: [0.22, 1, 0.36, 1],
};

export default function AuthModalShell({
  eyebrow,
  title,
  subtitle,
  onClose,
  children,
  footer,
}) {
  return (
    <motion.div
      className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={overlayTransition}
    >
      <button
        type="button"
        aria-label="Close auth modal"
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={panelTransition}
        className="relative w-full max-w-[460px] overflow-hidden rounded-[32px] border border-white/[0.1] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-6 shadow-[0_50px_160px_-48px_rgba(0,0,0,0.92)] backdrop-blur-3xl sm:p-7"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(129,140,248,0.24),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.14),transparent_34%)]" />

        <div className="relative">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-white/42">
                {eyebrow}
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-medium tracking-tight text-white/92">
                  {title}
                </h2>
                <p className="max-w-md text-sm leading-7 text-white/48">
                  {subtitle}
                </p>
              </div>
            </div>

            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/62 transition-colors duration-300 hover:text-white"
            >
              <X className="h-4.5 w-4.5" strokeWidth={1.8} />
            </button>
          </div>

          <div className="space-y-5">
            {children}
          </div>

          {footer ? (
            <div className="mt-6 border-t border-white/[0.08] pt-5">
              {footer}
            </div>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  );
}
