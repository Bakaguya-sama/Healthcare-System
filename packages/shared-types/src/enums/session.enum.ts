// Session & messaging enums
export enum AiSessionStatus {
    ACTIVE = 'active',
    COMPLETED = 'completed',
}

export enum DoctorSessionStatus {
    ACTIVE = 'active',
    COMPLETED = 'completed',
    PENDING = 'pending',
    REJECTED = 'rejected',
}

export enum MessageSenderType {
    PATIENT = 'patient',
    DOCTOR = 'doctor',
    AI = 'ai',
}
