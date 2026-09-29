import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConsultationHeartbeatService } from './consultation-heartbeat.service';

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

  constructor(
    private readonly jwtService: JwtService,
    private readonly heartbeats: ConsultationHeartbeatService,
  ) {}

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

  @SubscribeMessage('consultation_heartbeat')
  async recordHeartbeat(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: { consultationId?: string },
  ) {
    if (!client.userId) throw new WsException('Unauthenticated socket');
    if (!payload?.consultationId) {
      throw new WsException('consultationId is required');
    }
    try {
      return await this.heartbeats.record(payload.consultationId, client.userId);
    } catch (error: unknown) {
      throw new WsException(
        error instanceof Error ? error.message : 'Heartbeat rejected',
      );
    }
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
