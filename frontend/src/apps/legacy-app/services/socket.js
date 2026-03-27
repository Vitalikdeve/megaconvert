import { io } from 'socket.io-client';

const websocketUrl =
  String(import.meta.env.VITE_WS_URL || '').trim() ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173');

export const socket = io(websocketUrl, {
  autoConnect: false,
  path: '/socket.io',
  transports: ['websocket'],
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 2000,
});
