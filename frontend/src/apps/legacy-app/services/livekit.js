import { Room, RoomEvent, Track } from 'livekit-client';

import { LIVEKIT_TOKEN_QUERY_KEY, LIVEKIT_URL } from '../config/livekit.js';

export { LIVEKIT_URL, RoomEvent, Track };

export const createLiveKitRoom = () => new Room();

export const connectToLiveKitRoom = async ({ room, token }) => {
  await room.connect(LIVEKIT_URL, token);
  return room;
};

export const resolveLiveKitToken = ({ currentUser, search = '' }) => {
  const params = new URLSearchParams(search);

  const token =
    params.get(LIVEKIT_TOKEN_QUERY_KEY) ||
    currentUser?.liveKitToken ||
    currentUser?.livekitToken ||
    currentUser?.participantToken ||
    '';

  return String(token).trim();
};

const getPublishedTrack = (participant, source) =>
  participant?.getTrackPublication?.(source)?.track ?? null;

export const readParticipantMedia = (participant) => {
  const screenTrack = getPublishedTrack(participant, Track.Source.ScreenShare);
  const cameraTrack = getPublishedTrack(participant, Track.Source.Camera);
  const audioTrack = getPublishedTrack(participant, Track.Source.Microphone);

  return {
    audioTrack,
    isScreenSharing: Boolean(screenTrack),
    videoTrack: screenTrack || cameraTrack || null,
  };
};
