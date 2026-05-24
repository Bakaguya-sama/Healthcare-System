import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import type { AuthSocket } from '../../core/types/auth-socket.type';
import { getUserIdFromSocket } from '../../core/utils/socket-auth.utils';

type NotificationGatewayActions =
  | 'send'
  | 'mark_read'
  | 'mark_all_read'
  | 'deleted';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/notifications',
  transports: ['websocket', 'polling'],
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private connectedUsers = new Map<string, Set<string>>();

  constructor(private jwtService: JwtService) {}

  afterInit() {
    this.logger.log('Notifications gateway initialized');
  }

  async handleConnection(client: AuthSocket) {
    try {
      const userId = await getUserIdFromSocket(this.jwtService, client);
      if (!userId) {
        this.logger.warn(`Connection rejected: Invalid or missing token.`);
        return client.disconnect();
      }

      client.userId = userId;

      client.join(`user_${userId}_notifications`);

      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, new Set());
      }
      this.connectedUsers.get(userId)!.add(client.id);

      this.logger.log(
        `✅ User ${userId} connected. Total sockets: ${
          this.connectedUsers.get(userId)!.size
        }`,
      );

      client.emit('connected', {
        message: 'Connected to notification service',
        userId,
        socketId: client.id,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Authentication error: ${error.message}`);
      return client.disconnect();
    }
  }

  handleDisconnect(client: AuthSocket) {
    const userId = client.userId;
    if (userId && this.connectedUsers.has(userId)) {
      const userSockets = this.connectedUsers.get(userId)!;
      userSockets.delete(client.id);

      client.leave(`user_${userId}_notifications`);

      this.logger.log(
        `🔌 User ${userId} disconnected. Socket: ${client.id}. Sockets remaining: ${userSockets.size}`,
      );

      if (userSockets.size === 0) {
        this.connectedUsers.delete(userId);
        this.logger.log(`⭕ User ${userId} is now fully offline.`);
      }
    }
  }

  handleNotifications(payload: {
    userId: string;
    action: NotificationGatewayActions;
    notification?: {
      id: string;
      title: string;
      message: string;
      isRead: boolean;
      type?: string;
      createdAt?: string | Date;
      readAt?: string | Date;
    };
  }) {
    this.server
      .to(`user_${payload.userId}_notifications`)
      .emit('notifications', payload);
  }

  /**
   * 📥 SUBSCRIBE MESSAGE: typing-indicator
   *
   * Để biết user đang gõ pesan (tùy chọn)
   */
  // @SubscribeMessage('typing')
  // handleTyping(
  //   @ConnectedSocket() socket: Socket,
  //   @MessageBody() data: { conversationId: string; isTyping: boolean },
  // ) {
  //   // Broadcast to others in same conversation
  //   socket.to(`conversation_${data.conversationId}`).emit('user-typing', {
  //     socketId: socket.id,
  //     isTyping: data.isTyping,
  //   });
  // }

  // sendNotificationToUser(userId: string, notification: Partial<Notification>) {
  //   const roomName = `user_${userId}`;

  //   this.logger.log(
  //     `📤 Sending notification to user ${userId}: ${notification.title}`,
  //   );

  //   this.server.to(roomName).emit('notification', {
  //     ...notification,
  //     timestamp: new Date().toISOString(),
  //   });
  // }

  /**
   * 📤 BROADCAST NOTIFICATION TO MULTIPLE USERS
   *
   * USAGE:
   * this.notificationsGateway.broadcastNotification(
   *   ['userId1', 'userId2'],
   *   { title: 'System Alert', ... }
   * );
   */
  // broadcastNotification(
  //   userIds: string[],
  //   notification: Partial<Notification>,
  // ) {
  //   this.logger.log(`📢 Broadcasting to ${userIds.length} users`);

  //   userIds.forEach((userId) => {
  //     this.sendNotificationToUser(userId, notification);
  //   });
  // }

  /**
   * 📤 BROADCAST TO ALL CONNECTED USERS
   *
   * USAGE (Admin only):
   * this.notificationsGateway.broadcastToAll({
   *   title: 'System Maintenance',
   *   message: 'Server will restart in 10 minutes',
   *   type: 'warning'
   * });
   */
  // broadcastToAll(notification: Partial<Notification>) {
  //   this.logger.log(`📢 Broadcasting to ALL users`);
  //   this.server.emit('notification', {
  //     ...notification,
  //     timestamp: new Date().toISOString(),
  //   });
  // }

  /**
   * � GET CONNECTED USERS COUNT
   */
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * 📊 CHECK IF USER IS ONLINE
   */
  isUserOnline(userId: string): boolean {
    return (
      this.connectedUsers.has(userId) &&
      this.connectedUsers.get(userId)!.size > 0
    );
  }

  /**
   * 📊 GET USER SOCKET COUNT
   */
  getUserSocketCount(userId: string): number {
    return this.connectedUsers.get(userId)?.size || 0;
  }

  sendToUser(userId: string, event: string, payload: any) {
    this.server.to(`user_${userId}_notifications`).emit(event, payload);
  }

  sendToMany(userIds: string[], event: string, payload: any) {
    userIds.forEach((id) => this.sendToUser(id, event, payload));
  }
}
