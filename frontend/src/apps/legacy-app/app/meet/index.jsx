import { AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  Circle,
  Copy,
  Laugh,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  SendHorizontal,
  Video,
  VideoOff,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { createLiveKitToken } from '../../services/api.js';
import { socket } from '../../services/socket.js';
import {
  connectToLiveKitRoom,
  createLiveKitRoom,
  readParticipantMedia,
  resolveLiveKitToken,
  RoomEvent,
  Track,
} from '../../services/livekit.js';

const meetingReactionOptions = [
  { emoji: '👍', label: 'Thumbs up' },
  { emoji: '😂', label: 'Laugh' },
  { emoji: '👏', label: 'Clap' },
  { emoji: '❤️', label: 'Love' },
];

function AttachedVideoTrack({ className, muted = false, track }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) {
      return undefined;
    }

    if (!track) {
      videoElement.srcObject = null;
      return undefined;
    }

    track.attach(videoElement);
    videoElement.autoplay = true;
    videoElement.muted = muted;
    videoElement.playsInline = true;

    return () => {
      track.detach(videoElement);
    };
  }, [muted, track]);

  return <video autoPlay className={className} muted={muted} playsInline ref={videoRef} />;
}

function AttachedAudioTrack({ track }) {
  const audioRef = useRef(null);

  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) {
      return undefined;
    }

    if (!track) {
      audioElement.srcObject = null;
      return undefined;
    }

    track.attach(audioElement);
    audioElement.autoplay = true;
    audioElement.playsInline = true;

    return () => {
      track.detach(audioElement);
    };
  }, [track]);

  return <audio autoPlay className="meeting-audio-track" playsInline ref={audioRef} />;
}

function MeetingTile({ tile }) {
  return (
    <div className={`meeting-tile ${tile.isLocal ? 'meeting-tile--local' : ''}`}>
      {tile.videoTrack ? (
        <AttachedVideoTrack
          className="meeting-video"
          muted={tile.isLocal}
          track={tile.videoTrack}
        />
      ) : (
        <div className="meeting-video-placeholder">
          <div className="meeting-video-placeholder__avatar">
            {(tile.name || 'G').slice(0, 1).toUpperCase()}
          </div>
          <p>{tile.isLocal ? 'Turn on your camera to appear in the room.' : 'Camera is off.'}</p>
        </div>
      )}

      {!tile.isLocal && tile.audioTrack ? <AttachedAudioTrack track={tile.audioTrack} /> : null}

      <div className="meeting-tile__label">
        {tile.name}
        <small>{tile.subtitle}</small>
      </div>
    </div>
  );
}

const getReadableError = (error, fallbackMessage) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
};

const getSupportedRecordingMimeType = () => {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') {
    return '';
  }

  const mimeTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];

  return (
    mimeTypes.find((mimeType) => window.MediaRecorder.isTypeSupported(mimeType)) ?? ''
  );
};

const normalizeMeetingMessage = (payload) => {
  const sender =
    payload?.sender && typeof payload.sender === 'object'
      ? payload.sender
      : null;

  return {
    id: String(payload?.id ?? `meeting-message-${Date.now()}`),
    roomId: String(payload?.roomId ?? ''),
    message: String(payload?.message ?? payload?.text ?? '').trim(),
    senderId: String(
      sender?.userId ??
        payload?.senderId ??
        payload?.fromUserId ??
        payload?.sender ??
        'guest'
    ),
    senderName: String(
      sender?.username ??
        sender?.name ??
        payload?.senderName ??
        payload?.sender ??
        payload?.fromUsername ??
        'Guest'
    ).trim() || 'Guest',
    createdAt: payload?.createdAt ?? new Date().toISOString(),
  };
};

const normalizeMeetingReaction = (payload) => {
  const sender =
    payload?.sender && typeof payload.sender === 'object'
      ? payload.sender
      : null;

  return {
    id: String(payload?.id ?? `reaction-${Date.now()}`),
    roomId: String(payload?.roomId ?? ''),
    emoji: String(payload?.emoji ?? '').trim(),
    senderId: String(
      sender?.userId ??
        payload?.senderId ??
        payload?.fromUserId ??
        payload?.sender ??
        'guest'
    ),
    senderName: String(
      sender?.username ??
        sender?.name ??
        payload?.senderName ??
        payload?.sender ??
        payload?.fromUsername ??
        'Guest'
    ).trim() || 'Guest',
    createdAt: payload?.createdAt ?? new Date().toISOString(),
  };
};

const buildParticipantTile = (participant, options = {}) => {
  const { audioTrack, isScreenSharing, videoTrack } = readParticipantMedia(participant);
  const isLocal = Boolean(options.isLocal);
  const identity = String(
    participant?.identity ?? participant?.sid ?? options.fallbackId ?? 'participant'
  );
  const name = isLocal
    ? 'You'
    : String(
        participant?.name ?? participant?.identity ?? options.fallbackName ?? 'Guest'
      ).trim() || 'Guest';

  return {
    audioTrack: isLocal ? null : audioTrack,
    id: `${isLocal ? 'local' : 'remote'}:${identity}`,
    isLocal,
    isScreenSharing,
    name,
    subtitle: isScreenSharing
      ? 'Presenting screen'
      : participant?.isCameraEnabled
        ? 'Camera on'
        : 'Camera off',
    videoTrack,
  };
};

const buildParticipantTiles = (room, currentUser) => {
  if (!room) {
    return [];
  }

  const localTile = buildParticipantTile(room.localParticipant, {
    fallbackId: currentUser.userId,
    fallbackName: currentUser.username,
    isLocal: true,
  });

  const remoteTiles = Array.from(room.remoteParticipants.values()).map((participant) =>
    buildParticipantTile(participant)
  );

  return [localTile, ...remoteTiles];
};

const createRecordingStream = (room) => {
  const recordingStream = new MediaStream();
  const localParticipant = room.localParticipant;

  const screenTrack =
    localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track?.mediaStreamTrack ??
    null;
  const cameraTrack =
    localParticipant.getTrackPublication(Track.Source.Camera)?.track?.mediaStreamTrack ?? null;
  const microphoneTrack =
    localParticipant.getTrackPublication(Track.Source.Microphone)?.track?.mediaStreamTrack ??
    null;

  const activeVideoTrack = [screenTrack, cameraTrack].find(
    (track) => track && track.readyState === 'live'
  );

  if (!activeVideoTrack) {
    throw new Error('Turn on your camera or share your screen before recording.');
  }

  recordingStream.addTrack(activeVideoTrack.clone());

  if (microphoneTrack && microphoneTrack.readyState === 'live' && localParticipant.isMicrophoneEnabled) {
    recordingStream.addTrack(microphoneTrack.clone());
  }

  return recordingStream;
};

export default function MeetPage({ currentUser }) {
  const navigate = useNavigate();
  const { roomId = '' } = useParams();
  const copyTimeoutRef = useRef(null);
  const liveKitRoomRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const meetingChatPanelRef = useRef(null);
  const meetingChatRef = useRef(null);
  const meetingChatInputRef = useRef(null);
  const meetingControlsRef = useRef(null);
  const reactionTimeoutsRef = useRef(new Map());
  const recordedChunksRef = useRef([]);

  const [meetingState, setMeetingState] = useState('joining');
  const [meetingError, setMeetingError] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isReactionPickerOpen, setIsReactionPickerOpen] = useState(false);
  const [meetingMessages, setMeetingMessages] = useState([]);
  const [meetingDraft, setMeetingDraft] = useState('');
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [participantTiles, setParticipantTiles] = useState([]);

  const currentUserId = String(currentUser.userId || currentUser.username);
  const directLiveKitToken = useMemo(() => {
    const search = typeof window === 'undefined' ? '' : window.location.search;
    return resolveLiveKitToken({
      currentUser,
      search,
    });
  }, [currentUser]);
  const [liveKitToken, setLiveKitToken] = useState(() => directLiveKitToken);
  const [isLiveKitTokenLoading, setIsLiveKitTokenLoading] = useState(
    () => !directLiveKitToken && Boolean(String(roomId || '').trim())
  );

  const meetingUrl = useMemo(() => {
    if (typeof window === 'undefined') {
      return `/meet/${roomId}`;
    }

    return `${window.location.origin}/meet/${roomId}`;
  }, [roomId]);

  const participantCount = participantTiles.length;
  const remoteParticipantCount = Math.max(participantCount - 1, 0);
  const gridLayoutClass =
    participantCount <= 1 ? 'meeting-grid meeting-grid--solo' : 'meeting-grid';
  const meetingGridStyle = useMemo(
    () => ({
      '--meeting-grid-min':
        participantCount <= 1
          ? '100%'
          : participantCount === 2
            ? '320px'
            : participantCount <= 4
              ? '280px'
              : '250px',
    }),
    [participantCount]
  );

  useEffect(() => {
    let isCancelled = false;
    const normalizedRoomId = String(roomId || '').trim();

    if (!normalizedRoomId) {
      setLiveKitToken('');
      setIsLiveKitTokenLoading(false);
      return () => {
        isCancelled = true;
      };
    }

    if (directLiveKitToken) {
      setLiveKitToken(directLiveKitToken);
      setIsLiveKitTokenLoading(false);
      return () => {
        isCancelled = true;
      };
    }

    const resolveToken = async () => {
      try {
        setIsLiveKitTokenLoading(true);

        const payload = await createLiveKitToken({
          roomId: normalizedRoomId,
          token: currentUser.token,
          username: currentUser.username,
        });
        const nextToken = String(payload?.token || '').trim();

        if (!nextToken) {
          throw new Error('Local API returned an empty LiveKit token.');
        }

        if (!isCancelled) {
          setMeetingError('');
          setLiveKitToken(nextToken);
        }
      } catch (error) {
        if (!isCancelled) {
          setMeetingState('error');
          setMeetingError(
            getReadableError(error, 'Unable to create a LiveKit token for this room.')
          );
          setLiveKitToken('');
        }
      } finally {
        if (!isCancelled) {
          setIsLiveKitTokenLoading(false);
        }
      }
    };

    void resolveToken();

    return () => {
      isCancelled = true;
    };
  }, [currentUser.token, currentUser.username, directLiveKitToken, roomId]);

  const syncParticipantTiles = useCallback(
    (room) => {
      const nextTiles = buildParticipantTiles(room, currentUser);
      setParticipantTiles(nextTiles);
      setIsMuted(!room.localParticipant.isMicrophoneEnabled);
      setIsCameraEnabled(room.localParticipant.isCameraEnabled);
      setIsScreenSharing(room.localParticipant.isScreenShareEnabled);
    },
    [currentUser]
  );

  const queueFloatingReaction = useCallback((reaction) => {
    const stageReaction = {
      ...reaction,
      driftX: `${(Math.random() * 36 - 18).toFixed(0)}px`,
      driftY: `${(-80 - Math.random() * 48).toFixed(0)}px`,
      left: `${12 + Math.random() * 72}%`,
      rotation: `${(Math.random() * 16 - 8).toFixed(0)}deg`,
      top: `${18 + Math.random() * 48}%`,
    };

    setFloatingReactions((currentReactions) => [...currentReactions, stageReaction]);

    const timeoutId = window.setTimeout(() => {
      setFloatingReactions((currentReactions) =>
        currentReactions.filter((entry) => entry.id !== reaction.id)
      );
      reactionTimeoutsRef.current.delete(reaction.id);
    }, 2000);

    reactionTimeoutsRef.current.set(reaction.id, timeoutId);
  }, []);

  const stopMeetingRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      return;
    }

    recorder.stop();
  }, []);

  const startMeetingRecording = useCallback(() => {
    if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') {
      setMeetingError('Recording is not supported in this browser.');
      return;
    }

    const room = liveKitRoomRef.current;
    if (!room) {
      setMeetingError('Join the LiveKit room before starting a recording.');
      return;
    }

    try {
      setMeetingError('');
      recordedChunksRef.current = [];

      const recordingStream = createRecordingStream(room);
      const mimeType = getSupportedRecordingMimeType();
      const recorder = mimeType
        ? new window.MediaRecorder(recordingStream, { mimeType })
        : new window.MediaRecorder(recordingStream);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = (event) => {
        const nextError =
          event?.error instanceof Error
            ? event.error
            : new Error('Unable to continue the meeting recording.');

        setMeetingError(
          getReadableError(nextError, 'Unable to continue the meeting recording.')
        );
      };

      recorder.onstop = () => {
        const chunks = recordedChunksRef.current;
        recordedChunksRef.current = [];
        mediaRecorderRef.current = null;
        setIsRecording(false);

        recordingStream.getTracks().forEach((track) => {
          track.stop();
        });

        if (!chunks.length) {
          return;
        }

        const blob = new Blob(chunks, {
          type: mimeType || 'video/webm',
        });
        const downloadUrl = window.URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');

        downloadLink.href = downloadUrl;
        downloadLink.download = 'meeting-recording.webm';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();

        window.setTimeout(() => {
          window.URL.revokeObjectURL(downloadUrl);
        }, 1000);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setIsRecording(true);
    } catch (error) {
      setMeetingError(
        getReadableError(error, 'Unable to start the meeting recording.')
      );
    }
  }, []);

  const toggleMeetingRecording = useCallback(() => {
    if (isRecording) {
      stopMeetingRecording();
      return;
    }

    startMeetingRecording();
  }, [isRecording, startMeetingRecording, stopMeetingRecording]);

  const copyMeetingLink = useCallback(async () => {
    if (!navigator.clipboard?.writeText) {
      setMeetingError('Clipboard access is unavailable in this browser.');
      return;
    }

    try {
      await navigator.clipboard.writeText(meetingUrl);
      setIsCopied(true);
      window.clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = window.setTimeout(() => {
        setIsCopied(false);
      }, 1800);
    } catch {
      setMeetingError('Unable to copy the meeting link.');
    }
  }, [meetingUrl]);

  const focusMeetingChat = useCallback(() => {
    setIsReactionPickerOpen(false);
    meetingChatPanelRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });

    window.requestAnimationFrame(() => {
      meetingChatInputRef.current?.focus();
    });
  }, []);

  const sendMeetingMessage = useCallback(
    (event) => {
      event?.preventDefault?.();

      const message = meetingDraft.trim();
      if (!message) {
        return;
      }

      setMeetingDraft('');
      socket.emit(
        'meeting-message',
        {
          message,
          roomId,
          sender: currentUser.username,
        },
        (response) => {
          if (response?.ok) {
            return;
          }

          setMeetingDraft(message);
          setMeetingError(
            String(response?.message || 'Unable to send the meeting chat message.')
          );
        }
      );
    },
    [currentUser.username, meetingDraft, roomId]
  );

  const sendReaction = useCallback(
    (emoji) => {
      socket.emit(
        'reaction',
        {
          emoji,
          roomId,
          sender: currentUser.username,
        },
        (response) => {
          if (response?.ok) {
            return;
          }

          setMeetingError(
            String(response?.message || 'Unable to send the meeting reaction.')
          );
        }
      );
    },
    [currentUser.username, roomId]
  );

  const toggleReactionPicker = useCallback(() => {
    setIsReactionPickerOpen((currentState) => !currentState);
  }, []);

  const toggleMute = useCallback(async () => {
    const room = liveKitRoomRef.current;
    if (!room) {
      return;
    }

    try {
      const nextMuted = !isMuted;
      await room.localParticipant.setMicrophoneEnabled(!nextMuted);
      syncParticipantTiles(room);
    } catch (error) {
      setMeetingError(getReadableError(error, 'Unable to update microphone state.'));
    }
  }, [isMuted, syncParticipantTiles]);

  const toggleCamera = useCallback(async () => {
    const room = liveKitRoomRef.current;
    if (!room) {
      return;
    }

    try {
      const nextCameraEnabled = !isCameraEnabled;
      await room.localParticipant.setCameraEnabled(nextCameraEnabled);
      syncParticipantTiles(room);
    } catch (error) {
      setMeetingError(getReadableError(error, 'Unable to update camera state.'));
    }
  }, [isCameraEnabled, syncParticipantTiles]);

  const toggleScreenShare = useCallback(async () => {
    const room = liveKitRoomRef.current;
    if (!room) {
      return;
    }

    try {
      const nextScreenShareEnabled = !isScreenSharing;
      await room.localParticipant.setScreenShareEnabled(nextScreenShareEnabled);
      syncParticipantTiles(room);
    } catch (error) {
      setMeetingError(
        getReadableError(error, 'Unable to update screen sharing state.')
      );
    }
  }, [isScreenSharing, syncParticipantTiles]);

  const leaveMeeting = useCallback(() => {
    stopMeetingRecording();
    socket.emit('leave-room', { roomId });
    void liveKitRoomRef.current?.disconnect(true);
    navigate('/chat');
  }, [navigate, roomId, stopMeetingRecording]);

  useEffect(() => {
    const chatNode = meetingChatRef.current;
    if (!chatNode) {
      return;
    }

    chatNode.scrollTop = chatNode.scrollHeight;
  }, [meetingMessages]);

  useEffect(() => {
    if (!isReactionPickerOpen || typeof document === 'undefined') {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (meetingControlsRef.current?.contains(event.target)) {
        return;
      }

      setIsReactionPickerOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isReactionPickerOpen]);

  useEffect(() => {
    let isMounted = true;

    setMeetingMessages([]);
    setMeetingDraft('');
    setFloatingReactions([]);
    setIsReactionPickerOpen(false);

    if (!socket.connected) {
      socket.connect();
    }

    const handleMeetingMessage = (payload) => {
      if (String(payload?.roomId ?? '') !== roomId) {
        return;
      }

      const nextMessage = normalizeMeetingMessage(payload);
      if (!nextMessage.message) {
        return;
      }

      setMeetingMessages((currentMessages) => {
        if (currentMessages.some((message) => message.id === nextMessage.id)) {
          return currentMessages;
        }

        return [...currentMessages, nextMessage];
      });
    };

    const handleReaction = (payload) => {
      if (String(payload?.roomId ?? '') !== roomId) {
        return;
      }

      const nextReaction = normalizeMeetingReaction(payload);
      if (!nextReaction.emoji) {
        return;
      }

      queueFloatingReaction(nextReaction);
    };

    socket.on('meeting-message', handleMeetingMessage);
    socket.on('reaction', handleReaction);

    socket.emit('join-room', { roomId }, (response) => {
      if (!isMounted || response?.ok) {
        return;
      }

      setMeetingError(
        String(response?.message || 'Unable to join meeting chat and reactions.')
      );
    });

    return () => {
      isMounted = false;
      socket.off('meeting-message', handleMeetingMessage);
      socket.off('reaction', handleReaction);
      socket.emit('leave-room', { roomId });
    };
  }, [queueFloatingReaction, roomId]);

  useEffect(() => {
    if (!String(roomId || '').trim()) {
      setParticipantTiles([]);
      setMeetingState('error');
      setMeetingError('Meeting room id is missing from the URL.');
      return undefined;
    }

    if (!liveKitToken) {
      setParticipantTiles([]);
      setMeetingState(isLiveKitTokenLoading ? 'preparing' : 'error');
      if (!isLiveKitTokenLoading) {
        setMeetingError(
          'LiveKit token is required. Start the local API or open the room with a valid token.'
        );
      }
      return undefined;
    }

    let isMounted = true;
    const room = createLiveKitRoom();

    liveKitRoomRef.current = room;
    setMeetingError('');
    setMeetingState('preparing');
    setParticipantTiles([]);
    setIsRecording(false);

    const syncFromRoom = () => {
      if (!isMounted) {
        return;
      }

      syncParticipantTiles(room);
    };

    const handleDisconnected = () => {
      if (!isMounted) {
        return;
      }

      setMeetingState('error');
      setParticipantTiles([]);
      setMeetingError('Disconnected from the LiveKit room.');
    };

    const handleMediaDevicesError = (error) => {
      if (!isMounted) {
        return;
      }

      setMeetingError(getReadableError(error, 'Unable to access camera or microphone.'));
    };

    room.on(RoomEvent.ConnectionStateChanged, (state) => {
      if (!isMounted) {
        return;
      }

      if (state === 'connected') {
        setMeetingState('connected');
        return;
      }

      if (state === 'reconnecting' || state === 'signalReconnecting') {
        setMeetingState('joining');
        return;
      }

      if (state === 'connecting') {
        setMeetingState('preparing');
      }
    });
    room.on(RoomEvent.ParticipantConnected, syncFromRoom);
    room.on(RoomEvent.ParticipantDisconnected, syncFromRoom);
    room.on(RoomEvent.TrackSubscribed, syncFromRoom);
    room.on(RoomEvent.TrackUnsubscribed, syncFromRoom);
    room.on(RoomEvent.LocalTrackPublished, syncFromRoom);
    room.on(RoomEvent.LocalTrackUnpublished, syncFromRoom);
    room.on(RoomEvent.TrackMuted, syncFromRoom);
    room.on(RoomEvent.TrackUnmuted, syncFromRoom);
    room.on(RoomEvent.Disconnected, handleDisconnected);
    room.on(RoomEvent.MediaDevicesError, handleMediaDevicesError);

    const connectRoom = async () => {
      try {
        await connectToLiveKitRoom({
          room,
          token: liveKitToken,
        });

        if (!isMounted) {
          await room.disconnect(true);
          return;
        }

        if (room.name && String(room.name).trim().toLowerCase() !== String(roomId).trim().toLowerCase()) {
          await room.disconnect(true);
          throw new Error('The provided LiveKit token is not scoped to this meeting room.');
        }

        await room.localParticipant.enableCameraAndMicrophone();
        syncParticipantTiles(room);
        setMeetingState('connected');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setParticipantTiles([]);
        setMeetingState('error');
        setMeetingError(getReadableError(error, 'Unable to connect to the LiveKit room.'));
      }
    };

    void connectRoom();

    const reactionTimeouts = reactionTimeoutsRef.current;

    return () => {
      isMounted = false;
      reactionTimeouts.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      reactionTimeouts.clear();
      stopMeetingRecording();
      room.removeAllListeners();
      void room.disconnect(true);
      liveKitRoomRef.current = null;
      window.clearTimeout(copyTimeoutRef.current);
    };
  }, [
    currentUser,
    isLiveKitTokenLoading,
    liveKitToken,
    roomId,
    stopMeetingRecording,
    syncParticipantTiles,
  ]);

  return (
    <div className="meeting-shell">
      <div className="orb orb-a" />
      <div className="orb orb-b" />

      <div className="glass-panel meeting-card">
        <div className="meeting-card__topbar">
          <button
            className="glass-button glass-button--ghost"
            onClick={() => navigate('/chat')}
            type="button"
          >
            <ArrowLeft size={18} />
            Back to chat
          </button>

          <div className="meeting-card__meta">
            <span className="meeting-card__badge">
              <Video size={15} />
              LiveKit room
            </span>
            <h1>{roomId}</h1>
            <p>Signed in as @{currentUser.username}</p>
          </div>

          <div className="meeting-card__toolbar">
            <button
              className="glass-button glass-button--ghost"
              onClick={copyMeetingLink}
              type="button"
            >
              {isCopied ? <Check size={18} /> : <Copy size={18} />}
              {isCopied ? 'Copied' : 'Copy meeting link'}
            </button>

            <button
              className={`glass-button ${isRecording ? 'glass-button--primary' : 'glass-button--ghost'}`}
              onClick={toggleMeetingRecording}
              type="button"
            >
              <Circle size={18} />
              {isRecording ? 'Stop recording' : 'Record meeting'}
            </button>
          </div>
        </div>

        {meetingError ? <div className="auth-error">{meetingError}</div> : null}

        <div className="meeting-card__status">
          {meetingState === 'connected'
            ? `${participantCount} participant${participantCount === 1 ? '' : 's'} in the LiveKit room`
            : meetingState === 'preparing'
              ? 'Preparing LiveKit room, camera, and microphone...'
              : meetingState === 'joining'
                ? 'Connecting to LiveKit room...'
                : 'LiveKit connection requires attention'}
        </div>

        <div className="meeting-content">
          <div className="meeting-stage">
            <div className="meeting-reaction-layer">
              {floatingReactions.map((reaction) => (
                <div
                  className="meeting-floating-reaction"
                  key={reaction.id}
                  style={{
                    left: reaction.left,
                    top: reaction.top,
                    '--meeting-reaction-drift-x': reaction.driftX,
                    '--meeting-reaction-drift-y': reaction.driftY,
                    '--meeting-reaction-rotation': reaction.rotation,
                  }}
                >
                  <span className="meeting-floating-reaction__emoji">{reaction.emoji}</span>
                  <span className="meeting-floating-reaction__sender">
                    {reaction.senderName}
                  </span>
                </div>
              ))}
            </div>

            {remoteParticipantCount === 0 ? (
              <div className="meeting-card__hint">
                Share this link with other participants to bring them into the room:
                <strong>{meetingUrl}</strong>
              </div>
            ) : null}

            <div className={gridLayoutClass} style={meetingGridStyle}>
              {participantTiles.map((tile) => (
                <MeetingTile key={tile.id} tile={tile} />
              ))}
            </div>
          </div>

          <aside className="meeting-chat" ref={meetingChatPanelRef}>
            <div className="meeting-chat__header">
              <div>
                <h2>Meeting chat</h2>
                <p>Send notes and links without leaving the call.</p>
              </div>

              <span className="meeting-chat__badge">
                <MessageSquare size={15} />
                {meetingMessages.length}
              </span>
            </div>

            <div className="meeting-chat__messages" ref={meetingChatRef}>
              {meetingMessages.length === 0 ? (
                <div className="meeting-chat__empty">
                  Messages sent in this room will appear here for everyone in the call.
                </div>
              ) : (
                meetingMessages.map((message) => {
                  const isCurrentUser = message.senderId === currentUserId;

                  return (
                    <div
                      className={`meeting-chat__message ${isCurrentUser ? 'meeting-chat__message--me' : ''}`}
                      key={message.id}
                    >
                      <span className="meeting-chat__message-sender">
                        {isCurrentUser ? 'You' : message.senderName}
                      </span>
                      <div className="meeting-chat__message-bubble">
                        <p>{message.message}</p>
                        <time dateTime={message.createdAt}>
                          {new Date(message.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </time>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form className="meeting-chat__composer" onSubmit={sendMeetingMessage}>
              <input
                className="meeting-chat__input"
                onChange={(event) => {
                  setMeetingDraft(event.target.value);
                }}
                placeholder="Send a message to everyone in the room"
                ref={meetingChatInputRef}
                type="text"
                value={meetingDraft}
              />
              <button
                className="glass-button meeting-chat__send"
                disabled={!meetingDraft.trim()}
                type="submit"
              >
                <SendHorizontal size={16} />
                Send
              </button>
            </form>
          </aside>
        </div>
      </div>

      <div className="meeting-controls" ref={meetingControlsRef}>
        <div className="meeting-controls__panel">
          <AnimatePresence>
            {isReactionPickerOpen ? (
              <div className="meeting-reaction-picker">
                {meetingReactionOptions.map((reaction) => (
                  <button
                    aria-label={reaction.label}
                    className="meeting-reaction-picker__button"
                    key={reaction.emoji}
                    onClick={() => {
                      sendReaction(reaction.emoji);
                      setIsReactionPickerOpen(false);
                    }}
                    type="button"
                  >
                    <span>{reaction.emoji}</span>
                    {reaction.label}
                  </button>
                ))}
              </div>
            ) : null}
          </AnimatePresence>

          <button
            className={`meeting-control ${isMuted ? 'meeting-control--off' : ''}`}
            onClick={() => {
              void toggleMute();
            }}
            type="button"
          >
            {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
            {isMuted ? 'Unmute' : 'Mute'}
          </button>

          <button
            className={`meeting-control ${!isCameraEnabled ? 'meeting-control--off' : ''}`}
            onClick={() => {
              void toggleCamera();
            }}
            type="button"
          >
            {isCameraEnabled ? <Video size={18} /> : <VideoOff size={18} />}
            {isCameraEnabled ? 'Camera on' : 'Camera off'}
          </button>

          <button
            className={`meeting-control ${isScreenSharing ? 'meeting-control--active' : ''}`}
            onClick={() => {
              void toggleScreenShare();
            }}
            type="button"
          >
            <MonitorUp size={18} />
            {isScreenSharing ? 'Stop sharing' : 'Share screen'}
          </button>

          <button
            className="meeting-control"
            onClick={focusMeetingChat}
            type="button"
          >
            <MessageSquare size={18} />
            Chat
          </button>

          <button
            aria-expanded={isReactionPickerOpen}
            className={`meeting-control ${isReactionPickerOpen ? 'meeting-control--active' : ''}`}
            onClick={toggleReactionPicker}
            type="button"
          >
            <Laugh size={18} />
            Reactions
          </button>

          <button
            className="meeting-control meeting-control--danger"
            onClick={leaveMeeting}
            type="button"
          >
            <PhoneOff size={18} />
            Leave meeting
          </button>
        </div>
      </div>
    </div>
  );
}
