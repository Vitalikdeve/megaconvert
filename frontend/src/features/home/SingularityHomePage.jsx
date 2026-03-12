import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  ArrowRight,
  AudioLines,
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  Layers3,
  QrCode,
  ShieldCheck,
  Sparkles,
  Video,
  Wand2,
  Zap
} from 'lucide-react';

void motion;

const BUTTON_VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  outline: 'btn-outline',
  ghost: 'btn-ghost'
};

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'bmp', 'avif', 'svg']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm', 'avi', 'mkv', 'm4v', 'gif']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg']);
const DOC_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf']);

function HomeButton({ children, variant = 'primary', className = '', ...rest }) {
  return (
    <button
      type={rest.type || 'button'}
      {...rest}
      className={`pressable touch-target inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition-all duration-300 ${BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.primary} ${className}`}
    >
      {children}
    </button>
  );
}

function CatSilhouette({ sleeping = false }) {
  return (
    <svg viewBox="0 0 84 40" className={`portal-cat-svg ${sleeping ? 'is-sleeping' : ''}`} aria-hidden="true">
      <path
        d="M14 25c0-5.8 4.7-10.5 10.5-10.5H44c4.8 0 9.2 2.2 12 6l6.2-1.6 1.8 2.3-4.6 3.2c.2 1 .3 2 .3 3.1 0 6.4-5.1 11.5-11.5 11.5H24.8C18.9 39 14 34.1 14 28.2V25Zm10-14 4.5-6.5L33 12m12 0 4.5-7.5L54 11"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="42" cy="20" r="1.8" fill="currentColor" />
      <path d="M66 24c5 1.1 7.8 4 7.8 7.5 0 4.1-3.9 7.3-9.2 7.3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function ProgressCatBar({ progress, pipelineStage, etaSeconds, sleeping }) {
  return (
    <div className="portal-progress-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/70">Quantum Tube</div>
          <div className="mt-2 text-lg font-semibold text-white">{Math.round(progress)}%</div>
        </div>
        <div className="text-right">
          <div className="text-sm text-white/80">{pipelineStage || 'Орбитальная обработка'}</div>
          <div className="mt-1 text-xs text-white/45">{etaSeconds !== null ? `ETA ${etaSeconds}s` : 'Stable orbit'}</div>
        </div>
      </div>
      <div className="portal-progress-track mt-5">
        <div className="portal-progress-fill" style={{ width: `${progress}%` }} />
        <div className="portal-progress-glow" style={{ width: `${Math.max(progress, 8)}%` }} />
        <div className="portal-cat" style={{ left: `calc(${Math.min(progress, 96)}% - 34px)` }}>
          <CatSilhouette sleeping={sleeping} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.2em] text-white/38">
        <span className="portal-mini-chip">Analyze</span>
        <span className="portal-mini-chip">Morph</span>
        <span className="portal-mini-chip">Finalize</span>
      </div>
    </div>
  );
}

function createPortalCloud(count) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const radius = 0.88 + Math.pow(Math.random(), 0.45) * 1.05;
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);
    seeds[i] = Math.random();
  }
  return { positions, seeds };
}

function PortalParticleField({ dragging, morphed }) {
  const pointsRef = useRef(null);
  const innerRef = useRef(null);
  const cloud = useMemo(() => createPortalCloud(typeof window !== 'undefined' && window.innerWidth < 768 ? 1400 : 2200), []);

  useFrame((state) => {
    const pointCloud = pointsRef.current;
    const inner = innerRef.current;
    if (!pointCloud?.geometry?.attributes?.position) return;

    const arr = pointCloud.geometry.attributes.position.array;
    const time = state.clock.elapsedTime;
    const pointerX = state.pointer.x * 1.9;
    const pointerY = state.pointer.y * 1.3;
    const morphFactor = morphed ? 0.58 : 1;

    for (let i = 0; i < cloud.seeds.length; i += 1) {
      const idx = i * 3;
      const seed = cloud.seeds[i];
      const baseX = cloud.positions[idx];
      const baseY = cloud.positions[idx + 1];
      const baseZ = cloud.positions[idx + 2];
      const breath = 1 + Math.sin(time * 0.9 + seed * 10) * 0.075;
      let nextX = baseX * breath + Math.sin(time * 0.55 + seed * 18) * 0.04;
      let nextY = baseY * breath + Math.cos(time * 0.6 + seed * 22) * 0.04;
      let nextZ = baseZ * breath + Math.sin(time * 0.75 + seed * 16) * 0.08;

      const dx = pointerX - nextX;
      const dy = pointerY - nextY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const pull = Math.max(0, 1.2 - distance) * (dragging ? 0.22 : 0.13);
      nextX += dx * pull;
      nextY += dy * pull;
      nextZ += pull * 0.24;

      arr[idx] = nextX * morphFactor;
      arr[idx + 1] = nextY * (morphed ? 0.52 : 1) * (dragging ? 1.05 : 1);
      arr[idx + 2] = nextZ * (morphed ? 0.28 : 1);
    }

    pointCloud.geometry.attributes.position.needsUpdate = true;
    pointCloud.rotation.y = time * 0.16;
    pointCloud.rotation.x = Math.sin(time * 0.18) * 0.1;

    if (inner) {
      inner.rotation.y = time * 0.28;
      inner.rotation.z = Math.sin(time * 0.3) * 0.14;
      const scale = morphed ? 0.82 : (dragging ? 1.1 : 1);
      inner.scale.setScalar(scale + Math.sin(time * 1.1) * 0.04);
    }
  });

  return (
    <>
      <color attach="background" args={['#020202']} />
      <fog attach="fog" args={['#020202', 4.5, 8.5]} />
      <ambientLight intensity={0.35} />
      <pointLight position={[1.8, 1.4, 2.2]} intensity={3.2} color="#38bdf8" />
      <pointLight position={[-2.1, -1.5, 1.4]} intensity={2.5} color="#f9a8d4" />
      <mesh ref={innerRef}>
        <icosahedronGeometry args={[0.82, 18]} />
        <meshStandardMaterial
          color="#050b12"
          emissive="#38bdf8"
          emissiveIntensity={dragging ? 0.75 : 0.35}
          metalness={0.9}
          roughness={0.22}
          transparent
          opacity={0.72}
        />
      </mesh>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[cloud.positions.slice(), 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={dragging ? 0.035 : 0.028}
          color="#a5f3fc"
          transparent
          opacity={0.95}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </>
  );
}

function PortalCanvas({ dragging, morphed }) {
  return (
    <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0, 4.2], fov: 44 }}>
      <PortalParticleField dragging={dragging} morphed={morphed} />
    </Canvas>
  );
}

const normalizeFormatToken = (value) => String(value || '')
  .toLowerCase()
  .trim()
  .replace(/^[.]+/, '')
  .replace(/[^a-z0-9.+-]/g, '');

const formatBytes = (value) => {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

function detectFileKind(file) {
  const ext = normalizeFormatToken(String(file?.name || '').split('.').pop());
  const mime = String(file?.type || '').toLowerCase();
  if (mime.startsWith('image/') || IMAGE_EXTENSIONS.has(ext)) return { kind: 'image', ext };
  if (mime.startsWith('video/') || VIDEO_EXTENSIONS.has(ext)) return { kind: 'video', ext };
  if (mime.startsWith('audio/') || AUDIO_EXTENSIONS.has(ext)) return { kind: 'audio', ext };
  if (DOC_EXTENSIONS.has(ext) || mime.includes('pdf') || mime.includes('document') || mime.includes('text')) return { kind: 'doc', ext };
  return { kind: 'other', ext };
}

function getKindIcon(kind) {
  if (kind === 'image') return ImageIcon;
  if (kind === 'video') return Video;
  if (kind === 'audio') return AudioLines;
  return FileText;
}

function getQualityValue(kind, settings) {
  if (kind === 'image') return Number(settings?.image?.quality || 90);
  if (kind === 'video') {
    const resolution = String(settings?.video?.resolution || '1080p').toLowerCase();
    if (resolution.includes('4k')) return 92;
    if (resolution.includes('1440')) return 80;
    if (resolution.includes('1080')) return 66;
    if (resolution.includes('720')) return 36;
    return 54;
  }
  if (kind === 'audio') {
    const bitrate = parseInt(String(settings?.audio?.bitrate || '192').replace(/\D+/g, ''), 10);
    if (bitrate >= 320) return 94;
    if (bitrate >= 256) return 78;
    if (bitrate >= 192) return 62;
    if (bitrate >= 128) return 36;
    return 24;
  }
  return 58;
}

function getQualityLabel(value) {
  if (value >= 84) return 'Studio';
  if (value >= 58) return 'Balanced';
  return 'Light';
}

function applyQualityPreset(kind, value, setSettings) {
  const nextValue = Math.max(1, Math.min(100, Number(value || 0)));
  setSettings((current) => {
    if (kind === 'image') {
      return { ...current, image: { ...(current.image || {}), quality: nextValue } };
    }
    if (kind === 'video') {
      const profile = nextValue < 34
        ? { resolution: '720p', bitrate: '1200k', codec: 'h264' }
        : nextValue < 68
          ? { resolution: '1080p', bitrate: '2800k', codec: 'h264' }
          : nextValue < 88
            ? { resolution: '1440p', bitrate: '5200k', codec: 'h265' }
            : { resolution: '4k', bitrate: '9000k', codec: 'h265' };
      return { ...current, video: { ...(current.video || {}), ...profile } };
    }
    if (kind === 'audio') {
      const bitrate = nextValue < 34 ? '128k' : nextValue < 68 ? '192k' : nextValue < 88 ? '256k' : '320k';
      return { ...current, audio: { ...(current.audio || {}), bitrate, normalize: nextValue >= 60 } };
    }
    return current;
  });
}

function humanizeActionLabel(kind, ext, target) {
  const upperTarget = String(target || '').toUpperCase();
  if (kind === 'image' && (ext === 'heic' || ext === 'heif') && target === 'jpg') return 'Превратить в обычное фото (JPG)';
  if (kind === 'image' && target === 'webp') return 'Сделать web-ready (WEBP)';
  if (kind === 'image' && target === 'pdf') return 'Собрать в PDF';
  if (kind === 'video' && target === 'mp4') return 'Сделать универсальное видео (MP4)';
  if (kind === 'video' && target === 'gif') return 'Сделать GIF';
  if ((kind === 'video' || kind === 'audio') && target === 'mp3') return 'Вытащить только музыку';
  if (kind === 'audio' && target === 'wav') return 'Сделать студийный WAV';
  if (kind === 'doc' && target === 'pdf') return 'Сделать удобный PDF';
  if (kind === 'doc' && target === 'docx') return 'Открыть для редактирования (DOCX)';
  return `В ${upperTarget}`;
}

function findMatchingTool(tools, from, to) {
  return tools.find((tool) => tool.fromFormats.includes(from) && tool.toFormats.includes(to)) || null;
}

function buildPortalIntent({ file, files, tools, smartSuggestion }) {
  if (!file) return null;

  const { kind, ext } = detectFileKind(file);
  const isBatch = files.length > 1;
  const matches = tools.filter((tool) => tool.fromFormats.includes(ext));
  const actions = [];
  const pushAction = (tool, tone = 'cyan') => {
    if (!tool || actions.some((item) => item.toolId === tool.id)) return;
    const target = tool.toFormats?.[0] || tool.id.split('-').pop() || '';
    actions.push({
      id: tool.id,
      toolId: tool.id,
      label: humanizeActionLabel(kind, ext, target),
      caption: `${ext.toUpperCase()} → ${String(target || '').toUpperCase()}`,
      tone
    });
  };

  if (smartSuggestion) {
    pushAction(tools.find((tool) => tool.id === smartSuggestion) || null, 'violet');
  }

  const preferredTargets = kind === 'image'
    ? (ext === 'heic' || ext === 'heif' ? ['jpg', 'png', 'webp', 'pdf'] : ['jpg', 'webp', 'png', 'pdf'])
    : kind === 'video'
      ? (ext === 'mov' ? ['mp4', 'gif', 'mp3'] : ['gif', 'mp4', 'mp3'])
      : kind === 'audio'
        ? ['mp3', 'wav']
        : kind === 'doc'
          ? (ext === 'pdf' ? ['docx', 'jpg', 'png'] : ['pdf'])
          : [];

  preferredTargets.forEach((target, index) => {
    pushAction(findMatchingTool(tools, ext, target), index === 0 ? 'cyan' : 'slate');
  });

  matches.slice(0, 4).forEach((tool) => pushAction(tool, 'slate'));

  return {
    ext,
    kind,
    isBatch,
    actions: actions.slice(0, 4),
    headline: isBatch
      ? 'Франкенштейн-мод активирован'
      : kind === 'image'
        ? 'Фото распознано без вопросов'
        : kind === 'video'
          ? 'Видео готово к перевоплощению'
          : kind === 'audio'
            ? 'Аудио распознано мгновенно'
            : kind === 'doc'
              ? 'Документ понятен с первого взгляда'
              : 'Файл захвачен сингулярностью',
    subline: isBatch
      ? `Мы уже видим ${files.length} файлов и готовим пакетный сценарий без лишних экранов.`
      : 'Ваш файл не покидал ваш компьютер. Абсолютная приватность и скорость света.'
  };
}

function playPortalTone(kind = 'ingest') {
  if (typeof window === 'undefined') return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  const now = context.currentTime;
  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(kind === 'success' ? 0.06 : 0.045, now + 0.015);
  master.gain.exponentialRampToValueAtTime(0.0001, now + (kind === 'success' ? 0.38 : 0.28));
  master.connect(context.destination);

  const oscA = context.createOscillator();
  const oscB = context.createOscillator();
  oscA.type = 'sine';
  oscB.type = 'triangle';
  oscA.frequency.setValueAtTime(kind === 'success' ? 180 : 120, now);
  oscA.frequency.exponentialRampToValueAtTime(kind === 'success' ? 720 : 54, now + (kind === 'success' ? 0.24 : 0.18));
  oscB.frequency.setValueAtTime(kind === 'success' ? 280 : 170, now);
  oscB.frequency.exponentialRampToValueAtTime(kind === 'success' ? 920 : 110, now + (kind === 'success' ? 0.2 : 0.14));
  oscA.connect(master);
  oscB.connect(master);
  oscA.start(now);
  oscB.start(now);
  oscA.stop(now + (kind === 'success' ? 0.34 : 0.22));
  oscB.stop(now + (kind === 'success' ? 0.28 : 0.19));
  window.setTimeout(() => void context.close().catch(() => {}), 480);
}

export default function SingularityHomePage({
  file,
  files,
  filesConvertedCount,
  status,
  progress,
  pipelineStage,
  etaSeconds,
  downloadUrl,
  canOpenQuickLook,
  tools,
  smartSuggestion,
  settings,
  shareLink,
  shareHint,
  handleFilesSelected,
  openFilePicker,
  handleProcess,
  reset,
  download,
  openQuickLook,
  handleCreateShareLink,
  navigate,
  setSettings,
  launchAIMagic,
  prepareMegaDrop,
  trustedBy = []
}) {
  const previousStatusRef = useRef(status);
  const [isDragOver, setIsDragOver] = useState(false);
  const [rippleToken, setRippleToken] = useState(0);
  const [selectedActionId, setSelectedActionId] = useState('');
  const [sleepingCat, setSleepingCat] = useState(false);
  const [isPreparingShare, setIsPreparingShare] = useState(false);

  const primaryFile = file || files[0] || null;
  const intent = useMemo(
    () => buildPortalIntent({ file: primaryFile, files, tools, smartSuggestion }),
    [files, primaryFile, smartSuggestion, tools]
  );
  const qualityValue = useMemo(
    () => getQualityValue(intent?.kind || 'other', settings),
    [intent?.kind, settings]
  );
  const qualityHue = 118 - Math.round((qualityValue / 100) * 108);
  const KindIcon = getKindIcon(intent?.kind || 'other');

  const selectedAction = useMemo(() => {
    if (!intent?.actions?.length) return null;
    return intent.actions.find((action) => action.id === selectedActionId) || intent.actions[0];
  }, [intent?.actions, selectedActionId]);

  useEffect(() => {
    if (!intent?.actions?.length) {
      setSelectedActionId('');
      return;
    }
    setSelectedActionId((current) => (
      intent.actions.some((action) => action.id === current)
        ? current
        : intent.actions[0].id
    ));
  }, [intent?.actions]);

  useEffect(() => {
    if (status !== 'processing') {
      setSleepingCat(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setSleepingCat(true), etaSeconds && etaSeconds > 10 ? 2200 : 4200);
    return () => window.clearTimeout(timer);
  }, [etaSeconds, progress, status]);

  useEffect(() => {
    if (previousStatusRef.current !== 'done' && status === 'done') {
      playPortalTone('success');
    }
    previousStatusRef.current = status;
  }, [status]);

  const handlePortalDrop = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    const droppedFiles = event.dataTransfer?.files;
    if (!droppedFiles?.length) return;
    setRippleToken(Date.now());
    playPortalTone('ingest');
    handleFilesSelected(droppedFiles);
  };

  const runSelectedAction = async () => {
    if (!primaryFile) {
      openFilePicker();
      return;
    }
    if (intent?.isBatch && !selectedAction?.toolId) {
      navigate('/tools');
      return;
    }
    const targetToolId = selectedAction?.toolId || '';
    await handleProcess({
      toolId: targetToolId,
      initialStage: 'Сингулярность перестраивает файл...'
    });
  };

  const handlePrepareMegaDrop = async () => {
    setIsPreparingShare(true);
    try {
      await prepareMegaDrop();
    } finally {
      setIsPreparingShare(false);
    }
  };

  return (
    <div className="singularity-shell page-enter">
      <div className="singularity-noise" />
      <div className="singularity-grid" />
      <section className="singularity-hero">
        <motion.div
          className="singularity-copy"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="singularity-eyebrow">The Portal</div>
          <h1 className="singularity-title">Брось сюда что угодно</h1>
        </motion.div>

        <motion.div
          className={`portal-shell ${primaryFile ? 'has-file' : ''} ${isDragOver ? 'is-dragover' : ''}`}
          initial={{ opacity: 0, scale: 0.92, y: 32 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
          onClick={() => !primaryFile && openFilePicker()}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            const nextTarget = event.relatedTarget;
            if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
              setIsDragOver(false);
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragOver(true);
          }}
          onDrop={handlePortalDrop}
        >
          <AnimatePresence>
            {rippleToken ? (
              <motion.span
                key={rippleToken}
                className="portal-ripple"
                initial={{ opacity: 0.75, scale: 0.3 }}
                animate={{ opacity: 0, scale: 1.9 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.1, ease: 'easeOut' }}
              />
            ) : null}
          </AnimatePresence>

          <div className="portal-canvas-shell">
            <PortalCanvas dragging={isDragOver} morphed={Boolean(primaryFile)} />
          </div>

          <AnimatePresence mode="wait">
            {!primaryFile ? (
              <motion.div
                key="portal-idle"
                className="portal-idle-overlay"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="portal-orbit-badge">Tap / Drop</div>
              </motion.div>
            ) : (
              <motion.div
                key="portal-panel"
                className="portal-panel"
                initial={{ opacity: 0, y: 28, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 18, scale: 0.96 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="portal-file-row">
                  <div className="portal-file-chip">
                    <KindIcon size={16} />
                    <div>
                      <div className="portal-file-name">{primaryFile.name}</div>
                      <div className="portal-file-meta">
                        {files.length > 1 ? `${files.length} files` : formatBytes(primaryFile.size)} • {intent?.ext?.toUpperCase() || 'FILE'}
                      </div>
                    </div>
                  </div>
                  <div className="portal-file-actions">
                    <HomeButton variant="ghost" onClick={(event) => { event.stopPropagation(); openFilePicker(); }}>Заменить</HomeButton>
                    <HomeButton variant="ghost" onClick={(event) => { event.stopPropagation(); reset(); }}>Сбросить</HomeButton>
                  </div>
                </div>

                <div className="portal-intent-headline">{intent?.headline}</div>
                <p className="portal-intent-copy">{intent?.subline}</p>

                {status === 'idle' && (
                  <>
                    <div className="portal-action-grid">
                      {intent?.actions?.map((action, index) => (
                        <button
                          key={action.id}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedActionId(action.id);
                          }}
                          className={`portal-action-tile ${selectedAction?.id === action.id ? 'is-active' : ''} tone-${action.tone || (index === 0 ? 'cyan' : 'slate')}`}
                        >
                          <div className="portal-action-caption">{action.caption}</div>
                          <div className="portal-action-label">{action.label}</div>
                        </button>
                      ))}
                    </div>

                    {(intent?.kind === 'image' || intent?.kind === 'video' || intent?.kind === 'audio') && (
                      <div className="portal-quality-card">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">Tactile Quality</div>
                            <div className="mt-2 text-lg font-semibold text-white">{getQualityLabel(qualityValue)}</div>
                          </div>
                          <div className="portal-quality-pill" style={{ '--portal-quality-color': `hsl(${qualityHue} 88% 58%)` }}>
                            {qualityValue}
                          </div>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={100}
                          value={qualityValue}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => applyQualityPreset(intent.kind, event.target.value, setSettings)}
                          className="portal-quality-slider"
                          style={{ '--portal-quality-color': `hsl(${qualityHue} 88% 58%)` }}
                        />
                      </div>
                    )}

                    <div className="portal-cta-row">
                      <HomeButton
                        className="portal-primary-cta"
                        onClick={(event) => {
                          event.stopPropagation();
                          void runSelectedAction();
                        }}
                      >
                        <Zap size={16} />
                        {selectedAction?.label || 'Конвертировать'}
                      </HomeButton>
                      <HomeButton
                        variant="outline"
                        className="portal-ai-cta"
                        onClick={(event) => {
                          event.stopPropagation();
                          launchAIMagic();
                        }}
                      >
                        <Wand2 size={16} />
                        AI Magic
                      </HomeButton>
                    </div>
                  </>
                )}

                {status === 'processing' && (
                  <ProgressCatBar
                    progress={progress}
                    pipelineStage={pipelineStage}
                    etaSeconds={etaSeconds}
                    sleeping={sleepingCat}
                  />
                )}

                {status === 'done' && (
                  <div className="portal-result-panel">
                    <div className="portal-result-badge">Singularity complete</div>
                    <div className="portal-result-title">Файл уже готов. Дальше только удовольствие.</div>
                    <div className="portal-result-actions">
                      <HomeButton onClick={(event) => { event.stopPropagation(); download(); }}>
                        <Download size={16} />
                        Скачать
                      </HomeButton>
                      {canOpenQuickLook && (
                        <HomeButton variant="secondary" onClick={(event) => { event.stopPropagation(); void openQuickLook(); }}>
                          <Eye size={16} />
                          Quick Look
                        </HomeButton>
                      )}
                      <HomeButton
                        variant="secondary"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handlePrepareMegaDrop();
                        }}
                        disabled={!downloadUrl || isPreparingShare}
                      >
                        <QrCode size={16} />
                        {isPreparingShare ? 'Готовим MegaDrop...' : 'MegaDrop QR'}
                      </HomeButton>
                      <HomeButton
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleCreateShareLink();
                        }}
                      >
                        <ArrowRight size={16} />
                        Public Link
                      </HomeButton>
                    </div>
                    {shareLink ? <div className="portal-result-hint">Публичная ссылка готова: {shareLink}</div> : null}
                    {shareHint ? <div className="portal-result-hint">{shareHint}</div> : null}
                  </div>
                )}

                {status === 'error' && (
                  <div className="portal-error-panel">
                    <div className="portal-result-title">Сингулярность споткнулась, но файл в безопасности.</div>
                    <div className="portal-result-actions">
                      <HomeButton variant="secondary" onClick={(event) => { event.stopPropagation(); reset(); }}>
                        Начать заново
                      </HomeButton>
                      <HomeButton onClick={(event) => { event.stopPropagation(); void runSelectedAction(); }}>
                        Повторить
                      </HomeButton>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </section>

      <section className="singularity-feature-rail">
        {[
          {
            id: 'turbo',
            icon: ShieldCheck,
            title: 'Режим Турбо-Вкладка',
            body: 'WASM и клиентские пайплайны держат файл у пользователя. Без очередей, без поездок на сервер, без потери темпа.'
          },
          {
            id: 'magic',
            icon: Sparkles,
            title: 'AI Magic',
            body: 'Открывает AI Studio уже с твоим файлом в памяти приложения. Следующий шаг чувствуется как продолжение, а не новый сценарий.'
          },
          {
            id: 'megadrop',
            icon: QrCode,
            title: 'MegaDrop',
            body: 'После готовности результата можно одним кликом развернуть WebRTC-шаринг с QR-кодом и перекинуть файл напрямую.'
          },
          {
            id: 'frankenstein',
            icon: Layers3,
            title: 'Франкенштейн-мод',
            body: 'Если в портал летит пачка файлов, мы сразу переключаемся в пакетную логику и не заставляем пользователя вручную собирать конвейер.'
          }
        ].map((item) => {
          const Icon = item.icon;
          return (
            <motion.article
              key={item.id}
              className="singularity-feature-card"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="singularity-feature-icon">
                <Icon size={18} />
              </div>
              <div className="singularity-feature-title">{item.title}</div>
              <p className="singularity-feature-body">{item.body}</p>
            </motion.article>
          );
        })}
      </section>

      <section className="singularity-trust-strip">
        <div className="singularity-trust-stat">
          <div className="singularity-trust-label">Files touched</div>
          <div className="singularity-trust-value">{Number(filesConvertedCount || 0).toLocaleString()}</div>
        </div>
        <div className="singularity-trust-brands">
          {trustedBy.slice(0, 6).map((name) => (
            <span key={name} className="singularity-trust-brand">{name}</span>
          ))}
        </div>
      </section>
    </div>
  );
}
