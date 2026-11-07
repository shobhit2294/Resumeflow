// In Docker/production: Nginx proxies /socket.io → backend, so use same origin.
// In local dev: Vite proxy handles /api but not /socket.io by default,
// so we connect directly to the backend.
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.PROD ? '' : 'http://localhost:5000');

let socket = null;

export async function connectSocket(token) {
  if (socket?.connected) return socket;

  // Disconnect any stale socket first
  socket?.disconnect();

  try {
    const pkg = 'socket.io-client';
    const { io } = await import(/* @vite-ignore */ pkg);
    socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('🔌 Socket connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      if (import.meta.env.DEV) {
        console.warn('Socket connect error:', err.message);
      }
    });

    return socket;
  } catch {
    // Graceful fallback if socket.io-client is optional or unavailable
    socket = {
      connected: false,
      id: null,
      on: () => {},
      off: () => {},
      emit: () => {},
      disconnect: () => { socket = null; },
    };
    return socket;
  }
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

