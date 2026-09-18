import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { PresenceService } from './presence.service';
import { JwtService } from '@nestjs/jwt';
import type { AuthSocket } from '../../core/types/auth-socket.type';
import { getUserIdFromSocket } from '../../core/utils/socket-auth.utils';

@WebSocketGateway()
export class PresenceGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly heartbeatTimers = new Map<string, ReturnType<typeof setInterval>>();
  @WebSocketServer()
  server: Server;

  constructor(
    private jwtService: JwtService,
    private readonly presenceService: PresenceService,
  ) {}

  async handleConnection(socket: AuthSocket) {
    const userId = await getUserIdFromSocket(this.jwtService, socket);
    if (!userId) {
      return socket.disconnect();
    }

    socket.userId = userId;

    const isFirstConnection = await this.presenceService.addActiveUser(
      userId,
      socket.id,
    );
    if (isFirstConnection) {
      this.server.emit('userStatusChanged', { userId, status: 'online' });
    }
    this.heartbeatTimers.set(socket.id, setInterval(() => {
      void this.presenceService.refreshActiveUser(userId, socket.id);
    }, 60_000));
  }

  async handleDisconnect(socket: AuthSocket) {
    const timer = this.heartbeatTimers.get(socket.id);
    if (timer) clearInterval(timer);
    this.heartbeatTimers.delete(socket.id);
    const userId = socket.userId;

    if (userId) {
      const isLastDisconnect = await this.presenceService.removeActiveUser(
        userId,
        socket.id,
      );
      if (isLastDisconnect) {
        this.server.emit('userStatusChanged', { userId, status: 'offline' });
      }
    }
  }
}
