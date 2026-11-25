import {
  AccountStatus,
  DoctorVerificationStatus,
  UserRole,
} from '../../../../core/domain/user.enums';

export const GOOGLE_PATIENT_ACCOUNT_REPOSITORY = Symbol(
  'GOOGLE_PATIENT_ACCOUNT_REPOSITORY',
);

export interface GooglePatientAccount {
  id: string;
  email?: string;
  emailVerified: boolean;
  fullName: string;
  avatarUrl?: string;
  role: UserRole;
  accountStatus: AccountStatus;
  hasPassword: boolean;
  doctorVerificationStatus?: DoctorVerificationStatus;
}

export type GoogleEmailOwner =
  | 'password_account'
  | 'google_account'
  | 'other_account'
  | null;

export type CreateGooglePatientAccountResult =
  | { kind: 'created' | 'existing_subject'; account: GooglePatientAccount }
  | {
      kind:
        | 'password_account'
        | 'google_account'
        | 'other_account'
        | 'dangling_identity'
        | 'conflict';
    };

export interface GooglePatientAccountRepositoryPort {
  findByProviderSubject(
    provider: 'google',
    providerAccountId: string,
  ): Promise<GooglePatientAccount | null>;
  findEmailOwner(email: string): Promise<GoogleEmailOwner>;
  createPatientAccount(input: {
    provider: 'google';
    providerAccountId: string;
    email?: string;
    emailVerified: boolean;
    fullName: string;
  }): Promise<CreateGooglePatientAccountResult>;
}
