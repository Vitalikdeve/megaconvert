import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Peer from 'simple-peer/simplepeer.min.js';
import { io } from 'socket.io-client';

const CHUNK_SIZE = 64 * 1024;
const MAX_BUFFERED_AMOUNT = 512 * 1024;
const SOCKET_ACK_TIMEOUT_MS = 10000;
const ICE_SERVERS = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' },
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeApiBase = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '';
  }

  if (!/^(https?|wss?):\/\//i.test(normalized)) {
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  }

  try {
    const parsed = new URL(normalized);
    parsed.pathname = parsed.pathname.replace(/\/+$/g, '');
    if (parsed.pathname === '/api') {
      parsed.pathname = '';
    }
    return parsed.toString().replace(/\/+$/g, '');
  } catch {
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  }
};

const resolveRealtimeBase = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  const configuredBase = normalizeApiBase(import.meta.env.VITE_SIGNALING_URL || import.meta.env.VITE_API_BASE || '');
  if (!configuredBase) {
    return window.location.origin;
  }

  if (!/^(https?|wss?):\/\//i.test(configuredBase)) {
    return window.location.origin;
  }

  return configuredBase;
};

const normalizeRoomCode = (value) => String(value || '').trim().replace(/\D+/g, '').slice(0, 6);

const buildShareUrl = (roomCode) => {
  if (typeof window === 'undefined') {
    return '';
  }

  const normalized = normalizeRoomCode(roomCode);
  if (!normalized) {
    return '';
  }

  return `${window.location.origin}/receive?room=${normalized}`;
};

const safeRevokeObjectUrl = (value) => {
  if (!value || typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') {
    return;
  }

  try {
    URL.revokeObjectURL(value);
  } catch {
    // noop
  }
};

const toUint8Array = (packet) => {
  if (packet instanceof ArrayBuffer) {
    return new Uint8Array(packet);
  }

  if (ArrayBuffer.isView(packet)) {
    return new Uint8Array(packet.buffer, packet.byteOffset, packet.byteLength);
  }

  return null;
};

const emitWithAck = (socket, eventName, payload) => new Promise((resolve, reject) => {
  let settled = false;
  const timer = window.setTimeout(() => {
    if (settled) {
      return;
    }

    settled = true;
    reject(new Error(`${eventName}_timeout`));
  }, SOCKET_ACK_TIMEOUT_MS);

  socket.emit(eventName, payload, (response) => {
    if (settled) {
      return;
    }

    window.clearTimeout(timer);
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
  const timer = window.setTimeout(() => {
    if (settled) {
      return;
    }

    settled = true;
    socket.off('connect', handleConnect);
    socket.off('connect_error', handleError);
    reject(new Error('socket_connect_timeout'));
  }, SOCKET_ACK_TIMEOUT_MS);

  const handleConnect = () => {
    if (settled) {
      return;
    }

    settled = true;
    window.clearTimeout(timer);
    socket.off('connect_error', handleError);
    resolve(socket);
  };

  const handleError = (error) => {
    if (settled) {
      return;
    }

    settled = true;
    window.clearTimeout(timer);
    socket.off('connect', handleConnect);
    reject(error instanceof Error ? error : new Error(String(error || 'socket_connect_failed')));
  };

  socket.once('connect', handleConnect);
  socket.once('connect_error', handleError);
  socket.connect();
});

const waitForPeerBuffer = async (peer) => {
  while (peer?.connected && peer?._channel?.bufferedAmount > MAX_BUFFERED_AMOUNT) {
    await wait(16);
  }
};

export default function useMegaDrop() {
  const socketBase = useMemo(() => resolveRealtimeBase(), []);
  const webRtcSupported = typeof window !== 'undefined'
    && typeof window.RTCPeerConnection !== 'undefined'
    && typeof window.RTCDataChannel !== 'undefined';

  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const pendingSignalsRef = useRef([]);
  const incomingTransferRef = useRef(null);
  const outgoingFileRef = useRef(null);
  const sendStartedRef = useRef(false);
  const downloadUrlRef = useRef('');
  const roleRef = useRef('');
  const roomIdRef = useRef('');

  const [socketState, setSocketState] = useState('idle');
  const [role, setRole] = useState('');
  const [roomId, setRoomId] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [statusText, setStatusText] = useState('MegaDrop готов.');
  const [error, setError] = useState('');
  const [transferPhase, setTransferPhase] = useState('idle');
  const [transferProgress, setTransferProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloadName, setDownloadName] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isHosting, setIsHosting] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  const updateDownloadUrl = useCallback((nextUrl) => {
    setDownloadUrl((current) => {
      if (current && current !== nextUrl) {
        safeRevokeObjectUrl(current);
      }

      downloadUrlRef.current = nextUrl;
      return nextUrl;
    });
  }, []);

  const destroyPeer = useCallback((reason = 'manual') => {
    const peer = peerRef.current;
    peerRef.current = null;
    pendingSignalsRef.current = [];
    sendStartedRef.current = false;

    if (!peer) {
      return;
    }

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

    setIsConnected(false);
    console.log('[ZeroUI MegaDrop] peer-destroyed', reason);
  }, []);

  const resetTransferVisuals = useCallback(() => {
    incomingTransferRef.current = null;
    setTransferPhase('idle');
    setTransferProgress(0);
    setDownloadName('');
  }, []);

  const sendPreparedFile = useCallback(async () => {
    const peer = peerRef.current;
    const payload = outgoingFileRef.current;

    if (!peer || !peer.connected || !payload || sendStartedRef.current) {
      return;
    }

    sendStartedRef.current = true;
    setTransferPhase('transferring');
    setTransferProgress(0);
    setStatusText('Передача напрямую...');

    const transferId = typeof window !== 'undefined' && window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `megadrop-${Date.now()}`;

    try {
      peer.send(JSON.stringify({
        type: 'file-meta',
        transferId,
        name: payload.fileName,
        size: payload.blob.size,
        mime: payload.mimeType || payload.blob.type || 'application/octet-stream',
        totalChunks: Math.max(1, Math.ceil(payload.blob.size / CHUNK_SIZE)),
      }));

      let sentBytes = 0;
      for (let offset = 0; offset < payload.blob.size; offset += CHUNK_SIZE) {
        await waitForPeerBuffer(peer);
        const chunk = await payload.blob.slice(offset, Math.min(offset + CHUNK_SIZE, payload.blob.size)).arrayBuffer();
        peer.send(chunk);
        sentBytes += chunk.byteLength;
        setTransferProgress(payload.blob.size > 0 ? Math.min(100, (sentBytes / payload.blob.size) * 100) : 100);

        if (sentBytes % (CHUNK_SIZE * 8) === 0) {
          await wait(0);
        }
      }

      peer.send(JSON.stringify({
        type: 'file-complete',
        transferId,
      }));

      setTransferPhase('awaiting-confirmation');
      setTransferProgress(100);
      setStatusText('Файл передан в защищенный канал. Ждем подтверждение...');
    } catch (sendError) {
      console.error('[ZeroUI MegaDrop] send-failed', sendError);
      sendStartedRef.current = false;
      setTransferPhase('error');
      setError('Передача прервалась. Попробуйте открыть MegaDrop заново.');
      setStatusText('Не удалось завершить передачу.');
    }
  }, []);

  const handleControlMessage = useCallback((message) => {
    if (!message || typeof message !== 'object') {
      return;
    }

    if (message.type === 'file-meta') {
      incomingTransferRef.current = {
        id: String(message.transferId || `megadrop-${Date.now()}`),
        name: String(message.name || 'megadrop-download.bin'),
        size: Math.max(0, Number(message.size || 0)),
        mime: String(message.mime || 'application/octet-stream'),
        chunks: [],
        receivedBytes: 0,
      };

      updateDownloadUrl('');
      setDownloadName(String(message.name || 'megadrop-download.bin'));
      setTransferPhase('receiving');
      setTransferProgress(0);
      setStatusText('Получаем файл напрямую...');
      setError('');
      return;
    }

    if (message.type === 'file-complete') {
      const transfer = incomingTransferRef.current;
      if (!transfer) {
        return;
      }

      const blob = new Blob(transfer.chunks, {
        type: transfer.mime || 'application/octet-stream',
      });
      const nextUrl = URL.createObjectURL(blob);
      updateDownloadUrl(nextUrl);
      setDownloadName(transfer.name);
      setTransferPhase('complete');
      setTransferProgress(100);
      setStatusText('Файл получен напрямую.');
      incomingTransferRef.current = null;

      if (peerRef.current?.connected) {
        peerRef.current.send(JSON.stringify({
          type: 'file-received',
          transferId: transfer.id,
        }));
      }

      return;
    }

    if (message.type === 'file-received') {
      setTransferPhase('complete');
      setTransferProgress(100);
      setStatusText('Передача завершена.');
    }
  }, [updateDownloadUrl]);

  const handlePeerData = useCallback((packet) => {
    if (typeof packet === 'string') {
      try {
        handleControlMessage(JSON.parse(packet));
      } catch (parseError) {
        console.warn('[ZeroUI MegaDrop] control-parse-failed', parseError);
      }
      return;
    }

    const chunk = toUint8Array(packet);
    const transfer = incomingTransferRef.current;
    if (!chunk || !transfer) {
      return;
    }

    transfer.chunks.push(chunk);
    transfer.receivedBytes += chunk.byteLength;
    setTransferPhase('receiving');
    setTransferProgress(transfer.size > 0 ? Math.min(99, (transfer.receivedBytes / transfer.size) * 100) : 0);
  }, [handleControlMessage]);

  const createPeer = useCallback((initiator) => {
    if (peerRef.current) {
      return peerRef.current;
    }

    if (!webRtcSupported) {
      throw new Error('WebRTC is not supported in this browser');
    }

    const peer = new Peer({
      initiator,
      trickle: true,
      config: { iceServers: ICE_SERVERS },
    });

    peerRef.current = peer;

    peer.on('signal', (signal) => {
      const socket = socketRef.current;
      if (!socket) {
        return;
      }

      socket.emit('megadrop:signal', {
        roomCode: roomIdRef.current,
        signal,
      }, (response) => {
        if (response?.ok === false) {
          console.warn('[ZeroUI MegaDrop] signal-relay-failed', response);
        }
      });
    });

    peer.on('connect', () => {
      setIsConnected(true);
      setError('');
      if (roleRef.current === 'host') {
        setStatusText('Телефон подключен. Начинаем прямую передачу...');
        void sendPreparedFile();
      } else {
        setStatusText('Соединение установлено. Ждем файл от отправителя.');
      }
    });

    peer.on('data', handlePeerData);

    peer.on('close', () => {
      if (peerRef.current === peer) {
        peerRef.current = null;
      }
      setIsConnected(false);
      sendStartedRef.current = false;
      setStatusText(
        roleRef.current === 'host'
          ? 'Соединение закрыто. Можно снова показать QR-код.'
          : 'Соединение завершено. При необходимости откройте ссылку снова.',
      );
    });

    peer.on('error', (peerError) => {
      console.error('[ZeroUI MegaDrop] peer-error', peerError);
      if (peerRef.current === peer) {
        peerRef.current = null;
      }
      setIsConnected(false);
      sendStartedRef.current = false;
      setTransferPhase('error');
      setError('Не удалось удержать прямое соединение. Попробуйте еще раз.');
      setStatusText('P2P-соединение оборвалось.');
      try {
        peer.destroy();
      } catch {
        // noop
      }
    });

    if (pendingSignalsRef.current.length > 0) {
      const queuedSignals = [...pendingSignalsRef.current];
      pendingSignalsRef.current = [];
      queuedSignals.forEach((signal) => {
        try {
          peer.signal(signal);
        } catch (peerError) {
          console.error('[ZeroUI MegaDrop] pending-signal-failed', peerError);
        }
      });
    }

    return peer;
  }, [handlePeerData, sendPreparedFile, webRtcSupported]);

  const ensureSocket = useCallback(() => {
    if (socketRef.current || !socketBase || typeof window === 'undefined') {
      return socketRef.current;
    }

    const socket = io(socketBase, {
      autoConnect: false,
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    const handleConnect = () => {
      setSocketState('connected');
      setError('');
      if (!roomIdRef.current) {
        setStatusText('Сигнальный слой MegaDrop активен.');
      }
    };

    const handleDisconnect = (reason) => {
      setSocketState('disconnected');
      if (reason !== 'io client disconnect') {
        setStatusText('Сигнальный слой переподключается...');
      }
    };

    const handleConnectError = (connectError) => {
      console.error('[ZeroUI MegaDrop] socket-connect-error', connectError);
      setSocketState('error');
      setTransferPhase('error');
      setError('Не удалось подключиться к сигнальному серверу MegaDrop.');
      setStatusText('Socket.io пока недоступен.');
    };

    const handleRoomState = (nextRoomState) => {
      if (!nextRoomState) {
        return;
      }

      const nextRoomId = normalizeRoomCode(nextRoomState.roomCode);
      setRoomId(nextRoomId);
      roomIdRef.current = nextRoomId;
      setShareUrl(buildShareUrl(nextRoomId));

      if (nextRoomState.ready) {
        setTransferPhase((current) => (current === 'complete' ? current : 'connecting'));
        setStatusText(roleRef.current === 'host'
          ? 'Второе устройство в комнате. Инициализируем прямой канал...'
          : 'Отправитель найден. Инициализируем прямой канал...');

        if (!peerRef.current && roleRef.current) {
          try {
            createPeer(roleRef.current === 'host');
          } catch (peerError) {
            console.error('[ZeroUI MegaDrop] peer-init-failed', peerError);
            setTransferPhase('error');
            setError('Не удалось инициализировать WebRTC.');
          }
        }
      } else if (roleRef.current === 'host') {
        setTransferPhase((current) => (current === 'complete' ? current : 'waiting'));
        setStatusText('Комната открыта. Наведите камеру телефона на QR-код.');
      }
    };

    const handleRoomClosed = () => {
      destroyPeer('room_closed');
      resetTransferVisuals();
      setRoomId('');
      roomIdRef.current = '';
      setShareUrl('');
      setRole('');
      roleRef.current = '';
      setError('Сеанс MegaDrop завершен.');
      setStatusText('Комната закрыта. Откройте новый сеанс.');
    };

    const handlePeerLeft = () => {
      destroyPeer('peer_left');
      setTransferPhase((current) => (current === 'complete' ? current : 'waiting'));
      setStatusText('Второе устройство отключилось. QR-код можно показать снова.');
    };

    const handleGuestJoined = () => {
      setStatusText('Телефон вошел в комнату. Запускаем защищенное соединение...');
    };

    const handleSignal = (payload) => {
      if (!payload?.signal) {
        return;
      }

      const peer = peerRef.current;
      if (!peer) {
        pendingSignalsRef.current.push(payload.signal);
        return;
      }

      try {
        peer.signal(payload.signal);
      } catch (signalError) {
        console.error('[ZeroUI MegaDrop] apply-signal-failed', signalError);
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

    socketRef.current = socket;
    return socket;
  }, [createPeer, destroyPeer, resetTransferVisuals, socketBase]);

  const startHosting = useCallback(async (filePayload) => {
    if (!filePayload?.blob) {
      throw new Error('Файл для MegaDrop не подготовлен.');
    }

    if (!webRtcSupported) {
      throw new Error('WebRTC недоступен в этом браузере.');
    }

    outgoingFileRef.current = {
      blob: filePayload.blob,
      fileName: String(filePayload.fileName || 'megadrop-result.bin'),
      mimeType: String(filePayload.mimeType || filePayload.blob.type || 'application/octet-stream'),
    };
    sendStartedRef.current = false;
    resetTransferVisuals();
    updateDownloadUrl('');
    setDownloadName('');
    setIsHosting(true);
    setError('');
    setTransferPhase('opening-room');
    setTransferProgress(0);
    setStatusText('Открываем комнату MegaDrop...');
    destroyPeer('start_hosting');

    try {
      const socket = ensureSocket();
      roleRef.current = 'host';
      setRole('host');
      const connectedSocket = await waitForSocketConnection(socket);
      const response = await emitWithAck(connectedSocket, 'megadrop:create-room', {});
      const nextRoomId = normalizeRoomCode(response.roomCode);
      roomIdRef.current = nextRoomId;
      setRoomId(nextRoomId);
      setShareUrl(buildShareUrl(nextRoomId));
      setTransferPhase('waiting');
      setStatusText('Наведите камеру телефона.');
      return nextRoomId;
    } catch (hostingError) {
      console.error('[ZeroUI MegaDrop] start-hosting-failed', hostingError);
      setTransferPhase('error');
      setError('Не удалось открыть MegaDrop-комнату.');
      setStatusText('Создание комнаты не удалось.');
      throw hostingError;
    } finally {
      setIsHosting(false);
    }
  }, [destroyPeer, ensureSocket, resetTransferVisuals, updateDownloadUrl, webRtcSupported]);

  const joinRoom = useCallback(async (rawRoomCode) => {
    const normalized = normalizeRoomCode(rawRoomCode);
    if (!normalized) {
      throw new Error('Неверный код комнаты.');
    }

    if (!webRtcSupported) {
      throw new Error('WebRTC недоступен в этом браузере.');
    }

    setIsJoining(true);
    resetTransferVisuals();
    updateDownloadUrl('');
    setDownloadName('');
    setError('');
    setTransferPhase('joining');
    setTransferProgress(0);
    setStatusText('Подключаемся к комнате MegaDrop...');
    destroyPeer('join_room');

    try {
      const socket = ensureSocket();
      roleRef.current = 'guest';
      setRole('guest');
      const connectedSocket = await waitForSocketConnection(socket);
      const response = await emitWithAck(connectedSocket, 'megadrop:join-room', { roomCode: normalized });
      const nextRoomId = normalizeRoomCode(response.roomCode);
      roomIdRef.current = nextRoomId;
      setRoomId(nextRoomId);
      setShareUrl(buildShareUrl(nextRoomId));
      setTransferPhase('connecting');
      setStatusText('Комната найдена. Ждем прямое соединение...');
      return nextRoomId;
    } catch (joinError) {
      console.error('[ZeroUI MegaDrop] join-room-failed', joinError);
      setTransferPhase('error');
      setError('Не удалось подключиться к комнате MegaDrop.');
      setStatusText('Подключение к комнате не удалось.');
      throw joinError;
    } finally {
      setIsJoining(false);
    }
  }, [destroyPeer, ensureSocket, resetTransferVisuals, updateDownloadUrl, webRtcSupported]);

  const resetMegaDrop = useCallback(async () => {
    const socket = socketRef.current;

    try {
      if (socket?.connected && roomIdRef.current) {
        await emitWithAck(socket, 'megadrop:leave-room', {});
      }
    } catch (leaveError) {
      console.warn('[ZeroUI MegaDrop] leave-room-failed', leaveError);
    }

    destroyPeer('reset');
    outgoingFileRef.current = null;
    incomingTransferRef.current = null;
    roleRef.current = '';
    roomIdRef.current = '';
    setRole('');
    setRoomId('');
    setShareUrl('');
    setIsHosting(false);
    setIsJoining(false);
    setSocketState('idle');
    setError('');
    setStatusText('MegaDrop готов.');
    resetTransferVisuals();
    updateDownloadUrl('');

    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    }
  }, [destroyPeer, resetTransferVisuals, updateDownloadUrl]);

  useEffect(() => () => {
    destroyPeer('unmount');
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    safeRevokeObjectUrl(downloadUrlRef.current);
  }, [destroyPeer]);

  return {
    webRtcSupported,
    socketState,
    role,
    roomId,
    shareUrl,
    statusText,
    error,
    transferPhase,
    transferProgress,
    downloadUrl,
    downloadName,
    isConnected,
    isComplete: transferPhase === 'complete',
    isHosting,
    isJoining,
    startHosting,
    joinRoom,
    resetMegaDrop,
  };
}
