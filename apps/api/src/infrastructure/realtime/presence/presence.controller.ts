import { Controller, Post, Body } from '@nestjs/common';
import { PresenceService } from './presence.service';

@Controller('presence')
export class PresenceController {
  constructor(private readonly presenceService: PresenceService) {}

  @Post('status')
  async checkUsersStatus(@Body() body: { userIds: string[] }) {
    const onlineUsers = await this.presenceService.getActiveUsers(body.userIds);
    return {
      statusCode: 200,
      data: {
        onlineUserIds: onlineUsers,
      },
    };
  }
}
