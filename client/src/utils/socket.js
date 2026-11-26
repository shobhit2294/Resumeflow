import { io } from 'socket.io-client';

// In production, Vercel routes /socket.io to the backend service on the
// same domain. In local development, connect to the Express server directly.
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.PROD ? window.location.origin : 'http://localhost:5000');

let socket = null;

export async function connectSocket(token) {
  if (socket?.connected) return socket;

  socket?.disconnect();
  socket = io(SOCKET_URL, {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    if (import.meta.env.DEV) {
      console.warn('Socket connection error:', error.message);
    }
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
