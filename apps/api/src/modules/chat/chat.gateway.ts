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

    const message = await this.chatService.saveMessage(
      senderId,
      data.receiverId,
      data.content,
    );

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

    const messages = await this.chatService.getConversation(
      userId,
      data.otherId,
    );
    client.emit('conversation', messages);

    await this.chatService.markAsRead(data.otherId, userId);
  }
}
