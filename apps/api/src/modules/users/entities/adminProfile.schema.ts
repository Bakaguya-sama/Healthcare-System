import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AdminRole } from '@repo/shared-types';

@Schema({ _id: false })
export class AdminProfile {
    @Prop({ type: String, enum: AdminRole, required: true })
    adminRole: AdminRole;
}

export const AdminProfileSchema = SchemaFactory.createForClass(AdminProfile);