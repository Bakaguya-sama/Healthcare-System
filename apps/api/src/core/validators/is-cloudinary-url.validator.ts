import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isCloudinaryUrl, isValidUrl } from '../utils/cloudinary.utils';

/**
 * ✅ CUSTOM VALIDATOR: @IsCloudinaryUrl()
 * 
 * Kiểm tra URL có phải từ Cloudinary hay không
 * 
 * Usage:
 * @IsCloudinaryUrl()
 * @IsOptional()
 * avatarUrl?: string;
 * 
 * @IsCloudinaryUrl({ each: true })
 * @IsArray()
 * verificationDocuments?: string[];
 */
@ValidatorConstraint({ name: 'isCloudinaryUrl', async: false })
export class IsCloudinaryUrlConstraint implements ValidatorConstraintInterface {
  validate(value: any): boolean {
    // Allow empty/null values - use @IsOptional() for that
    if (value === null || value === undefined || value === '') {
      return true;
    }

    // String validation
    if (typeof value === 'string') {
      return isValidUrl(value) && isCloudinaryUrl(value);
    }

    // Array validation (for { each: true })
    if (Array.isArray(value)) {
      return value.every((url) => {
        if (typeof url !== 'string') return false;
        return isValidUrl(url) && isCloudinaryUrl(url);
      });
    }

    return false;
  }

  defaultMessage(): string {
    return 'All URLs must be Cloudinary URLs (res.cloudinary.com). Please upload files via /upload endpoint first';
  }
}

/**
 * ✅ Decorator to use custom Cloudinary URL validator
 */
export function IsCloudinaryUrl(options?: ValidationOptions) {
  return function (target: any, propertyName: string) {
    registerDecorator({
      target: target.constructor,
      propertyName: propertyName,
      constraints: [],
      options: {
        message:
          'must be a valid Cloudinary URL (https://res.cloudinary.com/...)',
        ...options,
      },
      validator: IsCloudinaryUrlConstraint,
    });
  };
}
