import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

export type ConsultationChangedAction =
  | 'created'
  | 'updated'
  | 'accepted'
  | 'declined'
  | 'started'
  | 'completed'
  | 'cancelled';

interface AuthSocket extends Socket {
  userId: string;
}

@WebSocketGateway({ namespace: '/consultations' })
export class ConsultationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ConsultationsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  @WebSocketServer()
  server!: Server;

  afterInit() {
    this.logger.log('Consultations gateway initialized');
  }

  async handleConnection(client: AuthSocket) {
    const authToken =
      typeof client.handshake.auth?.token === 'string'
        ? client.handshake.auth.token
        : '';
    const headerToken = client.handshake.headers.authorization?.split(' ')[1];
    const token = authToken || headerToken;
    if (!token) return client.disconnect();

    try {
      const payload = await this.jwtService.verifyAsync(token);
      if (!payload.sub) return client.disconnect();
      client.userId = payload.sub;
      client.join(`user_${client.userId}_consultations`);
    } catch (error) {
      this.logger.warn(
        `Consultation socket authentication failed: ${String(error)}`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthSocket) {
    if (client.userId) client.leave(`user_${client.userId}_consultations`);
  }

  emitConsultationChanged(payload: {
    action: ConsultationChangedAction;
    consultationId: string;
    patientId: string;
    doctorId: string;
  }) {
    this.server
      .to(`user_${payload.patientId}_consultations`)
      .emit('consultation_changed', payload);
    this.server
      .to(`user_${payload.doctorId}_consultations`)
      .emit('consultation_changed', payload);
  }
}
