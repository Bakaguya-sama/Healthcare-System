// User, account & role enums
export enum UserRole {
    PATIENT = 'patient',
    DOCTOR = 'doctor',
    ADMIN = 'admin',
}

export enum AccountStatus {
    ACTIVE = 'active',
    BANNED = 'banned',
}

export enum AdminRole {
    SUPER_ADMIN = 'super_admin',
    USER_MANAGER = 'user_manager',
    AI_MANAGER = 'ai_manager',
}

export enum DoctorVerificationStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    REJECTED = 'rejected',
}
