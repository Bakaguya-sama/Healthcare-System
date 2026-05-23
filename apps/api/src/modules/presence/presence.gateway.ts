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

@WebSocketGateway({ origin: '*' })
export class PresenceGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
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

    const isFirstConnection = this.presenceService.addActiveUser(
      userId,
      socket.id,
    );
    if (isFirstConnection) {
      this.server.emit('userStatusChanged', { userId, status: 'online' });
    }
  }

  handleDisconnect(socket: AuthSocket) {
    const userId = socket.userId;

    if (userId) {
      const isLastDisconnect = this.presenceService.removeActiveUser(
        userId,
        socket.id,
      );
      if (isLastDisconnect) {
        this.server.emit('userStatusChanged', { userId, status: 'offline' });
      }
    }
  }
}
