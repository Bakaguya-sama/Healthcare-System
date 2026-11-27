export const CARE_PROGRAM_DIRECTORY_READER = Symbol(
  'CARE_PROGRAM_DIRECTORY_READER',
);

export interface CareProgramDirectoryReader {
  findPublishedProgram(
    programCode: string,
  ): Promise<{ programCode: string; diseaseKey: string } | null>;
  hasPublishedProgramForDisease(diseaseKey: string): Promise<boolean>;
}
