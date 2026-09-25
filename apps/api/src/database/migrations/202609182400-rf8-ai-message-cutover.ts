import type { Db, Document, WithId } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const RF8_AI_MESSAGE_CUTOVER_VERSION = 202609182400;
export const RF8_AI_MESSAGE_CUTOVER_NAME = 'rf8-ai-message-cutover';
export const RF8_AI_MESSAGE_CUTOVER_CHECKSUM = migrationChecksum({
  version: RF8_AI_MESSAGE_CUTOVER_VERSION,
  name: RF8_AI_MESSAGE_CUTOVER_NAME,
  steps: [
    'create-canonical-ai-message-indexes',
    'extract-embedded-ai-conversation-messages',
    'migrate-legacy-ai-sessions-and-messages',
  ],
});

type LegacyMessage = {
  _id?: { toString(): string };
  senderType?: 'patient' | 'ai';
  content?: string;
  attachments?: unknown[];
  sentAt?: Date;
  createdAt?: Date;
};

function messageSourceKey(ownerId: unknown, message: LegacyMessage, index: number): string {
  return `${String(ownerId)}:${message._id?.toString() ?? index}`;
}

function safeTopic(content?: string): string {
  const normalized = content?.replace(/\s+/g, ' ').trim() || 'Legacy AI conversation';
  return normalized.length >= 5 ? normalized.slice(0, 500) : 'Legacy AI conversation';
}

/**
 * Makes aiconversationmessages the only runtime message source. The migration is
 * restart-safe: every imported record owns a unique legacySourceKey and a legacy
 * session owns exactly one canonical conversation.
 */
export async function applyRf8AiMessageCutover(db: Db): Promise<void> {
  const canonicalMessages = db.collection('aiconversationmessages');
  await canonicalMessages.createIndex(
    { conversationId: 1, timestamp: -1, _id: -1 },
    { name: 'conversationId_1_timestamp_-1__id_-1' },
  );
  await canonicalMessages.createIndex(
    { legacySourceKey: 1 },
    { name: 'legacySourceKey_unique', unique: true, sparse: true },
  );
  await db.collection('aiconversations').createIndex(
    { legacyAiSessionId: 1 },
    { name: 'legacyAiSessionId_unique', unique: true, sparse: true },
  );

  const conversations = db.collection('aiconversations');
  for await (const conversation of conversations.find({ messages: { $type: 'array' } }).batchSize(100)) {
    const embeddedMessages = Array.isArray(conversation.messages)
      ? (conversation.messages as LegacyMessage[])
      : [];
    if (embeddedMessages.length > 0) {
      const writes = embeddedMessages.map((message, index) => ({
        updateOne: {
          filter: { legacySourceKey: `embedded:${messageSourceKey(conversation._id, message, index)}` },
          update: {
            $setOnInsert: {
              conversationId: conversation._id,
              role: message.senderType === 'ai' ? 'assistant' : (message as Document & { role?: string }).role || 'user',
              content: message.content || '',
              timestamp: message.sentAt || message.createdAt || conversation.createdAt || new Date(),
              attachments: message.attachments || [],
              legacySourceKey: `embedded:${messageSourceKey(conversation._id, message, index)}`,
            },
          },
          upsert: true,
        },
      }));
      await canonicalMessages.bulkWrite(writes, { ordered: false });
    }
    await conversations.updateOne(
      { _id: conversation._id },
      { $unset: { messages: '' } },
    );
  }

  const legacySessions = db.collection('aisessions');
  const legacyMessages = db.collection('aimessages');
  for await (const session of legacySessions.find({}).batchSize(100)) {
    const messages = await legacyMessages
      .find({ aiSessionId: session._id })
      .sort({ sentAt: 1, _id: 1 })
      .toArray() as WithId<LegacyMessage>[];
    const firstUserMessage = messages.find((message) => message.senderType === 'patient');
    const lastMessageAt = messages.at(-1)?.sentAt || session.endedAt || session.startedAt || session.createdAt || new Date();
    const result = await conversations.findOneAndUpdate(
      { legacyAiSessionId: session._id },
      {
        $setOnInsert: {
          userId: session.patientId,
          legacyAiSessionId: session._id,
          type: 'general_consultation',
          topic: safeTopic(firstUserMessage?.content),
          status: session.status === 'completed' ? 'completed' : 'active',
          messageCount: messages.length,
          totalTokensUsed: 0,
          lastMessageAt,
          createdAt: session.createdAt || session.startedAt || new Date(),
          updatedAt: session.updatedAt || lastMessageAt,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    const conversation = result;
    if (!conversation || messages.length === 0) continue;
    const writes = messages.map((message, index) => ({
      updateOne: {
        filter: { legacySourceKey: `session:${messageSourceKey(session._id, message, index)}` },
        update: {
          $setOnInsert: {
            conversationId: conversation._id,
            role: message.senderType === 'ai' ? 'assistant' : 'user',
            content: message.content || '',
            timestamp: message.sentAt || message.createdAt || session.createdAt || new Date(),
            attachments: message.attachments || [],
            legacySourceKey: `session:${messageSourceKey(session._id, message, index)}`,
          },
        },
        upsert: true,
      },
    }));
    await canonicalMessages.bulkWrite(writes, { ordered: false });
  }
}
