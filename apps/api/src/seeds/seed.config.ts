/**
 * Seed Database Configuration
 *
 * This file contains helper functions and constants for database seeding.
 * All data is generated with realistic relationships following the DB template.
 */

export const SEED_CONFIG = {
  // User roles
  ROLES: {
    PATIENT: 'patient',
    DOCTOR: 'doctor',
    ADMIN: 'admin',
  },

  // Account statuses
  ACCOUNT_STATUS: {
    ACTIVE: 'active',
    BANNED: 'banned',
  },

  // Doctor verification statuses
  VERIFICATION_STATUS: {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
  },

  // Session statuses
  SESSION_STATUS: {
    ACTIVE: 'active',
    COMPLETED: 'completed',
    PENDING: 'pending',
    REJECTED: 'rejected',
    CANCELED: 'canceled',
  },

  // AI Session statuses
  AI_SESSION_STATUS: {
    ACTIVE: 'active',
    COMPLETED: 'completed',
  },

  // Metric types
  METRIC_TYPES: {
    BLOOD_PRESSURE: 'blood_pressure',
    HEART_RATE: 'heart_rate',
    BMI: 'bmi',
    WEIGHT: 'weight',
    HEIGHT: 'height',
    WATER_INTAKE: 'water_intake',
    KCAL_INTAKE: 'kcal_intake',
  },

  // Report types
  REPORT_TYPES: {
    HARASSMENT: 'harassment',
    SPAM: 'spam',
    MISINFORMATION: 'misinformation',
    INAPPROPRIATE_CONTENT: 'inappropriate_content',
    IMPERSONATION: 'impersonation',
    FRAUD: 'fraud',
    AI_HALLUCINATION: 'ai_hallucination',
  },

  // Report statuses
  REPORT_STATUS: {
    PENDING: 'pending',
    RESOLVED: 'resolved',
  },

  // Notification types
  NOTIFICATION_TYPES: {
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    CRITICAL: 'critical',
  },

  // AI Document statuses
  DOCUMENT_STATUS: {
    PROCESSING: 'processing',
    ACTIVE: 'active',
    ERROR: 'error',
    INACTIVE: 'inactive',
  },

  // Admin roles
  ADMIN_ROLES: {
    SUPER_ADMIN: 'super_admin',
    USER_ADMIN: 'user_admin',
    AI_ADMIN: 'ai_admin',
  },

  // Risk levels
  RISK_LEVELS: {
    NORMAL: 'normal',
    WARNING: 'warning',
    DANGER: 'danger',
  },

  // Sender types
  SENDER_TYPES: {
    PATIENT: 'patient',
    DOCTOR: 'doctor',
    AI: 'ai',
  },

  // File types for AI documents
  FILE_TYPES: {
    PDF: 'pdf',
    DOCX: 'docx',
    TXT: 'txt',
  },
};

/**
 * Helper function to generate realistic health metric values
 */
export function generateHealthMetricValue(metricType: string) {
  switch (metricType) {
    case SEED_CONFIG.METRIC_TYPES.BLOOD_PRESSURE:
      return {
        systolic: {
          value: Math.floor(Math.random() * 50 + 100),
          recordedAt: new Date(),
        },
        diastolic: {
          value: Math.floor(Math.random() * 30 + 60),
          recordedAt: new Date(),
        },
      };
    case SEED_CONFIG.METRIC_TYPES.HEART_RATE:
      return {
        value: {
          value: Math.floor(Math.random() * 40 + 60),
          recordedAt: new Date(),
        },
      };
    case SEED_CONFIG.METRIC_TYPES.BMI:
      return {
        value: {
          value: Math.round((Math.random() * 12 + 18) * 10) / 10,
          recordedAt: new Date(),
        },
      };
    case SEED_CONFIG.METRIC_TYPES.WEIGHT:
      return {
        value: {
          value: Math.floor(Math.random() * 40 + 50),
          recordedAt: new Date(),
        },
      };
    case SEED_CONFIG.METRIC_TYPES.HEIGHT:
      return {
        value: {
          value: Math.floor(Math.random() * 30 + 150),
          recordedAt: new Date(),
        },
      };
    case SEED_CONFIG.METRIC_TYPES.WATER_INTAKE:
      return {
        amount: {
          value: Math.floor(Math.random() * 1000 + 1500),
          recordedAt: new Date(),
        },
      };
    case SEED_CONFIG.METRIC_TYPES.KCAL_INTAKE:
      return {
        amount: {
          value: Math.floor(Math.random() * 1500 + 1500),
          recordedAt: new Date(),
        },
      };
    default:
      return {};
  }
}

/**
 * Helper function to get metric unit
 */
export function getMetricUnit(metricType: string): string {
  switch (metricType) {
    case SEED_CONFIG.METRIC_TYPES.BLOOD_PRESSURE:
      return 'mmHg';
    case SEED_CONFIG.METRIC_TYPES.HEART_RATE:
      return 'bpm';
    case SEED_CONFIG.METRIC_TYPES.BMI:
      return 'kg/m²';
    case SEED_CONFIG.METRIC_TYPES.WEIGHT:
      return 'kg';
    case SEED_CONFIG.METRIC_TYPES.HEIGHT:
      return 'cm';
    case SEED_CONFIG.METRIC_TYPES.WATER_INTAKE:
      return 'ml';
    case SEED_CONFIG.METRIC_TYPES.KCAL_INTAKE:
      return 'kcal';
    default:
      return '';
  }
}

/**
 * Helper function to assess health risk based on metrics
 */
export function assessHealthRisk(metrics: Record<string, any>): string {
  // Check blood pressure
  if (metrics.blood_pressure) {
    const bp = metrics.blood_pressure;
    if (typeof bp === 'string') {
      const [systolic, diastolic] = bp.split('/').map(Number);
      if (systolic > 140 || diastolic > 90) {
        return SEED_CONFIG.RISK_LEVELS.DANGER;
      }
      if (systolic > 130 || diastolic > 85) {
        return SEED_CONFIG.RISK_LEVELS.WARNING;
      }
    }
  }

  // Check BMI
  if (metrics.bmi) {
    const bmi = Number(metrics.bmi);
    if (bmi > 30) {
      return SEED_CONFIG.RISK_LEVELS.DANGER;
    }
    if (bmi > 25) {
      return SEED_CONFIG.RISK_LEVELS.WARNING;
    }
  }

  return SEED_CONFIG.RISK_LEVELS.NORMAL;
}
