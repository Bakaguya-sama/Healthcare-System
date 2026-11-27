import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  ArrayUnique,
  IsBoolean,
  IsEnum,
  IsInt,
  IsIn,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
  ValidateNested,
} from 'class-validator';
import {
  GOOGLE_PLACE_TYPE_FILTERS,
  type GooglePlaceTypeFilter,
} from '../../application/ports/care-directory.ports';

export enum DirectoryFacilityTypeDto {
  HOSPITAL = 'hospital',
  GENERAL_HOSPITAL = 'general_hospital',
  MEDICAL_CENTER = 'medical_center',
  CLINIC = 'clinic',
}
export enum FacilityDirectoryStatusDto {
  DRAFT = 'draft',
  VERIFIED = 'verified',
  RETIRED = 'retired',
}
export enum SpecialtyMappingScopeDto {
  PROGRAM = 'program',
  DISEASE = 'disease',
}

export class FacilityLocationInputDto {
  @ApiProperty({ minimum: -180, maximum: 180, example: 106.7009 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;
  @ApiProperty({ minimum: -90, maximum: 90, example: 10.7769 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;
}

export class MapCandidatePreviewDto {
  @ApiProperty({ example: 'ChIJxxxxxxxxxxxxxxxx' })
  placeId: string;

  @ApiPropertyOptional({ example: 'Phòng khám minh họa - Quận 3' })
  name?: string;

  @ApiPropertyOptional({ example: 'Quận 3, Thành phố Hồ Chí Minh' })
  address?: string;

  @ApiPropertyOptional({ type: FacilityLocationInputDto })
  location?: FacilityLocationInputDto;

  @ApiPropertyOptional({ example: 'https://www.google.com/maps/...' })
  mapsUrl?: string;

  @ApiProperty({ enum: ['Google Maps'], example: 'Google Maps' })
  attribution: 'Google Maps';

  @ApiPropertyOptional({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        provider: { type: 'string' },
        providerUrl: { type: 'string' },
      },
    },
  })
  thirdPartyAttributions?: Array<{ provider: string; providerUrl?: string }>;

  @ApiPropertyOptional({ enum: ['google_maps'], example: 'google_maps' })
  source?: 'google_maps';

  @ApiPropertyOptional({ example: false })
  verifiedInternally?: false;
}

export class MapCandidateSearchDataDto {
  @ApiProperty({ enum: ['google_maps'], example: 'google_maps' })
  source: 'google_maps';

  @ApiProperty({ example: false })
  verifiedInternally: false;

  @ApiProperty({ enum: ['Google Maps'], example: 'Google Maps' })
  attribution: 'Google Maps';

  @ApiProperty({ type: [MapCandidatePreviewDto] })
  items: MapCandidatePreviewDto[];
}

export class MapCandidateSearchResponseDto {
  @ApiProperty({ type: MapCandidateSearchDataDto })
  data: MapCandidateSearchDataDto;
}

export class MapCandidatePreviewResponseDto {
  @ApiProperty({ type: MapCandidatePreviewDto })
  data: MapCandidatePreviewDto;
}

export class FacilityDraftFromMapDataDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  id: string;

  @ApiProperty({ enum: FacilityDirectoryStatusDto, example: 'draft' })
  status: FacilityDirectoryStatusDto;

  @ApiProperty({ example: 1 })
  revision: number;

  @ApiProperty({ example: 'ChIJxxxxxxxxxxxxxxxx' })
  googlePlaceId: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439012' })
  draftRevisionId: string;

  @ApiPropertyOptional({ type: MapCandidatePreviewDto })
  providerPreview?: MapCandidatePreviewDto;
}

export class FacilityDraftFromMapResponseDto {
  @ApiProperty({ type: FacilityDraftFromMapDataDto })
  data: FacilityDraftFromMapDataDto;
}

export class PatientFacilitySearchDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(60) specialtyCode?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) programCode?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) diseaseKey?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) area?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => FacilityLocationInputDto)
  location?: FacilityLocationInputDto;
  @IsOptional() @IsBoolean() locationConsent?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) radiusKm?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}

@ValidatorConstraint({ name: 'adminMapCandidateSelector', async: false })
class AdminMapCandidateSelectorConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments) {
    const input = args.object as AdminMapCandidateSearchDto;
    const hasQuery = input.query !== undefined;
    const hasSpecialty = input.specialtyCode !== undefined;
    if (hasQuery === hasSpecialty) return false;
    if (hasQuery)
      return typeof input.query === 'string' && input.query.trim().length >= 2;
    return (
      typeof input.specialtyCode === 'string' &&
      input.specialtyCode.trim().length >= 2 &&
      input.specialtyCode.trim().length <= 60
    );
  }

  defaultMessage() {
    return 'Provide exactly one of query or specialtyCode; query must contain at least 2 characters.';
  }
}

@ValidatorConstraint({ name: 'adminMapCandidateAreaLocation', async: false })
class AdminMapCandidateAreaLocationConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments) {
    const input = args.object as AdminMapCandidateSearchDto;
    const hasArea = input.area !== undefined;
    const hasLocation = input.location !== undefined;
    if (
      hasArea &&
      (typeof input.area !== 'string' ||
        input.area.trim().length < 2 ||
        input.area.trim().length > 100)
    )
      return false;
    if (hasArea && hasLocation) return false;
    if (input.specialtyCode !== undefined) return hasArea !== hasLocation;
    return true;
  }

  defaultMessage() {
    return 'Specialty search requires exactly one of area or location; area and location cannot be combined.';
  }
}

/** Admin can search Places by free text or by an active internal specialty. */
export class AdminMapCandidateSearchDto {
  @ApiPropertyOptional({
    description: 'Chọn đúng một selector: query hoặc specialtyCode.',
    example: 'cardiology',
    minLength: 2,
    maxLength: 60,
  })
  @ValidateIf(
    (input: AdminMapCandidateSearchDto) =>
      input.query === undefined || input.specialtyCode !== undefined,
  )
  @Validate(AdminMapCandidateSelectorConstraint)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  specialtyCode?: string;

  @ApiPropertyOptional({
    description:
      'Tìm theo tên cơ sở, tên chi nhánh hoặc địa chỉ; loại trừ specialtyCode.',
    example: 'Phòng khám Minh An chi nhánh Quận 3',
    minLength: 2,
    maxLength: 180,
  })
  @ValidateIf((input: AdminMapCandidateSearchDto) => input.query !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  query?: string;

  @ApiPropertyOptional({
    description:
      'Khu vực bổ sung; với tìm theo specialtyCode phải gửi thay cho location.',
    example: 'Quận 3',
    minLength: 2,
    maxLength: 100,
  })
  @ValidateIf((input: AdminMapCandidateSearchDto) => input.area !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Validate(AdminMapCandidateAreaLocationConstraint)
  area?: string;

  @ApiPropertyOptional({
    description:
      'Tọa độ để ưu tiên kết quả Places; với specialtyCode phải gửi thay cho area.',
    type: FacilityLocationInputDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => FacilityLocationInputDto)
  location?: FacilityLocationInputDto;

  @ApiPropertyOptional({
    description:
      'Loại trong taxonomy Google Text Search. Chỉ là bộ lọc provider, không gán specialty hoặc facilityType nội bộ.',
    enum: GOOGLE_PLACE_TYPE_FILTERS,
  })
  @IsOptional()
  @IsIn(GOOGLE_PLACE_TYPE_FILTERS)
  placeType?: GooglePlaceTypeFilter;

  @ApiPropertyOptional({
    description:
      'Chỉ dùng cùng location. Bán kính locationBias theo km để ưu tiên kết quả, không phải ranh giới bắt buộc.',
    type: 'integer',
    minimum: 1,
    maximum: 50,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  radiusKm?: number;
}

export class FacilityDuplicateReviewDto {
  @ApiProperty({ example: true, enum: [true] })
  @IsBoolean()
  @IsIn([true])
  confirmedDistinct: true;

  @ApiProperty({
    example: 'Hai phòng khám ở hai tầng khác nhau của cùng tòa nhà.',
    minLength: 10,
    maxLength: 300,
  })
  @IsString()
  @MinLength(10)
  @MaxLength(300)
  reason: string;

  @ApiProperty({
    type: [String],
    minItems: 1,
    maxItems: 50,
    description:
      'Các Facility ID super_admin đã đối chiếu và xác nhận khác cơ sở.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsMongoId({ each: true })
  reviewedFacilityIds: string[];
}

/** Patient deliberately requests this separate external search after internal results. */
export class PatientExternalFacilitySearchDto {
  @IsString() @MinLength(2) @MaxLength(60) specialtyCode: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) area?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => FacilityLocationInputDto)
  location?: FacilityLocationInputDto;
  @IsOptional() @IsBoolean() locationConsent?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) radiusKm?: number;
}

export class CreateFacilityDraftFromMapDto {
  @ApiProperty({ example: 'ChIJxxxxxxxxxxxxxxxx' })
  @IsString()
  @MinLength(5)
  @MaxLength(256)
  placeId: string;

  @ApiPropertyOptional({ type: () => FacilityDuplicateReviewDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => FacilityDuplicateReviewDto)
  duplicateReview?: FacilityDuplicateReviewDto;
}

export class FacilityAddressInputDto {
  @IsOptional() @IsString() @MaxLength(240) street?: string;
  @IsOptional() @IsString() @MaxLength(120) ward?: string;
  @IsOptional() @IsString() @MaxLength(120) district?: string;
  @IsString() @MinLength(2) @MaxLength(120) province: string;
}

export class FacilityContactInputDto {
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  website?: string;
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  bookingUrl?: string;
}

export class FacilityDetailsInputDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(180) name?: string;
  @IsOptional()
  @IsEnum(DirectoryFacilityTypeDto)
  facilityType?: DirectoryFacilityTypeDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => FacilityAddressInputDto)
  address?: FacilityAddressInputDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => FacilityLocationInputDto)
  location?: FacilityLocationInputDto;
  @IsOptional() @IsArray() @IsString({ each: true }) specialtyCodes?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) services?: string[];
  @IsOptional()
  @ValidateNested()
  @Type(() => FacilityContactInputDto)
  contact?: FacilityContactInputDto;
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(1000)
  officialSourceUrl?: string;
}

export class CreateFacilityDraftDto {
  @ValidateNested()
  @Type(() => FacilityDetailsInputDto)
  details: FacilityDetailsInputDto;

  @ApiPropertyOptional({ type: () => FacilityDuplicateReviewDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => FacilityDuplicateReviewDto)
  duplicateReview?: FacilityDuplicateReviewDto;
}
export class UpdateFacilityDraftDto {
  @IsOptional() @IsMongoId() revisionId?: string;
  @Type(() => Number) @IsInt() @Min(1) expectedRevision: number;
  @ValidateNested()
  @Type(() => FacilityDetailsInputDto)
  details: FacilityDetailsInputDto;
}
export class VerifyFacilityRevisionDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsMongoId()
  revisionId: string;
  @ApiProperty({ minimum: 1, example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedRevision: number;
  @ApiPropertyOptional({
    description:
      'Bắt buộc true với Facility xuất phát từ Google Places; xác nhận super_admin đã kiểm tra dữ liệu lưu lâu dài bằng nguồn chính thức độc lập.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  providerDataReviewedAgainstOfficialSource?: boolean;

  @ApiPropertyOptional({
    type: () => FacilityDuplicateReviewDto,
    description:
      'Chỉ cần khi có ứng viên trùng mới chưa được xác nhận trước đây. Quyết định được lưu theo từng cặp Facility.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => FacilityDuplicateReviewDto)
  duplicateReview?: FacilityDuplicateReviewDto;
}

export class UpdateFacilityMetadataDto {
  @ApiProperty({ example: 'ChIJxxxxxxxxxxxxxxxx' })
  @IsString()
  @MinLength(5)
  @MaxLength(256)
  placeId: string;

  @ApiProperty({ minimum: 1, example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedRevision: number;
}
export class RetireFacilityDto {
  @IsString() @MinLength(2) @MaxLength(300) reason: string;
  @Type(() => Number) @IsInt() @Min(1) expectedRevision: number;
}
export class FacilityAdminListDto {
  @IsOptional()
  @IsEnum(FacilityDirectoryStatusDto)
  status?: FacilityDirectoryStatusDto;
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  needsRecheck?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}

export class SpecialtyAdminListDto {
  @IsOptional() @IsEnum(['active', 'retired']) status?: 'active' | 'retired';
}
export class CreateMedicalSpecialtyDto {
  @IsString() @MinLength(2) @MaxLength(60) code: string;
  @IsString() @MinLength(2) @MaxLength(120) nameVi: string;
  @IsOptional() @IsArray() @IsString({ each: true }) synonyms?: string[];
}
export class UpdateMedicalSpecialtyDto {
  @IsString() @MinLength(2) @MaxLength(120) nameVi: string;
  @IsOptional() @IsArray() @IsString({ each: true }) synonyms?: string[];
  @Type(() => Number) @IsInt() @Min(1) expectedRevision: number;
}
export class RetireSpecialtyDto {
  @IsString() @MinLength(2) @MaxLength(300) reason: string;
  @Type(() => Number) @IsInt() @Min(1) expectedRevision: number;
}

export class DiseaseSpecialtyMappingListDto {
  @IsOptional()
  @IsEnum(SpecialtyMappingScopeDto)
  scope?: SpecialtyMappingScopeDto;
  @IsOptional() @IsString() @MaxLength(80) scopeKey?: string;
  @IsOptional() @IsEnum(['draft', 'published', 'retired']) status?:
    | 'draft'
    | 'published'
    | 'retired';
}
export class CreateDiseaseSpecialtyMappingDto {
  @IsEnum(SpecialtyMappingScopeDto) scope: SpecialtyMappingScopeDto;
  @IsString() @MinLength(2) @MaxLength(80) scopeKey: string;
  @IsArray() @IsString({ each: true }) specialtyCodes: string[];
  @IsArray() @IsString({ each: true }) sourceReferences: string[];
}
export class UpdateDiseaseSpecialtyMappingDto {
  @IsArray() @IsString({ each: true }) specialtyCodes: string[];
  @IsArray() @IsString({ each: true }) sourceReferences: string[];
  @Type(() => Number) @IsInt() @Min(1) expectedRevision: number;
}
export class PublishDiseaseSpecialtyMappingDto {
  @Type(() => Number) @IsInt() @Min(1) expectedRevision: number;
}
export class RetireDiseaseSpecialtyMappingDto {
  @IsString() @MinLength(2) @MaxLength(300) reason: string;
  @Type(() => Number) @IsInt() @Min(1) expectedRevision: number;
}

export class FacilityMutationHeadersDto {
  key: string;
}
