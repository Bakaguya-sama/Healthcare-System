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
import { CloudinaryService } from 'src/modules/cloudinary/cloudinary.service';
import { ConsultationSessionStatus } from '../consultations/entities/consultation.entity';
import { ConsultationsService } from '../consultations/consultations.service';
import {
  decodeCursor,
  encodeCursor,
  InvalidCursorError,
} from '../../common/pagination';

type MessageDbAttachment = {
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
};

const MESSAGE_READ_PROJECTION =
  '_id consultationId clientMessageId senderId senderType content attachments sentAt createdAt updatedAt';

@Injectable()
export class ChatService {
  private static readonly maxImageSizeBytes = 10 * 1024 * 1024;

  private static readonly maxDocumentSizeBytes = 20 * 1024 * 1024;

  private readonly allowedMimeTypes: Set<string>;

  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    private readonly consultations: ConsultationsService,
    private readonly cloudinaryService: CloudinaryService,
  ) {
    this.allowedMimeTypes = new Set(
      this.cloudinaryService.getAllowedMimeTypes(),
    );
  }

  private validateAttachment(file: UploadedAttachment): void {
    if (!file?.mimetype) {
      throw new BadRequestException('File mimetype is required');
    }

    if (!this.allowedMimeTypes.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type: ${
          file.mimetype
        }. Allowed types: ${this.cloudinaryService
          .getAllowedFileTypes()
          .join(', ')}`,
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

        const normalizedFileName = Buffer.from(
          file.originalname,
          'latin1',
        ).toString('utf8');

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
          fileName: normalizedFileName,
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
  async getConsultationDetails(consultationId: string, userId: string) {
    if (
      !Types.ObjectId.isValid(consultationId) ||
      !Types.ObjectId.isValid(userId)
    ) {
      return null;
    }

    return this.consultations.findAccessible(consultationId, userId);
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
    const consultationId = dto.consultationId;
    if (!Types.ObjectId.isValid(consultationId)) {
      throw new BadRequestException('Invalid consultation ID');
    }

    const senderObjectId = new Types.ObjectId(senderId);
    const consultationObjectId = new Types.ObjectId(consultationId);

    const consultation = await this.consultations.findDocument(consultationId);
    if (!consultation) {
      throw new NotFoundException('Consultation not found');
    }

    const isPatient = consultation.patientId.equals(senderObjectId);
    const isDoctor = consultation.doctorId.equals(senderObjectId);
    if (!isPatient && !isDoctor) {
      throw new BadRequestException(
        'Sender is not a participant of this consultation',
      );
    }

    let attachmentsForDb: MessageDbAttachment[] = [];

    if (attachments && attachments.length > 0) {
      const uploadedFiles = await this.uploadConversationFiles(
        consultationObjectId.toString(),
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

    const isCompleted =
      consultation.sessionStatus === ConsultationSessionStatus.COMPLETED;
    const isClosed =
      consultation.sessionStatus === ConsultationSessionStatus.CANCELLED;
    if (isCompleted)
      throw new BadRequestException(
        'Cannot send message in completed consultation',
      );
    if (isClosed)
      throw new BadRequestException(
        'Cannot send message in cancelled consultation',
      );

    if (isPatient && dto.senderType !== 'patient') {
      throw new BadRequestException('senderType does not match sender role');
    }
    if (isDoctor && dto.senderType !== 'doctor') {
      throw new BadRequestException('senderType does not match sender role');
    }

    if (dto.clientMessageId) {
      const existing = await this.messageModel.findOne({
        consultationId: consultationObjectId,
        clientMessageId: dto.clientMessageId,
      });
      if (existing) {
        return {
          statusCode: 200,
          message: 'Message already sent',
          data: existing,
        };
      }
    }

    let message: MessageDocument;
    try {
      message = await this.messageModel.create({
        consultationId: consultationObjectId,
        clientMessageId: dto.clientMessageId,
        senderId: senderObjectId,
        senderType: dto.senderType,
        content: dto.content,
        attachments: attachmentsForDb.length > 0 ? attachmentsForDb : [],
        sentAt: new Date(),
      });
    } catch (error: any) {
      if (error?.code === 11000 && dto.clientMessageId) {
        const existing = await this.messageModel.findOne({
          consultationId: consultationObjectId,
          clientMessageId: dto.clientMessageId,
        });
        if (existing)
          return {
            statusCode: 200,
            message: 'Message already sent',
            data: existing,
          };
      }
      throw error;
    }

    await this.consultations.recordLastMessage(
      consultationId,
      String(message.id),
      message.sentAt,
    );

    return {
      statusCode: 201,
      message: 'Message sent successfully',
      data: message,
    };
  }

  /**
   * 💬 GET MESSAGES BY SESSION
   */
  async getConsultationMessages(
    consultationId: string,
    query: QueryMessageDto,
  ) {
    if (!Types.ObjectId.isValid(consultationId)) {
      throw new BadRequestException('Invalid consultation ID');
    }

    const filter = {
      consultationId: new Types.ObjectId(consultationId),
    };
    const cursorFilter: Record<string, unknown> = { ...filter };
    if (query.cursor) {
      try {
        const cursor = decodeCursor(query.cursor);
        cursorFilter.$or = [
          { sentAt: { $lt: new Date(cursor.sortValue) } },
          {
            sentAt: new Date(cursor.sortValue),
            _id: { $lt: new Types.ObjectId(cursor.id) },
          },
        ];
      } catch (error) {
        if (error instanceof InvalidCursorError)
          throw new BadRequestException('Invalid message cursor');
        throw error;
      }
    }
    const messages = await this.messageModel
      .find(cursorFilter)
      .select(MESSAGE_READ_PROJECTION)
      .sort({ sentAt: -1, _id: -1 })
      .limit(query.limit + 1)
      .lean()
      .exec();
    const hasNextPage = messages.length > query.limit;
    const data = hasNextPage ? messages.slice(0, query.limit) : messages;
    const last = data.at(-1) as
      | { sentAt?: Date; _id?: Types.ObjectId }
      | undefined;

    return {
      statusCode: 200,
      message: 'Messages retrieved successfully',
      data,
      nextCursor:
        hasNextPage && last?.sentAt && last?._id
          ? encodeCursor({
              sortValue: last.sentAt.toISOString(),
              id: String(last._id),
            })
          : null,
      hasNextPage,
      pagination: {
        limit: query.limit,
      },
    };
  }

  /**
   * 📊 GET ALL MESSAGES
   */
  async findAll(query: QueryMessageDto) {
    const filter: any = {};

    if (query.consultationId) {
      if (!Types.ObjectId.isValid(query.consultationId)) {
        throw new BadRequestException('Invalid consultation ID');
      }
      filter.consultationId = new Types.ObjectId(query.consultationId);
    }

    const skip = (query.page - 1) * query.limit;

    const [messages, total] = await Promise.all([
      this.messageModel
        .find(filter)
        .select(MESSAGE_READ_PROJECTION)
        .sort({ sentAt: 'desc' as any, _id: 'desc' })
        .skip(skip)
        .limit(query.limit)
        .lean()
        .exec(),
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

    const message = await this.messageModel
      .findById(new Types.ObjectId(id))
      .select(MESSAGE_READ_PROJECTION)
      .lean()
      .exec();

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
