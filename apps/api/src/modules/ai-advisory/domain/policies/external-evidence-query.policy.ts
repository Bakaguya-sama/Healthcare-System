/** Removes direct identifiers and patient-specific history before a public literature search. */
export class ExternalEvidenceQueryPolicy {
  scrub(message: string): string | null {
    if (
      /(tôi bị|toi bi|của tôi|cua toi|đã dùng|da dung|xét nghiệm của)/i.test(
        message,
      )
    )
      return null;
    const value = message
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, ' ')
      .replace(/\b(?:\+?84|0)\d{9,10}\b/g, ' ')
      .replace(/\b\d{9,12}\b/g, ' ')
      .replace(/https?:\/\/\S+/gi, ' ')
      .replace(
        /\b(tôi|toi|bệnh nhân|benh nhan|tên|ten|ngày sinh|ngay sinh|hồ sơ|ho so|địa chỉ|dia chi)\b[^,.!;]{0,80}/gi,
        ' ',
      )
      .replace(/\s+/g, ' ')
      .trim();
    if (!value || value.length < 8) return null;
    // A first-person timeline is patient history even if it contains no explicit identifier.
    return value.slice(0, 300);
  }
}
