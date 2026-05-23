import { Injectable } from '@nestjs/common';

@Injectable()
export class PresenceService {
  private activeUsers = new Map<string, Set<string>>();

  addActiveUser(userId: string, socketId: string) {
    if (!this.activeUsers.has(userId)) {
      this.activeUsers.set(userId, new Set([socketId]));
      return true;
    }

    this.activeUsers.get(userId)!.add(socketId);
    return false;
  }

  removeActiveUser(userId: string, socketId: string) {
    const userSockets = this.activeUsers.get(userId);

    if (!userSockets) return false;

    userSockets.delete(socketId);
    if (userSockets.size === 0) {
      this.activeUsers.delete(userId);
      return true;
    }
    return false;
  }

  getActiveUsers(userId: string[]) {
    return userId.filter((id) => this.activeUsers.has(id));
  }
}
