import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { NotificationsService } from '../notifications/notifications.service';
import { Notification } from '../notifications/entities/notification.entity';

/**
 * 🔌 WEBSOCKET GATEWAY FOR NOTIFICATIONS
 *
 * KIẾN THỨC:
 * - Client kết nối qua Socket.IO (WebSocket protocol)
 * - Mỗi user có một room = userId (để broadcast specific)
 * - Notification được push real-time khi có event
 *
 * FLOW:
 * 1. Client connect → auth via JWT → join room `user_${userId}`
 * 2. Khi có notification → emit event đến room đó
 * 3. Client nhận → UI update ngay (không cần refresh)
 *
 * USES:
 * - Health metric alert (huyết áp cao)
 * - Session request (bác sĩ request tư vấn)
 * - Appointment reminder
 * - Document verification status
 */

interface AuthSocket extends Socket {
  userId?: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
    credentials: true,
  },
  namespace: '/notifications', // Separate namespace để tránh conflict
  transports: ['websocket', 'polling'], // Fallback to polling nếu WebSocket fail
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private connectedUsers = new Map<string, Set<string>>(); // userId -> Set<socketId>

  constructor(
    private jwtService: JwtService,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * 🔗 CLIENT CONNECT
   *
   * Validate JWT token từ query params
   * Join user vào room dựa trên userId
   *
   * CLIENT CODE:
   * const socket = io('http://localhost:3000/notifications', {
   *   query: { token: 'jwt_token_here' },
   *   auth: { token: 'jwt_token_here' }
   * });
   */

  afterInit() {
    this.logger.log('Notifications gateway initialized');
  }

  async handleConnection(client: AuthSocket) {
    try {
      // ✅ BƯỚC 1: Lấy token từ nhiều nguồn để tăng tính tương thích
      let token: string | undefined = client.handshake.auth.token;

      // Fallback 1: Lấy từ query params (hữu ích cho Postman cũ)
      if (
        !token &&
        client.handshake.query &&
        typeof client.handshake.query.token === 'string'
      ) {
        this.logger.log('Found token in query parameter.');
        token = client.handshake.query.token;
      }

      // Fallback 2: Lấy từ headers (giống luồng /chat)
      if (!token && client.handshake.headers.authorization) {
        this.logger.log('Found token in Authorization header.');
        token = client.handshake.headers.authorization.split(' ')[1];
      }

      if (!token) {
        this.logger.warn(`❌ Connection rejected: No token provided`);
        return client.disconnect(true);
      }

      // ✅ BƯỚC 2: Verify JWT token
      try {
        const payload = await this.jwtService.verifyAsync(token);
        const userId = payload.sub;
        if (!userId) {
          this.logger.warn(`Connection rejected: Invalid token payload.`);
          return client.disconnect();
        }

        client.userId = userId;

        // ✅ BƯỚC 3: Join user to room
        client.join(`user_${userId}`);

        // ✅ BƯỚC 4: Track user connections
        if (!this.connectedUsers.has(userId)) {
          this.connectedUsers.set(userId, new Set());
        }
        this.connectedUsers.get(userId)!.add(client.id);

        this.logger.log(
          `✅ User ${userId} connected. Total sockets: ${
            this.connectedUsers.get(userId)!.size
          }`,
        );

        // ✅ BƯỚC 5: Emit welcome message
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
    } catch (error) {
      this.logger.error('Connection error:', error);
      client.disconnect(true);
    }
  }

  /**
   * 🔌 CLIENT DISCONNECT
   */
  handleDisconnect(client: AuthSocket) {
    // ✅ Sử dụng userId đã được lưu trên socket, đáng tin cậy hơn nhiều
    const userId = client.userId;
    if (userId && this.connectedUsers.has(userId)) {
      const userSockets = this.connectedUsers.get(userId)!;
      userSockets.delete(client.id);

      this.logger.log(
        `🔌 User ${userId} disconnected. Socket: ${client.id}. Sockets remaining: ${userSockets.size}`,
      );

      if (userSockets.size === 0) {
        this.connectedUsers.delete(userId);
        this.logger.log(`⭕ User ${userId} is now fully offline.`);
      }
    }
  }

  /**
   * 📥 SUBSCRIBE MESSAGE: mark-as-read
   *
   * Client gửi event để mark notification là read
   *
   * CLIENT CODE:
   * socket.emit('mark-as-read', { notificationId: '...' });
   */
  @SubscribeMessage('mark-as-read')
  async handleMarkAsRead(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { notificationId: string },
  ) {
    try {
      const userId = client.userId;
      if (!userId) return;

      this.logger.log(
        `📖 Marking notification as read: ${data.notificationId}`,
      );

      // ✅ Mark as read in DB
      await this.notificationsService.markAsRead(userId, data.notificationId);

      // ✅ Emit back to client for UI update
      client.emit('notification-marked', {
        notificationId: data.notificationId,
        status: 'read',
      });

      return { success: true };
    } catch (error) {
      this.logger.error('Mark as read error:', error);
      client.emit('mark_as_read_error', {
        message: 'Failed to mark notification as read',
      });
    }
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

  /**
   * 📤 SEND NOTIFICATION TO USER
   *
   * Gọi từ service khác (VD: SessionsService)
   *
   * USAGE:
   * this.notificationsGateway.sendNotificationToUser(userId, {
   *   title: 'New Session',
   *   message: 'Dr. Tran wants to consult',
   *   type: 'info'
   * });
   */
  sendNotificationToUser(userId: string, notification: Partial<Notification>) {
    const roomName = `user_${userId}`;

    this.logger.log(
      `📤 Sending notification to user ${userId}: ${notification.title}`,
    );

    // ✅ Emit to user's room
    this.server.to(roomName).emit('notification', {
      ...notification,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 📤 BROADCAST NOTIFICATION TO MULTIPLE USERS
   *
   * USAGE:
   * this.notificationsGateway.broadcastNotification(
   *   ['userId1', 'userId2'],
   *   { title: 'System Alert', ... }
   * );
   */
  broadcastNotification(
    userIds: string[],
    notification: Partial<Notification>,
  ) {
    this.logger.log(`📢 Broadcasting to ${userIds.length} users`);

    userIds.forEach((userId) => {
      this.sendNotificationToUser(userId, notification);
    });
  }

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
  broadcastToAll(notification: Partial<Notification>) {
    this.logger.log(`📢 Broadcasting to ALL users`);
    this.server.emit('notification', {
      ...notification,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 📤 Gửi xác nhận đã đọc tất cả thông báo cho một user
   * @param userId - ID của user
   */
  sendMarkAllAsReadConfirmation(userId: string) {
    const roomName = `user_${userId}`;
    this.logger.log(
      `📖 Emitting mark-all-as-read confirmation to user ${userId}`,
    );
    this.server.to(roomName).emit('all-notifications-marked', {
      timestamp: new Date().toISOString(),
      message: 'All notifications have been marked as read.',
    });
  }

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
}
