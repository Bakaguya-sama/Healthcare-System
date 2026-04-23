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
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { SenderType } from './entities/message.entity';
import { JwtService } from '@nestjs/jwt'; // Giả sử bạn dùng @nestjs/jwt
interface AuthSocket extends Socket {
  userId?: string;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/chat',
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private connectedUsers = new Map<string, string>(); // userId -> socketId

  // Giả sử bạn đã có JwtService được cung cấp trong module
  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
  ) {}

  afterInit() {
    this.logger.log('Chat Gateway Initialized');
  }

  async handleConnection(client: AuthSocket) {
    const token = client.handshake.headers.authorization?.split(' ')[1];
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
      this.connectedUsers.set(userId, client.id);
      this.logger.log(`Client connected: ${client.id}, UserID: ${userId}`);
    } catch (error) {
      this.logger.error(`Authentication error: ${error.message}`);
      return client.disconnect();
    }
  }

  handleDisconnect(client: AuthSocket) {
    if (client.userId) {
      this.connectedUsers.delete(client.userId);
      this.logger.log(
        `Client disconnected: ${client.id}, UserID: ${client.userId}`,
      );
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
      // Verify user is participant of this session
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
      this.logger.error(`Error joining session: ${error.message}`);
      client.emit('join_session_error', { message: error.message });
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

      // Gửi tin nhắn CHỈ đến những người trong phòng chat (session) đó
      this.server.to(dto.doctorSessionId).emit('new_message', message);

      // Emit back to sender for confirmation
      client.emit('message_sent', message);
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      client.emit('send_message_error', {
        message: error.message || 'Could not send message',
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
      // Verify user is participant of this session
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
      this.logger.error(`Error fetching session messages: ${error.message}`);
      client.emit('get_session_messages_error', { message: error.message });
    }
  }
}
