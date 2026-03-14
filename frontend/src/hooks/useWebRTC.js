import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Peer from 'simple-peer/simplepeer.min.js';
import { io } from 'socket.io-client';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

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

const normalizeRoomId = (value) => String(value || '')
  .trim()
  .replace(/[^a-z0-9_-]+/gi, '')
  .slice(0, 64)
  .toLowerCase();

const normalizeDisplayName = (value) => String(value || '')
  .trim()
  .replace(/\s+/g, ' ')
  .slice(0, 48);

const createMessageId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `message-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const toTextPayload = (packet) => {
  if (typeof packet === 'string') {
    return packet;
  }

  if (packet instanceof ArrayBuffer) {
    return new TextDecoder().decode(new Uint8Array(packet));
  }

  if (ArrayBuffer.isView(packet)) {
    return new TextDecoder().decode(new Uint8Array(packet.buffer, packet.byteOffset, packet.byteLength));
  }

  return '';
};

export default function useWebRTC({
  roomId,
  displayName,
  enabled = true,
}) {
  const socketBase = useMemo(() => resolveRealtimeBase(), []);
  const normalizedRoomId = useMemo(() => normalizeRoomId(roomId), [roomId]);

  const socketRef = useRef(null);
  const peersRef = useRef(new Map());
  const localStreamRef = useRef(null);
  const cameraTrackRef = useRef(null);
  const screenTrackRef = useRef(null);
  const screenStreamRef = useRef(null);
  const normalizedRoomIdRef = useRef(normalizedRoomId);
  const displayNameRef = useRef(normalizeDisplayName(displayName) || 'Guest');
  const audioEnabledRef = useRef(true);
  const videoEnabledRef = useRef(true);
  const screenSharingRef = useRef(false);

  const [localStream, setLocalStream] = useState(null);
  const [peers, setPeers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [connectionState, setConnectionState] = useState('idle');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    normalizedRoomIdRef.current = normalizedRoomId;
  }, [normalizedRoomId]);

  useEffect(() => {
    displayNameRef.current = normalizeDisplayName(displayName) || 'Guest';
  }, [displayName]);

  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);

  useEffect(() => {
    videoEnabledRef.current = videoEnabled;
  }, [videoEnabled]);

  useEffect(() => {
    screenSharingRef.current = screenSharing;
  }, [screenSharing]);

  const publishPeersSnapshot = useCallback(() => {
    const nextPeers = Array.from(peersRef.current.values())
      .map((entry) => {
        const { peer: _peer, ...snapshot } = entry;
        return snapshot;
      })
      .sort((left, right) => left.socketId.localeCompare(right.socketId));

    setPeers(nextPeers);
  }, []);

  const stopScreenShare = useCallback(() => {
    const screenTrack = screenTrackRef.current;
    if (!screenTrack) {
      return;
    }

    screenTrack.onended = null;
    try {
      screenTrack.stop();
    } catch {
      // ignore track stop failures
    }

    screenTrackRef.current = null;

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        if (track !== screenTrack) {
          try {
            track.stop();
          } catch {
            // ignore stop failures
          }
        }
      });
    }

    screenStreamRef.current = null;
  }, []);

  const broadcastPayload = useCallback((payload) => {
    const serialized = JSON.stringify(payload);

    for (const entry of peersRef.current.values()) {
      if (!entry.connected) {
        continue;
      }

      try {
        entry.peer.send(serialized);
      } catch (sendError) {
        console.warn('[MegaMeet] peer-send-failed', entry.socketId, sendError);
      }
    }
  }, []);

  const announceLocalMediaState = useCallback(() => {
    broadcastPayload({
      type: 'media-state',
      displayName: displayNameRef.current,
      audioEnabled: audioEnabledRef.current,
      videoEnabled: videoEnabledRef.current,
      screenSharing: screenSharingRef.current,
    });
  }, [broadcastPayload]);

  const destroyPeer = useCallback((socketId, reason = 'manual') => {
    const entry = peersRef.current.get(socketId);
    if (!entry) {
      return;
    }

    peersRef.current.delete(socketId);
    publishPeersSnapshot();

    try {
      entry.peer.removeAllListeners?.();
    } catch {
      // ignore listener cleanup failures
    }

    try {
      entry.peer.destroy();
    } catch {
      // ignore destroy failures
    }

    console.warn('[MegaMeet] peer-destroyed', socketId, reason);
  }, [publishPeersSnapshot]);

  const destroyAllPeers = useCallback((reason = 'manual') => {
    for (const socketId of peersRef.current.keys()) {
      destroyPeer(socketId, reason);
    }
  }, [destroyPeer]);

  const handlePeerData = useCallback((socketId, packet) => {
    const payloadText = toTextPayload(packet);
    if (!payloadText) {
      return;
    }

    let payload;
    try {
      payload = JSON.parse(payloadText);
    } catch (parseError) {
      console.warn('[MegaMeet] peer-data-parse-failed', socketId, parseError);
      return;
    }

    if (payload?.type === 'chat' && typeof payload.text === 'string' && payload.text.trim()) {
      const peerEntry = peersRef.current.get(socketId);
      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          side: 'left',
          author: String(payload.senderName || peerEntry?.displayName || 'Guest').trim() || 'Guest',
          text: payload.text.trim(),
        },
      ]);
      return;
    }

    if (payload?.type === 'media-state') {
      const peerEntry = peersRef.current.get(socketId);
      if (!peerEntry) {
        return;
      }

      peerEntry.displayName = String(payload.displayName || peerEntry.displayName || 'Guest').trim() || 'Guest';
      peerEntry.audioEnabled = payload.audioEnabled !== false;
      peerEntry.videoEnabled = payload.videoEnabled !== false;
      peerEntry.screenSharing = payload.screenSharing === true;
      publishPeersSnapshot();
    }
  }, [publishPeersSnapshot]);

  const createPeer = useCallback((socketId, options = {}) => {
    const existingPeer = peersRef.current.get(socketId);
    if (existingPeer) {
      if (options.displayName) {
        existingPeer.displayName = options.displayName;
        publishPeersSnapshot();
      }
      return existingPeer.peer;
    }

    const stream = localStreamRef.current;
    if (!stream) {
      return null;
    }

    const peer = new Peer({
      initiator: options.initiator === true,
      trickle: true,
      stream,
      config: {
        iceServers: ICE_SERVERS,
      },
    });

    const peerEntry = {
      socketId,
      peer,
      displayName: String(options.displayName || 'Guest').trim() || 'Guest',
      stream: null,
      connected: false,
      audioEnabled: true,
      videoEnabled: true,
      screenSharing: false,
    };

    peersRef.current.set(socketId, peerEntry);
    publishPeersSnapshot();

    peer.on('signal', (signal) => {
      const socket = socketRef.current;
      if (!socket || !normalizedRoomIdRef.current) {
        return;
      }

      socket.emit('signal', {
        roomId: normalizedRoomIdRef.current,
        targetSocketId: socketId,
        signal,
      });
    });

    peer.on('stream', (remoteStream) => {
      const currentEntry = peersRef.current.get(socketId);
      if (!currentEntry) {
        return;
      }

      currentEntry.stream = remoteStream;
      publishPeersSnapshot();
    });

    peer.on('connect', () => {
      const currentEntry = peersRef.current.get(socketId);
      if (!currentEntry) {
        return;
      }

      currentEntry.connected = true;
      publishPeersSnapshot();
      announceLocalMediaState();
    });

    peer.on('data', (packet) => {
      handlePeerData(socketId, packet);
    });

    peer.on('close', () => {
      destroyPeer(socketId, 'close');
    });

    peer.on('error', (peerError) => {
      console.warn('[MegaMeet] peer-error', socketId, peerError);
      destroyPeer(socketId, 'error');
    });

    return peer;
  }, [announceLocalMediaState, destroyPeer, handlePeerData, publishPeersSnapshot]);

  const teardownConnection = useCallback((resetState = true) => {
    const socket = socketRef.current;
    if (socket && normalizedRoomIdRef.current) {
      socket.emit('leave-meet-room', {
        roomId: normalizedRoomIdRef.current,
      });
      socket.disconnect();
      socket.removeAllListeners();
      socketRef.current = null;
    }

    destroyAllPeers('leave_room');

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore track stop failures
        }
      });
      localStreamRef.current = null;
    }

    stopScreenShare();
    cameraTrackRef.current = null;
    audioEnabledRef.current = true;
    videoEnabledRef.current = true;
    screenSharingRef.current = false;

    if (resetState) {
      setLocalStream(null);
      setPeers([]);
      setMessages([]);
      setAudioEnabled(true);
      setVideoEnabled(true);
      setScreenSharing(false);
      setConnectionState('idle');
      setError('');
    }
  }, [destroyAllPeers, stopScreenShare]);

  const leaveRoom = useCallback(() => {
    teardownConnection(true);
  }, [teardownConnection]);

  const restoreCameraTrack = useCallback(() => {
    const stream = localStreamRef.current;
    const cameraTrack = cameraTrackRef.current;
    const screenTrack = screenTrackRef.current;
    if (!stream || !cameraTrack || !screenTrack) {
      return;
    }

    for (const entry of peersRef.current.values()) {
      try {
        entry.peer.replaceTrack(screenTrack, cameraTrack, stream);
      } catch (replaceError) {
        console.warn('[MegaMeet] restore-camera-track-failed', entry.socketId, replaceError);
      }
    }

    try {
      stream.removeTrack(screenTrack);
    } catch {
      // ignore remove track failures
    }

    if (!stream.getVideoTracks().includes(cameraTrack)) {
      stream.addTrack(cameraTrack);
    }

    cameraTrack.enabled = videoEnabledRef.current;
    screenSharingRef.current = false;
    stopScreenShare();
    setScreenSharing(false);
    announceLocalMediaState();
  }, [announceLocalMediaState, stopScreenShare]);

  const toggleAudio = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) {
      return;
    }

    const nextEnabled = !audioEnabledRef.current;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = nextEnabled;
    });

    audioEnabledRef.current = nextEnabled;
    setAudioEnabled(nextEnabled);
    announceLocalMediaState();
  }, [announceLocalMediaState]);

  const toggleVideo = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) {
      return;
    }

    const nextEnabled = !videoEnabledRef.current;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = nextEnabled;
    });

    videoEnabledRef.current = nextEnabled;
    setVideoEnabled(nextEnabled);
    announceLocalMediaState();
  }, [announceLocalMediaState]);

  const shareScreen = useCallback(async () => {
    if (screenTrackRef.current) {
      restoreCameraTrack();
      return true;
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      return false;
    }

    const stream = localStreamRef.current;
    const cameraTrack = cameraTrackRef.current;
    if (!stream || !cameraTrack) {
      return false;
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      const screenTrack = displayStream.getVideoTracks()[0];
      if (!screenTrack) {
        return false;
      }

      screenTrack.enabled = videoEnabledRef.current;
      screenTrack.onended = () => {
        restoreCameraTrack();
      };

      for (const entry of peersRef.current.values()) {
        try {
          entry.peer.replaceTrack(cameraTrack, screenTrack, stream);
        } catch (replaceError) {
          console.warn('[MegaMeet] share-screen-track-failed', entry.socketId, replaceError);
        }
      }

      try {
        stream.removeTrack(cameraTrack);
      } catch {
        // ignore remove track failures
      }

      if (!stream.getVideoTracks().includes(screenTrack)) {
        stream.addTrack(screenTrack);
      }

      screenTrackRef.current = screenTrack;
      screenStreamRef.current = displayStream;
      screenSharingRef.current = true;
      setScreenSharing(true);
      announceLocalMediaState();
      return true;
    } catch (shareError) {
      console.warn('[MegaMeet] share-screen-failed', shareError);
      return false;
    }
  }, [announceLocalMediaState, restoreCameraTrack]);

  const sendSecureMessage = useCallback((text) => {
    const trimmed = String(text || '').trim();
    if (!trimmed) {
      return false;
    }

    const payload = {
      type: 'chat',
      text: trimmed,
      senderName: displayNameRef.current,
    };

    broadcastPayload(payload);
    setMessages((current) => [
      ...current,
      {
        id: createMessageId(),
        side: 'right',
        author: displayNameRef.current,
        text: trimmed,
      },
    ]);
    return true;
  }, [broadcastPayload]);

  useEffect(() => {
    if (!enabled || !normalizedRoomId) {
      return undefined;
    }

    let active = true;

    const socket = io(socketBase, {
      autoConnect: false,
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    const setupRoom = async () => {
      try {
        setError('');
        setConnectionState('connecting');

        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        localStreamRef.current = stream;
        cameraTrackRef.current = stream.getVideoTracks()[0] || null;
        audioEnabledRef.current = (stream.getAudioTracks()[0]?.enabled ?? true) !== false;
        videoEnabledRef.current = (stream.getVideoTracks()[0]?.enabled ?? true) !== false;
        setLocalStream(stream);
        setAudioEnabled(audioEnabledRef.current);
        setVideoEnabled(videoEnabledRef.current);

        socket.on('connect', () => {
          setConnectionState('joining');
          socket.emit('join-meet-room', {
            roomId: normalizedRoomIdRef.current,
            displayName: displayNameRef.current,
          }, (response) => {
            if (response?.ok === false) {
              setError(String(response?.message || 'Unable to join room.'));
              setConnectionState('error');
              return;
            }

            setConnectionState('joined');
          });
        });

        socket.on('connect_error', (connectError) => {
          console.warn('[MegaMeet] socket-connect-error', connectError);
          setError(connectError?.message || 'Unable to connect to the signaling server.');
          setConnectionState('error');
        });

        socket.on('disconnect', () => {
          setConnectionState('disconnected');
        });

        socket.on('user-connected', (payload) => {
          const remoteSocketId = String(payload?.socketId || '').trim();
          if (!remoteSocketId || remoteSocketId === socket.id) {
            return;
          }

          createPeer(remoteSocketId, {
            initiator: true,
            displayName: String(payload?.displayName || '').trim() || 'Guest',
          });
        });

        socket.on('signal', (payload) => {
          const remoteSocketId = String(payload?.fromSocketId || '').trim();
          if (!remoteSocketId || remoteSocketId === socket.id || !payload?.signal) {
            return;
          }

          const peer = createPeer(remoteSocketId, {
            initiator: false,
            displayName: String(payload?.fromDisplayName || '').trim() || 'Guest',
          });

          try {
            peer?.signal(payload.signal);
          } catch (signalError) {
            console.warn('[MegaMeet] apply-signal-failed', remoteSocketId, signalError);
          }
        });

        socket.on('user-disconnected', (payload) => {
          const remoteSocketId = String(payload?.socketId || '').trim();
          if (!remoteSocketId) {
            return;
          }

          destroyPeer(remoteSocketId, 'user_disconnected');
        });

        socket.connect();
      } catch (mediaError) {
        console.warn('[MegaMeet] media-capture-failed', mediaError);
        setError(mediaError?.message || 'Unable to access camera or microphone.');
        setConnectionState('error');
      }
    };

    void setupRoom();

    return () => {
      active = false;
      socket.removeAllListeners();
      teardownConnection(false);
    };
  }, [createPeer, destroyPeer, enabled, normalizedRoomId, socketBase, teardownConnection]);

  useEffect(() => {
    if (connectionState !== 'joined') {
      return;
    }

    announceLocalMediaState();
  }, [announceLocalMediaState, connectionState, displayName]);

  return {
    connectionState,
    error,
    localStream,
    peers,
    messages,
    audioEnabled,
    videoEnabled,
    screenSharing,
    toggleAudio,
    toggleVideo,
    shareScreen,
    sendSecureMessage,
    leaveRoom,
  };
}
