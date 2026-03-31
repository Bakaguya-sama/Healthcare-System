import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
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
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
    credentials: true,
  },
  namespace: '/notifications', // Separate namespace để tránh conflict
  transports: ['websocket', 'polling'], // Fallback to polling nếu WebSocket fail
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect {
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
  async handleConnection(socket: Socket) {
    try {
      // ✅ BƯỚC 1: Extract token từ request
      const token = socket.handshake.auth.token ||
        socket.handshake.query.token as string;

      if (!token) {
        this.logger.warn(`❌ Connection rejected: No token provided`);
        socket.disconnect(true);
        return;
      }

      // ✅ BƯỚC 2: Verify JWT token
      let decoded: any;
      try {
        decoded = this.jwtService.verify(token);
      } catch (error) {
        this.logger.warn(`❌ Invalid token: ${error.message}`);
        socket.disconnect(true);
        return;
      }

      const userId = decoded.sub;

      // ✅ BƯỚC 3: Join user to room
      socket.join(`user_${userId}`);

      // ✅ BƯỚC 4: Track user connections
      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, new Set());
      }
      this.connectedUsers.get(userId)!.add(socket.id);

      this.logger.log(
        `✅ User ${userId} connected. Total sockets: ${
          this.connectedUsers.get(userId)!.size
        }`,
      );

      // ✅ BƯỚC 5: Emit welcome message
      socket.emit('connected', {
        message: 'Connected to notification service',
        userId,
        socketId: socket.id,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error('Connection error:', error);
      socket.disconnect(true);
    }
  }

  /**
   * 🔌 CLIENT DISCONNECT
   */
  handleDisconnect(socket: Socket) {
    try {
      const token = socket.handshake.auth.token ||
        socket.handshake.query.token as string;

      if (token) {
        const decoded = this.jwtService.verify(token);
        const userId = decoded.sub;

        if (this.connectedUsers.has(userId)) {
          this.connectedUsers.get(userId)!.delete(socket.id);

          if (this.connectedUsers.get(userId)!.size === 0) {
            this.connectedUsers.delete(userId);
          }
        }

        this.logger.log(`✅ User ${userId} disconnected. Socket: ${socket.id}`);
      }
    } catch (error) {
      this.logger.error('Disconnect error:', error);
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
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { notificationId: string },
  ) {
    try {
      const token = socket.handshake.auth.token as string;
      const decoded = this.jwtService.verify(token);
      const userId = decoded.sub;

      this.logger.log(
        `📖 Marking notification as read: ${data.notificationId}`,
      );

      // ✅ Mark as read in DB
      await this.notificationsService.markAsRead(userId, data.notificationId);

      // ✅ Emit back to client for UI update
      socket.emit('notification-marked', {
        notificationId: data.notificationId,
        status: 'read',
      });

      return { success: true };
    } catch (error) {
      this.logger.error('Mark as read error:', error);
      socket.emit('error', { message: 'Failed to mark notification' });
    }
  }

  /**
   * 📥 SUBSCRIBE MESSAGE: typing-indicator
   * 
   * Để biết user đang gõ pesan (tùy chọn)
   */
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string; isTyping: boolean },
  ) {
    // Broadcast to others in same conversation
    socket.to(`conversation_${data.conversationId}`).emit('user-typing', {
      socketId: socket.id,
      isTyping: data.isTyping,
    });
  }

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
    
    this.logger.log(`📤 Sending notification to user ${userId}: ${notification.title}`);
    
    // ✅ Emit to user's room
    this.server.to(roomName).emit('notification', {
      ...notification,
      timestamp: new Date(),
      _id: undefined, // Tạm gán trước (DB sẽ set)
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
      timestamp: new Date(),
    });
  }

  /**
   * 📊 GET CONNECTED USERS COUNT
   */
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * 📊 CHECK IF USER IS ONLINE
   */
  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId) && 
      this.connectedUsers.get(userId)!.size > 0;
  }

  /**
   * 📊 GET USER SOCKET COUNT
   */
  getUserSocketCount(userId: string): number {
    return this.connectedUsers.get(userId)?.size || 0;
  }
}
