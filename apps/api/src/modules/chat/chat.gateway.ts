import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { SenderType } from './entities/message.entity';

interface AuthSocket extends Socket {
  userId?: string;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, string>(); // userId -> socketId

  constructor(private readonly chatService: ChatService) {}

  handleConnection(client: AuthSocket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      this.connectedUsers.set(userId, client.id);
      client.userId = userId;
    }
  }

  handleDisconnect(client: AuthSocket) {
    if (client.userId) {
      this.connectedUsers.delete(client.userId);
    }
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: any,
  ) {
    const senderId = client.userId;
    if (!senderId) return;

    // Map string to SenderType enum
    const senderType =
      data.senderType === 'doctor' ? SenderType.DOCTOR : SenderType.PATIENT;

    const dto: SendMessageDto = {
      doctorSessionId: data.doctorSessionId,
      senderType,
      content: data.content,
    };

    const result = await this.chatService.sendMessage(senderId, dto);
    const message = result.data || result;

    // Broadcast to all connected clients in session room
    this.server.emit('new_message', message);

    // Emit back to sender for confirmation
    client.emit('message_sent', message);
  }

  @SubscribeMessage('get_session_messages')
  async handleGetSessionMessages(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: any,
  ) {
    if (!client.userId) return;

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
  }
}
