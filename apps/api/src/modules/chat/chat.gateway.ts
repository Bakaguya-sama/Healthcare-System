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
import { Logger } from '@nestjs/common';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtService } from '@nestjs/jwt';
import type { AuthSocket } from '../../core/types/auth-socket.type';
import { getUserIdFromSocket } from '../../core/utils/socket-auth.utils';
import { NotificationsGateway } from '../notifications/notifications.gateway';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/chat',
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private connectedUsers = new Map<string, Set<string>>();

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  afterInit() {
    this.logger.log('Chat Gateway Initialized');
  }

  async handleConnection(client: AuthSocket) {
    const userId = await getUserIdFromSocket(this.jwtService, client);
    if (!userId) {
      this.logger.warn(`Connection rejected: Invalid or missing token.`);
      return client.disconnect();
    }

    client.userId = userId;

    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }

    this.connectedUsers.get(userId)!.add(client.id);

    this.logger.log(`Client connected: ${client.id}, UserID: ${userId}`);
  }

  handleDisconnect(client: AuthSocket) {
    const userId = client.userId;
    if (userId && this.connectedUsers.has(userId)) {
      this.connectedUsers.get(userId)!.delete(client.id);
      this.logger.log(
        `Client disconnected: ${client.id}, UserID: ${client.userId}`,
      );

      if (this.connectedUsers.get(userId)!.size === 0)
        this.connectedUsers.delete(userId);
    }
  }

  @SubscribeMessage('join_session')
  async handleJoinSession(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() sessionId: string,
  ) {
    if (!client.userId) {
      client.emit('join_session_error', { message: 'Unauthorized' });
      return;
    }

    try {
      const session = await this.chatService.getSessionDetails(
        sessionId,
        client.userId,
      );
      if (!session) {
        client.emit('join_session_error', {
          message: 'Not a participant of this session',
        });
        return;
      }

      client.join(sessionId);
      this.logger.log(
        `Client ${client.id} (User: ${client.userId}) joined session: ${sessionId}`,
      );
      client.emit('joined_session', { sessionId });
    } catch (error) {
      const message = this.getErrorMessage(error);
      this.logger.error(`Error joining session: ${message}`);
      client.emit('join_session_error', { message });
    }
  }

  @SubscribeMessage('leave_session')
  async handleLeaveSession(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() sessionId: string,
  ) {
    if (!client.userId) {
      client.emit('leave_session_error', { message: 'Unauthorized' });
      return;
    }

    try {
      const session = await this.chatService.getSessionDetails(
        sessionId,
        client.userId,
      );
      if (!session) {
        client.emit('leave_session_error', {
          message: 'Not a participant of this session',
        });
        return;
      }

      client.leave(sessionId);
      this.logger.log(
        `Client ${client.id} (User: ${client.userId}) left session: ${sessionId}`,
      );
      client.emit('left_session', { sessionId });
    } catch (error) {
      const message = this.getErrorMessage(error);
      this.logger.error(`Error leaving session: ${message}`);
      client.emit('leave_session_error', { message });
    }
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() dto: SendMessageDto,
  ) {
    const senderId = client.userId;
    if (!senderId) return;

    try {
      const result = await this.chatService.sendMessage(senderId, dto);
      const message = result.data || result;
      const sessionId = String(message.doctorSessionId);
      const lastMessageAt =
        message.sentAt instanceof Date
          ? message.sentAt.toISOString()
          : new Date(message.sentAt).toISOString();
      const chatNotification = {
        sessionId,
        lastMessageAt,
        lastMessageId: String(message.id || message._id || ''),
        senderId: String(message.senderId),
        senderType: message.senderType,
      };

      this.server.to(sessionId).emit('new_message', message);

      // send notifications of new messages to both sender and recepient
      const session = await this.chatService.getSessionDetails(
        sessionId,
        senderId,
      );

      this.notificationsGateway.sendToUser(
        String(session!.doctorId),
        'chat_notification',
        chatNotification,
      );
      this.notificationsGateway.sendToUser(
        String(session!.patientId),
        'chat_notification',
        chatNotification,
      );

      client.emit('message_sent', message);
    } catch (error) {
      const message = this.getErrorMessage(error);
      this.logger.error(`Error sending message: ${message}`);
      client.emit('send_message_error', {
        message: message || 'Could not send message',
      });
    }
  }

  @SubscribeMessage('get_session_messages')
  async handleGetSessionMessages(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: any,
  ) {
    if (!client.userId) {
      client.emit('get_session_messages_error', { message: 'Unauthorized' });
      return;
    }

    try {
      const session = await this.chatService.getSessionDetails(
        data.doctorSessionId,
        client.userId,
      );
      if (!session) {
        client.emit('get_session_messages_error', {
          message: 'Not a participant of this session',
        });
        return;
      }

      const result = await this.chatService.getSessionMessages(
        data.doctorSessionId,
        {
          page: 1,
          limit: 50,
          sortBy: 'sentAt',
          sortOrder: -1 as 1 | -1,
        },
      );
      client.emit('session_messages', result);
    } catch (error) {
      const message = this.getErrorMessage(error);
      this.logger.error(`Error fetching session messages: ${message}`);
      client.emit('get_session_messages_error', { message });
    }
  }
}
