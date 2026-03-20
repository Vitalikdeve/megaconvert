import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import {
  mediaDevices,
  MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  registerGlobals,
} from 'react-native-webrtc';

import { toast } from '@/src/utils/toast';

registerGlobals();

type CallState = 'idle' | 'connecting' | 'joined' | 'disconnected' | 'error';

type UseMegaMeetCallInput = {
  roomId: string;
  displayName: string;
  enableVideoByDefault: boolean;
};

type UseMegaMeetCallResult = {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  remoteDisplayName: string;
  micEnabled: boolean;
  cameraEnabled: boolean;
  callState: CallState;
  errorMessage: string | null;
  toggleMic: () => void;
  toggleCamera: () => void;
  endCall: () => void;
};

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];
const ALPHA_SIGNALING_FALLBACK_URL = 'https://35.202.253.153.nip.io';

function normalizeRoomId(value: string): string {
  return String(value || '')
    .trim()
    .replace(/[^a-z0-9_-]+/gi, '')
    .slice(0, 64)
    .toLowerCase();
}

function normalizeDisplayName(value: string): string {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 48);
}

function normalizeSignalingBase(value: string): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return '';
  }

  try {
    const parsed = new URL(trimmed);
    parsed.pathname = parsed.pathname.replace(/\/+$/g, '');
    if (parsed.pathname === '/api') {
      parsed.pathname = '';
    }
    return parsed.toString().replace(/\/+$/g, '');
  } catch {
    return trimmed.replace(/\/+$/g, '');
  }
}

function stopMediaStream(stream: MediaStream | null) {
  if (!stream) {
    return;
  }

  stream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // ignore track stop errors
    }
  });

  try {
    stream.release();
  } catch {
    // ignore stream release errors
  }
}

function showPermissionAlert() {
  Alert.alert('Нужен доступ к камере', 'Для звонка необходим доступ к камере.');
}

function isPermissionDeniedError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalized = error.message.trim().toLowerCase();
  return (
    normalized.includes('permission') ||
    normalized.includes('denied') ||
    normalized.includes('notallowed') ||
    normalized.includes('security') ||
    normalized.includes('media_permission_denied')
  );
}

async function requestAndroidMediaPermissions(needCamera: boolean) {
  if (Platform.OS !== 'android') {
    return;
  }

  const permissionList = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  if (needCamera) {
    permissionList.push(PermissionsAndroid.PERMISSIONS.CAMERA);
  }

  const result = await PermissionsAndroid.requestMultiple(permissionList);
  const denied = permissionList.find((permission) => result[permission] !== PermissionsAndroid.RESULTS.GRANTED);
  if (denied) {
    throw new Error('MEDIA_PERMISSION_DENIED');
  }
}

export function useMegaMeetCall({
  roomId,
  displayName,
  enableVideoByDefault,
}: UseMegaMeetCallInput): UseMegaMeetCallResult {
  const signalingUrl = useMemo(
    () =>
      // fallback URL - GCP signaling server (35.202.253.153.nip.io)
      normalizeSignalingBase(process.env.EXPO_PUBLIC_SIGNALING_URL || ALPHA_SIGNALING_FALLBACK_URL) ||
      ALPHA_SIGNALING_FALLBACK_URL,
    []
  );
  const normalizedRoomId = useMemo(() => normalizeRoomId(roomId), [roomId]);
  const normalizedDisplayName = useMemo(() => normalizeDisplayName(displayName) || 'Guest', [displayName]);

  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const roomIdRef = useRef(normalizedRoomId);
  const mountedRef = useRef(true);
  const reconnectToastShownRef = useRef(false);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remoteDisplayName, setRemoteDisplayName] = useState<string>('Собеседник');
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(enableVideoByDefault);
  const [callState, setCallState] = useState<CallState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    roomIdRef.current = normalizedRoomId;
  }, [normalizedRoomId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const pickFirstRemoteStream = useCallback(() => {
    const first = remoteStreamsRef.current.values().next();
    setRemoteStream(first.done ? null : first.value);
  }, []);

  const removePeer = useCallback(
    (socketId: string) => {
      const peer = peersRef.current.get(socketId);
      if (peer) {
        try {
          peer.close();
        } catch {
          // ignore peer close errors
        }
        peersRef.current.delete(socketId);
      }

      remoteStreamsRef.current.delete(socketId);
      pickFirstRemoteStream();
    },
    [pickFirstRemoteStream]
  );

  const emitSignal = useCallback((targetSocketId: string, signal: unknown) => {
    const socket = socketRef.current;
    if (!socket || !roomIdRef.current || !targetSocketId) {
      return;
    }

        socket.emit(
      'signal',
      {
        roomId: roomIdRef.current,
        targetSocketId,
        signal,
      },
      (response: { ok?: boolean; message?: string } | undefined) => {
        if (response?.ok === false) {
          console.error('[mobile-call] signal rejected:', response.message);
        }
      }
    );
  }, []);

  const createPeerConnection = useCallback(
    (socketId: string, initialDisplayName?: string) => {
      const existing = peersRef.current.get(socketId);
      if (existing) {
        if (initialDisplayName) {
          setRemoteDisplayName(initialDisplayName);
        }
        return existing;
      }

      const peer = new RTCPeerConnection({
        iceServers: ICE_SERVERS,
      });

      const stream = localStreamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => {
          peer.addTrack(track, stream);
        });
      }

      const peerEventBridge = peer as RTCPeerConnection & {
        onicecandidate?: (event: { candidate?: RTCIceCandidate & { toJSON?: () => unknown } }) => void;
        ontrack?: (event: { streams?: MediaStream[] }) => void;
        onconnectionstatechange?: () => void;
      };

      peerEventBridge.onicecandidate = (event) => {
        if (!event.candidate) {
          return;
        }
        emitSignal(
          socketId,
          typeof event.candidate.toJSON === 'function' ? event.candidate.toJSON() : event.candidate
        );
      };

      peerEventBridge.ontrack = (event) => {
        const streamFromEvent = event.streams?.[0];
        if (!streamFromEvent) {
          return;
        }
        remoteStreamsRef.current.set(socketId, streamFromEvent);
        setRemoteStream(streamFromEvent);
      };

      peerEventBridge.onconnectionstatechange = () => {
        if (peer.connectionState === 'failed' || peer.connectionState === 'closed') {
          removePeer(socketId);
        }
      };

      peersRef.current.set(socketId, peer);
      if (initialDisplayName) {
        setRemoteDisplayName(initialDisplayName);
      }
      return peer;
    },
    [emitSignal, removePeer]
  );

  const applyIncomingSignal = useCallback(
    async (
      fromSocketId: string,
      signal: {
        type?: string;
        sdp?: string;
        candidate?: string;
        sdpMid?: string | null;
        sdpMLineIndex?: number | null;
      },
      senderName?: string
    ) => {
      if (!fromSocketId || !signal) {
        return;
      }

      const peer = createPeerConnection(fromSocketId, senderName);
      if (!peer) {
        return;
      }

      if (signal.type === 'offer' || signal.type === 'answer') {
        if (!signal.sdp) {
          return;
        }
        await peer.setRemoteDescription(
          new RTCSessionDescription({
            type: signal.type,
            sdp: signal.sdp,
          })
        );
        if (signal.type === 'offer') {
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          emitSignal(fromSocketId, answer);
        }
        return;
      }

      if (signal.candidate) {
        await peer.addIceCandidate(new RTCIceCandidate(signal));
      }
    },
    [createPeerConnection, emitSignal]
  );

  const createOfferForPeer = useCallback(
    async (socketId: string, senderName?: string) => {
      const peer = createPeerConnection(socketId, senderName);
      if (!peer) {
        return;
      }
      const offer = await peer.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await peer.setLocalDescription(offer);
      emitSignal(socketId, offer);
    },
    [createPeerConnection, emitSignal]
  );

  const cleanupCall = useCallback(
    (notifyServer: boolean) => {
      const socket = socketRef.current;
      if (socket && notifyServer && roomIdRef.current) {
        socket.emit('leave-meet-room', { roomId: roomIdRef.current });
      }

      if (socket) {
        socket.removeAllListeners();
        socket.io.removeAllListeners();
        socket.disconnect();
        socketRef.current = null;
      }

      for (const [socketId, peer] of peersRef.current.entries()) {
        try {
          peer.close();
        } catch {
          // ignore close errors
        }
        peersRef.current.delete(socketId);
      }

      remoteStreamsRef.current.clear();
      setRemoteStream(null);
      stopMediaStream(localStreamRef.current);
      localStreamRef.current = null;
      setLocalStream(null);
    },
    []
  );

  useEffect(() => {
    if (!normalizedRoomId) {
      setCallState('error');
      setErrorMessage('Идентификатор комнаты звонка не задан.');
      return;
    }

    let cancelled = false;

    const initialize = async () => {
      setCallState('connecting');
      setErrorMessage(null);

      try {
        await requestAndroidMediaPermissions(enableVideoByDefault);
      } catch {
        showPermissionAlert();
        setCallState('error');
        setErrorMessage('Для звонка необходим доступ к камере.');
        return;
      }

      try {
        const stream = await mediaDevices.getUserMedia({
          audio: true,
          video: enableVideoByDefault
            ? {
                facingMode: 'user',
              }
            : false,
        });

        if (cancelled || !mountedRef.current) {
          stopMediaStream(stream);
          return;
        }

        localStreamRef.current = stream;
        setLocalStream(stream);
        setMicEnabled(stream.getAudioTracks()[0]?.enabled !== false);
        setCameraEnabled(stream.getVideoTracks()[0]?.enabled !== false);

        const socket = io(signalingUrl, {
          autoConnect: false,
          transports: ['websocket', 'polling'],
          withCredentials: true,
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 900,
          reconnectionDelayMax: 2500,
        });
        socketRef.current = socket;

        socket.on('connect', () => {
          reconnectToastShownRef.current = false;
          socket.emit(
            'join-meet-room',
            {
              roomId: roomIdRef.current,
              displayName: normalizedDisplayName,
            },
            (response: { ok?: boolean; message?: string } | undefined) => {
              if (response?.ok === false) {
                setCallState('error');
                setErrorMessage('Не удалось подключиться к комнате звонка.');
                return;
              }

              setCallState('joined');
            }
          );
        });

        socket.on('connect_error', () => {
          if (!mountedRef.current) {
            return;
          }

          setCallState('connecting');
          setErrorMessage('Соединение с сервером звонков нестабильно. Выполняется переподключение...');

          if (!reconnectToastShownRef.current) {
            reconnectToastShownRef.current = true;
            toast.info('Соединение потеряно, переподключение...');
          }
        });

        socket.on(
          'user-connected',
          (payload: { socketId?: string; displayName?: string } | undefined) => {
            const remoteSocketId = String(payload?.socketId || '').trim();
            if (!remoteSocketId || remoteSocketId === socket.id) {
              return;
            }

            void createOfferForPeer(remoteSocketId, payload?.displayName);
          }
        );

        socket.on(
          'signal',
          (payload: {
            fromSocketId?: string;
            fromDisplayName?: string;
            signal?: {
              type?: string;
              sdp?: string;
              candidate?: string;
              sdpMid?: string | null;
              sdpMLineIndex?: number | null;
            };
          }) => {
            const fromSocketId = String(payload?.fromSocketId || '').trim();
            if (!fromSocketId || !payload?.signal) {
              return;
            }
            void applyIncomingSignal(fromSocketId, payload.signal, payload.fromDisplayName);
          }
        );

        socket.on('user-disconnected', (payload: { socketId?: string } | undefined) => {
          const remoteSocketId = String(payload?.socketId || '').trim();
          if (!remoteSocketId) {
            return;
          }
          removePeer(remoteSocketId);
        });

        socket.on('disconnect', (reason) => {
          if (mountedRef.current) {
            if (reason === 'io client disconnect') {
              setCallState('disconnected');
              return;
            }

            setCallState('connecting');
            setErrorMessage('Соединение потеряно. Пытаемся восстановить звонок...');
            if (!reconnectToastShownRef.current) {
              reconnectToastShownRef.current = true;
              toast.info('Соединение потеряно, переподключение...');
            }
            socket.connect();
          }
        });

        socket.io.on('reconnect_attempt', () => {
          if (!mountedRef.current) {
            return;
          }
          setCallState('connecting');
          setErrorMessage('Соединение потеряно. Пытаемся восстановить звонок...');
          if (!reconnectToastShownRef.current) {
            reconnectToastShownRef.current = true;
            toast.info('Соединение потеряно, переподключение...');
          }
        });

        socket.io.on('reconnect', () => {
          if (!mountedRef.current) {
            return;
          }
          reconnectToastShownRef.current = false;
          setCallState('joined');
          setErrorMessage(null);
          toast.success('Соединение восстановлено');
        });

        socket.io.on('reconnect_failed', () => {
          if (!mountedRef.current) {
            return;
          }
          reconnectToastShownRef.current = false;
          setCallState('error');
          setErrorMessage('Не удалось переподключиться к звонку. Проверьте интернет и попробуйте снова.');
          toast.error('Не удалось переподключиться к серверу звонков');
        });

        socket.connect();
      } catch (error) {
        if (isPermissionDeniedError(error)) {
          showPermissionAlert();
          setCallState('error');
          setErrorMessage('Для звонка необходим доступ к камере.');
          return;
        }

        setCallState('error');
        setErrorMessage('Ошибка доступа к камере или микрофону.');
      }
    };

    void initialize();

    return () => {
      cancelled = true;
      cleanupCall(true);
    };
  }, [
    applyIncomingSignal,
    cleanupCall,
    createOfferForPeer,
    enableVideoByDefault,
    normalizedDisplayName,
    normalizedRoomId,
    removePeer,
    signalingUrl,
  ]);

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) {
      return;
    }

    const nextState = !micEnabled;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = nextState;
    });
    setMicEnabled(nextState);
  }, [micEnabled]);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) {
      return;
    }

    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) {
      return;
    }

    const nextState = !cameraEnabled;
    videoTracks.forEach((track) => {
      track.enabled = nextState;
    });
    setCameraEnabled(nextState);
  }, [cameraEnabled]);

  const endCall = useCallback(() => {
    cleanupCall(true);
    setCallState('disconnected');
  }, [cleanupCall]);

  return {
    localStream,
    remoteStream,
    remoteDisplayName,
    micEnabled,
    cameraEnabled,
    callState,
    errorMessage,
    toggleMic,
    toggleCamera,
    endCall,
  };
}
