import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AdminRole } from '../../../core/domain/user.enums';

@Schema({ _id: false })
export class AdminProfile {
    @Prop({ type: String, enum: AdminRole, required: true })
    adminRole: AdminRole;
}

export const AdminProfileSchema = SchemaFactory.createForClass(AdminProfile);
