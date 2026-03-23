const browserOrigin =
  typeof window === 'undefined' ? '' : window.location.origin;

export const API_URL = '/api/backend';
export const SOCKET_URL = browserOrigin;
export const SOCKET_PATH = '/socket.io';
