import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminsService } from './admins.service';
import { AdminsController } from './admins.controller';
import { Admin, AdminSchema } from './entities/admin.entity';
import { User, UserSchema } from '../auth/entities/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Admin.name, schema: AdminSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [AdminsController],
  providers: [AdminsService],
  exports: [AdminsService],
})
export class AdminsModule {}
