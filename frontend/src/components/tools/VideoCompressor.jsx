import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import GlassPanel from '../ui/GlassPanel.jsx';

const MotionToolScene = motion.div;

export default function VideoCompressor() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <MotionToolScene
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="flex h-screen w-screen items-center justify-center bg-[#030303] px-4 text-white"
    >
      <GlassPanel className="flex h-[500px] w-[min(800px,calc(100vw-2rem))] flex-col items-center justify-center gap-6 px-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/80">
          <Video className="h-7 w-7" strokeWidth={1.8} />
        </div>
        <h2 className="text-2xl font-medium text-white/80">{t('appShell.tools.videoCompressor.label')}</h2>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.05] px-5 py-3 text-sm text-white/72 transition-colors duration-300 hover:bg-white/[0.1] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
          {t('toolPlaceholderBack')}
        </button>
      </GlassPanel>
    </MotionToolScene>
  );
}
