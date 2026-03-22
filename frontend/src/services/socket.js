import { io } from 'socket.io-client';

import { SOCKET_URL } from '../config/api.js';

export const createSocketClient = () =>
  io(SOCKET_URL, {
    autoConnect: true,
    transports: ['websocket', 'polling'],
  });
