import { io } from 'socket.io-client';

const socket = io({
  transports: ['websocket', 'polling'],
  reconnectionDelay: 1000,
  reconnectionAttempts: Infinity,
});

export default socket;
