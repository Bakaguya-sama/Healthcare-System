import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from './entities/message.entity';
import {
  SendMessageDto,
  UploadedAttachment,
  UploadedAttachmentMetadata,
} from './dto/send-message.dto';
import { QueryMessageDto } from './dto/query-message.dto';
import {
  Session,
  SessionDocument,
  SessionStatus,
} from '../sessions/entities/session.entity';
import { CloudinaryService } from 'src/modules/cloudinary/cloudinary.service';

type MessageDbAttachment = {
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
};

@Injectable()
export class ChatService {
  private static readonly maxImageSizeBytes = 10 * 1024 * 1024;

  private static readonly maxDocumentSizeBytes = 20 * 1024 * 1024;

  private readonly allowedMimeTypes = new Set<string>([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]);

  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  private validateAttachment(file: UploadedAttachment): void {
    if (!file?.mimetype) {
      throw new BadRequestException('File mimetype is required');
    }

    if (!this.allowedMimeTypes.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype}. Allowed: images, pdf, doc, docx`,
      );
    }

    const isImage = file.mimetype.startsWith('image/');
    const maxSize = isImage
      ? ChatService.maxImageSizeBytes
      : ChatService.maxDocumentSizeBytes;

    if (file.size > maxSize) {
      throw new BadRequestException(
        `${isImage ? 'Image' : 'Document'} too large (${file.size} bytes). Max allowed is ${maxSize} bytes`,
      );
    }
  }

  private async uploadConversationFiles(
    conversationId: string,
    files: UploadedAttachment[],
  ): Promise<UploadedAttachmentMetadata[]> {
    const folder = `healthcare/chat/doctors/attachments/${conversationId}`;
    const uploadedFiles: UploadedAttachmentMetadata[] = [];

    try {
      for (const file of files) {
        this.validateAttachment(file);

        const resourceType: 'image' | 'document' = file.mimetype.startsWith(
          'image/',
        )
          ? 'image'
          : 'document';

        const uploadResult = await this.cloudinaryService.uploadFile(
          file,
          folder,
          resourceType,
        );

        uploadedFiles.push({
          publicId: uploadResult.publicId,
          fileUrl: uploadResult.secureUrl,
          cloudinaryResourceType: resourceType,
          mimeType: file.mimetype,
          fileName: file.originalname,
          size: file.size,
        });
      }
    } catch (error) {
      for (const uploadedFile of uploadedFiles) {
        await this.cloudinaryService.deleteFile(
          uploadedFile.publicId,
          uploadedFile.cloudinaryResourceType,
        );
      }
      throw error;
    }

    return uploadedFiles;
  }

  /**
   * � GET SESSION DETAILS (with user verification)
   */
  async getSessionDetails(sessionId: string, userId: string) {
    if (!Types.ObjectId.isValid(sessionId) || !Types.ObjectId.isValid(userId)) {
      return null;
    }

    const sessionObjectId = new Types.ObjectId(sessionId);
    const userObjectId = new Types.ObjectId(userId);

    const session = await this.sessionModel.findOne({
      _id: sessionObjectId,
      $or: [{ patientId: userObjectId }, { doctorId: userObjectId }],
    });

    return session;
  }

  /**
   * �📝 SEND MESSAGE
   */
  async sendMessage(
    senderId: string,
    dto: SendMessageDto,
    attachments?: UploadedAttachment[],
  ) {
    if (!Types.ObjectId.isValid(senderId)) {
      throw new BadRequestException('Invalid sender ID');
    }
    if (!Types.ObjectId.isValid(dto.doctorSessionId)) {
      throw new BadRequestException('Invalid session ID');
    }

    const senderObjectId = new Types.ObjectId(senderId);
    const sessionObjectId = new Types.ObjectId(dto.doctorSessionId);

    const session = await this.sessionModel.findById(sessionObjectId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const isPatient = session.patientId.equals(senderObjectId);
    const isDoctor = session.doctorId.equals(senderObjectId);
    if (!isPatient && !isDoctor) {
      throw new BadRequestException(
        'Sender is not a participant of this session',
      );
    }

    let attachmentsForDb: MessageDbAttachment[] = [];

    if (attachments && attachments.length > 0) {
      const uploadedFiles = await this.uploadConversationFiles(
        sessionObjectId.toString(),
        attachments,
      );

      attachmentsForDb = uploadedFiles.map((file) => ({
        fileUrl: file.fileUrl,
        fileName: file.fileName,
        fileSize: file.size,
        mimeType: file.mimeType,
      }));
    } else if (dto.attachments && dto.attachments.length > 0) {
      attachmentsForDb = dto.attachments.map((att) => ({
        fileUrl: att.fileUrl,
        fileName: att.fileName,
        fileSize: att.size ?? 0,
        mimeType: att.mimeType,
      }));
    }

    if (session.status === SessionStatus.COMPLETED) {
      throw new BadRequestException('Cannot send message in completed session');
    }
    if (session.status === SessionStatus.REJECTED) {
      throw new BadRequestException('Cannot send message in rejected session');
    }

    if (isPatient && dto.senderType !== 'patient') {
      throw new BadRequestException('senderType does not match sender role');
    }
    if (isDoctor && dto.senderType !== 'doctor') {
      throw new BadRequestException('senderType does not match sender role');
    }

    const message = await this.messageModel.create({
      doctorSessionId: sessionObjectId,
      senderId: senderObjectId,
      senderType: dto.senderType,
      content: dto.content,
      attachments: attachmentsForDb.length > 0 ? attachmentsForDb : [],
      sentAt: new Date(),
    });

    return {
      statusCode: 201,
      message: 'Message sent successfully',
      data: message,
    };
  }

  /**
   * 💬 GET MESSAGES BY SESSION
   */
  async getSessionMessages(sessionId: string, query: QueryMessageDto) {
    if (!Types.ObjectId.isValid(sessionId)) {
      throw new BadRequestException('Invalid session ID');
    }

    const filter = {
      doctorSessionId: new Types.ObjectId(sessionId),
    };

    const skip = (query.page - 1) * query.limit;

    const [messages, total] = await Promise.all([
      this.messageModel
        .find(filter)
        .sort({ sentAt: 'desc' as any })
        .skip(skip)
        .limit(query.limit),
      this.messageModel.countDocuments(filter),
    ]);

    return {
      statusCode: 200,
      message: 'Messages retrieved successfully',
      data: messages,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    };
  }

  /**
   * 📊 GET ALL MESSAGES
   */
  async findAll(query: QueryMessageDto) {
    const filter: any = {};

    const skip = (query.page - 1) * query.limit;

    const [messages, total] = await Promise.all([
      this.messageModel
        .find(filter)
        .sort({ sentAt: 'desc' as any })
        .skip(skip)
        .limit(query.limit),
      this.messageModel.countDocuments(filter),
    ]);

    return {
      statusCode: 200,
      message: 'Messages retrieved successfully',
      data: messages,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    };
  }

  /**
   * 🔍 GET MESSAGE BY ID
   */
  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid message ID');
    }

    const message = await this.messageModel.findById(new Types.ObjectId(id));

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    return {
      statusCode: 200,
      message: 'Message retrieved successfully',
      data: message,
    };
  }

  /**
   * ✏️ UPDATE MESSAGE
   */
  async update(userId: string, id: string, dto: any) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid message ID');
    }

    const message = await this.messageModel.findById(new Types.ObjectId(id));

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId.toString() !== userId) {
      throw new BadRequestException('Only sender can update message');
    }

    if (dto.content) {
      message.content = dto.content;
    }

    await message.save();

    return {
      statusCode: 200,
      message: 'Message updated successfully',
      data: message,
    };
  }

  /**
   * 🗑️ DELETE MESSAGE
   */
  async remove(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid message ID');
    }

    const message = await this.messageModel.findById(new Types.ObjectId(id));

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId.toString() !== userId) {
      throw new BadRequestException('Only sender can delete message');
    }

    await this.messageModel.deleteOne({ _id: new Types.ObjectId(id) });

    return {
      statusCode: 200,
      message: 'Message deleted successfully',
    };
  }
}
