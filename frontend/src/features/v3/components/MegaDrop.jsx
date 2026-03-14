import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Peer from 'simple-peer/simplepeer.min.js';
import QRCode from 'qrcode';
import { useTranslation } from 'react-i18next';
import { io } from 'socket.io-client';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Link2,
  Loader2,
  QrCode,
  Radio,
  Send,
  ShieldCheck,
  Upload,
  Wifi,
  WifiOff
} from 'lucide-react';

const CHUNK_SIZE = 64 * 1024;
const MAX_BUFFERED_AMOUNT = 512 * 1024;
const SOCKET_ACK_TIMEOUT_MS = 10000;
const ICE_SERVERS = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' }
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const formatBytes = (value) => {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

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

const normalizeRoomCode = (value) => String(value || '').trim().replace(/\D+/g, '').slice(0, 6);

const getRoomCodeFromLocation = () => {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  return normalizeRoomCode(params.get('room'));
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

export default function MegaDrop({ initialFile = null, onInitialFileConsumed = null }) {
  const { t } = useTranslation();
  const socketBase = useMemo(() => resolveRealtimeBase(), []);
  const initialRoomCode = useMemo(() => getRoomCodeFromLocation(), []);
  const webRtcSupported = typeof window !== 'undefined'
    && typeof window.RTCPeerConnection !== 'undefined'
    && typeof window.RTCDataChannel !== 'undefined';

  const fileInputRef = useRef(null);
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const pendingSignalsRef = useRef([]);
  const incomingTransferRef = useRef(null);
  const autoJoinAttemptedRef = useRef(false);
  const autoPreparedRoomRef = useRef(false);
  const downloadUrlRef = useRef('');
  const roomCodeRef = useRef(initialRoomCode);
  const roleRef = useRef(initialRoomCode ? 'guest' : '');

  const [socketState, setSocketState] = useState('idle');
  const [role, setRole] = useState(initialRoomCode ? 'guest' : '');
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [joinCode, setJoinCode] = useState(initialRoomCode);
  const [roomState, setRoomState] = useState(null);
  const [peerConnected, setPeerConnected] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [transferState, setTransferState] = useState('idle');
  const [sendProgress, setSendProgress] = useState(0);
  const [receiveProgress, setReceiveProgress] = useState(0);
  const [receivedBytes, setReceivedBytes] = useState(0);
  const [receivedMeta, setReceivedMeta] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloadName, setDownloadName] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [statusText, setStatusText] = useState(
    initialRoomCode
      ? t('legacyV3.megaDrop.statuses.connectingRoom')
      : t('legacyV3.megaDrop.statuses.createOrJoin')
  );
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    roomCodeRef.current = roomCode;
  }, [roomCode]);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  useEffect(() => {
    if (!(initialFile instanceof File)) return;
    setSelectedFile(initialFile);
    setStatusText(t('legacyV3.megaDrop.statuses.fileFromSingularity'));
    autoPreparedRoomRef.current = true;
    onInitialFileConsumed?.();
  }, [initialFile, onInitialFileConsumed, t]);

  const syncRoomInLocation = useCallback((nextRoomCode) => {
    if (typeof window === 'undefined') return;
    const normalized = normalizeRoomCode(nextRoomCode);
    const url = new URL(window.location.href);
    if (normalized) url.searchParams.set('room', normalized);
    else url.searchParams.delete('room');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const buildShareLink = useCallback((nextRoomCode) => {
    const normalized = normalizeRoomCode(nextRoomCode);
    if (!normalized || typeof window === 'undefined') return '';
    return `${window.location.origin}/workspace/secure-share?room=${normalized}`;
  }, []);

  const updateDownloadUrl = useCallback((nextUrl) => {
    setDownloadUrl((previousUrl) => {
      if (previousUrl && previousUrl !== nextUrl) safeRevokeObjectUrl(previousUrl);
      downloadUrlRef.current = nextUrl;
      return nextUrl;
    });
  }, []);

  const destroyPeer = useCallback((reason = 'manual') => {
    const peer = peerRef.current;
    peerRef.current = null;
    pendingSignalsRef.current = [];
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
    setPeerConnected(false);
    console.log('[MegaDrop] peer-destroyed', reason);
  }, []);

  const resetTransferState = useCallback(() => {
    incomingTransferRef.current = null;
    setTransferState('idle');
    setSendProgress(0);
    setReceiveProgress(0);
    setReceivedBytes(0);
    setReceivedMeta(null);
  }, []);

  const handleControlMessage = useCallback((message) => {
    if (!message || typeof message !== 'object') return;

    if (message.type === 'file-meta') {
      incomingTransferRef.current = {
        id: String(message.transferId || `megadrop-${Date.now()}`),
        name: String(message.name || 'megadrop-download.bin'),
        size: Math.max(0, Number(message.size || 0)),
        mime: String(message.mime || 'application/octet-stream'),
        chunks: [],
        receivedBytes: 0,
        receivedChunks: 0
      };
      updateDownloadUrl('');
      setDownloadName(String(message.name || 'megadrop-download.bin'));
      setReceivedMeta({
        name: String(message.name || 'megadrop-download.bin'),
        size: Math.max(0, Number(message.size || 0)),
        mime: String(message.mime || 'application/octet-stream')
      });
      setTransferState('receiving');
      setReceiveProgress(0);
      setReceivedBytes(0);
      setError('');
      setStatusText(t('legacyV3.megaDrop.statuses.receivingDirect'));
      return;
    }

    if (message.type === 'file-complete') {
      const transfer = incomingTransferRef.current;
      if (!transfer) return;
      const blob = new Blob(transfer.chunks, {
        type: transfer.mime || 'application/octet-stream'
      });
      const nextUrl = URL.createObjectURL(blob);
      updateDownloadUrl(nextUrl);
      setDownloadName(transfer.name);
      setTransferState('complete');
      setReceiveProgress(100);
      setStatusText(t('legacyV3.megaDrop.statuses.fileReceived'));
      incomingTransferRef.current = null;
      if (peerRef.current?.connected) {
        peerRef.current.send(JSON.stringify({
          type: 'file-received',
          transferId: transfer.id
        }));
      }
      return;
    }

    if (message.type === 'file-received') {
      setTransferState('sent');
      setSendProgress(100);
      setStatusText(t('legacyV3.megaDrop.statuses.receiverConfirmed'));
    }
  }, [t, updateDownloadUrl]);

  const handlePeerData = useCallback((packet) => {
    if (typeof packet === 'string') {
      try {
        handleControlMessage(JSON.parse(packet));
      } catch (parseError) {
        console.warn('[MegaDrop] control-parse-failed', parseError);
      }
      return;
    }

    const chunk = toUint8Array(packet);
    if (!chunk) return;
    const transfer = incomingTransferRef.current;
    if (!transfer) return;

    transfer.chunks.push(chunk);
    transfer.receivedBytes += chunk.byteLength;
    transfer.receivedChunks += 1;

    const progress = transfer.size > 0
      ? Math.min(99, (transfer.receivedBytes / transfer.size) * 100)
      : 0;

    setTransferState('receiving');
    setReceivedBytes(transfer.receivedBytes);
    setReceiveProgress(progress);
    if (transfer.receivedChunks === 1) {
      setStatusText(t('legacyV3.megaDrop.statuses.channelActive'));
    }
  }, [handleControlMessage, t]);

  const createPeer = useCallback((initiator) => {
    if (peerRef.current) return peerRef.current;
    if (!webRtcSupported) {
      throw new Error('WebRTC is not supported in this browser');
    }

    const peer = new Peer({
      initiator,
      trickle: true,
      config: { iceServers: ICE_SERVERS }
    });

    peerRef.current = peer;

    peer.on('signal', (signal) => {
      const socket = socketRef.current;
      if (!socket) return;
      socket.emit('megadrop:signal', {
        roomCode: roomCodeRef.current,
        signal
      }, (response) => {
        if (response?.ok === false) {
          console.warn('[MegaDrop] signal-relay-failed', response);
        }
      });
    });

    peer.on('connect', () => {
      setPeerConnected(true);
      setError('');
      setStatusText(
        initiator
          ? t('legacyV3.megaDrop.statuses.peerConnectedHost')
          : t('legacyV3.megaDrop.statuses.peerConnectedGuest')
      );
    });

    peer.on('data', (packet) => {
      handlePeerData(packet);
    });

    peer.on('close', () => {
      if (peerRef.current === peer) {
        peerRef.current = null;
      }
      setPeerConnected(false);
      if (roomCodeRef.current) {
        setStatusText(
          roleRef.current === 'host'
            ? t('legacyV3.megaDrop.statuses.connectionClosedHost')
            : t('legacyV3.megaDrop.statuses.connectionClosedGuest')
        );
      }
    });

    peer.on('error', (peerError) => {
      console.error('[MegaDrop] peer-error', peerError);
      if (peerRef.current === peer) {
        peerRef.current = null;
      }
      setPeerConnected(false);
      setError(t('legacyV3.megaDrop.errors.peerFailed'));
      setStatusText(t('legacyV3.megaDrop.statuses.peerDropped'));
      try {
        peer.destroy();
      } catch {
        // noop
      }
    });

    if (pendingSignalsRef.current.length > 0) {
      const queuedSignals = [...pendingSignalsRef.current];
      pendingSignalsRef.current = [];
      for (const signal of queuedSignals) {
        try {
          peer.signal(signal);
        } catch (peerError) {
          console.error('[MegaDrop] pending-signal-failed', peerError);
        }
      }
    }

    return peer;
  }, [handlePeerData, t, webRtcSupported]);

  const leaveRoom = useCallback(async () => {
    const socket = socketRef.current;
    try {
      if (socket?.connected) {
        await emitWithAck(socket, 'megadrop:leave-room', {});
      }
    } catch (leaveError) {
      console.warn('[MegaDrop] leave-room-failed', leaveError);
    }
    destroyPeer('leave_room');
    resetTransferState();
    setPeerConnected(false);
    setRole('');
    setRoomCode('');
    setJoinCode('');
    setRoomState(null);
    setShareLink('');
    setCopied(false);
    setError('');
    setStatusText(t('legacyV3.megaDrop.statuses.sessionEnded'));
    syncRoomInLocation('');
  }, [destroyPeer, resetTransferState, syncRoomInLocation, t]);

  const createRoom = useCallback(async () => {
    setIsCreatingRoom(true);
    setError('');
    setCopied(false);
    setStatusText(t('legacyV3.megaDrop.statuses.creatingRoom'));

    try {
      destroyPeer('create_room');
      resetTransferState();
      const socket = await waitForSocketConnection(socketRef.current);
      const response = await emitWithAck(socket, 'megadrop:create-room', {});
      const nextRoomCode = normalizeRoomCode(response.roomCode);
      setRole('host');
      setRoomCode(nextRoomCode);
      setJoinCode(nextRoomCode);
      setRoomState(response.room || null);
      setShareLink(buildShareLink(nextRoomCode));
      syncRoomInLocation(nextRoomCode);
      setStatusText(t('legacyV3.megaDrop.statuses.roomCreated'));
    } catch (createError) {
      console.error('[MegaDrop] create-room-failed', createError);
      setError(t('legacyV3.megaDrop.errors.createRoomFailed'));
      setStatusText(t('legacyV3.megaDrop.statuses.createRoomFailed'));
    } finally {
      setIsCreatingRoom(false);
    }
  }, [buildShareLink, destroyPeer, resetTransferState, syncRoomInLocation, t]);

  const joinRoom = useCallback(async (rawCode, { silent = false } = {}) => {
    const normalized = normalizeRoomCode(rawCode);
    if (!normalized) {
      setError(t('legacyV3.megaDrop.errors.invalidRoomCode'));
      return false;
    }

    if (!silent) setIsJoiningRoom(true);
    setError('');
    setCopied(false);
    setStatusText(t('legacyV3.megaDrop.statuses.connectingRoom'));

    try {
      destroyPeer('join_room');
      resetTransferState();
      const socket = await waitForSocketConnection(socketRef.current);
      const response = await emitWithAck(socket, 'megadrop:join-room', { roomCode: normalized });
      const nextRoomCode = normalizeRoomCode(response.roomCode);
      setRole('guest');
      setRoomCode(nextRoomCode);
      setJoinCode(nextRoomCode);
      setRoomState(response.room || null);
      setShareLink(buildShareLink(nextRoomCode));
      syncRoomInLocation(nextRoomCode);
      setStatusText(t('legacyV3.megaDrop.statuses.roomFound'));
      return true;
    } catch (joinError) {
      console.error('[MegaDrop] join-room-failed', joinError);
      setError(t('legacyV3.megaDrop.errors.joinRoomFailed'));
      setStatusText(t('legacyV3.megaDrop.statuses.joinRoomFailed'));
      return false;
    } finally {
      if (!silent) setIsJoiningRoom(false);
    }
  }, [buildShareLink, destroyPeer, resetTransferState, syncRoomInLocation, t]);

  const copyShareLink = useCallback(async () => {
    if (!shareLink) return;
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('clipboard_unavailable');
      }
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setError('');
    } catch {
      setError(t('legacyV3.megaDrop.errors.copyFailed'));
    }
  }, [shareLink, t]);

  const handleSelectFile = useCallback((file) => {
    if (!file) return;
    setSelectedFile(file);
    setSendProgress(0);
    setError('');
    setStatusText(
      peerConnected
        ? t('legacyV3.megaDrop.statuses.fileSelectedReady')
        : t('legacyV3.megaDrop.statuses.fileSelectedWaiting')
    );
  }, [peerConnected, t]);

  const sendFile = useCallback(async () => {
    if (role !== 'host') return;
    if (!selectedFile) {
      setError(t('legacyV3.megaDrop.errors.selectFile'));
      return;
    }
    const peer = peerRef.current;
    if (!peer || !peer.connected) {
      setError(t('legacyV3.megaDrop.errors.peerNotReady'));
      return;
    }

    const transferId = typeof window !== 'undefined' && window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `megadrop-${Date.now()}`;
    const totalChunks = Math.max(1, Math.ceil(selectedFile.size / CHUNK_SIZE));

    setTransferState('sending');
    setSendProgress(0);
    setError('');
    setStatusText(t('legacyV3.megaDrop.statuses.sendingChunks'));

    try {
      peer.send(JSON.stringify({
        type: 'file-meta',
        transferId,
        name: selectedFile.name,
        size: selectedFile.size,
        mime: selectedFile.type || 'application/octet-stream',
        totalChunks
      }));

      let sentBytes = 0;
      for (let offset = 0; offset < selectedFile.size; offset += CHUNK_SIZE) {
        await waitForPeerBuffer(peer);
        const chunk = await selectedFile.slice(offset, Math.min(offset + CHUNK_SIZE, selectedFile.size)).arrayBuffer();
        peer.send(chunk);
        sentBytes += chunk.byteLength;
        const progress = selectedFile.size > 0 ? Math.min(100, (sentBytes / selectedFile.size) * 100) : 100;
        setSendProgress(progress);
        if (sentBytes % (CHUNK_SIZE * 8) === 0) {
          await wait(0);
        }
      }

      peer.send(JSON.stringify({
        type: 'file-complete',
        transferId
      }));
      setSendProgress(100);
      setTransferState('awaiting-confirmation');
      setStatusText(t('legacyV3.megaDrop.statuses.awaitingConfirmation'));
    } catch (sendError) {
      console.error('[MegaDrop] send-failed', sendError);
      setTransferState('idle');
      setError(t('legacyV3.megaDrop.errors.sendFailed'));
      setStatusText(t('legacyV3.megaDrop.statuses.sendFailed'));
    }
  }, [role, selectedFile, t]);

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
      setError('');
      setStatusText((current) => (roomCodeRef.current ? current : t('legacyV3.megaDrop.statuses.signalConnected')));
    };

    const handleDisconnect = (reason) => {
      setSocketState('disconnected');
      if (reason !== 'io client disconnect') {
        setStatusText(t('legacyV3.megaDrop.statuses.signalReconnecting'));
      }
    };

    const handleConnectError = (connectError) => {
      console.error('[MegaDrop] socket-connect-error', connectError);
      setSocketState('error');
      setError(t('legacyV3.megaDrop.errors.signalFailed'));
      setStatusText(t('legacyV3.megaDrop.statuses.signalUnavailable'));
    };

    const handleRoomState = (nextRoomState) => {
      if (!nextRoomState) return;
      const normalized = normalizeRoomCode(nextRoomState.roomCode);
      setRoomCode(normalized);
      setJoinCode(normalized);
      setRoomState(nextRoomState);
      setShareLink(buildShareLink(normalized));
      if (normalized) syncRoomInLocation(normalized);
      if (nextRoomState.ready) {
        setStatusText(t('legacyV3.megaDrop.statuses.bothDevicesReady'));
      } else if (roleRef.current === 'host') {
        setStatusText(t('legacyV3.megaDrop.statuses.roomActiveWaiting'));
      }
    };

    const handleRoomClosed = (payload) => {
      destroyPeer('room_closed');
      resetTransferState();
      setPeerConnected(false);
      setRoomState(null);
      setRoomCode('');
      setJoinCode('');
      setRole('');
      setShareLink('');
      syncRoomInLocation('');
      setError(payload?.reason === 'host_disconnected'
        ? t('legacyV3.megaDrop.errors.hostLeft')
        : t('legacyV3.megaDrop.errors.sessionClosed'));
      setStatusText(t('legacyV3.megaDrop.statuses.roomClosed'));
    };

    const handlePeerLeft = () => {
      destroyPeer('peer_left');
      setPeerConnected(false);
      setRoomState((current) => (current ? { ...current, guestConnected: false, ready: false } : current));
      setStatusText(t('legacyV3.megaDrop.statuses.secondDeviceLeft'));
    };

    const handleGuestJoined = () => {
      setStatusText(t('legacyV3.megaDrop.statuses.secondDeviceJoined'));
    };

    const handleSignal = (payload) => {
      if (!payload?.signal) return;
      const peer = peerRef.current;
      if (!peer) {
        pendingSignalsRef.current.push(payload.signal);
        return;
      }
      try {
        peer.signal(payload.signal);
      } catch (signalError) {
        console.error('[MegaDrop] apply-signal-failed', signalError);
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('megadrop:room-state', handleRoomState);
    socket.on('megadrop:room-closed', handleRoomClosed);
    socket.on('megadrop:peer-left', handlePeerLeft);
    socket.on('megadrop:guest-joined', handleGuestJoined);
    socket.on('megadrop:signal', handleSignal);
    socket.connect();

    return () => {
      destroyPeer('component_unmount');
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [buildShareLink, destroyPeer, resetTransferState, socketBase, syncRoomInLocation, t, webRtcSupported]);

  useEffect(() => {
    if (!roomState?.ready || !roomCode || !role || peerRef.current) return;
    try {
      createPeer(role === 'host');
    } catch (peerError) {
      console.error('[MegaDrop] peer-init-failed', peerError);
      setError(t('legacyV3.megaDrop.errors.webrtcInitFailed'));
      setStatusText(t('legacyV3.megaDrop.statuses.webrtcUnavailable'));
    }
  }, [createPeer, role, roomCode, roomState, t]);

  useEffect(() => {
    if (!initialRoomCode || autoJoinAttemptedRef.current || socketState !== 'connected') return;
    autoJoinAttemptedRef.current = true;
    void joinRoom(initialRoomCode, { silent: true });
  }, [initialRoomCode, joinRoom, socketState]);

  useEffect(() => {
    if (!autoPreparedRoomRef.current || !selectedFile) return;
    if (!webRtcSupported || socketState !== 'connected' || roomCode) return;
    autoPreparedRoomRef.current = false;
    void createRoom();
  }, [createRoom, roomCode, selectedFile, socketState, webRtcSupported]);

  useEffect(() => {
    if (!shareLink || role !== 'host') {
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
      console.warn('[MegaDrop] qr-generation-failed', qrError);
      if (!cancelled) setQrCodeUrl('');
    });

    return () => {
      cancelled = true;
    };
  }, [role, shareLink]);

  useEffect(() => () => {
    safeRevokeObjectUrl(downloadUrlRef.current);
  }, []);

  const connectionTone = peerConnected
    ? 'border-emerald-300/70 bg-emerald-100/70 text-emerald-800 dark:border-emerald-300/30 dark:bg-emerald-500/10 dark:text-emerald-100'
    : 'border-slate-200/70 bg-white/80 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200';

  return (
    <section className="mc-card rounded-3xl p-6 md:p-8 overflow-hidden">
      <div className="relative">
        <div className="absolute inset-x-0 top-0 h-40 rounded-[2rem] bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_58%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.14),_transparent_42%)] pointer-events-none" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/70 dark:border-cyan-400/20 bg-cyan-50/80 dark:bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700 dark:text-cyan-100">
            <Radio size={13} />
            MegaDrop / P2P
          </div>
          <h2 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {t('legacyV3.megaDrop.title')}
          </h2>
          <p className="mt-3 max-w-3xl text-sm md:text-base text-slate-600 dark:text-slate-300">
            {t('legacyV3.megaDrop.description')}
          </p>
        </div>
      </div>

      {!webRtcSupported && (
        <div className="mt-6 rounded-3xl border border-red-300/70 dark:border-red-400/20 bg-red-100/70 dark:bg-red-500/10 px-4 py-4 text-sm text-red-700 dark:text-red-200">
          <div className="flex items-start gap-2">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>{t('legacyV3.megaDrop.errors.unsupportedBrowser')}</span>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-2xl p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${connectionTone}`}>
                {peerConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
                {peerConnected ? t('legacyV3.megaDrop.p2pActive') : t('legacyV3.megaDrop.waitingChannel')}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-white/5 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                <ShieldCheck size={14} />
                {t('legacyV3.megaDrop.securePath')}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-white/5 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                {t('legacyV3.megaDrop.socketLabel')}: {socketState}
              </span>
            </div>

            <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">{statusText}</div>

            {roomCode ? (
              <div className="mt-5 rounded-2xl border border-cyan-200/60 dark:border-cyan-300/20 bg-cyan-50/70 dark:bg-cyan-500/10 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-100">{t('legacyV3.megaDrop.roomCode')}</div>
                <div className="mt-2 text-3xl font-semibold tracking-[0.32em] text-slate-900 dark:text-slate-100">{roomCode}</div>
                <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                  {role === 'host'
                    ? t('legacyV3.megaDrop.roomCodeHostHint')
                    : t('legacyV3.megaDrop.roomCodeGuestHint')}
                </div>
              </div>
            ) : null}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void createRoom()}
                disabled={!webRtcSupported || isCreatingRoom}
                className="rounded-2xl px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 ease-out hover:scale-[1.01] inline-flex items-center justify-center gap-2"
              >
                {isCreatingRoom ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
                {t('legacyV3.megaDrop.createRoom')}
              </button>

              <button
                type="button"
                onClick={() => void leaveRoom()}
                disabled={!roomCode}
                className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 ease-out hover:scale-[1.01]"
              >
                {t('legacyV3.megaDrop.endSession')}
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200/70 dark:border-white/10 bg-slate-50/80 dark:bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t('legacyV3.megaDrop.joinByCode')}</div>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  value={joinCode}
                  onChange={(event) => setJoinCode(normalizeRoomCode(event.target.value))}
                  inputMode="numeric"
                  placeholder={t('legacyV3.megaDrop.enterCode')}
                  className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-950/40 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-cyan-400"
                />
                <button
                  type="button"
                  onClick={() => void joinRoom(joinCode)}
                  disabled={!webRtcSupported || isJoiningRoom || joinCode.length < 6}
                  className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 ease-out hover:scale-[1.01] inline-flex items-center justify-center gap-2"
                >
                  {isJoiningRoom ? <Loader2 size={16} className="animate-spin" /> : <Radio size={16} />}
                  {t('legacyV3.megaDrop.connect')}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-2xl p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Upload size={16} />
              {t('legacyV3.megaDrop.sendFileSection')}
            </div>

            <div
              className={`mt-4 rounded-3xl border-2 border-dashed px-5 py-8 text-center backdrop-blur-xl transition-all duration-300 ease-out ${
                isDragOver
                  ? 'border-cyan-400/70 bg-cyan-50/70 dark:bg-cyan-500/10'
                  : 'border-slate-300/70 dark:border-white/15 bg-white/70 dark:bg-white/5'
              } ${role !== 'host' ? 'opacity-60' : ''}`}
              onDragEnter={() => role === 'host' && setIsDragOver(true)}
              onDragLeave={() => setIsDragOver(false)}
              onDragOver={(event) => {
                event.preventDefault();
                if (role === 'host') setIsDragOver(true);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragOver(false);
                if (role !== 'host') return;
                const file = event.dataTransfer?.files?.[0] || null;
                handleSelectFile(file);
              }}
            >
              <div className="mx-auto h-12 w-12 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 flex items-center justify-center text-slate-600 dark:text-slate-200">
                <Upload size={18} />
              </div>
              <div className="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
                {role === 'host' ? t('legacyV3.megaDrop.hostDropTitle') : t('legacyV3.megaDrop.guestDropTitle')}
              </div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {role === 'host'
                  ? t('legacyV3.megaDrop.hostDropHint')
                  : t('legacyV3.megaDrop.guestDropHint')}
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={role !== 'host'}
                  className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 px-4 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 ease-out hover:scale-[1.02]"
                >
                  {t('btnSelect')}
                </button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(event) => {
                handleSelectFile(event.target.files?.[0] || null);
                event.target.value = '';
              }}
            />

            {selectedFile ? (
              <div className="mt-4 rounded-2xl border border-slate-200/70 dark:border-white/10 bg-slate-50/80 dark:bg-white/5 p-4">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 break-all">{selectedFile.name}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatBytes(selectedFile.size)}</div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-500 to-emerald-500 transition-all duration-300"
                    style={{ width: `${sendProgress}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {transferState === 'sent' ? t('legacyV3.megaDrop.transferConfirmed') : t('legacyV3.megaDrop.sentLabel', { progress: sendProgress.toFixed(0) })}
                </div>
                <button
                  type="button"
                  onClick={() => void sendFile()}
                  disabled={role !== 'host' || !selectedFile || !peerConnected || transferState === 'sending'}
                  className="mt-4 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 ease-out hover:scale-[1.01] inline-flex items-center gap-2"
                >
                  {transferState === 'sending' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  {t('legacyV3.megaDrop.sendDirect')}
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-2xl p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <QrCode size={16} />
              {t('legacyV3.megaDrop.inviteQr')}
            </div>
            <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              {t('legacyV3.megaDrop.inviteDescription')}
            </div>

            {shareLink ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-cyan-200/60 dark:border-cyan-300/20 bg-cyan-50/70 dark:bg-cyan-500/10 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-100">{t('legacyV3.megaDrop.roomLink')}</div>
                  <div className="mt-2 break-all text-sm text-slate-800 dark:text-slate-100">{shareLink}</div>
                  <button
                    type="button"
                    onClick={() => void copyShareLink()}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl border border-cyan-200/70 dark:border-cyan-300/20 bg-white/85 dark:bg-white/5 px-3 py-2 text-xs font-semibold text-cyan-800 dark:text-cyan-100 transition-all duration-300 ease-out hover:scale-[1.02]"
                  >
                    <Copy size={14} />
                    {copied ? t('legacyV3.megaDrop.copied') : t('legacyV3.megaDrop.copyLink')}
                  </button>
                </div>

                {qrCodeUrl ? (
                  <div className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/85 dark:bg-slate-950/40 p-4">
                    <img src={qrCodeUrl} alt="MegaDrop QR" className="mx-auto h-48 w-48 rounded-2xl" />
                    <div className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
                      {t('legacyV3.megaDrop.qrHint')}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200/70 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 p-4 text-sm text-slate-500 dark:text-slate-400">
                {t('legacyV3.megaDrop.linkPending')}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-2xl p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Download size={16} />
              {t('legacyV3.megaDrop.receiveFileSection')}
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-500 transition-all duration-300"
                style={{ width: `${receiveProgress}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {t('legacyV3.megaDrop.receivedLabel', { progress: receiveProgress.toFixed(0), size: receivedBytes > 0 ? `(${formatBytes(receivedBytes)})` : '' })}
            </div>

            {receivedMeta ? (
              <div className="mt-4 rounded-2xl border border-slate-200/70 dark:border-white/10 bg-slate-50/80 dark:bg-white/5 p-4">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 break-all">{receivedMeta.name}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatBytes(receivedMeta.size)}</div>
              </div>
            ) : null}

            {downloadUrl ? (
              <a
                href={downloadUrl}
                download={downloadName || 'megadrop-download'}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-emerald-600 transition-all duration-300 ease-out hover:scale-[1.01]"
              >
                <Download size={15} />
                {t('legacyV3.megaDrop.downloadReceived')}
              </a>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200/70 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 p-4 text-sm text-slate-500 dark:text-slate-400">
                {t('legacyV3.megaDrop.waitingForFile')}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-emerald-200/60 dark:border-emerald-400/20 bg-emerald-50/70 dark:bg-emerald-500/10 backdrop-blur-xl p-5 text-sm text-emerald-900 dark:text-emerald-100">
            <div className="flex items-start gap-2">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold">{t('legacyV3.megaDrop.howItWorksTitle')}</div>
                <div className="mt-1 text-emerald-800/90 dark:text-emerald-100/90">
                  {t('legacyV3.megaDrop.howItWorksBody')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-300/60 dark:border-red-400/20 bg-red-100/70 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
