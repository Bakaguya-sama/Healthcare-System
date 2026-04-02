/**
 * 🌥️ CLOUDINARY UTILITIES
 * Helper functions for working with Cloudinary URLs and validation
 */

/**
 * ✅ Kiểm tra URL có phải từ Cloudinary hay không
 * @param url - URL cần kiểm tra
 * @returns true nếu là Cloudinary URL, false nếu không
 * 
 * Example Cloudinary URLs:
 * - https://res.cloudinary.com/{CLOUD_NAME}/image/upload/...
 * - https://res.cloudinary.com/{CLOUD_NAME}/raw/upload/...
 */
export const isCloudinaryUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  return url.includes('res.cloudinary.com');
};

/**
 * ✅ Kiểm tra URL có hợp lệ hay không (cấu trúc URL)
 * @param url - URL cần kiểm tra
 * @returns true nếu là URL hợp lệ, false nếu không
 */
export const isValidUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * ✅ Kiểm tra URL có phải từ Cloudinary và hợp lệ
 * @param url - URL cần kiểm tra
 * @returns true nếu là valid Cloudinary URL, false nếu không
 */
export const isValidCloudinaryUrl = (url: string): boolean => {
  return isValidUrl(url) && isCloudinaryUrl(url);
};

/**
 * ✅ Xây dựng error message cho URL không hợp lệ
 * @param fieldName - Tên của trường (vd: "avatarUrl", "verificationDocuments[0]")
 * @param url - URL được submit
 * @returns Error message hướng dẫn người dùng
 */
export const getCloudinaryUrlErrorMessage = (
  fieldName: string,
  url?: string,
): string => {
  if (!url) {
    return `${fieldName} là bắt buộc`;
  }

  if (!isValidUrl(url)) {
    return `${fieldName} phải là URL hợp lệ. Received: ${url}`;
  }

  if (!isCloudinaryUrl(url)) {
    return `${fieldName} phải là Cloudinary URL. Vui lòng upload file qua endpoint /upload/single trước. Received: ${url}`;
  }

  return `${fieldName} không hợp lệ`;
};

/**
 * ✅ Extract public ID từ Cloudinary URL
 * @param url - Cloudinary URL
 * @returns Public ID (vd: "healthcare/profiles/user123")
 * 
 * Example:
 * Input: https://res.cloudinary.com/mycloud/image/upload/v123/healthcare/profiles/user123.jpg
 * Output: healthcare/profiles/user123
 */
export const extractPublicIdFromUrl = (url: string): string | null => {
  if (!isCloudinaryUrl(url)) return null;

  try {
    // URL format: https://res.cloudinary.com/{CLOUD}/image/upload/{VERSION}/{PUBLIC_ID}.{EXT}
    const match = url.match(/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
    if (match && match[1]) {
      // Remove any query parameters
      return match[1].split('?')[0];
    }
  } catch (error) {
    // Silent fail - return null if can't parse
  }

  return null;
};

/**
 * ✅ Validate array of Cloudinary URLs
 * @param urls - Array of URLs
 * @param maxUrls - Maximum number of URLs allowed (default: unlimited)
 * @returns { isValid: boolean, errors: string[] }
 * 
 * Example:
 * validateCloudinaryUrlArray(['url1', 'url2'], 5)
 * Returns: { isValid: true, errors: [] }
 */
export const validateCloudinaryUrlArray = (
  urls: string[] | undefined,
  maxUrls?: number,
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Check if array exists
  if (!urls) {
    return { isValid: true, errors: [] }; // Optional field
  }

  // Check if is array
  if (!Array.isArray(urls)) {
    errors.push('Must be an array');
    return { isValid: false, errors };
  }

  // Check max URLs
  if (maxUrls && urls.length > maxUrls) {
    errors.push(`Maximum ${maxUrls} URLs allowed, received ${urls.length}`);
  }

  // Validate each URL
  urls.forEach((url, index) => {
    if (!url || typeof url !== 'string') {
      errors.push(`URL at index ${index} is not a string`);
    } else if (!isValidUrl(url)) {
      errors.push(`URL at index ${index} is not a valid URL: ${url}`);
    } else if (!isCloudinaryUrl(url)) {
      errors.push(
        `URL at index ${index} must be a Cloudinary URL. Received: ${url}`,
      );
    }
  });

  return { isValid: errors.length === 0, errors };
};
