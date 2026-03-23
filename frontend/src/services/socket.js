import { io } from 'socket.io-client';

const websocketUrl = import.meta.env.VITE_WS_URL;

export const socket = io(websocketUrl, {
  autoConnect: false,
  path: '/socket.io',
  transports: ['websocket'],
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 2000,
});
