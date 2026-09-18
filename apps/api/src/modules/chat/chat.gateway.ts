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
import { Server } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtService } from '@nestjs/jwt';
import type { AuthSocket } from '../../core/types/auth-socket.type';
import { getUserIdFromSocket } from '../../core/utils/socket-auth.utils';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { WsThrottleGuard } from '../../core/throttling/ws-throttle.guard';
import { WsThrottle } from '../../core/throttling/ws-throttle.decorator';

@WebSocketGateway({ namespace: '/chat' })
@UseGuards(WsThrottleGuard)
@WsThrottle()
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}
  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
  afterInit() {
    this.logger.log('Chat Gateway Initialized');
  }

  async handleConnection(client: AuthSocket) {
    const userId = await getUserIdFromSocket(this.jwtService, client);
    if (!userId) return client.disconnect();
    client.userId = userId;
  }
  handleDisconnect(client: AuthSocket) {
    void client;
  }

  private async joinConsultation(
    client: AuthSocket,
    consultationId: string,
    joining: boolean,
  ) {
    const prefix = joining ? 'join_consultation' : 'leave_consultation';
    if (!client.userId)
      return client.emit(`${prefix}_error`, { message: 'Unauthorized' });
    try {
      const consultation = await this.chatService.getConsultationDetails(
        consultationId,
        client.userId,
      );
      if (!consultation)
        return client.emit(`${prefix}_error`, {
          message: 'Not a participant of this consultation',
        });
      if (joining) {
        client.join(consultationId);
        client.emit('joined_consultation', { consultationId });
      } else {
        client.leave(consultationId);
        client.emit('left_consultation', { consultationId });
      }
    } catch (error) {
      client.emit(`${prefix}_error`, { message: this.errorMessage(error) });
    }
  }
  @SubscribeMessage('join_consultation')
  handleJoinConsultation(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() consultationId: string,
  ) {
    return this.joinConsultation(client, consultationId, true);
  }
  @SubscribeMessage('leave_consultation')
  handleLeaveConsultation(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() consultationId: string,
  ) {
    return this.joinConsultation(client, consultationId, false);
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() dto: SendMessageDto,
  ) {
    if (!client.userId) return;
    try {
      const result = await this.chatService.sendMessage(client.userId, dto);
      const message = result.data || result;
      const consultationId = String(
        message.consultationId || dto.consultationId || dto.doctorSessionId,
      );
      const notification = {
        consultationId,
        sessionId: consultationId,
        lastMessageAt: new Date(message.sentAt).toISOString(),
        lastMessageId: String(message.id || message._id || ''),
        senderId: String(message.senderId),
        senderType: message.senderType,
      };
      this.server.to(consultationId).emit('consultation.message.v1', message);
      this.server.to(consultationId).emit('new_message', message);
      const consultation = await this.chatService.getConsultationDetails(
        consultationId,
        client.userId,
      );
      if (consultation) {
        this.notificationsGateway.sendToUser(
          String(consultation.doctorId),
          'chat_notification',
          notification,
        );
        this.notificationsGateway.sendToUser(
          String(consultation.patientId),
          'chat_notification',
          notification,
        );
      }
      client.emit('message_sent', message);
    } catch (error) {
      client.emit('send_message_error', {
        message: this.errorMessage(error) || 'Could not send message',
      });
    }
  }

  @SubscribeMessage('get_consultation_messages')
  async handleGetConsultationMessages(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: any,
  ) {
    if (!client.userId)
      return client.emit('get_consultation_messages_error', {
        message: 'Unauthorized',
      });
    const consultationId = data.consultationId || data.doctorSessionId;
    try {
      const consultation = await this.chatService.getConsultationDetails(
        consultationId,
        client.userId,
      );
      if (!consultation)
        return client.emit('get_consultation_messages_error', {
          message: 'Not a participant of this consultation',
        });
      const result = await this.chatService.getSessionMessages(consultationId, {
        page: 1,
        limit: Math.min(Number(data.limit) || 50, 100),
        sortBy: 'sentAt',
        sortOrder: -1,
        cursor: data.cursor,
      });
      client.emit('consultation_messages', result);
    } catch (error) {
      client.emit('get_consultation_messages_error', {
        message: this.errorMessage(error),
      });
    }
  }

  @SubscribeMessage('join_session')
  handleLegacyJoin(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() id: string,
  ) {
    return this.joinConsultation(client, id, true);
  }
  @SubscribeMessage('leave_session')
  handleLegacyLeave(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() id: string,
  ) {
    return this.joinConsultation(client, id, false);
  }
  @SubscribeMessage('get_session_messages')
  handleLegacyHistory(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: any,
  ) {
    return this.handleGetConsultationMessages(client, data);
  }
}
