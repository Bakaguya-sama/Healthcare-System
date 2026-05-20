import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export type SessionStatus = 'created' | 'confirmed' | 'rejected' | 'completed';

interface AuthSocket extends Socket {
  userId: string;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/session',
})
export class SessionsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(SessionsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  @WebSocketServer()
  server: Server;

  afterInit() {
    this.logger.log('Sessions Gateway Initialized');
  }

  async handleConnection(client: AuthSocket) {
    const authToken =
      typeof client.handshake.auth?.token === 'string'
        ? client.handshake.auth.token
        : '';
    const headerToken = client.handshake.headers.authorization?.split(' ')[1];
    const token = authToken || headerToken;
    if (!token) {
      this.logger.warn(`Connection rejected: No token provided.`);
      return client.disconnect();
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);
      const userId = payload.sub;

      if (!userId) {
        this.logger.warn(`Connection rejected: Invalid token payload.`);
        return client.disconnect();
      }

      client.userId = userId;

      client.join(`user_${client.userId}_session`);

      this.logger.log(`Client connected: ${client.id}, UserID: ${userId}`);
    } catch (error) {
      this.logger.error(`Authentication error: ${error.message}`);
      return client.disconnect();
    }
  }

  handleDisconnect(client: AuthSocket) {
    if (client.userId) {
      client.leave(`user_${client.userId}_session`);

      this.logger.log(
        `Client disconnected: ${client.id}, UserID: ${client.userId}`,
      );
    }
  }

  emitSessionChange(payload: {
    action: SessionStatus;
    sessionId: string;
    patientId: string;
    doctorId: string;
  }) {
    this.server
      .to(`user_${payload.patientId}_session`)
      .emit('session_changed', payload);
    this.server
      .to(`user_${payload.doctorId}_session`)
      .emit('session_changed', payload);
  }
}
