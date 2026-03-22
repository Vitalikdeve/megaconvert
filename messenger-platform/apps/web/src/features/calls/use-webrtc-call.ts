"use client";

import {
  callAnswerSchema,
  callEndSchema,
  callIceCandidateSchema,
  callOfferSchema,
  realtimeEventNames,
  type CallAnswer,
  type CallEnd,
  type CallIceCandidate,
  type CallMedia,
  type CallOffer
} from "@messenger/shared";
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

const userLabels: Record<string, string> = {
  you: "You",
  nina: "Nina",
  ari: "Ari",
  mika: "Mika"
};

const defaultIceServers: RTCIceServer[] = [
  {
    urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"]
  }
];

const parseIceServers = (): RTCIceServer[] => {
  const envValue = process.env.NEXT_PUBLIC_STUN_URLS;

  if (!envValue) {
    return defaultIceServers;
  }

  const urls = envValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return urls.length > 0 ? [{ urls }] : defaultIceServers;
};

const toDisplayName = (userId: string) => userLabels[userId] ?? userId;

type CallStatus =
  | "idle"
  | "incoming"
  | "requesting-media"
  | "dialing"
  | "connecting"
  | "connected"
  | "ending"
  | "error";

type CallDirection = "incoming" | "outgoing" | null;

interface IncomingCallState {
  callId: string;
  fromUserId: string;
  media: CallMedia;
  offer: CallOffer;
}

interface ActiveCallContext {
  callId: string;
  remoteUserId: string;
}

const buildRtcDescription = (description: CallOffer["description"] | CallAnswer["description"]): RTCSessionDescriptionInit => ({
  type: description.type,
  sdp: description.sdp
});

const buildRtcCandidate = (candidate: CallIceCandidate["candidate"]): RTCIceCandidateInit => ({
  candidate: candidate.candidate,
  sdpMid: candidate.sdpMid ?? null,
  sdpMLineIndex: candidate.sdpMLineIndex ?? null,
  usernameFragment: candidate.usernameFragment ?? null
});

const serializeIceCandidate = (candidate: RTCIceCandidate): CallIceCandidate["candidate"] => ({
  candidate: candidate.candidate,
  sdpMid: candidate.sdpMid ?? null,
  sdpMLineIndex: candidate.sdpMLineIndex ?? null,
  usernameFragment: candidate.usernameFragment ?? null
});

const createPreviewStream = (audioTracks: MediaStreamTrack[], videoTrack?: MediaStreamTrack | null) => {
  const tracks = videoTrack ? [...audioTracks, videoTrack] : [...audioTracks];
  return new MediaStream(tracks);
};

export interface UseWebRtcCallOptions {
  conversationId: string;
  currentUserId: string;
}

export const useWebRtcCall = ({
  conversationId,
  currentUserId
}: UseWebRtcCallOptions) => {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [direction, setDirection] = useState<CallDirection>(null);
  const [callMedia, setCallMedia] = useState<CallMedia>("voice");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallState | null>(null);
  const [remoteUserId, setRemoteUserId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const pendingOfferRef = useRef<CallOffer | null>(null);
  const pendingIceCandidatesRef = useRef<CallIceCandidate["candidate"][]>([]);
  const currentCallRef = useRef<ActiveCallContext | null>(null);
  const baseMediaRef = useRef<"voice" | "video">("voice");
  const callMediaRef = useRef<CallMedia>("voice");
  const statusRef = useRef<CallStatus>("idle");
  const screenShareAddedTrackRef = useRef(false);
  const screenSenderRef = useRef<RTCRtpSender | null>(null);

  const updateStatus = (nextStatus: CallStatus) => {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
  };

  const applyLocalPreview = (videoTrack?: MediaStreamTrack | null) => {
    const stream = localStreamRef.current;

    if (!stream) {
      setLocalStream(null);
      return;
    }

    setLocalStream(createPreviewStream(stream.getAudioTracks(), videoTrack ?? stream.getVideoTracks()[0] ?? null));
  };

  const stopScreenShareInternal = async (shouldRenegotiate: boolean) => {
    const peerConnection = peerConnectionRef.current;
    const screenStream = screenStreamRef.current;

    if (!screenStream) {
      return;
    }

    const cameraTrack = localStreamRef.current?.getVideoTracks()[0] ?? null;

    screenStream.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    setIsScreenSharing(false);
    callMediaRef.current = baseMediaRef.current;
    setCallMedia(baseMediaRef.current);

    if (!peerConnection) {
      screenSenderRef.current = null;
      screenShareAddedTrackRef.current = false;
      applyLocalPreview(cameraTrack);
      return;
    }

    if (screenShareAddedTrackRef.current) {
      if (screenSenderRef.current) {
        peerConnection.removeTrack(screenSenderRef.current);
      }
      screenSenderRef.current = null;
      screenShareAddedTrackRef.current = false;
      applyLocalPreview(cameraTrack);

      if (shouldRenegotiate) {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        if (peerConnection.localDescription && currentCallRef.current && socketRef.current) {
          socketRef.current.emit(
            realtimeEventNames.callOffer,
            callOfferSchema.parse({
              callId: currentCallRef.current.callId,
              conversationId,
              fromUserId: currentUserId,
              toUserId: currentCallRef.current.remoteUserId,
              media: baseMediaRef.current,
              description: {
                type: "offer",
                sdp: peerConnection.localDescription.sdp ?? ""
              }
            })
          );
        }
      }

      return;
    }

    if (screenSenderRef.current) {
      await screenSenderRef.current.replaceTrack(cameraTrack);
    }

    applyLocalPreview(cameraTrack);
  };

  const cleanupCall = async (options?: { remoteEnded?: boolean; nextError?: string | null }) => {
    if (screenStreamRef.current) {
      await stopScreenShareInternal(false);
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    remoteStreamRef.current?.getTracks().forEach((track) => track.stop());

    localStreamRef.current = null;
    remoteStreamRef.current = null;
    screenStreamRef.current = null;
    pendingIceCandidatesRef.current = [];
    pendingOfferRef.current = null;
    currentCallRef.current = null;
    screenSenderRef.current = null;
    screenShareAddedTrackRef.current = false;

    setLocalStream(null);
    setRemoteStream(null);
    setIncomingCall(null);
    setRemoteUserId(null);
    setDirection(null);
    setIsMuted(false);
    setIsCameraEnabled(true);
    setIsScreenSharing(false);
    setCallMedia(baseMediaRef.current);
    updateStatus(options?.nextError ? "error" : "idle");
    setError(options?.nextError ?? null);

    if (options?.remoteEnded) {
      updateStatus("idle");
    }
  };

  const flushPendingIceCandidates = async () => {
    const peerConnection = peerConnectionRef.current;

    if (!peerConnection || !peerConnection.remoteDescription) {
      return;
    }

    for (const candidate of pendingIceCandidatesRef.current) {
      await peerConnection.addIceCandidate(buildRtcCandidate(candidate));
    }

    pendingIceCandidatesRef.current = [];
  };

  const requestLocalMedia = async (media: "voice" | "video") => {
    updateStatus("requesting-media");

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true
      },
      video:
        media === "video"
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "user"
            }
          : false
    });

    localStreamRef.current = stream;
    setIsCameraEnabled(stream.getVideoTracks().some((track) => track.enabled));
    setIsMuted(stream.getAudioTracks().some((track) => !track.enabled));
    applyLocalPreview();
    return stream;
  };

  const createPeerConnection = (remotePeerUserId: string) => {
    const peerConnection = new RTCPeerConnection({
      iceServers: parseIceServers()
    });

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate || !socketRef.current || !currentCallRef.current) {
        return;
      }

      socketRef.current.emit(
        realtimeEventNames.callIceCandidate,
        callIceCandidateSchema.parse({
          callId: currentCallRef.current.callId,
          conversationId,
          fromUserId: currentUserId,
          toUserId: remotePeerUserId,
          media: callMediaRef.current,
          candidate: serializeIceCandidate(event.candidate)
        })
      );
    };

    peerConnection.ontrack = (event) => {
      const stream = event.streams[0];

      if (stream) {
        remoteStreamRef.current = stream;
        setRemoteStream(stream);
        return;
      }

      const fallbackStream =
        remoteStreamRef.current ??
        new MediaStream();

      fallbackStream.addTrack(event.track);
      remoteStreamRef.current = fallbackStream;
      setRemoteStream(fallbackStream);
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;

      if (state === "connected") {
        updateStatus("connected");
        setError(null);
        return;
      }

      if (state === "disconnected") {
        updateStatus("connecting");
        return;
      }

      if (state === "failed") {
        void cleanupCall({
          nextError: "Call connection failed."
        });
      }
    };

    localStreamRef.current?.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStreamRef.current as MediaStream);
    });

    peerConnectionRef.current = peerConnection;
    return peerConnection;
  };

  const applyOfferToExistingCall = async (offer: CallOffer) => {
    const peerConnection = peerConnectionRef.current;

    if (!peerConnection) {
      return;
    }

    callMediaRef.current = offer.media;
    setCallMedia(offer.media);

    await peerConnection.setRemoteDescription(buildRtcDescription(offer.description));
    await flushPendingIceCandidates();

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    if (!peerConnection.localDescription || !socketRef.current) {
      return;
    }

    socketRef.current.emit(
      realtimeEventNames.callAnswer,
      callAnswerSchema.parse({
        callId: offer.callId,
        conversationId,
        fromUserId: currentUserId,
        toUserId: offer.fromUserId,
        media: offer.media,
        description: {
          type: "answer",
          sdp: peerConnection.localDescription.sdp ?? ""
        }
      })
    );

    updateStatus("connecting");
  };

  const startCall = async (targetUserId: string, media: "voice" | "video") => {
    try {
      setError(null);
      baseMediaRef.current = media;
      callMediaRef.current = media;
      setCallMedia(media);
      setRemoteUserId(targetUserId);
      setDirection("outgoing");

      const stream = await requestLocalMedia(media);
      const callId = crypto.randomUUID();
      const peerConnection = createPeerConnection(targetUserId);

      currentCallRef.current = {
        callId,
        remoteUserId: targetUserId
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      if (!peerConnection.localDescription || !socketRef.current) {
        return;
      }

      socketRef.current.emit(
        realtimeEventNames.callOffer,
        callOfferSchema.parse({
          callId,
          conversationId,
          fromUserId: currentUserId,
          toUserId: targetUserId,
          media,
          description: {
            type: "offer",
            sdp: peerConnection.localDescription.sdp ?? ""
          }
        })
      );

      applyLocalPreview(stream.getVideoTracks()[0] ?? null);
      updateStatus("dialing");
    } catch (callError) {
      await cleanupCall({
        nextError: callError instanceof Error ? callError.message : "Failed to start call."
      });
    }
  };

  const answerIncomingCall = async () => {
    const incoming = pendingOfferRef.current;

    if (!incoming) {
      return;
    }

    try {
      setError(null);
      const requestMedia = incoming.media === "voice" ? "voice" : "video";
      baseMediaRef.current = requestMedia;
      callMediaRef.current = incoming.media;
      setCallMedia(incoming.media);
      setDirection("incoming");
      setRemoteUserId(incoming.fromUserId);

      await requestLocalMedia(requestMedia);
      currentCallRef.current = {
        callId: incoming.callId,
        remoteUserId: incoming.fromUserId
      };

      const peerConnection = createPeerConnection(incoming.fromUserId);

      await peerConnection.setRemoteDescription(buildRtcDescription(incoming.description));
      await flushPendingIceCandidates();

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      if (!peerConnection.localDescription || !socketRef.current) {
        return;
      }

      socketRef.current.emit(
        realtimeEventNames.callAnswer,
        callAnswerSchema.parse({
          callId: incoming.callId,
          conversationId,
          fromUserId: currentUserId,
          toUserId: incoming.fromUserId,
          media: incoming.media,
          description: {
            type: "answer",
            sdp: peerConnection.localDescription.sdp ?? ""
          }
        })
      );

      pendingOfferRef.current = null;
      setIncomingCall(null);
      updateStatus("connecting");
    } catch (callError) {
      await cleanupCall({
        nextError: callError instanceof Error ? callError.message : "Failed to answer call."
      });
    }
  };

  const declineIncomingCall = () => {
    const incoming = pendingOfferRef.current;

    if (!incoming || !socketRef.current) {
      setIncomingCall(null);
      pendingOfferRef.current = null;
      updateStatus("idle");
      return;
    }

    socketRef.current.emit(
      realtimeEventNames.callEnd,
      callEndSchema.parse({
        callId: incoming.callId,
        conversationId,
        fromUserId: currentUserId,
        toUserId: incoming.fromUserId,
        media: incoming.media,
        reason: "declined"
      })
    );

    setIncomingCall(null);
    pendingOfferRef.current = null;
    updateStatus("idle");
  };

  const endCall = async (reason: CallEnd["reason"] = "hangup") => {
    const currentCall = currentCallRef.current;

    updateStatus("ending");

    if (currentCall && socketRef.current) {
      socketRef.current.emit(
        realtimeEventNames.callEnd,
        callEndSchema.parse({
          callId: currentCall.callId,
          conversationId,
          fromUserId: currentUserId,
          toUserId: currentCall.remoteUserId,
          media: callMediaRef.current,
          reason
        })
      );
    }

    await cleanupCall();
  };

  const toggleMute = () => {
    const stream = localStreamRef.current;

    if (!stream) {
      return;
    }

    const nextMuted = !isMuted;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
  };

  const toggleCamera = () => {
    const stream = localStreamRef.current;

    if (!stream) {
      return;
    }

    const videoTrack = stream.getVideoTracks()[0];

    if (!videoTrack) {
      return;
    }

    const nextCameraEnabled = !isCameraEnabled;
    videoTrack.enabled = nextCameraEnabled;
    setIsCameraEnabled(nextCameraEnabled);
  };

  const toggleScreenShare = async () => {
    const peerConnection = peerConnectionRef.current;
    const currentCall = currentCallRef.current;

    if (!peerConnection || !currentCall || typeof navigator === "undefined") {
      return;
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError("Screen sharing is not supported in this browser.");
      return;
    }

    try {
      setError(null);

      if (isScreenSharing) {
        await stopScreenShareInternal(true);
        return;
      }

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });

      const screenTrack = displayStream.getVideoTracks()[0];

      if (!screenTrack) {
        displayStream.getTracks().forEach((track) => track.stop());
        setError("No screen track was returned by the browser.");
        return;
      }

      screenTrack.onended = () => {
        void stopScreenShareInternal(true);
      };

      const existingVideoSender = peerConnection
        .getSenders()
        .find((sender) => sender.track?.kind === "video");

      screenStreamRef.current = displayStream;
      callMediaRef.current = "screen";
      setCallMedia("screen");
      setIsScreenSharing(true);

      if (existingVideoSender) {
        screenSenderRef.current = existingVideoSender;
        screenShareAddedTrackRef.current = false;
        await existingVideoSender.replaceTrack(screenTrack);
        applyLocalPreview(screenTrack);
        return;
      }

      screenSenderRef.current = peerConnection.addTrack(screenTrack, displayStream);
      screenShareAddedTrackRef.current = true;
      applyLocalPreview(screenTrack);

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      if (!peerConnection.localDescription || !socketRef.current) {
        return;
      }

      socketRef.current.emit(
        realtimeEventNames.callOffer,
        callOfferSchema.parse({
          callId: currentCall.callId,
          conversationId,
          fromUserId: currentUserId,
          toUserId: currentCall.remoteUserId,
          media: "screen",
          description: {
            type: "offer",
            sdp: peerConnection.localDescription.sdp ?? ""
          }
        })
      );
    } catch (screenShareError) {
      const nextError =
        screenShareError instanceof DOMException && screenShareError.name === "NotAllowedError"
          ? "Screen sharing was canceled."
          : screenShareError instanceof Error
            ? screenShareError.message
            : "Failed to share screen.";

      if (screenStreamRef.current) {
        await stopScreenShareInternal(false);
      }

      setError(nextError);
    }
  };

  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;

    if (!socketUrl) {
      setError("NEXT_PUBLIC_SOCKET_URL is not configured.");
      updateStatus("error");
      return;
    }

    const socket = io(socketUrl, {
      path: "/socket.io",
      transports: ["websocket"]
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit(realtimeEventNames.joinConversation, {
        conversationId,
        userId: currentUserId
      });
      if (statusRef.current === "idle") {
        updateStatus("idle");
      }
    });

    socket.on("disconnect", () => {
      if (statusRef.current !== "idle") {
        setError("Signaling connection lost.");
      }
    });

    socket.on(realtimeEventNames.callOffer, async (payload: unknown) => {
      const offer = callOfferSchema.parse(payload);

      if (offer.toUserId !== currentUserId) {
        return;
      }

      if (currentCallRef.current && currentCallRef.current.callId === offer.callId) {
        await applyOfferToExistingCall(offer);
        return;
      }

      if (statusRef.current !== "idle") {
        socket.emit(
          realtimeEventNames.callEnd,
          callEndSchema.parse({
            callId: offer.callId,
            conversationId,
            fromUserId: currentUserId,
            toUserId: offer.fromUserId,
            media: offer.media,
            reason: "busy"
          })
        );
        return;
      }

      pendingOfferRef.current = offer;
      setIncomingCall({
        callId: offer.callId,
        fromUserId: offer.fromUserId,
        media: offer.media,
        offer
      });
      setRemoteUserId(offer.fromUserId);
      setDirection("incoming");
      setCallMedia(offer.media);
      callMediaRef.current = offer.media;
      updateStatus("incoming");
    });

    socket.on(realtimeEventNames.callAnswer, async (payload: unknown) => {
      const answer = callAnswerSchema.parse(payload);
      const currentCall = currentCallRef.current;
      const peerConnection = peerConnectionRef.current;

      if (!peerConnection || !currentCall || answer.callId !== currentCall.callId) {
        return;
      }

      callMediaRef.current = answer.media;
      setCallMedia(answer.media);
      await peerConnection.setRemoteDescription(buildRtcDescription(answer.description));
      await flushPendingIceCandidates();
      updateStatus("connecting");
    });

    socket.on(realtimeEventNames.callIceCandidate, async (payload: unknown) => {
      const candidateSignal = callIceCandidateSchema.parse(payload);
      const currentCall = currentCallRef.current;
      const pendingOffer = pendingOfferRef.current;

      const matchingCallId =
        (currentCall && candidateSignal.callId === currentCall.callId) ||
        (pendingOffer && candidateSignal.callId === pendingOffer.callId);

      if (!matchingCallId) {
        return;
      }

      const peerConnection = peerConnectionRef.current;

      if (!peerConnection || !peerConnection.remoteDescription) {
        pendingIceCandidatesRef.current.push(candidateSignal.candidate);
        return;
      }

      await peerConnection.addIceCandidate(buildRtcCandidate(candidateSignal.candidate));
    });

    socket.on(realtimeEventNames.callEnd, async (payload: unknown) => {
      const signal = callEndSchema.parse(payload);
      const currentCall = currentCallRef.current;
      const pendingOffer = pendingOfferRef.current;

      const isMatchingActiveCall = currentCall && signal.callId === currentCall.callId;
      const isMatchingIncomingCall = pendingOffer && signal.callId === pendingOffer.callId;

      if (!isMatchingActiveCall && !isMatchingIncomingCall) {
        return;
      }

      const reasonLabel =
        signal.reason === "declined"
          ? `${toDisplayName(signal.fromUserId)} declined the call.`
          : signal.reason === "busy"
            ? `${toDisplayName(signal.fromUserId)} is busy right now.`
            : signal.reason === "failed"
              ? "Call failed."
              : null;

      await cleanupCall({
        remoteEnded: true,
        nextError: reasonLabel
      });
    });

    return () => {
      void cleanupCall();
      socket.close();
      socketRef.current = null;
    };
  }, [conversationId, currentUserId]);

  return {
    status,
    direction,
    callMedia,
    localStream,
    remoteStream,
    incomingCall,
    remoteUserId,
    remoteUserLabel: remoteUserId ? toDisplayName(remoteUserId) : null,
    incomingCallerLabel: incomingCall ? toDisplayName(incomingCall.fromUserId) : null,
    isMuted,
    isCameraEnabled,
    isScreenSharing,
    error,
    startVoiceCall: (targetUserId: string) => void startCall(targetUserId, "voice"),
    startVideoCall: (targetUserId: string) => void startCall(targetUserId, "video"),
    answerIncomingCall,
    declineIncomingCall,
    endCall,
    toggleMute,
    toggleCamera,
    toggleScreenShare
  };
};
