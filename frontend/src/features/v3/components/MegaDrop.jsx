import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Peer from 'simple-peer/simplepeer.min.js';
import QRCode from 'qrcode';
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
import useWorkspaceLocale from '../lib/useWorkspaceLocale.js';

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
  const { pick } = useWorkspaceLocale();
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
      ? 'Подключаемся к комнате MegaDrop...'
      : 'Создайте комнату или введите код, чтобы начать прямую передачу.'
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
    setStatusText('Файл уже загружен из сингулярности. Подготавливаем MegaDrop-комнату...');
    autoPreparedRoomRef.current = true;
    onInitialFileConsumed?.();
  }, [initialFile, onInitialFileConsumed]);

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
      setStatusText('Получаем файл напрямую через WebRTC. Сервер не хранит данные.');
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
      setStatusText('Файл получен напрямую. Можно скачать локально.');
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
      setStatusText('Получатель подтвердил прием файла. Передача завершена.');
    }
  }, [updateDownloadUrl]);

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
      setStatusText('Канал активен. Получаем чанки и собираем Blob локально...');
    }
  }, [handleControlMessage]);

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
          ? 'P2P-соединение установлено. Можно отправлять файл на второе устройство.'
          : 'P2P-соединение установлено. Ждем файл от отправителя.'
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
            ? 'Соединение закрыто. Можно дождаться нового подключения по той же ссылке.'
            : 'Соединение завершено. Если нужно, откройте ссылку заново.'
        );
      }
    });

    peer.on('error', (peerError) => {
      console.error('[MegaDrop] peer-error', peerError);
      if (peerRef.current === peer) {
        peerRef.current = null;
      }
      setPeerConnected(false);
      setError('Не удалось удержать прямое соединение. Попробуйте переподключиться.');
      setStatusText('P2P-соединение оборвалось. Можно создать новую комнату или повторить вход.');
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
  }, [handlePeerData, webRtcSupported]);

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
    setStatusText('Сеанс завершен. Можно создать новую комнату или подключиться снова.');
    syncRoomInLocation('');
  }, [destroyPeer, resetTransferState, syncRoomInLocation]);

  const createRoom = useCallback(async () => {
    setIsCreatingRoom(true);
    setError('');
    setCopied(false);
    setStatusText('Создаем комнату MegaDrop и резервируем код...');

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
      setStatusText('Комната создана. Откройте ссылку или QR-код на втором устройстве.');
    } catch (createError) {
      console.error('[MegaDrop] create-room-failed', createError);
      setError('Не удалось создать комнату MegaDrop. Проверьте соединение и попробуйте еще раз.');
      setStatusText('Создание комнаты не удалось.');
    } finally {
      setIsCreatingRoom(false);
    }
  }, [buildShareLink, destroyPeer, resetTransferState, syncRoomInLocation]);

  const joinRoom = useCallback(async (rawCode, { silent = false } = {}) => {
    const normalized = normalizeRoomCode(rawCode);
    if (!normalized) {
      setError('Введите корректный 6-значный код комнаты.');
      return false;
    }

    if (!silent) setIsJoiningRoom(true);
    setError('');
    setCopied(false);
    setStatusText('Подключаемся к комнате MegaDrop...');

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
      setStatusText('Комната найдена. Инициализируем защищенное соединение...');
      return true;
    } catch (joinError) {
      console.error('[MegaDrop] join-room-failed', joinError);
      setError('Не удалось подключиться к комнате. Проверьте код и попробуйте снова.');
      setStatusText('Подключение к комнате не удалось.');
      return false;
    } finally {
      if (!silent) setIsJoiningRoom(false);
    }
  }, [buildShareLink, destroyPeer, resetTransferState, syncRoomInLocation]);

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
      setError('Не удалось скопировать ссылку в буфер обмена.');
    }
  }, [shareLink]);

  const handleSelectFile = useCallback((file) => {
    if (!file) return;
    setSelectedFile(file);
    setSendProgress(0);
    setError('');
    setStatusText(
      peerConnected
        ? 'Файл выбран. Можно отправлять напрямую без загрузки на сервер.'
        : 'Файл выбран. Ждем подключение второго устройства.'
    );
  }, [peerConnected]);

  const sendFile = useCallback(async () => {
    if (role !== 'host') return;
    if (!selectedFile) {
      setError('Сначала выберите файл для передачи.');
      return;
    }
    const peer = peerRef.current;
    if (!peer || !peer.connected) {
      setError('P2P-соединение еще не готово. Подождите второе устройство.');
      return;
    }

    const transferId = typeof window !== 'undefined' && window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `megadrop-${Date.now()}`;
    const totalChunks = Math.max(1, Math.ceil(selectedFile.size / CHUNK_SIZE));

    setTransferState('sending');
    setSendProgress(0);
    setError('');
    setStatusText('Передаем файл чанками через WebRTC Data Channel...');

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
      setStatusText('Файл передан в защищенный канал. Ждем подтверждение от получателя...');
    } catch (sendError) {
      console.error('[MegaDrop] send-failed', sendError);
      setTransferState('idle');
      setError('Передача прервалась. Попробуйте еще раз или пересоздайте комнату.');
      setStatusText('Не удалось завершить передачу.');
    }
  }, [role, selectedFile]);

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
      setStatusText((current) => (roomCodeRef.current ? current : 'Сигнальный сервер подключен. Можно создать комнату MegaDrop.'));
    };

    const handleDisconnect = (reason) => {
      setSocketState('disconnected');
      if (reason !== 'io client disconnect') {
        setStatusText('Сигнальный сервер переподключается. Уже созданный P2P-канал может продолжить работу.');
      }
    };

    const handleConnectError = (connectError) => {
      console.error('[MegaDrop] socket-connect-error', connectError);
      setSocketState('error');
      setError('Не удалось подключиться к сигнальному серверу MegaDrop.');
      setStatusText('Socket.io пока недоступен. Проверьте сеть и конфигурацию API.');
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
        setStatusText('Оба устройства в комнате. Инициализируем прямой канал связи...');
      } else if (roleRef.current === 'host') {
        setStatusText('Комната активна. Ждем второе устройство по ссылке или QR-коду.');
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
        ? 'Отправитель вышел из комнаты.'
        : 'Сеанс MegaDrop завершен.');
      setStatusText('Комната закрыта. Создайте новую или подключитесь к другой.');
    };

    const handlePeerLeft = () => {
      destroyPeer('peer_left');
      setPeerConnected(false);
      setRoomState((current) => (current ? { ...current, guestConnected: false, ready: false } : current));
      setStatusText('Второе устройство отключилось. Можно дождаться переподключения.');
    };

    const handleGuestJoined = () => {
      setStatusText('Второе устройство вошло в комнату. Запускаем защищенное соединение...');
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
  }, [buildShareLink, destroyPeer, resetTransferState, socketBase, syncRoomInLocation, webRtcSupported]);

  useEffect(() => {
    if (!roomState?.ready || !roomCode || !role || peerRef.current) return;
    try {
      createPeer(role === 'host');
    } catch (peerError) {
      console.error('[MegaDrop] peer-init-failed', peerError);
      setError('Не удалось инициализировать WebRTC. Проверьте поддержку браузера.');
      setStatusText('WebRTC недоступен для текущей сессии.');
    }
  }, [createPeer, role, roomCode, roomState]);

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
            Прямая передача файлов между устройствами
          </h2>
          <p className="mt-3 max-w-3xl text-sm md:text-base text-slate-600 dark:text-slate-300">
            Файл идет напрямую по WebRTC Data Channel. Сигнальный сервер нужен только для рукопожатия, а данные не сохраняются в облаке.
          </p>
        </div>
      </div>

      {!webRtcSupported && (
        <div className="mt-6 rounded-3xl border border-red-300/70 dark:border-red-400/20 bg-red-100/70 dark:bg-red-500/10 px-4 py-4 text-sm text-red-700 dark:text-red-200">
          <div className="flex items-start gap-2">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>Текущий браузер не поддерживает WebRTC Data Channels. Для MegaDrop нужен современный Chrome, Edge, Safari или Firefox.</span>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-2xl p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${connectionTone}`}>
                {peerConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
                {peerConnected ? pick('P2P активен', 'P2P online') : pick('Ожидание канала', 'Waiting for channel')}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-white/5 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                <ShieldCheck size={14} />
                {pick('Прямой защищенный маршрут', 'End-to-end path')}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-white/5 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                {pick('Сокет', 'Socket')}: {socketState}
              </span>
            </div>

            <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">{statusText}</div>

            {roomCode ? (
              <div className="mt-5 rounded-2xl border border-cyan-200/60 dark:border-cyan-300/20 bg-cyan-50/70 dark:bg-cyan-500/10 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-100">{pick('Код комнаты', 'Room code')}</div>
                <div className="mt-2 text-3xl font-semibold tracking-[0.32em] text-slate-900 dark:text-slate-100">{roomCode}</div>
                <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                  {role === 'host'
                    ? 'Этот код можно ввести вручную на втором устройстве.'
                    : 'Вы подключены как принимающая сторона.'}
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
                Создать комнату
              </button>

              <button
                type="button"
                onClick={() => void leaveRoom()}
                disabled={!roomCode}
                className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 ease-out hover:scale-[1.01]"
              >
                Завершить сеанс
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200/70 dark:border-white/10 bg-slate-50/80 dark:bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{pick('Подключение по коду', 'Join by code')}</div>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  value={joinCode}
                  onChange={(event) => setJoinCode(normalizeRoomCode(event.target.value))}
                  inputMode="numeric"
                  placeholder="Введите 6 цифр"
                  className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-950/40 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-cyan-400"
                />
                <button
                  type="button"
                  onClick={() => void joinRoom(joinCode)}
                  disabled={!webRtcSupported || isJoiningRoom || joinCode.length < 6}
                  className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 ease-out hover:scale-[1.01] inline-flex items-center justify-center gap-2"
                >
                  {isJoiningRoom ? <Loader2 size={16} className="animate-spin" /> : <Radio size={16} />}
                  Подключиться
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-2xl p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Upload size={16} />
              Отправка файла
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
                {role === 'host' ? 'Перетащите файл для прямой отправки' : 'Файлы отправляет устройство-хост'}
              </div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {role === 'host'
                  ? 'MegaDrop нарежет поток по 64 KB и передаст его напрямую.'
                  : 'На этой стороне файл будет собран в Blob и предложен к скачиванию.'}
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={role !== 'host'}
                  className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 px-4 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 ease-out hover:scale-[1.02]"
                >
                  Выбрать файл
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
                  {transferState === 'sent' ? 'Передача подтверждена получателем.' : `Отправлено: ${sendProgress.toFixed(0)}%`}
                </div>
                <button
                  type="button"
                  onClick={() => void sendFile()}
                  disabled={role !== 'host' || !selectedFile || !peerConnected || transferState === 'sending'}
                  className="mt-4 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 ease-out hover:scale-[1.01] inline-flex items-center gap-2"
                >
                  {transferState === 'sending' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  Отправить напрямую
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-2xl p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <QrCode size={16} />
              {pick('Ссылка и QR', 'Invite / QR')}
            </div>
            <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Создайте комнату на основном устройстве и откройте ссылку на втором. Если удобно, можно просто ввести код вручную.
            </div>

            {shareLink ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-cyan-200/60 dark:border-cyan-300/20 bg-cyan-50/70 dark:bg-cyan-500/10 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-100">{pick('Ссылка комнаты', 'Room link')}</div>
                  <div className="mt-2 break-all text-sm text-slate-800 dark:text-slate-100">{shareLink}</div>
                  <button
                    type="button"
                    onClick={() => void copyShareLink()}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl border border-cyan-200/70 dark:border-cyan-300/20 bg-white/85 dark:bg-white/5 px-3 py-2 text-xs font-semibold text-cyan-800 dark:text-cyan-100 transition-all duration-300 ease-out hover:scale-[1.02]"
                  >
                    <Copy size={14} />
                    {copied ? 'Скопировано' : 'Скопировать ссылку'}
                  </button>
                </div>

                {qrCodeUrl ? (
                  <div className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/85 dark:bg-slate-950/40 p-4">
                    <img src={qrCodeUrl} alt="MegaDrop QR" className="mx-auto h-48 w-48 rounded-2xl" />
                    <div className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
                      Сканируйте QR на втором устройстве для быстрого входа в комнату.
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200/70 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 p-4 text-sm text-slate-500 dark:text-slate-400">
                Ссылка и QR появятся после создания комнаты.
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-2xl p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Download size={16} />
              Прием файла
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-500 transition-all duration-300"
                style={{ width: `${receiveProgress}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Получено: {receiveProgress.toFixed(0)}% {receivedBytes > 0 ? `(${formatBytes(receivedBytes)})` : ''}
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
                Скачать полученный файл
              </a>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200/70 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 p-4 text-sm text-slate-500 dark:text-slate-400">
                Когда второй участник отправит файл, он соберется здесь локально и станет доступен для скачивания.
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-emerald-200/60 dark:border-emerald-400/20 bg-emerald-50/70 dark:bg-emerald-500/10 backdrop-blur-xl p-5 text-sm text-emerald-900 dark:text-emerald-100">
            <div className="flex items-start gap-2">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold">Как это работает</div>
                <div className="mt-1 text-emerald-800/90 dark:text-emerald-100/90">
                  Хост создает комнату, второе устройство открывает ссылку, дальше `simple-peer` поднимает WebRTC-канал, а файл идет чанками по 64 KB.
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
