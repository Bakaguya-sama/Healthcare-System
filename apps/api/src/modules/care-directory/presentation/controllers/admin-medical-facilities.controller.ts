import {
  Body,
  Controller,
  Get,
  Headers,
  Patch,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiConflictResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../core/decorators/current-user.decorator';
import { Roles } from '../../../../core/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../core/guards/roles.guard';
import { UserRole } from '../../../../core/domain/user.enums';
import { ManageMedicalFacilities } from '../../application/use-cases/manage-medical-facilities.use-case';
import { SearchMapFacilityCandidates } from '../../application/use-cases/search-map-facility-candidates.use-case';
import {
  AdminMapCandidateSearchDto,
  CreateFacilityDraftDto,
  CreateFacilityDraftFromMapDto,
  FacilityDraftFromMapResponseDto,
  FacilityAdminListDto,
  MapCandidatePreviewResponseDto,
  MapCandidateSearchResponseDto,
  UpdateFacilityMetadataDto,
  RetireFacilityDto,
  UpdateFacilityDraftDto,
  VerifyFacilityRevisionDto,
} from '../dto/facility-directory.dto';

@ApiTags('admin-medical-facilities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/medical-facilities')
export class AdminMedicalFacilitiesController {
  constructor(
    private readonly facilities: ManageMedicalFacilities,
    private readonly mapSearch: SearchMapFacilityCandidates,
  ) {}

  @Get() list(
    @CurrentUser('sub') actorId: string,
    @Query() query: FacilityAdminListDto,
  ) {
    return this.facilities.list(actorId, query);
  }
  @Get(':id/map-candidate')
  @ApiOperation({
    summary: 'Lấy preview Places mới cho Facility draft',
    description:
      'Chỉ trả preview có attribution; preview không được ghi vào draft. Provider có thể không khả dụng.',
  })
  @ApiOkResponse({ type: MapCandidatePreviewResponseDto })
  previewMapCandidate(
    @CurrentUser('sub') actorId: string,
    @Param('id') id: string,
  ) {
    return this.mapSearch.previewStoredCandidate(actorId, id);
  }
  @Get(':id') get(
    @CurrentUser('sub') actorId: string,
    @Param('id') id: string,
  ) {
    return this.facilities.get(actorId, id);
  }

  @Post()
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  create(
    @CurrentUser('sub') actorId: string,
    @Headers('idempotency-key') key: string,
    @Body() dto: CreateFacilityDraftDto,
  ) {
    return this.facilities.createDraft(
      actorId,
      key,
      dto.details,
      dto.duplicateReview,
    );
  }

  @Post('map-candidates')
  @ApiOperation({
    summary: 'Tìm Google Places candidate cho danh bạ quản trị',
    description:
      'Body phải chọn đúng một selector: query hoặc specialtyCode. Query tìm theo tên cơ sở, chi nhánh hoặc địa chỉ; có thể gửi area hoặc location, không gửi cả hai. Specialty phải active và cần đúng một area/location. radiusKm chỉ đi cùng location. placeType là allowlist của Google Text Search, không gán taxonomy nội bộ. locationBias ưu tiên kết quả, không tạo ranh giới tìm kiếm cứng.',
  })
  @ApiCreatedResponse({ type: MapCandidateSearchResponseDto })
  searchMapCandidates(
    @CurrentUser('sub') actorId: string,
    @Body() dto: AdminMapCandidateSearchDto,
  ) {
    return this.mapSearch.forSuperAdmin(actorId, {
      ...dto,
      ...(dto.location
        ? {
            location: {
              longitude: dto.location.longitude,
              latitude: dto.location.latitude,
            },
          }
        : {}),
    });
  }

  @Post('from-map-candidate')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary: 'Tạo Facility draft từ Place ID đã chọn',
    description:
      'Kiểm tra super_admin và idempotency receipt trước Place Details. Request mới trả preview tạm có attribution; replay trả draft đã commit và preview có thể vắng mặt. Chỉ Place ID được lưu bền vững; tên, địa chỉ và tọa độ không được ghi vào draft.',
  })
  @ApiCreatedResponse({ type: FacilityDraftFromMapResponseDto })
  @ApiConflictResponse({
    description:
      'FACILITY_POSSIBLE_DUPLICATE trả details.candidates; exact Place ID conflict trả details.facility.',
  })
  createFromMap(
    @CurrentUser('sub') actorId: string,
    @Headers('idempotency-key') key: string,
    @Body() dto: CreateFacilityDraftFromMapDto,
  ) {
    return this.facilities.createDraftFromMapCandidate(
      actorId,
      key,
      dto.placeId,
      dto.duplicateReview,
    );
  }

  @Patch(':id')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary: 'Cập nhật metadata quản trị của Facility',
    description:
      'Hiện hỗ trợ gắn Place ID lần đầu vào Facility draft/verified. Xác minh ID qua provider; không đổi nội dung Facility hoặc thay/gỡ Place ID.',
  })
  @ApiOkResponse({ description: 'Metadata Facility đã được cập nhật.' })
  @ApiConflictResponse({
    description: 'Place ID đã thuộc Facility khác hoặc revision đã cũ.',
  })
  updateMetadata(
    @CurrentUser('sub') actorId: string,
    @Headers('idempotency-key') key: string,
    @Param('id') id: string,
    @Body() dto: UpdateFacilityMetadataDto,
  ) {
    return this.facilities.updateFacilityMetadata(actorId, key, id, dto);
  }

  @Put(':id/draft')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  updateDraft(
    @CurrentUser('sub') actorId: string,
    @Headers('idempotency-key') key: string,
    @Param('id') id: string,
    @Body() dto: UpdateFacilityDraftDto,
  ) {
    return this.facilities.updateDraft(actorId, key, id, dto);
  }

  @Post(':id/revisions')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  createRevision(
    @CurrentUser('sub') actorId: string,
    @Headers('idempotency-key') key: string,
    @Param('id') id: string,
  ) {
    return this.facilities.createRevision(actorId, key, id);
  }

  @Post(':id/actions/verify')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  verify(
    @CurrentUser('sub') actorId: string,
    @Headers('idempotency-key') key: string,
    @Param('id') id: string,
    @Body() dto: VerifyFacilityRevisionDto,
  ) {
    return this.facilities.verify(actorId, key, id, dto);
  }

  @Post(':id/actions/retire')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  retire(
    @CurrentUser('sub') actorId: string,
    @Headers('idempotency-key') key: string,
    @Param('id') id: string,
    @Body() dto: RetireFacilityDto,
  ) {
    return this.facilities.retire(actorId, key, id, dto);
  }
}
