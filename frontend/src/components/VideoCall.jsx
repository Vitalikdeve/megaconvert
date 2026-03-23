import { AnimatePresence, motion } from 'framer-motion';
import {
  LoaderCircle,
  Mic,
  MicOff,
  PhoneIncoming,
  PhoneOff,
  Video,
  VideoOff,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { socket } from '../services/socket.js';

const MotionDiv = motion.div;

const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

const createCallId = () => `call-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

const getCallDescription = (payload) => payload?.description ?? payload?.offer ?? payload?.answer ?? null;

const getReadableError = (error, fallbackMessage) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
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

  const canCallActiveChat = Boolean(
    activeChat &&
      !activeChat.isSavedMessages &&
      activeChat.userId &&
      String(activeChat.userId).trim()
  );

  const displayParticipantName = useMemo(() => {
    if (incomingCall?.fromUsername) {
      return incomingCall.fromUsername;
    }

    if (remoteParticipant?.name) {
      return remoteParticipant.name;
    }

    if (activeChat?.displayName) {
      return activeChat.displayName;
    }

    return 'Unknown contact';
  }, [activeChat?.displayName, incomingCall?.fromUsername, remoteParticipant?.name]);

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

  const emitEndCall = useCallback(({
    callId,
    chatId,
    toUserId,
    reason = 'ended',
  }) => {
    if (!callId || !toUserId) {
      return;
    }

    socket.emit('end-call', {
      callId,
      chatId,
      fromUserId: String(currentUser.userId),
      fromUsername: currentUser.username,
      toUserId: String(toUserId),
      reason,
      createdAt: new Date().toISOString(),
    });
  }, [currentUser.userId, currentUser.username]);

  const resetCallSession = useCallback(({
    shouldEmitEnd = false,
    reason = 'ended',
    preserveError = false,
  } = {}) => {
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
  }, [destroyPeerConnection, emitEndCall, stopLocalStream, stopRemoteStream]);

  async function ensureLocalStream() {
    if (
      localStreamRef.current &&
      localStreamRef.current.getTracks().some((track) => track.readyState === 'live')
    ) {
      return localStreamRef.current;
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia
    ) {
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
  }

  function ensureRemoteMediaStream() {
    if (remoteStreamRef.current) {
      return remoteStreamRef.current;
    }

    const stream = new MediaStream();
    remoteStreamRef.current = stream;
    setRemoteStream(stream);
    return stream;
  }

  function createPeerConnection({ callId, chatId, peerUserId, peerName }) {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }

    const connection = new RTCPeerConnection(configuration);

    activeCallRef.current = {
      callId,
      chatId,
      peerUserId: String(peerUserId),
      peerName,
    };

    setRemoteParticipant({
      id: String(peerUserId),
      name: peerName,
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

      socket.emit('ice-candidate', {
        callId: activeCallRef.current.callId,
        chatId: activeCallRef.current.chatId,
        fromUserId: String(currentUser.userId),
        fromUsername: currentUser.username,
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
          currentPhase === 'incoming' ? 'connecting' : currentPhase
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
  }

  function addLocalTracks(connection, stream) {
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
  }

  async function flushPendingIceCandidates(connection) {
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
  }

  async function startCall() {
    if (!canCallActiveChat || callPhaseRef.current !== 'idle') {
      return;
    }

    if (typeof RTCPeerConnection === 'undefined') {
      setCallError('WebRTC is not supported in this browser.');
      return;
    }

    const callId = createCallId();

    setCallError('');
    setIncomingCall(null);
    setCallPhase('requesting-media');

    try {
      const stream = await ensureLocalStream();
      const connection = createPeerConnection({
        callId,
        chatId: activeChat.id,
        peerUserId: activeChat.userId,
        peerName: activeChat.displayName,
      });

      addLocalTracks(connection, stream);

      socket.emit('call-user', {
        callId,
        chatId: activeChat.id,
        fromUserId: String(currentUser.userId),
        fromUsername: currentUser.username,
        toUserId: String(activeChat.userId),
        createdAt: new Date().toISOString(),
      });

      const offer = await connection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await connection.setLocalDescription(offer);

      socket.emit('call-offer', {
        callId,
        chatId: activeChat.id,
        fromUserId: String(currentUser.userId),
        fromUsername: currentUser.username,
        toUserId: String(activeChat.userId),
        description: offer,
        offer,
      });

      setCallPhase('calling');
    } catch (error) {
      setCallError(getReadableError(error, 'Unable to start the video call.'));
      resetCallSession({ shouldEmitEnd: false, preserveError: true });
    }
  }

  async function answerCall() {
    if (!incomingCallRef.current?.description) {
      setCallError('Waiting for the call offer to finish arriving.');
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
      const incoming = incomingCallRef.current;
      const connection = createPeerConnection({
        callId: incoming.callId,
        chatId: incoming.chatId,
        peerUserId: incoming.fromUserId,
        peerName: incoming.fromUsername,
      });

      addLocalTracks(connection, stream);
      await connection.setRemoteDescription(
        new RTCSessionDescription(incoming.description)
      );
      await flushPendingIceCandidates(connection);

      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);

      socket.emit('call-answer', {
        callId: incoming.callId,
        chatId: incoming.chatId,
        fromUserId: String(currentUser.userId),
        fromUsername: currentUser.username,
        toUserId: String(incoming.fromUserId),
        description: answer,
        answer,
      });

      setIncomingCall(null);
      setCallPhase('connecting');
    } catch (error) {
      setCallError(getReadableError(error, 'Unable to answer the call.'));
      resetCallSession({ shouldEmitEnd: false, preserveError: true });
    }
  }

  function declineCall() {
    resetCallSession({ shouldEmitEnd: true, reason: 'declined' });
  }

  function endCall() {
    resetCallSession({ shouldEmitEnd: true, reason: 'ended' });
  }

  function toggleMute() {
    const stream = localStreamRef.current;
    if (!stream) {
      return;
    }

    const nextMuted = !isMuted;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
  }

  function toggleCamera() {
    const stream = localStreamRef.current;
    if (!stream) {
      return;
    }

    const nextCameraEnabled = !isCameraEnabled;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = nextCameraEnabled;
    });
    setIsCameraEnabled(nextCameraEnabled);
  }

  useEffect(() => {
    if (!currentUser?.userId) {
      return undefined;
    }

    const currentUserId = String(currentUser.userId);

    const handleCallUser = (payload) => {
      if (
        String(payload?.toUserId ?? '') !== currentUserId ||
        String(payload?.fromUserId ?? '') === currentUserId
      ) {
        return;
      }

      if (
        activeCallRef.current &&
        activeCallRef.current.callId !== payload.callId
      ) {
        emitEndCall({
          callId: payload.callId,
          chatId: payload.chatId,
          toUserId: payload.fromUserId,
          reason: 'busy',
        });
        return;
      }

      setCallError('');
      setRemoteParticipant({
        id: String(payload.fromUserId),
        name: String(payload.fromUsername ?? payload.fromUserId ?? 'Unknown contact'),
      });
      setIncomingCall((currentCall) => ({
        callId: String(payload.callId),
        chatId: String(payload.chatId ?? `dm:${String(payload.fromUserId)}`),
        fromUserId: String(payload.fromUserId),
        fromUsername: String(payload.fromUsername ?? payload.fromUserId ?? 'Unknown contact'),
        description: currentCall?.description ?? null,
      }));
      setCallPhase((currentPhase) =>
        currentPhase === 'idle' ? 'incoming' : currentPhase
      );
    };

    const handleCallOffer = (payload) => {
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

      if (
        activeCallRef.current &&
        activeCallRef.current.callId !== payload.callId
      ) {
        emitEndCall({
          callId: payload.callId,
          chatId: payload.chatId,
          toUserId: payload.fromUserId,
          reason: 'busy',
        });
        return;
      }

      setCallError('');
      setRemoteParticipant({
        id: String(payload.fromUserId),
        name: String(payload.fromUsername ?? payload.fromUserId ?? 'Unknown contact'),
      });
      setIncomingCall({
        callId: String(payload.callId),
        chatId: String(payload.chatId ?? `dm:${String(payload.fromUserId)}`),
        fromUserId: String(payload.fromUserId),
        fromUsername: String(payload.fromUsername ?? payload.fromUserId ?? 'Unknown contact'),
        description,
      });
      setCallPhase((currentPhase) =>
        currentPhase === 'idle' ? 'incoming' : currentPhase
      );
    };

    const handleCallAnswer = async (payload) => {
      if (
        String(payload?.toUserId ?? '') !== currentUserId ||
        String(payload?.fromUserId ?? '') === currentUserId ||
        activeCallRef.current?.callId !== String(payload?.callId ?? '')
      ) {
        return;
      }

      const description = getCallDescription(payload);
      if (!description || !peerConnectionRef.current) {
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
        String(payload?.fromUserId ?? '') === currentUserId ||
        activeCallRef.current?.callId !== String(payload?.callId ?? '')
      ) {
        return;
      }

      if (!payload?.candidate) {
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

      const activeCallId = activeCallRef.current?.callId ?? incomingCallRef.current?.callId;
      if (activeCallId && String(payload?.callId ?? '') !== String(activeCallId)) {
        return;
      }

      const reason = String(payload?.reason ?? 'ended');
      const message =
        reason === 'busy'
          ? 'The other user is already in another call.'
          : reason === 'declined'
            ? 'The call was declined.'
            : 'Call ended.';

      setCallError(message);
      resetCallSession({ shouldEmitEnd: false, preserveError: true });
    };

    socket.on('call-user', handleCallUser);
    socket.on('call-offer', handleCallOffer);
    socket.on('call-answer', handleCallAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('end-call', handleEndCall);

    return () => {
      socket.off('call-user', handleCallUser);
      socket.off('call-offer', handleCallOffer);
      socket.off('call-answer', handleCallAnswer);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('end-call', handleEndCall);
    };
  }, [currentUser?.userId, currentUser?.username, emitEndCall, resetCallSession]);

  useEffect(
    () => () => {
      destroyPeerConnection();
      stopRemoteStream();
      stopLocalStream();
    },
    [destroyPeerConnection, stopLocalStream, stopRemoteStream]
  );

  const callStateLabel =
    callPhase === 'requesting-media'
      ? 'Requesting camera and microphone'
      : callPhase === 'calling'
        ? 'Calling'
        : callPhase === 'incoming'
          ? 'Incoming call'
          : callPhase === 'connecting'
            ? 'Connecting peer channel'
            : callPhase === 'connected'
              ? 'Connected'
              : 'Ready';

  const isCallVisible = callPhase !== 'idle' || Boolean(incomingCall);

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
          Video call
        </button>
      </div>

      <AnimatePresence>
        {isCallVisible ? (
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
                    {callPhase === 'connected' ? 'Live peer connection' : 'WebRTC secure path'}
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
                        {callPhase === 'incoming'
                          ? 'Waiting for you to answer'
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
                {incomingCall ? (
                  <>
                    <button
                      className="glass-button video-call-action video-call-action--accept"
                      disabled={!incomingCall.description}
                      onClick={answerCall}
                      type="button"
                    >
                      <PhoneIncoming size={18} />
                      Answer
                    </button>
                    <button
                      className="glass-button video-call-action video-call-action--hangup"
                      onClick={declineCall}
                      type="button"
                    >
                      <PhoneOff size={18} />
                      Decline
                    </button>
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </MotionDiv>
          </MotionDiv>
        ) : null}
      </AnimatePresence>
    </>
  );
}
