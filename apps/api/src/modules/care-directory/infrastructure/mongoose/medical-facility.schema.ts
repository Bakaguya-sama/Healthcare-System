import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import type {
  FacilityAddress,
  FacilityContact,
  FacilityPoint,
  FacilityType,
} from '../../domain/care-directory.types';

export type MedicalFacilityDocument = HydratedDocument<MedicalFacility>;

@Schema({ _id: false })
export class FacilityGeoPoint implements FacilityPoint {
  @Prop({ required: true, enum: ['Point'] }) type: 'Point';
  @Prop({ type: [Number], required: true }) coordinates: [number, number];
}
const FacilityGeoPointSchema = SchemaFactory.createForClass(FacilityGeoPoint);

@Schema({ _id: false })
export class FacilityAddressValue implements FacilityAddress {
  @Prop() street?: string;
  @Prop() ward?: string;
  @Prop() district?: string;
  @Prop({ required: true }) province: string;
  @Prop({ required: true, enum: ['HCMC'] }) provinceCode: 'HCMC';
  @Prop({ required: true, enum: ['VN'] }) country: 'VN';
}
const FacilityAddressSchema =
  SchemaFactory.createForClass(FacilityAddressValue);

@Schema({ _id: false })
export class FacilityContactValue implements FacilityContact {
  @Prop() phone?: string;
  @Prop() website?: string;
  @Prop() bookingUrl?: string;
}
const FacilityContactSchema =
  SchemaFactory.createForClass(FacilityContactValue);

@Schema({ _id: false })
export class FacilityDuplicateReviewValue {
  @Prop({ type: Types.ObjectId, required: true })
  candidateFacilityId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, required: true, ref: 'User' })
  reviewedBy: Types.ObjectId;
  @Prop({ type: String, required: true, minlength: 10, maxlength: 300 })
  reason: string;
  @Prop({ required: true }) reviewedAt: Date;
}
const FacilityDuplicateReviewSchema = SchemaFactory.createForClass(
  FacilityDuplicateReviewValue,
);

@Schema({ timestamps: true, collection: 'medicalfacilities', minimize: false })
export class MedicalFacility {
  @Prop({
    required: true,
    enum: ['draft', 'verified', 'retired'],
    default: 'draft',
  })
  status: 'draft' | 'verified' | 'retired';
  @Prop({ required: true, min: 1, default: 1 }) revision: number;
  @Prop({ type: Types.ObjectId }) currentRevisionId?: Types.ObjectId;
  @Prop({ type: Types.ObjectId }) draftRevisionId?: Types.ObjectId;
  @Prop({ type: String, trim: true, maxlength: 200 }) name?: string;
  @Prop({ type: String, trim: true, lowercase: true, maxlength: 200 })
  normalizedName?: string;
  @Prop({
    type: String,
    enum: ['hospital', 'general_hospital', 'medical_center', 'clinic'],
  })
  facilityType?: FacilityType;
  @Prop({ type: FacilityAddressSchema }) address?: FacilityAddressValue;
  @Prop({ type: FacilityGeoPointSchema }) location?: FacilityGeoPoint;
  /** Internal, derived candidate lookup fields; never returned to Patient APIs. */
  @Prop({ type: [String], default: [] }) duplicateSearchTokens: string[];
  @Prop({ type: FacilityGeoPointSchema }) duplicateLocation?: FacilityGeoPoint;
  @Prop({ type: [String], default: [] }) specialtyCodes: string[];
  @Prop({ type: [String], default: [] }) services?: string[];
  @Prop({ type: FacilityContactSchema }) contact?: FacilityContactValue;
  @Prop({ type: String, maxlength: 1000 }) officialSourceUrl?: string;
  /** Long-lived Google reference only; provider preview fields are never persisted. */
  @Prop({ type: String, trim: true, maxlength: 256 }) googlePlaceId?: string;
  @Prop({ type: [FacilityDuplicateReviewSchema], default: [] })
  duplicateReviews: FacilityDuplicateReviewValue[];
  @Prop({ type: Types.ObjectId, required: true, ref: 'User' })
  createdBy: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User' }) verifiedBy?: Types.ObjectId;
  @Prop() verifiedAt?: Date;
  @Prop() lastCheckedAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) retiredBy?: Types.ObjectId;
  @Prop() retiredAt?: Date;
}

export const MedicalFacilitySchema =
  SchemaFactory.createForClass(MedicalFacility);
MedicalFacilitySchema.index(
  { status: 1, specialtyCodes: 1, _id: 1 },
  { name: 'status_1_specialtyCodes_1__id_1' },
);
MedicalFacilitySchema.index(
  { status: 1, 'address.provinceCode': 1, 'address.district': 1, _id: 1 },
  { name: 'status_1_province_district_id' },
);
MedicalFacilitySchema.index(
  { status: 1, duplicateSearchTokens: 1, _id: 1 },
  { name: 'status_1_duplicateSearchTokens_1__id_1' },
);
MedicalFacilitySchema.index(
  { duplicateLocation: '2dsphere' },
  { name: 'facility_duplicate_location_2dsphere' },
);
MedicalFacilitySchema.index(
  { location: '2dsphere' },
  {
    name: 'verified_location_2dsphere',
    partialFilterExpression: { status: 'verified' },
  },
);
MedicalFacilitySchema.index(
  { googlePlaceId: 1 },
  {
    name: 'googlePlaceId_1_unique',
    unique: true,
    partialFilterExpression: { googlePlaceId: { $type: 'string' } },
  },
);

@Schema({
  timestamps: true,
  collection: 'medicalfacilityrevisions',
  minimize: false,
})
export class MedicalFacilityRevision {
  @Prop({ type: Types.ObjectId, required: true, ref: MedicalFacility.name })
  facilityId: Types.ObjectId;
  @Prop({ required: true, min: 1 }) version: number;
  @Prop({ required: true, min: 1, default: 1 }) revision: number;
  @Prop({ required: true, enum: ['draft', 'verified', 'superseded'] }) status:
    | 'draft'
    | 'verified'
    | 'superseded';
  @Prop({ type: MongooseSchema.Types.Mixed, required: true }) details: Record<
    string,
    unknown
  >;
  @Prop({ type: Types.ObjectId, required: true, ref: 'User' })
  createdBy: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User' }) updatedBy?: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User' }) verifiedBy?: Types.ObjectId;
  @Prop() verifiedAt?: Date;
}

export type MedicalFacilityRevisionDocument =
  HydratedDocument<MedicalFacilityRevision>;
export const MedicalFacilityRevisionSchema = SchemaFactory.createForClass(
  MedicalFacilityRevision,
);
MedicalFacilityRevisionSchema.index(
  { facilityId: 1, version: 1 },
  { name: 'facilityId_1_version_1_unique', unique: true },
);
MedicalFacilityRevisionSchema.index(
  { facilityId: 1, status: 1, version: -1 },
  { name: 'facilityId_1_status_1_version_-1' },
);
