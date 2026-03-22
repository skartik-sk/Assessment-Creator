import type { Server as SocketIOServer } from 'socket.io';

interface SocketRoomLike {
  emit: (event: string, payload: unknown) => void;
}

interface SocketServerLike {
  emit: (event: string, payload: unknown) => void;
  to: (room: string) => SocketRoomLike;
}

const noopRoom: SocketRoomLike = {
  emit: () => undefined,
};

const noopServer: SocketServerLike = {
  emit: () => undefined,
  to: () => noopRoom,
};

let socketServer: SocketIOServer | null = null;

export function setSocketIOServer(server: SocketIOServer) {
  socketServer = server;
}

export function clearSocketIOServer() {
  socketServer = null;
}

export function isSocketIOServerReady() {
  return Boolean(socketServer);
}

export function getSocketIOServer(): SocketServerLike {
  return socketServer ?? noopServer;
}

export function emitJobUpdate(jobId: string, status: string, data?: Record<string, unknown>) {
  getSocketIOServer().to(`job:${jobId}`).emit('job:updated', {
    jobId,
    status,
    ...data,
  });
}

export function emitJobCompleted(jobId: string, result: unknown) {
  getSocketIOServer().to(`job:${jobId}`).emit('job:completed', {
    jobId,
    result,
  });
}

export function emitJobFailed(jobId: string, error: string) {
  getSocketIOServer().to(`job:${jobId}`).emit('job:failed', {
    jobId,
    error,
  });
}
