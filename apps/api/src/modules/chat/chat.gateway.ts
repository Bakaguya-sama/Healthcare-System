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
import { QueryMessageDto } from './dto/query-message.dto';
import { MessageType } from './entities/message.entity';

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
    @MessageBody() data: { receiverId: string; content: string },
  ) {
    const senderId = client.userId;
    if (!senderId) return;

    const dto: SendMessageDto = {
      receiverId: data.receiverId,
      content: data.content,
      type: MessageType.TEXT,
    };

    const result = await this.chatService.sendMessage(senderId, dto);
    const message = result.data;

    // Emit to receiver if online
    const receiverSocketId = this.connectedUsers.get(data.receiverId);
    if (receiverSocketId) {
      this.server.to(receiverSocketId).emit('new_message', message);
    }

    // Emit back to sender for confirmation
    client.emit('message_sent', message);
  }

  @SubscribeMessage('get_conversation')
  async handleGetConversation(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { otherId: string },
  ) {
    const userId = client.userId;
    if (!userId) return;

    const query: QueryMessageDto = {
      page: 1,
      limit: 50,
      sortBy: 'createdAt',
      sortOrder: -1,
    };

    const result = await this.chatService.getConversation(userId, data.otherId, query);
    client.emit('conversation', result.data);

    await this.chatService.markConversationAsRead(userId, data.otherId);
  }
}
