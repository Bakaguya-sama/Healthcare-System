import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CareProgram,
  CareProgramDocument,
  CareProgramStatus,
} from '../../domain/entities/care-program.entity';
import type { CareProgramDirectoryReader } from '../../application/ports/care-program-directory-reader.port';

@Injectable()
export class MongooseCareProgramDirectoryReader implements CareProgramDirectoryReader {
  constructor(
    @InjectModel(CareProgram.name)
    private readonly programs: Model<CareProgramDocument>,
  ) {}

  async findPublishedProgram(programCode: string) {
    const program = await this.programs
      .findOne({ programCode, status: CareProgramStatus.PUBLISHED })
      .sort({ version: -1 })
      .select('programCode diseaseKey')
      .lean()
      .exec();
    return program
      ? { programCode: program.programCode, diseaseKey: program.diseaseKey }
      : null;
  }

  async hasPublishedProgramForDisease(diseaseKey: string) {
    return this.programs
      .exists({ diseaseKey, status: CareProgramStatus.PUBLISHED })
      .then(Boolean);
  }
}
