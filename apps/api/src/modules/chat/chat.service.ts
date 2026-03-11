import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from './entities/message.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  async saveMessage(senderId: string, receiverId: string, content: string) {
    return this.messageModel.create({ senderId, receiverId, content });
  }

  async getConversation(userId1: string, userId2: string) {
    return this.messageModel
      .find({
        $or: [
          { senderId: userId1, receiverId: userId2 },
          { senderId: userId2, receiverId: userId1 },
        ],
      })
      .sort({ createdAt: 1 })
      .populate('senderId', 'name avatarUrl')
      .populate('receiverId', 'name avatarUrl');
  }

  async markAsRead(senderId: string, receiverId: string) {
    await this.messageModel.updateMany(
      { senderId, receiverId, isRead: false },
      { isRead: true },
    );
  }
}
