import { AnimatePresence, motion } from 'framer-motion';
import {
  LoaderCircle,
  Mic,
  MicOff,
  PhoneOff,
  Video,
  VideoOff,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { socket } from '../services/socket.js';
import IncomingCallModal from './IncomingCallModal.jsx';

const MotionDiv = motion.div;

const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

const createCallId = () => `call-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

const getCallDescription = (payload) =>
  payload?.description ?? payload?.offer ?? payload?.answer ?? null;

const getReadableError = (error, fallbackMessage) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
};

const createAvatarFallback = (value) =>
  String(value || '?').trim().slice(0, 1).toUpperCase() || '?';

const resolveAvatarToken = (avatar, fallbackName) => {
  const rawAvatar = String(avatar || '').trim();
  return rawAvatar || createAvatarFallback(fallbackName);
};

export default function VideoCall({ activeChat, currentUser }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const activeCallRef = useRef(null);
  const incomingCallRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const callPhaseRef = useRef('idle');

  const [callPhase, setCallPhase] = useState('idle');
  const [callError, setCallError] = useState('');
  const [incomingCall, setIncomingCall] = useState(null);
  const [remoteParticipant, setRemoteParticipant] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);

  const currentUserId = String(currentUser?.userId || '');
  const currentCallerAvatar = useMemo(
    () =>
      resolveAvatarToken(
        currentUser?.avatar ?? currentUser?.avatarUrl,
        currentUser?.username
      ),
    [currentUser?.avatar, currentUser?.avatarUrl, currentUser?.username]
  );

  const canCallActiveChat = Boolean(
    activeChat &&
      !activeChat.isSavedMessages &&
      activeChat.userId &&
      String(activeChat.userId).trim()
  );

  const displayParticipantName = useMemo(() => {
    if (remoteParticipant?.name) {
      return remoteParticipant.name;
    }

    if (incomingCall?.callerName) {
      return incomingCall.callerName;
    }

    if (activeChat?.displayName) {
      return activeChat.displayName;
    }

    return 'Unknown contact';
  }, [activeChat?.displayName, incomingCall?.callerName, remoteParticipant?.name]);

  useEffect(() => {
    callPhaseRef.current = callPhase;
  }, [callPhase]);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream ?? null;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream ?? null;
    }
  }, [remoteStream]);

  const stopLocalStream = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setIsMuted(false);
    setIsCameraEnabled(true);
  }, []);

  const stopRemoteStream = useCallback(() => {
    remoteStreamRef.current?.getTracks().forEach((track) => track.stop());
    remoteStreamRef.current = null;
    setRemoteStream(null);
  }, []);

  const destroyPeerConnection = useCallback(() => {
    const connection = peerConnectionRef.current;
    if (!connection) {
      return;
    }

    connection.onicecandidate = null;
    connection.ontrack = null;
    connection.onconnectionstatechange = null;
    connection.close();
    peerConnectionRef.current = null;
  }, []);

  const emitPeerSignal = useCallback(
    (eventName, payload) => {
      const targetUserId = String(payload?.toUserId || '').trim();
      const callId = String(payload?.callId || '').trim();

      if (!targetUserId || !callId) {
        return;
      }

      socket.emit(eventName, {
        ...payload,
        callId,
        toUserId: targetUserId,
        fromUserId: currentUserId,
        fromUsername: currentUser.username,
        callerName: payload?.callerName ?? currentUser.username,
        callerAvatar: payload?.callerAvatar ?? currentCallerAvatar,
        createdAt: payload?.createdAt ?? new Date().toISOString(),
      });
    },
    [currentCallerAvatar, currentUser.username, currentUserId]
  );

  const emitEndCall = useCallback(
    ({ callId, chatId, toUserId, reason = 'ended' }) => {
      emitPeerSignal('end-call', {
        callId,
        chatId,
        toUserId,
        reason,
      });
    },
    [emitPeerSignal]
  );

  const resetCallSession = useCallback(
    ({ shouldEmitEnd = false, reason = 'ended', preserveError = false } = {}) => {
      const activeCall = activeCallRef.current;
      const pendingIncoming = incomingCallRef.current;

      if (shouldEmitEnd) {
        emitEndCall({
          callId: activeCall?.callId ?? pendingIncoming?.callId,
          chatId: activeCall?.chatId ?? pendingIncoming?.chatId,
          toUserId: activeCall?.peerUserId ?? pendingIncoming?.fromUserId,
          reason,
        });
      }

      pendingIceCandidatesRef.current = [];
      activeCallRef.current = null;
      setIncomingCall(null);
      setRemoteParticipant(null);
      setCallPhase('idle');
      if (!preserveError) {
        setCallError('');
      }

      destroyPeerConnection();
      stopRemoteStream();
      stopLocalStream();
    },
    [destroyPeerConnection, emitEndCall, stopLocalStream, stopRemoteStream]
  );

  const ensureLocalStream = useCallback(async () => {
    if (
      localStreamRef.current &&
      localStreamRef.current.getTracks().some((track) => track.readyState === 'live')
    ) {
      return localStreamRef.current;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera access is not available in this browser.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });

    localStreamRef.current = stream;
    setLocalStream(stream);
    setIsMuted(stream.getAudioTracks().every((track) => !track.enabled));
    setIsCameraEnabled(stream.getVideoTracks().every((track) => track.enabled));
    return stream;
  }, []);

  const ensureRemoteMediaStream = useCallback(() => {
    if (remoteStreamRef.current) {
      return remoteStreamRef.current;
    }

    const stream = new MediaStream();
    remoteStreamRef.current = stream;
    setRemoteStream(stream);
    return stream;
  }, []);

  const createPeerConnection = useCallback(
    ({ callId, chatId, peerUserId, peerName, peerAvatar }) => {
      if (peerConnectionRef.current) {
        return peerConnectionRef.current;
      }

      const connection = new RTCPeerConnection(configuration);

      activeCallRef.current = {
        ...(activeCallRef.current ?? {}),
        callId,
        chatId,
        peerUserId: String(peerUserId),
        peerName,
        peerAvatar,
      };

      setRemoteParticipant({
        id: String(peerUserId),
        name: peerName,
        avatar: peerAvatar,
      });

      connection.ontrack = (event) => {
        const targetStream = ensureRemoteMediaStream();
        const tracks = event.streams?.[0]?.getTracks?.() ?? [event.track];

        tracks.forEach((track) => {
          const alreadyAttached = targetStream
            .getTracks()
            .some((existingTrack) => existingTrack.id === track.id);

          if (!alreadyAttached) {
            targetStream.addTrack(track);
          }
        });

        setRemoteStream(targetStream);
      };

      connection.onicecandidate = (event) => {
        if (!event.candidate || !activeCallRef.current) {
          return;
        }

        emitPeerSignal('ice-candidate', {
          callId: activeCallRef.current.callId,
          chatId: activeCallRef.current.chatId,
          toUserId: activeCallRef.current.peerUserId,
          candidate:
            typeof event.candidate.toJSON === 'function'
              ? event.candidate.toJSON()
              : event.candidate,
        });
      };

      connection.onconnectionstatechange = () => {
        if (connection.connectionState === 'connected') {
          setCallPhase('connected');
          return;
        }

        if (
          connection.connectionState === 'connecting' ||
          connection.connectionState === 'new'
        ) {
          setCallPhase((currentPhase) =>
            currentPhase === 'requesting-media' || currentPhase === 'calling'
              ? 'connecting'
              : currentPhase
          );
          return;
        }

        if (
          connection.connectionState === 'disconnected' ||
          connection.connectionState === 'failed'
        ) {
          setCallError('Call connection was lost.');
          resetCallSession({ shouldEmitEnd: false, preserveError: true });
        }
      };

      peerConnectionRef.current = connection;
      return connection;
    },
    [emitPeerSignal, ensureRemoteMediaStream, resetCallSession]
  );

  const addLocalTracks = useCallback((connection, stream) => {
    const existingTrackIds = new Set(
      connection
        .getSenders()
        .map((sender) => sender.track?.id)
        .filter(Boolean)
    );

    stream.getTracks().forEach((track) => {
      if (!existingTrackIds.has(track.id)) {
        connection.addTrack(track, stream);
      }
    });
  }, []);

  const flushPendingIceCandidates = useCallback(async (connection) => {
    if (!pendingIceCandidatesRef.current.length) {
      return;
    }

    const queuedCandidates = [...pendingIceCandidatesRef.current];
    pendingIceCandidatesRef.current = [];

    for (const candidate of queuedCandidates) {
      try {
        await connection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Ignore malformed or stale ICE candidates.
      }
    }
  }, []);

  const startOutgoingOffer = useCallback(async () => {
    const activeCall = activeCallRef.current;
    if (
      !activeCall ||
      activeCall.direction !== 'outgoing' ||
      activeCall.offerSent
    ) {
      return;
    }

    if (typeof RTCPeerConnection === 'undefined') {
      setCallError('WebRTC is not supported in this browser.');
      resetCallSession({ shouldEmitEnd: false, preserveError: true });
      return;
    }

    activeCallRef.current = {
      ...activeCall,
      offerSent: true,
      accepted: true,
    };

    setCallError('');
    setCallPhase('requesting-media');

    try {
      const stream = await ensureLocalStream();
      const connection = createPeerConnection({
        callId: activeCall.callId,
        chatId: activeCall.chatId,
        peerUserId: activeCall.peerUserId,
        peerName: activeCall.peerName,
        peerAvatar: activeCall.peerAvatar,
      });

      addLocalTracks(connection, stream);

      const offer = await connection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await connection.setLocalDescription(offer);

      emitPeerSignal('call-offer', {
        callId: activeCall.callId,
        chatId: activeCall.chatId,
        toUserId: activeCall.peerUserId,
        description: offer,
        offer,
      });

      setCallPhase('connecting');
    } catch (error) {
      setCallError(getReadableError(error, 'Unable to start the video call.'));
      activeCallRef.current = {
        ...activeCallRef.current,
        offerSent: false,
      };
      resetCallSession({ shouldEmitEnd: false, preserveError: true });
    }
  }, [
    addLocalTracks,
    createPeerConnection,
    emitPeerSignal,
    ensureLocalStream,
    resetCallSession,
  ]);

  const startCall = useCallback(() => {
    if (!canCallActiveChat || callPhaseRef.current !== 'idle') {
      return;
    }

    const callId = createCallId();
    const peerName = String(activeChat.displayName || activeChat.username || 'Unknown contact');
    const peerAvatar = resolveAvatarToken(activeChat.avatar, peerName);

    activeCallRef.current = {
      callId,
      chatId: activeChat.id,
      peerUserId: String(activeChat.userId),
      peerName,
      peerAvatar,
      direction: 'outgoing',
      accepted: false,
      offerSent: false,
    };

    setCallError('');
    setIncomingCall(null);
    setRemoteParticipant({
      id: String(activeChat.userId),
      name: peerName,
      avatar: peerAvatar,
    });
    setCallPhase('calling');

    emitPeerSignal('call-user', {
      callId,
      chatId: activeChat.id,
      toUserId: String(activeChat.userId),
      callerName: currentUser.username,
      callerAvatar: currentCallerAvatar,
    });
  }, [
    activeChat,
    canCallActiveChat,
    currentCallerAvatar,
    currentUser.username,
    emitPeerSignal,
  ]);

  const acceptIncomingCall = useCallback(async () => {
    const pendingCall = incomingCallRef.current;
    if (!pendingCall) {
      return;
    }

    if (typeof RTCPeerConnection === 'undefined') {
      setCallError('WebRTC is not supported in this browser.');
      return;
    }

    setCallError('');
    setCallPhase('requesting-media');

    try {
      const stream = await ensureLocalStream();
      const connection = createPeerConnection({
        callId: pendingCall.callId,
        chatId: pendingCall.chatId,
        peerUserId: pendingCall.fromUserId,
        peerName: pendingCall.callerName,
        peerAvatar: pendingCall.callerAvatar,
      });

      addLocalTracks(connection, stream);

      activeCallRef.current = {
        ...(activeCallRef.current ?? {}),
        callId: pendingCall.callId,
        chatId: pendingCall.chatId,
        peerUserId: pendingCall.fromUserId,
        peerName: pendingCall.callerName,
        peerAvatar: pendingCall.callerAvatar,
        direction: 'incoming',
        accepted: true,
        offerSent: false,
      };

      emitPeerSignal('call-accepted', {
        callId: pendingCall.callId,
        chatId: pendingCall.chatId,
        toUserId: pendingCall.fromUserId,
      });

      await flushPendingIceCandidates(connection);
      setIncomingCall(null);
      setCallPhase('connecting');
    } catch (error) {
      setCallError(getReadableError(error, 'Unable to answer the call.'));
      resetCallSession({ shouldEmitEnd: false, preserveError: true });
    }
  }, [
    addLocalTracks,
    createPeerConnection,
    emitPeerSignal,
    ensureLocalStream,
    flushPendingIceCandidates,
    resetCallSession,
  ]);

  const declineIncomingCall = useCallback(() => {
    const pendingCall = incomingCallRef.current;
    if (!pendingCall) {
      return;
    }

    emitPeerSignal('call-declined', {
      callId: pendingCall.callId,
      chatId: pendingCall.chatId,
      toUserId: pendingCall.fromUserId,
      reason: 'declined',
    });

    resetCallSession({ shouldEmitEnd: false });
  }, [emitPeerSignal, resetCallSession]);

  const endCall = useCallback(() => {
    resetCallSession({ shouldEmitEnd: true, reason: 'ended' });
  }, [resetCallSession]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) {
      return;
    }

    const nextMuted = !isMuted;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
  }, [isMuted]);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) {
      return;
    }

    const nextCameraEnabled = !isCameraEnabled;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = nextCameraEnabled;
    });
    setIsCameraEnabled(nextCameraEnabled);
  }, [isCameraEnabled]);

  useEffect(() => {
    if (!currentUserId) {
      return undefined;
    }

    const handleCallUser = (payload) => {
      if (
        String(payload?.toUserId ?? '') !== currentUserId ||
        String(payload?.fromUserId ?? '') === currentUserId
      ) {
        return;
      }

      const activeCall = activeCallRef.current;
      if (activeCall || incomingCallRef.current || callPhaseRef.current !== 'idle') {
        emitPeerSignal('call-declined', {
          callId: payload.callId,
          chatId: payload.chatId,
          toUserId: payload.fromUserId,
          reason: 'busy',
        });
        return;
      }

      const callerName = String(
        payload?.callerName ?? payload?.fromUsername ?? payload?.fromUserId ?? 'Unknown contact'
      );
      const callerAvatar = resolveAvatarToken(payload?.callerAvatar, callerName);

      setCallError('');
      setRemoteParticipant({
        id: String(payload.fromUserId),
        name: callerName,
        avatar: callerAvatar,
      });
      setIncomingCall({
        callId: String(payload.callId),
        chatId: String(payload.chatId ?? `dm:${String(payload.fromUserId)}`),
        fromUserId: String(payload.fromUserId),
        callerName,
        callerAvatar,
      });
      setCallPhase('incoming');
    };

    const handleCallAccepted = (payload) => {
      if (
        String(payload?.toUserId ?? '') !== currentUserId ||
        String(payload?.fromUserId ?? '') === currentUserId
      ) {
        return;
      }

      const activeCall = activeCallRef.current;
      if (
        !activeCall ||
        activeCall.direction !== 'outgoing' ||
        activeCall.callId !== String(payload?.callId ?? '')
      ) {
        return;
      }

      void startOutgoingOffer();
    };

    const handleCallDeclined = (payload) => {
      if (
        String(payload?.toUserId ?? '') !== currentUserId ||
        String(payload?.fromUserId ?? '') === currentUserId
      ) {
        return;
      }

      const activeCallId =
        activeCallRef.current?.callId ?? incomingCallRef.current?.callId;
      if (activeCallId && String(payload?.callId ?? '') !== String(activeCallId)) {
        return;
      }

      const reason = String(payload?.reason ?? 'declined');
      setCallError(
        reason === 'busy'
          ? 'The other user is already in another call.'
          : 'The call was declined.'
      );
      resetCallSession({ shouldEmitEnd: false, preserveError: true });
    };

    const handleCallOffer = async (payload) => {
      if (
        String(payload?.toUserId ?? '') !== currentUserId ||
        String(payload?.fromUserId ?? '') === currentUserId
      ) {
        return;
      }

      const description = getCallDescription(payload);
      if (!description) {
        return;
      }

      const activeCall = activeCallRef.current;
      if (
        !activeCall ||
        activeCall.direction !== 'incoming' ||
        !activeCall.accepted ||
        activeCall.callId !== String(payload?.callId ?? '')
      ) {
        pendingIceCandidatesRef.current = [];
        return;
      }

      try {
        const connection =
          peerConnectionRef.current ??
          createPeerConnection({
            callId: activeCall.callId,
            chatId: activeCall.chatId,
            peerUserId: activeCall.peerUserId,
            peerName: activeCall.peerName,
            peerAvatar: activeCall.peerAvatar,
          });

        await connection.setRemoteDescription(
          new RTCSessionDescription(description)
        );
        await flushPendingIceCandidates(connection);

        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);

        emitPeerSignal('call-answer', {
          callId: activeCall.callId,
          chatId: activeCall.chatId,
          toUserId: activeCall.peerUserId,
          description: answer,
          answer,
        });

        setCallPhase('connecting');
      } catch (error) {
        setCallError(getReadableError(error, 'Unable to answer the call.'));
        resetCallSession({ shouldEmitEnd: false, preserveError: true });
      }
    };

    const handleCallAnswer = async (payload) => {
      if (
        String(payload?.toUserId ?? '') !== currentUserId ||
        String(payload?.fromUserId ?? '') === currentUserId
      ) {
        return;
      }

      const activeCall = activeCallRef.current;
      if (
        !activeCall ||
        activeCall.direction !== 'outgoing' ||
        activeCall.callId !== String(payload?.callId ?? '') ||
        !peerConnectionRef.current
      ) {
        return;
      }

      const description = getCallDescription(payload);
      if (!description) {
        return;
      }

      try {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(description)
        );
        await flushPendingIceCandidates(peerConnectionRef.current);
        setCallPhase('connecting');
      } catch (error) {
        setCallError(getReadableError(error, 'Unable to finish call setup.'));
        resetCallSession({ shouldEmitEnd: false, preserveError: true });
      }
    };

    const handleIceCandidate = async (payload) => {
      if (
        String(payload?.toUserId ?? '') !== currentUserId ||
        String(payload?.fromUserId ?? '') === currentUserId
      ) {
        return;
      }

      const activeCallId = activeCallRef.current?.callId;
      if (
        !payload?.candidate ||
        !activeCallId ||
        activeCallId !== String(payload?.callId ?? '')
      ) {
        return;
      }

      const connection = peerConnectionRef.current;
      if (!connection || !connection.remoteDescription) {
        pendingIceCandidatesRef.current.push(payload.candidate);
        return;
      }

      try {
        await connection.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch {
        // Ignore invalid remote ICE candidates.
      }
    };

    const handleEndCall = (payload) => {
      if (
        String(payload?.toUserId ?? '') !== currentUserId ||
        String(payload?.fromUserId ?? '') === currentUserId
      ) {
        return;
      }

      const activeCallId =
        activeCallRef.current?.callId ?? incomingCallRef.current?.callId;
      if (activeCallId && String(payload?.callId ?? '') !== String(activeCallId)) {
        return;
      }

      setCallError('Call ended.');
      resetCallSession({ shouldEmitEnd: false, preserveError: true });
    };

    socket.on('call-user', handleCallUser);
    socket.on('call-accepted', handleCallAccepted);
    socket.on('call-declined', handleCallDeclined);
    socket.on('call-offer', handleCallOffer);
    socket.on('call-answer', handleCallAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('end-call', handleEndCall);

    return () => {
      socket.off('call-user', handleCallUser);
      socket.off('call-accepted', handleCallAccepted);
      socket.off('call-declined', handleCallDeclined);
      socket.off('call-offer', handleCallOffer);
      socket.off('call-answer', handleCallAnswer);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('end-call', handleEndCall);
    };
  }, [
    createPeerConnection,
    currentUserId,
    emitPeerSignal,
    flushPendingIceCandidates,
    resetCallSession,
    startOutgoingOffer,
  ]);

  useEffect(
    () => () => {
      destroyPeerConnection();
      stopRemoteStream();
      stopLocalStream();
    },
    [destroyPeerConnection, stopLocalStream, stopRemoteStream]
  );

  const callStateLabel =
    callPhase === 'calling'
      ? 'Waiting for the other user to accept'
      : callPhase === 'requesting-media'
        ? 'Requesting camera and microphone'
        : callPhase === 'connecting'
          ? 'Connecting peer channel'
          : callPhase === 'connected'
            ? 'Connected'
            : 'Ready';

  const isVideoOverlayVisible =
    callPhase !== 'idle' && callPhase !== 'incoming';

  return (
    <>
      <div className="video-call-header-actions">
        {callError ? <span className="video-call-error">{callError}</span> : null}

        <button
          className="glass-button glass-button--ghost video-call-trigger"
          disabled={!canCallActiveChat || callPhase !== 'idle'}
          onClick={startCall}
          type="button"
        >
          <Video size={17} />
          Video Call
        </button>
      </div>

      <IncomingCallModal
        callerAvatar={incomingCall?.callerAvatar}
        callerName={incomingCall?.callerName ?? 'Unknown contact'}
        isOpen={callPhase === 'incoming' && Boolean(incomingCall)}
        onAccept={acceptIncomingCall}
        onDecline={declineIncomingCall}
      />

      <AnimatePresence>
        {isVideoOverlayVisible ? (
          <MotionDiv
            animate={{ opacity: 1 }}
            className="video-call-overlay"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
          >
            <MotionDiv
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="glass-panel video-call-shell"
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="video-call-topbar">
                <div>
                  <h3>{displayParticipantName}</h3>
                  <p>{callStateLabel}</p>
                </div>

                {callPhase === 'requesting-media' ? (
                  <span className="status-pill status-pill--degraded">
                    <LoaderCircle className="video-call-spinner" size={14} />
                    Preparing media
                  </span>
                ) : (
                  <span className="status-pill status-pill--connected">
                    <Video size={14} />
                    {callPhase === 'connected'
                      ? 'Live peer connection'
                      : 'WebRTC secure path'}
                  </span>
                )}
              </div>

              <div className="video-call-stage">
                <div className="video-call-stage__remote">
                  <video
                    autoPlay
                    className="video-call-video"
                    playsInline
                    ref={remoteVideoRef}
                  />
                  {!remoteStream ? (
                    <div className="video-call-placeholder">
                      <Video size={26} />
                      <span>
                        {callPhase === 'calling'
                          ? 'Ringing the other user'
                          : 'Waiting for remote video'}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="video-call-stage__local">
                  <video
                    autoPlay
                    className="video-call-video"
                    muted
                    playsInline
                    ref={localVideoRef}
                  />
                  {!localStream ? (
                    <div className="video-call-placeholder video-call-placeholder--compact">
                      <Mic size={18} />
                      <span>Local preview</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="video-call-actions">
                <button
                  className="glass-button glass-button--ghost video-call-action"
                  disabled={!localStream}
                  onClick={toggleMute}
                  type="button"
                >
                  {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                  {isMuted ? 'Unmute' : 'Mute'}
                </button>

                <button
                  className="glass-button glass-button--ghost video-call-action"
                  disabled={!localStream}
                  onClick={toggleCamera}
                  type="button"
                >
                  {isCameraEnabled ? <Video size={18} /> : <VideoOff size={18} />}
                  {isCameraEnabled ? 'Camera on' : 'Camera off'}
                </button>

                <button
                  className="glass-button video-call-action video-call-action--hangup"
                  onClick={endCall}
                  type="button"
                >
                  <PhoneOff size={18} />
                  End call
                </button>
              </div>
            </MotionDiv>
          </MotionDiv>
        ) : null}
      </AnimatePresence>
    </>
  );
}
