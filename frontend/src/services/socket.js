import { io } from 'socket.io-client';

import { SOCKET_PATH, SOCKET_URL } from '../config/api.js';

export const createSocketClient = () =>
  io(SOCKET_URL, {
    autoConnect: true,
    path: SOCKET_PATH,
    transports: ['websocket', 'polling'],
  });
