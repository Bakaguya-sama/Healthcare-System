import { ConversationMessage } from '../../ai-assistant/entities/ai-conversation.entity';

export type buildUserPromptType = {
  question: string;
  ragContext: string | null;
};

export interface IPromptBuilder {
  buildChatHistory(
    messages: ConversationMessage[],
  ): Array<{ role: string; parts: Array<{ text: string }> }>;
  getSystemPrompt(): Promise<string>;
  buildUserPrompt(input: buildUserPromptType): string;
  buildDynamicTriagePrompt(userMessage: string): Promise<string>;
}
