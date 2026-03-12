import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Peer from 'simple-peer/simplepeer.min.js';
import QRCode from 'qrcode';
import { io } from 'socket.io-client';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Cpu,
  Download,
  Loader2,
  Network,
  Play,
  QrCode,
  Radio,
  ServerCog,
  ShieldCheck,
  Upload,
  Users,
  Wifi,
  WifiOff
} from 'lucide-react';
import useMegaGridEngine from '../../../hooks/useMegaGridEngine.js';

const CHUNK_SIZE = 64 * 1024;
const MAX_BUFFERED_AMOUNT = 512 * 1024;
const SOCKET_ACK_TIMEOUT_MS = 10000;
const ICE_SERVERS = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' }
];

const GRID_FORMAT_OPTIONS = [
  {
    id: 'mp4',
    label: 'Distributed MP4',
    ext: 'mp4',
    mime: 'video/mp4',
    args: ['-i', '{input}', '-movflags', '+faststart', '{output}']
  },
  {
    id: 'webm',
    label: 'Distributed WebM',
    ext: 'webm',
    mime: 'video/webm',
    args: ['-i', '{input}', '{output}']
  }
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeApiBase = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return '/api';
  if (!/^https?:\/\//i.test(normalized)) {
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  }
  try {
    const parsed = new URL(normalized);
    const host = String(parsed.hostname || '').trim().toLowerCase();
    const loopbackHost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    if (!loopbackHost && String(parsed.port || '').trim() === '5000') parsed.port = '';
    if (!loopbackHost && typeof window !== 'undefined' && window.location.protocol === 'https:' && parsed.protocol === 'http:') {
      parsed.protocol = 'https:';
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/g, '');
    if (parsed.pathname === '/api') parsed.pathname = '';
    return parsed.toString().replace(/\/+$/g, '');
  } catch {
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  }
};

const resolveRealtimeBase = () => {
  if (typeof window === 'undefined') return '';
  const apiBase = normalizeApiBase(import.meta.env.VITE_API_BASE || '/api');
  if (!apiBase || !/^https?:\/\//i.test(apiBase)) return window.location.origin;
  try {
    const parsed = new URL(apiBase);
    parsed.pathname = parsed.pathname.replace(/\/+$/g, '');
    if (parsed.pathname === '/api') parsed.pathname = '';
    return parsed.toString().replace(/\/+$/g, '');
  } catch {
    return window.location.origin;
  }
};

const normalizeSessionCode = (value) => String(value || '').trim().replace(/\D+/g, '').slice(0, 6);

const getInitialSessionCode = () => {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  return normalizeSessionCode(params.get('session'));
};

const formatBytes = (value) => {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const safeRevokeObjectUrl = (value) => {
  if (!value || typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return;
  try {
    URL.revokeObjectURL(value);
  } catch {
    // noop
  }
};

const toUint8Array = (packet) => {
  if (packet instanceof ArrayBuffer) return new Uint8Array(packet);
  if (ArrayBuffer.isView(packet)) {
    return new Uint8Array(packet.buffer, packet.byteOffset, packet.byteLength);
  }
  return null;
};

const concatChunks = (chunks, totalSize) => {
  const merged = new Uint8Array(Math.max(0, Number(totalSize || 0)));
  let offset = 0;
  for (const chunk of chunks) {
    const bytes = toUint8Array(chunk);
    if (!bytes) continue;
    merged.set(bytes, offset);
    offset += bytes.byteLength;
  }
  return merged.buffer;
};

const emitWithAck = (socket, eventName, payload) => new Promise((resolve, reject) => {
  let settled = false;
  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    reject(new Error(`${eventName}_timeout`));
  }, SOCKET_ACK_TIMEOUT_MS);

  socket.emit(eventName, payload, (response) => {
    if (settled) return;
    clearTimeout(timer);
    settled = true;
    if (!response?.ok) {
      reject(new Error(String(response?.message || response?.code || `${eventName}_failed`)));
      return;
    }
    resolve(response);
  });
});

const waitForSocketConnection = (socket) => new Promise((resolve, reject) => {
  if (!socket) {
    reject(new Error('socket_unavailable'));
    return;
  }
  if (socket.connected) {
    resolve(socket);
    return;
  }

  let settled = false;
  const handleConnect = () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    socket.off('connect_error', handleError);
    resolve(socket);
  };
  const handleError = (error) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    socket.off('connect', handleConnect);
    reject(error instanceof Error ? error : new Error(String(error || 'socket_connect_failed')));
  };
  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    socket.off('connect', handleConnect);
    socket.off('connect_error', handleError);
    reject(new Error('socket_connect_timeout'));
  }, SOCKET_ACK_TIMEOUT_MS);

  socket.once('connect', handleConnect);
  socket.once('connect_error', handleError);
  socket.connect();
});

const waitForPeerBuffer = async (peer) => {
  while (peer?.connected && peer?._channel?.bufferedAmount > MAX_BUFFERED_AMOUNT) {
    await wait(16);
  }
};

const buildPeerStateTone = (connected) => (
  connected
    ? 'border-emerald-300/70 bg-emerald-100/70 text-emerald-800 dark:border-emerald-300/30 dark:bg-emerald-500/10 dark:text-emerald-100'
    : 'border-slate-200/70 bg-white/80 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200'
);

const getDefaultWorkerLabel = () => {
  if (typeof navigator === 'undefined') return 'Worker Node';
  const platform = String(navigator.platform || '').trim();
  return platform ? `Worker ${platform}` : 'Worker Node';
};

export default function MegaGridLab() {
  const socketBase = useMemo(() => resolveRealtimeBase(), []);
  const initialSessionCode = useMemo(() => getInitialSessionCode(), []);
  const webRtcSupported = typeof window !== 'undefined'
    && typeof window.RTCPeerConnection !== 'undefined'
    && typeof window.RTCDataChannel !== 'undefined';
  const gridEngine = useMegaGridEngine();

  const socketRef = useRef(null);
  const masterPeersRef = useRef(new Map());
  const workerPeerRef = useRef(null);
  const workerTransferRef = useRef(null);
  const masterResultTransfersRef = useRef(new Map());
  const jobRef = useRef(null);
  const downloadUrlRef = useRef('');
  const sessionCodeRef = useRef(initialSessionCode);
  const roleRef = useRef(initialSessionCode ? 'worker' : '');
  const masterSocketIdRef = useRef('');
  const autoJoinAttemptedRef = useRef(false);

  const fileInputRef = useRef(null);

  const [socketState, setSocketState] = useState('idle');
  const [role, setRole] = useState(initialSessionCode ? 'worker' : '');
  const [sessionCode, setSessionCode] = useState(initialSessionCode);
  const [joinCode, setJoinCode] = useState(initialSessionCode);
  const [sessionSnapshot, setSessionSnapshot] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [segmentSeconds, setSegmentSeconds] = useState(5);
  const [selectedFormat, setSelectedFormat] = useState(GRID_FORMAT_OPTIONS[0].id);
  const [workerLabel, setWorkerLabel] = useState(getDefaultWorkerLabel());
  const [workerReady, setWorkerReady] = useState(false);
  const [statusText, setStatusText] = useState(
    initialSessionCode
      ? 'Подключаемся к MegaGrid-сессии как worker...'
      : 'Создайте распределенную сессию или подключитесь как worker-node.'
  );
  const [error, setError] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [masterProgress, setMasterProgress] = useState(0);
  const [masterTotals, setMasterTotals] = useState({ total: 0, completed: 0 });
  const [download, setDownload] = useState(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isJoiningSession, setIsJoiningSession] = useState(false);

  useEffect(() => {
    sessionCodeRef.current = sessionCode;
  }, [sessionCode]);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  const syncSessionInLocation = useCallback((nextSessionCode) => {
    if (typeof window === 'undefined') return;
    const normalized = normalizeSessionCode(nextSessionCode);
    const url = new URL(window.location.href);
    if (normalized) {
      url.searchParams.set('session', normalized);
    } else {
      url.searchParams.delete('session');
    }
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const buildShareLink = useCallback((nextSessionCode) => {
    const normalized = normalizeSessionCode(nextSessionCode);
    if (!normalized || typeof window === 'undefined') return '';
    return `${window.location.origin}/workspace/megagrid?session=${normalized}`;
  }, []);

  const updateDownload = useCallback((nextDownload) => {
    setDownload((previous) => {
      if (previous?.url && previous.url !== nextDownload?.url) {
        safeRevokeObjectUrl(previous.url);
      }
      downloadUrlRef.current = nextDownload?.url || '';
      return nextDownload;
    });
  }, []);

  const resetJobState = useCallback(() => {
    jobRef.current = null;
    setMasterProgress(0);
    setMasterTotals({ total: 0, completed: 0 });
  }, []);

  const destroyMasterPeer = useCallback((workerSocketId, reason = 'manual') => {
    const peer = masterPeersRef.current.get(workerSocketId);
    if (!peer) return;
    masterPeersRef.current.delete(workerSocketId);
    try {
      peer.removeAllListeners?.();
    } catch {
      // noop
    }
    try {
      peer.destroy();
    } catch {
      // noop
    }

    const activeJob = jobRef.current;
    if (activeJob?.activeTasks?.has(workerSocketId)) {
      const task = activeJob.activeTasks.get(workerSocketId);
      activeJob.activeTasks.delete(workerSocketId);
      activeJob.pendingTasks.unshift(task);
    }
    masterResultTransfersRef.current.delete(workerSocketId);
    console.warn('[MegaGrid] master-peer-destroyed', workerSocketId, reason);
  }, []);

  const destroyWorkerPeer = useCallback((reason = 'manual') => {
    const peer = workerPeerRef.current;
    workerPeerRef.current = null;
    workerTransferRef.current = null;
    if (!peer) return;
    try {
      peer.removeAllListeners?.();
    } catch {
      // noop
    }
    try {
      peer.destroy();
    } catch {
      // noop
    }
    console.warn('[MegaGrid] worker-peer-destroyed', reason);
  }, []);

  const leaveSession = useCallback(async () => {
    try {
      if (socketRef.current?.connected) {
        await emitWithAck(socketRef.current, 'megagrid:leave-session', {});
      }
    } catch (leaveError) {
      console.warn('[MegaGrid] leave-session-failed', leaveError);
    }

    for (const workerSocketId of masterPeersRef.current.keys()) {
      destroyMasterPeer(workerSocketId, 'leave_session');
    }
    destroyWorkerPeer('leave_session');
    masterPeersRef.current.clear();
    masterResultTransfersRef.current.clear();
    workerTransferRef.current = null;
    masterSocketIdRef.current = '';
    setRole('');
    setWorkerReady(false);
    setSessionCode('');
    setJoinCode('');
    setSessionSnapshot(null);
    setShareLink('');
    setQrCodeUrl('');
    setCopied(false);
    setError('');
    setStatusText('Сессия MegaGrid завершена. Можно создать новую или войти в другую.');
    resetJobState();
    syncSessionInLocation('');
  }, [destroyMasterPeer, destroyWorkerPeer, resetJobState, syncSessionInLocation]);

  const sendBufferOverPeer = useCallback(async (peer, meta, buffer, onProgress) => {
    if (!peer?.connected) {
      throw new Error('peer_not_connected');
    }
    const payloadBuffer = buffer instanceof ArrayBuffer
      ? buffer
      : (ArrayBuffer.isView(buffer)
        ? buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
        : new ArrayBuffer(0));

    peer.send(JSON.stringify(meta));
    let sentBytes = 0;
    for (let offset = 0; offset < payloadBuffer.byteLength; offset += CHUNK_SIZE) {
      await waitForPeerBuffer(peer);
      const chunk = payloadBuffer.slice(offset, Math.min(offset + CHUNK_SIZE, payloadBuffer.byteLength));
      peer.send(chunk);
      sentBytes += chunk.byteLength;
      onProgress?.(sentBytes, payloadBuffer.byteLength);
      if (sentBytes % (CHUNK_SIZE * 8) === 0) {
        await wait(0);
      }
    }
  }, []);

  const getSelectedFormat = useCallback(() => (
    GRID_FORMAT_OPTIONS.find((option) => option.id === selectedFormat) || GRID_FORMAT_OPTIONS[0]
  ), [selectedFormat]);

  const updateWorkerState = useCallback(async (nextState) => {
    const socket = socketRef.current;
    if (!socket || !sessionCodeRef.current || roleRef.current !== 'worker') return;
    try {
      await emitWithAck(socket, 'megagrid:update-worker-state', {
        sessionCode: sessionCodeRef.current,
        label: workerLabel,
        ready: nextState.ready,
        status: nextState.status,
        assignedTaskId: nextState.assignedTaskId || null,
        capacity: 1,
        capabilities: {
          ffmpegWasm: true,
          webRtc: webRtcSupported
        }
      });
    } catch (updateError) {
      console.warn('[MegaGrid] update-worker-state-failed', updateError);
    }
  }, [webRtcSupported, workerLabel]);

  const finalizeDistributedJob = useCallback(async () => {
    const activeJob = jobRef.current;
    if (!activeJob || activeJob.finalizing) return;
    activeJob.finalizing = true;

    try {
      setStatusText('Все сегменты готовы. Склеиваем распределенный результат...');
      setMasterProgress(92);
      const orderedSegments = activeJob.results
        .filter(Boolean)
        .sort((left, right) => left.index - right.index)
        .map((item) => ({
          fileName: item.fileName,
          buffer: item.buffer
        }));

      const merged = await gridEngine.concatSegments({
        segments: orderedSegments,
        outputFileName: activeJob.outputFileName,
        outputExt: activeJob.outputExt,
        mimeType: activeJob.mimeType
      });

      const blob = new Blob([merged.buffer], { type: merged.mimeType });
      const url = URL.createObjectURL(blob);
      updateDownload({
        url,
        fileName: merged.fileName,
        size: merged.size
      });
      setMasterProgress(100);
      setStatusText('MegaGrid завершил распределенную обработку. Файл готов к скачиванию.');
      jobRef.current = null;
    } catch (finalizeError) {
      console.error('[MegaGrid] finalize-failed', finalizeError);
      setError('Не удалось склеить итоговый файл. Проверьте одинаковость формата сегментов.');
      setStatusText('Финальная сборка завершилась с ошибкой.');
      jobRef.current = null;
    }
  }, [gridEngine, updateDownload]);

  const dispatchAvailableTasks = useCallback(() => {
    const activeJob = jobRef.current;
    if (!activeJob || activeJob.finalizing) return;

    const workers = Array.isArray(sessionSnapshot?.workers) ? sessionSnapshot.workers : [];
    for (const worker of workers) {
      if (activeJob.pendingTasks.length === 0) break;
      if (!worker.ready || worker.status === 'busy') continue;
      if (activeJob.activeTasks.has(worker.socketId)) continue;

      const peer = masterPeersRef.current.get(worker.socketId);
      if (!peer?.connected) continue;

      const nextTask = activeJob.pendingTasks.shift();
      if (!nextTask) break;
      activeJob.activeTasks.set(worker.socketId, nextTask);

      void (async () => {
        try {
          setStatusText(`Отправляем сегмент ${nextTask.index + 1}/${activeJob.totalTasks} на worker ${worker.socketId.slice(-4)}...`);
          await sendBufferOverPeer(
            peer,
            {
              type: 'grid-task-meta',
              taskId: nextTask.taskId,
              index: nextTask.index,
              fileName: nextTask.fileName,
              size: nextTask.size,
              format: activeJob.format
            },
            nextTask.buffer
          );
          peer.send(JSON.stringify({
            type: 'grid-task-complete',
            taskId: nextTask.taskId,
            index: nextTask.index
          }));
        } catch (transferError) {
          console.error('[MegaGrid] task-transfer-failed', transferError);
          activeJob.activeTasks.delete(worker.socketId);
          activeJob.pendingTasks.unshift(nextTask);
          destroyMasterPeer(worker.socketId, 'task_transfer_failed');
          setError('Один из worker-нод отвалился во время передачи сегмента.');
        }
      })();
    }

    if (
      activeJob.pendingTasks.length === 0
      && activeJob.activeTasks.size === 0
      && activeJob.results.filter(Boolean).length === activeJob.totalTasks
    ) {
      void finalizeDistributedJob();
    }
  }, [destroyMasterPeer, finalizeDistributedJob, sendBufferOverPeer, sessionSnapshot?.workers]);

  const handleMasterResultReady = useCallback((workerSocketId, meta, buffer) => {
    const activeJob = jobRef.current;
    if (!activeJob) return;

    activeJob.activeTasks.delete(workerSocketId);
    activeJob.results[meta.index] = {
      index: meta.index,
      fileName: meta.fileName,
      buffer,
      size: meta.size
    };

    const completedCount = activeJob.results.filter(Boolean).length;
    setMasterTotals({
      total: activeJob.totalTasks,
      completed: completedCount
    });
    setMasterProgress(Math.min(90, (completedCount / activeJob.totalTasks) * 90));
    setStatusText(`Получен результат сегмента ${meta.index + 1}/${activeJob.totalTasks}. Продолжаем распределение...`);
    dispatchAvailableTasks();
  }, [dispatchAvailableTasks]);

  const handleMasterPeerData = useCallback((workerSocketId, packet) => {
    if (typeof packet === 'string') {
      try {
        const message = JSON.parse(packet);
        if (message.type === 'grid-result-meta') {
          masterResultTransfersRef.current.set(workerSocketId, {
            meta: message,
            chunks: [],
            receivedBytes: 0
          });
        }
        if (message.type === 'grid-result-complete') {
          const transfer = masterResultTransfersRef.current.get(workerSocketId);
          if (!transfer) return;
          masterResultTransfersRef.current.delete(workerSocketId);
          const mergedBuffer = concatChunks(transfer.chunks, transfer.meta.size);
          handleMasterResultReady(workerSocketId, transfer.meta, mergedBuffer);
        }
      } catch (parseError) {
        console.warn('[MegaGrid] master-peer-parse-failed', parseError);
      }
      return;
    }

    const transfer = masterResultTransfersRef.current.get(workerSocketId);
    const bytes = toUint8Array(packet);
    if (!transfer || !bytes) return;
    transfer.chunks.push(bytes);
    transfer.receivedBytes += bytes.byteLength;
  }, [handleMasterResultReady]);

  const processWorkerTask = useCallback(async (meta, buffer) => {
    try {
      setStatusText(`Worker обрабатывает сегмент ${meta.index + 1} через FFmpeg.wasm...`);
      await updateWorkerState({
        ready: true,
        status: 'busy',
        assignedTaskId: meta.taskId
      });

      const result = await gridEngine.convertBuffer({
        buffer,
        fileName: meta.fileName,
        format: meta.format
      });

      if (!workerPeerRef.current?.connected) {
        throw new Error('worker_peer_not_connected');
      }

      await sendBufferOverPeer(
        workerPeerRef.current,
        {
          type: 'grid-result-meta',
          taskId: meta.taskId,
          index: meta.index,
          fileName: result.fileName,
          size: result.size,
          mimeType: result.mimeType
        },
        result.buffer
      );
      workerPeerRef.current.send(JSON.stringify({
        type: 'grid-result-complete',
        taskId: meta.taskId,
        index: meta.index
      }));

      setStatusText(`Worker отправил результат сегмента ${meta.index + 1} обратно в кластер.`);
      await updateWorkerState({
        ready: workerReady,
        status: workerReady ? 'idle' : 'paused',
        assignedTaskId: null
      });
    } catch (taskError) {
      console.error('[MegaGrid] worker-task-failed', taskError);
      setError('Worker не смог обработать сегмент. Проверьте FFmpeg.wasm и соединение.');
      await updateWorkerState({
        ready: workerReady,
        status: workerReady ? 'idle' : 'paused',
        assignedTaskId: null
      });
    }
  }, [gridEngine, sendBufferOverPeer, updateWorkerState, workerReady]);

  const handleWorkerPeerData = useCallback((packet) => {
    if (typeof packet === 'string') {
      try {
        const message = JSON.parse(packet);
        if (message.type === 'grid-task-meta') {
          workerTransferRef.current = {
            meta: message,
            chunks: [],
            receivedBytes: 0
          };
        }
        if (message.type === 'grid-task-complete') {
          const transfer = workerTransferRef.current;
          if (!transfer) return;
          workerTransferRef.current = null;
          const mergedBuffer = concatChunks(transfer.chunks, transfer.meta.size);
          void processWorkerTask(transfer.meta, mergedBuffer);
        }
      } catch (parseError) {
        console.warn('[MegaGrid] worker-peer-parse-failed', parseError);
      }
      return;
    }

    const transfer = workerTransferRef.current;
    const bytes = toUint8Array(packet);
    if (!transfer || !bytes) return;
    transfer.chunks.push(bytes);
    transfer.receivedBytes += bytes.byteLength;
  }, [processWorkerTask]);

  const createMasterPeer = useCallback((workerSocketId) => {
    if (masterPeersRef.current.has(workerSocketId)) {
      return masterPeersRef.current.get(workerSocketId);
    }

    const peer = new Peer({
      initiator: true,
      trickle: true,
      config: { iceServers: ICE_SERVERS }
    });

    masterPeersRef.current.set(workerSocketId, peer);

    peer.on('signal', (signal) => {
      socketRef.current?.emit('megagrid:signal', {
        sessionCode: sessionCodeRef.current,
        targetSocketId: workerSocketId,
        signal
      }, (response) => {
        if (response?.ok === false) {
          console.warn('[MegaGrid] master-signal-relay-failed', response);
        }
      });
    });

    peer.on('connect', () => {
      setStatusText(`Grid-канал к worker ${workerSocketId.slice(-4)} готов.`);
      dispatchAvailableTasks();
    });

    peer.on('data', (packet) => {
      handleMasterPeerData(workerSocketId, packet);
    });

    peer.on('close', () => {
      destroyMasterPeer(workerSocketId, 'peer_closed');
      dispatchAvailableTasks();
    });

    peer.on('error', (peerError) => {
      console.error('[MegaGrid] master-peer-error', peerError);
      destroyMasterPeer(workerSocketId, 'peer_error');
      dispatchAvailableTasks();
    });

    return peer;
  }, [destroyMasterPeer, dispatchAvailableTasks, handleMasterPeerData]);

  const ensureWorkerPeer = useCallback((masterSocketId) => {
    if (workerPeerRef.current) return workerPeerRef.current;

    const peer = new Peer({
      initiator: false,
      trickle: true,
      config: { iceServers: ICE_SERVERS }
    });

    workerPeerRef.current = peer;
    masterSocketIdRef.current = masterSocketId;

    peer.on('signal', (signal) => {
      socketRef.current?.emit('megagrid:signal', {
        sessionCode: sessionCodeRef.current,
        targetSocketId: masterSocketId,
        signal
      }, (response) => {
        if (response?.ok === false) {
          console.warn('[MegaGrid] worker-signal-relay-failed', response);
        }
      });
    });

    peer.on('connect', () => {
      setStatusText('Worker привязан к master-ноде. Можно принимать задачи.');
    });

    peer.on('data', (packet) => {
      handleWorkerPeerData(packet);
    });

    peer.on('close', () => {
      destroyWorkerPeer('peer_closed');
    });

    peer.on('error', (peerError) => {
      console.error('[MegaGrid] worker-peer-error', peerError);
      destroyWorkerPeer('peer_error');
    });

    return peer;
  }, [destroyWorkerPeer, handleWorkerPeerData]);

  const createSession = useCallback(async () => {
    setIsCreatingSession(true);
    setError('');
    setStatusText('Создаем MegaGrid-сессию и поднимаем координатор...');

    try {
      resetJobState();
      updateDownload(null);
      const socket = await waitForSocketConnection(socketRef.current);
      const response = await emitWithAck(socket, 'megagrid:create-session', {});
      setRole('master');
      setSessionCode(response.sessionCode);
      setJoinCode(response.sessionCode);
      setSessionSnapshot(response.session || null);
      setShareLink(buildShareLink(response.sessionCode));
      syncSessionInLocation(response.sessionCode);
      setStatusText('MegaGrid-сессия создана. Подключайте worker-ноды по ссылке или QR.');
    } catch (createError) {
      console.error('[MegaGrid] create-session-failed', createError);
      setError('Не удалось создать MegaGrid-сессию.');
      setStatusText('Создание MegaGrid-сессии завершилось с ошибкой.');
    } finally {
      setIsCreatingSession(false);
    }
  }, [buildShareLink, resetJobState, syncSessionInLocation, updateDownload]);

  const joinSessionAsWorker = useCallback(async (rawCode, { silent = false } = {}) => {
    const normalized = normalizeSessionCode(rawCode);
    if (!normalized) {
      setError('Введите корректный 6-значный код MegaGrid-сессии.');
      return false;
    }

    if (!silent) setIsJoiningSession(true);
    setError('');
    setStatusText('Подключаемся к MegaGrid-сессии как worker...');

    try {
      resetJobState();
      updateDownload(null);
      const socket = await waitForSocketConnection(socketRef.current);
      const response = await emitWithAck(socket, 'megagrid:join-session', {
        sessionCode: normalized,
        label: workerLabel,
        capabilities: {
          ffmpegWasm: true,
          webRtc: webRtcSupported
        }
      });
      setRole('worker');
      setSessionCode(response.sessionCode);
      setJoinCode(response.sessionCode);
      setSessionSnapshot(response.session || null);
      setShareLink(buildShareLink(response.sessionCode));
      syncSessionInLocation(response.sessionCode);
      setStatusText('Worker вошел в сессию. Загрузите FFmpeg и переведите ноду в ready.');
      return true;
    } catch (joinError) {
      console.error('[MegaGrid] join-session-failed', joinError);
      setError('Не удалось войти в MegaGrid-сессию.');
      setStatusText('Подключение к MegaGrid-сессии завершилось с ошибкой.');
      return false;
    } finally {
      if (!silent) setIsJoiningSession(false);
    }
  }, [buildShareLink, resetJobState, syncSessionInLocation, updateDownload, webRtcSupported, workerLabel]);

  const toggleWorkerReady = useCallback(async () => {
    if (role !== 'worker') return;
    const nextReady = !workerReady;
    setError('');

    try {
      if (nextReady) {
        await gridEngine.loadEngine();
      }
      setWorkerReady(nextReady);
      await updateWorkerState({
        ready: nextReady,
        status: nextReady ? 'idle' : 'paused',
        assignedTaskId: null
      });
      setStatusText(
        nextReady
          ? 'Worker-нода готова принимать сегменты от master.'
          : 'Worker-нода поставлена на паузу и больше не забирает задачи.'
      );
    } catch (readyError) {
      console.error('[MegaGrid] toggle-worker-ready-failed', readyError);
      setError('Не удалось перевести worker в состояние ready.');
    }
  }, [gridEngine, role, updateWorkerState, workerReady]);

  const startDistributedConversion = useCallback(async () => {
    if (role !== 'master') return;
    if (!selectedFile) {
      setError('Сначала выберите большое видео для распределения.');
      return;
    }

    const readyWorkers = (sessionSnapshot?.workers || []).filter((worker) => worker.ready);
    if (!readyWorkers.length) {
      setError('Нет готовых worker-нод. Подключите хотя бы одну.');
      return;
    }

    try {
      setError('');
      updateDownload(null);
      setStatusText('Master сегментирует исходное видео и формирует очередь задач...');
      setMasterProgress(4);
      await gridEngine.loadEngine();

      const targetFormat = getSelectedFormat();
      const segmentation = await gridEngine.segmentMedia(selectedFile, {
        segmentSeconds
      });

      if (!segmentation.segments.length) {
        throw new Error('no_segments_generated');
      }

      const pendingTasks = segmentation.segments.map((segment) => ({
        ...segment,
        taskId: `grid-task-${segment.index}-${Date.now()}`
      }));

      jobRef.current = {
        totalTasks: pendingTasks.length,
        pendingTasks,
        activeTasks: new Map(),
        results: new Array(pendingTasks.length),
        format: targetFormat,
        outputFileName: `${selectedFile.name.replace(/\.[^.]+$/, '') || 'megagrid-output'}.${targetFormat.ext}`,
        outputExt: targetFormat.ext,
        mimeType: targetFormat.mime,
        finalizing: false
      };

      setMasterTotals({
        total: pendingTasks.length,
        completed: 0
      });
      setMasterProgress(12);
      setStatusText(`Сформировано ${pendingTasks.length} сегментов. Распределяем их по worker-нодам...`);
      dispatchAvailableTasks();
    } catch (jobError) {
      console.error('[MegaGrid] start-distributed-conversion-failed', jobError);
      setError('Не удалось запустить распределенную обработку.');
      setStatusText('MegaGrid не смог стартовать текущий job.');
      resetJobState();
    }
  }, [dispatchAvailableTasks, getSelectedFormat, gridEngine, resetJobState, role, segmentSeconds, selectedFile, sessionSnapshot?.workers, updateDownload]);

  const copyShareLink = useCallback(async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setError('');
    } catch {
      setError('Не удалось скопировать ссылку MegaGrid.');
    }
  }, [shareLink]);

  useEffect(() => {
    if (!webRtcSupported || !socketBase) return undefined;

    const socket = io(socketBase, {
      autoConnect: false,
      withCredentials: true,
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;
    setSocketState('connecting');

    const handleConnect = () => {
      setSocketState('connected');
      if (!sessionCodeRef.current) {
        setStatusText('Grid coordinator подключен. Можно создать распределенную сессию.');
      }
    };

    const handleDisconnect = (reason) => {
      setSocketState('disconnected');
      if (reason !== 'io client disconnect') {
        setStatusText('Grid coordinator переподключается. Peer-соединения могут восстановиться.');
      }
    };

    const handleConnectError = (connectError) => {
      console.error('[MegaGrid] socket-connect-error', connectError);
      setSocketState('error');
      setError('Не удалось подключиться к Socket.io coordinator для MegaGrid.');
    };

    const handleSessionSnapshot = (snapshot) => {
      if (!snapshot) return;
      setSessionSnapshot(snapshot);
      masterSocketIdRef.current = String(snapshot.masterSocketId || '');
      if (roleRef.current === 'master') {
        setStatusText(snapshot.workerCount > 0
          ? `MegaGrid видит ${snapshot.workerCount} worker-ноды. Ready: ${snapshot.readyWorkerCount}.`
          : 'MegaGrid-сессия создана. Ждем первые worker-ноды.');
      }
    };

    const handleSessionClosed = (payload) => {
      console.warn('[MegaGrid] session-closed', payload);
      void leaveSession();
      setError(payload?.reason === 'master_disconnected'
        ? 'Master-нода завершила сессию.'
        : 'Сессия MegaGrid закрыта.');
    };

    const handleSignal = (payload) => {
      if (!payload?.signal) return;
      if (roleRef.current === 'master') {
        const peer = createMasterPeer(payload.fromSocketId);
        try {
          peer.signal(payload.signal);
        } catch (signalError) {
          console.error('[MegaGrid] master-apply-signal-failed', signalError);
        }
        return;
      }

      const peer = ensureWorkerPeer(payload.fromSocketId);
      try {
        peer.signal(payload.signal);
      } catch (signalError) {
        console.error('[MegaGrid] worker-apply-signal-failed', signalError);
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('megagrid:session-snapshot', handleSessionSnapshot);
    socket.on('megagrid:session-closed', handleSessionClosed);
    socket.on('megagrid:signal', handleSignal);
    socket.connect();

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [createMasterPeer, ensureWorkerPeer, leaveSession, socketBase, webRtcSupported]);

  useEffect(() => {
    if (role !== 'master') return undefined;
    const knownWorkers = new Set((sessionSnapshot?.workers || []).map((worker) => worker.socketId));
    for (const worker of sessionSnapshot?.workers || []) {
      createMasterPeer(worker.socketId);
    }
    for (const workerSocketId of masterPeersRef.current.keys()) {
      if (!knownWorkers.has(workerSocketId)) {
        destroyMasterPeer(workerSocketId, 'worker_removed_from_snapshot');
      }
    }
    dispatchAvailableTasks();
    return undefined;
  }, [createMasterPeer, destroyMasterPeer, dispatchAvailableTasks, role, sessionSnapshot]);

  useEffect(() => {
    if (!initialSessionCode || autoJoinAttemptedRef.current || socketState !== 'connected') return;
    autoJoinAttemptedRef.current = true;
    void joinSessionAsWorker(initialSessionCode, { silent: true });
  }, [initialSessionCode, joinSessionAsWorker, socketState]);

  useEffect(() => {
    if (!shareLink || role !== 'master') {
      setQrCodeUrl('');
      return undefined;
    }

    let cancelled = false;
    QRCode.toDataURL(shareLink, {
      width: 220,
      margin: 1,
      color: { dark: '#0f172a', light: '#0000' }
    }).then((dataUrl) => {
      if (!cancelled) setQrCodeUrl(dataUrl);
    }).catch((qrError) => {
      console.warn('[MegaGrid] qr-generation-failed', qrError);
      if (!cancelled) setQrCodeUrl('');
    });

    return () => {
      cancelled = true;
    };
  }, [role, shareLink]);

  useEffect(() => () => {
    safeRevokeObjectUrl(downloadUrlRef.current);
    for (const workerSocketId of masterPeersRef.current.keys()) {
      destroyMasterPeer(workerSocketId, 'component_unmount');
    }
    destroyWorkerPeer('component_unmount');
  }, [destroyMasterPeer, destroyWorkerPeer]);

  const readyWorkers = (sessionSnapshot?.workers || []).filter((worker) => worker.ready);
  const connectedWorkerCount = Array.from(masterPeersRef.current.values()).filter((peer) => peer?.connected).length;
  const selectedFormatMeta = getSelectedFormat();
  const peerStateTone = buildPeerStateTone(role === 'master' ? connectedWorkerCount > 0 : Boolean(workerPeerRef.current?.connected));

  return (
    <section className="mc-card rounded-3xl p-6 md:p-8 overflow-hidden">
      <div className="relative">
        <div className="absolute inset-x-0 top-0 h-40 rounded-[2rem] bg-[radial-gradient(circle_at_top_left,_rgba(8,145,178,0.16),_transparent_55%),radial-gradient(circle_at_top_right,_rgba(34,197,94,0.16),_transparent_42%)] pointer-events-none" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/70 dark:border-emerald-400/20 bg-emerald-50/80 dark:bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-100">
            <Network size={13} />
            MegaGrid / Distributed FFmpeg
          </div>
          <h2 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Распределенная конвертация в браузерном кластере
          </h2>
          <p className="mt-3 max-w-3xl text-sm md:text-base text-slate-600 dark:text-slate-300">
            Master режет видео локально на сегменты, свободные worker-ноды конвертируют куски через FFmpeg.wasm, а итоговый файл собирается обратно в браузере.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${peerStateTone}`}>
          {(role === 'master' ? connectedWorkerCount > 0 : Boolean(workerPeerRef.current?.connected)) ? <Wifi size={14} /> : <WifiOff size={14} />}
          {role === 'master' ? `Peer mesh: ${connectedWorkerCount}` : (workerPeerRef.current?.connected ? 'Linked to master' : 'Waiting for peer')}
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-white/5 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
          <ServerCog size={14} />
          Socket: {socketState}
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-white/5 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
          <ShieldCheck size={14} />
          FFmpeg.wasm Cluster
        </span>
      </div>

      <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">{statusText}</div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-2xl p-5">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Session Control</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void createSession()}
                disabled={!webRtcSupported || isCreatingSession}
                className="rounded-2xl px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-cyan-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 ease-out hover:scale-[1.01] inline-flex items-center justify-center gap-2"
              >
                {isCreatingSession ? <Loader2 size={16} className="animate-spin" /> : <Radio size={16} />}
                Create Master Session
              </button>
              <button
                type="button"
                onClick={() => void leaveSession()}
                disabled={!sessionCode}
                className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 ease-out hover:scale-[1.01]"
              >
                Leave Session
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200/70 dark:border-white/10 bg-slate-50/80 dark:bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Join as Worker</div>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  value={joinCode}
                  onChange={(event) => setJoinCode(normalizeSessionCode(event.target.value))}
                  inputMode="numeric"
                  placeholder="Введите 6 цифр"
                  className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-950/40 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-400"
                />
                <button
                  type="button"
                  onClick={() => void joinSessionAsWorker(joinCode)}
                  disabled={!webRtcSupported || isJoiningSession || joinCode.length < 6}
                  className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 ease-out hover:scale-[1.01] inline-flex items-center justify-center gap-2"
                >
                  {isJoiningSession ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
                  Join Worker
                </button>
              </div>
            </div>

            {sessionCode ? (
              <div className="mt-5 rounded-2xl border border-emerald-200/60 dark:border-emerald-300/20 bg-emerald-50/70 dark:bg-emerald-500/10 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-100">Session Code</div>
                <div className="mt-2 text-3xl font-semibold tracking-[0.32em] text-slate-900 dark:text-slate-100">{sessionCode}</div>
                <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                  {role === 'master' ? 'Поделитесь кодом с worker-нодами.' : 'Эта нода подключена к текущему кластеру.'}
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-2xl p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Cpu size={16} />
              Master Pipeline
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_180px_220px]">
              <div>
                <div className="rounded-3xl border-2 border-dashed border-slate-300/70 dark:border-white/15 bg-white/70 dark:bg-white/5 px-5 py-8 text-center backdrop-blur-xl">
                  {selectedFile ? (
                    <>
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Source Video</div>
                      <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100 break-all">{selectedFile.name}</div>
                      <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{formatBytes(selectedFile.size)}</div>
                    </>
                  ) : (
                    <>
                      <div className="mx-auto h-12 w-12 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 flex items-center justify-center text-slate-600 dark:text-slate-200">
                        <Upload size={18} />
                      </div>
                      <div className="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Выберите видео для MegaGrid</div>
                      <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">Лучше всего подходит крупный файл, который выгодно разбивать на сегменты.</div>
                    </>
                  )}
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={role !== 'master'}
                      className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 px-4 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 ease-out hover:scale-[1.02]"
                    >
                      Выбрать файл
                    </button>
                    {selectedFile ? (
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 transition-all duration-300 ease-out hover:scale-[1.02]"
                      >
                        Очистить
                      </button>
                    ) : null}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                  />
                </div>
              </div>

              <label className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-slate-50/80 dark:bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Segment Size</div>
                <input
                  type="number"
                  min="2"
                  max="30"
                  value={segmentSeconds}
                  onChange={(event) => setSegmentSeconds(Math.max(2, Math.min(30, Number(event.target.value || 5))))}
                  className="mt-3 w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-950/40 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-400"
                />
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Обычно 5 секунд дают хороший баланс между overhead и параллелизмом.</div>
              </label>

              <label className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-slate-50/80 dark:bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Output Format</div>
                <select
                  value={selectedFormat}
                  onChange={(event) => setSelectedFormat(event.target.value)}
                  className="mt-3 w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-950/40 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-400"
                >
                  {GRID_FORMAT_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Сегменты будут конвертированы worker-нодами именно в этот формат.</div>
              </label>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 transition-all duration-300"
                style={{ width: `${masterProgress}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Progress: {Math.round(masterProgress)}%</span>
              <span>Segments: {masterTotals.completed}/{masterTotals.total}</span>
            </div>

            <button
              type="button"
              onClick={() => void startDistributedConversion()}
              disabled={role !== 'master' || !selectedFile || readyWorkers.length === 0 || gridEngine.isBusy}
              className="mt-4 rounded-2xl px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 ease-out hover:scale-[1.01] inline-flex items-center gap-2"
            >
              {gridEngine.isBusy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              Start Distributed Job
            </button>

            {download ? (
              <div className="mt-4 rounded-2xl border border-emerald-300/60 dark:border-emerald-400/20 bg-emerald-100/70 dark:bg-emerald-500/10 px-4 py-3">
                <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-100">Distributed output ready</div>
                <div className="mt-1 text-xs text-emerald-700 dark:text-emerald-200">
                  {download.fileName} · {formatBytes(download.size)}
                </div>
                <a
                  href={download.url}
                  download={download.fileName}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl border border-emerald-300/70 dark:border-emerald-300/30 bg-white/85 dark:bg-white/5 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-100 transition-all duration-300 ease-out hover:scale-[1.02]"
                >
                  <Download size={14} />
                  Скачать итоговый файл
                </a>
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-2xl p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Users size={16} />
              Worker Pool
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {(sessionSnapshot?.workers || []).map((worker) => (
                <div key={worker.socketId} className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-slate-50/80 dark:bg-white/5 p-4">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{worker.label || `Worker ${worker.socketId.slice(-4)}`}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 break-all">{worker.socketId}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${worker.ready ? 'border-emerald-300/70 bg-emerald-100/70 text-emerald-700 dark:border-emerald-300/30 dark:bg-emerald-500/10 dark:text-emerald-100' : 'border-slate-200/70 bg-white/80 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'}`}>
                      {worker.ready ? <CheckCircle2 size={12} /> : <WifiOff size={12} />}
                      {worker.ready ? 'Ready' : 'Paused'}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-white/5 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      Status: {worker.status}
                    </span>
                  </div>
                </div>
              ))}
              {(!sessionSnapshot?.workers || sessionSnapshot.workers.length === 0) ? (
                <div className="rounded-2xl border border-dashed border-slate-200/70 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 p-4 text-sm text-slate-500 dark:text-slate-400 md:col-span-2">
                  Пока нет подключенных worker-нод. Откройте эту страницу на втором устройстве и войдите в сессию.
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-2xl p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <QrCode size={16} />
              Invite / QR
            </div>
            {shareLink ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-emerald-200/60 dark:border-emerald-300/20 bg-emerald-50/70 dark:bg-emerald-500/10 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-100">Worker Link</div>
                  <div className="mt-2 break-all text-sm text-slate-800 dark:text-slate-100">{shareLink}</div>
                  <button
                    type="button"
                    onClick={() => void copyShareLink()}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl border border-emerald-200/70 dark:border-emerald-300/20 bg-white/85 dark:bg-white/5 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-100 transition-all duration-300 ease-out hover:scale-[1.02]"
                  >
                    <Copy size={14} />
                    {copied ? 'Скопировано' : 'Скопировать ссылку'}
                  </button>
                </div>
                {qrCodeUrl ? (
                  <div className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/85 dark:bg-slate-950/40 p-4">
                    <img src={qrCodeUrl} alt="MegaGrid QR" className="mx-auto h-48 w-48 rounded-2xl" />
                    <div className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
                      Откройте QR на втором устройстве и подключите worker прямо в кластер.
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200/70 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 p-4 text-sm text-slate-500 dark:text-slate-400">
                Создайте master-сессию, и здесь появится ссылка для подключения worker-нод.
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-2xl p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Cpu size={16} />
              Worker Node
            </div>
            <label className="mt-4 block">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Node Label</div>
              <input
                value={workerLabel}
                onChange={(event) => setWorkerLabel(event.target.value)}
                className="mt-3 w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-950/40 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-400"
              />
            </label>
            <button
              type="button"
              onClick={() => void toggleWorkerReady()}
              disabled={role !== 'worker'}
              className="mt-4 rounded-2xl px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 ease-out hover:scale-[1.01] inline-flex items-center gap-2"
            >
              {gridEngine.isBusy && role === 'worker' ? <Loader2 size={16} className="animate-spin" /> : <Cpu size={16} />}
              {workerReady ? 'Pause Worker' : 'Load Engine & Ready'}
            </button>
            <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Engine: {gridEngine.engineReady ? 'loaded' : 'not loaded'} · Ready workers in cluster: {readyWorkers.length}
            </div>
          </div>

          <div className="rounded-3xl border border-cyan-200/60 dark:border-cyan-400/20 bg-cyan-50/70 dark:bg-cyan-500/10 backdrop-blur-xl p-5 text-sm text-cyan-900 dark:text-cyan-100">
            <div className="flex items-start gap-2">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold">Pipeline</div>
                <div className="mt-1 text-cyan-800/90 dark:text-cyan-100/90">
                  Master сегментирует видео локально, coordinator отслеживает ready/busy worker-нод, а сегменты и результаты идут по WebRTC Data Channels.
                </div>
                <div className="mt-2 text-cyan-800/90 dark:text-cyan-100/90">
                  Текущий формат job: {selectedFormatMeta.label} · segment time: {segmentSeconds}s
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {(error || gridEngine.error) ? (
        <div className="mt-4 rounded-2xl border border-red-300/60 dark:border-red-400/20 bg-red-100/70 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error || gridEngine.error}</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
