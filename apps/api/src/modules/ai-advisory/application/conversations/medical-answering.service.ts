import { Injectable } from '@nestjs/common';

const MEDICAL_KNOWLEDGE_GAP_RESPONSE =
  'Hiện tại tôi chưa có đủ kiến thức từ nguồn dữ liệu đã được xác thực để trả lời chính xác câu hỏi này. Bạn nên tham khảo bác sĩ hoặc cơ sở y tế để được tư vấn chuyên môn.';

@Injectable()
export class MedicalAnsweringService {
  getKnowledgeGapResponse(): string {
    return MEDICAL_KNOWLEDGE_GAP_RESPONSE;
  }

  estimateConfidence(topScore: number | null, citationCount: number): number {
    if (!topScore || citationCount === 0) {
      return 0;
    }

    const scoreWeight = Math.max(0, Math.min(1, topScore));
    const citationWeight = Math.min(1, citationCount / 3);
    const confidence = scoreWeight * 0.8 + citationWeight * 0.2;

    return Number(confidence.toFixed(3));
  }
}
