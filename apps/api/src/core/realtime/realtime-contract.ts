export const realtimeContract = {
  asyncapi: '3.0.0',
  info: {
    title: 'Healthcare realtime contract',
    version: '2.0.0',
    description: 'Canonical-only consultation and messaging contract.',
  },
  servers: {
    runtime: {
      host: '{host}',
      pathname: '{socketPath}',
      protocol: 'socket.io',
      variables: {
        host: { default: 'localhost:3000' },
        socketPath: { default: '/socket.io' },
      },
      security: [{ bearerAuth: [] }],
    },
  },
  channels: {
    chat: {
      address: '/chat',
      messages: {
        join_consultation: { $ref: '#/components/messages/joinConsultation' },
        leave_consultation: { $ref: '#/components/messages/leaveConsultation' },
        get_consultation_messages: {
          $ref: '#/components/messages/getConsultationMessages',
        },
        send_consultation_message: {
          $ref: '#/components/messages/sendConsultationMessage',
        },
        consultation_message: {
          $ref: '#/components/messages/messageDocument',
        },
        joined_consultation: {
          $ref: '#/components/messages/consultationRoomResult',
        },
        left_consultation: {
          $ref: '#/components/messages/consultationRoomResult',
        },
        consultation_messages: {
          $ref: '#/components/messages/consultationMessages',
        },
        consultation_message_sent: {
          $ref: '#/components/messages/messageDocument',
        },
        join_consultation_error: {
          $ref: '#/components/messages/consultationError',
        },
        leave_consultation_error: {
          $ref: '#/components/messages/consultationError',
        },
        get_consultation_messages_error: {
          $ref: '#/components/messages/consultationError',
        },
        send_consultation_message_error: {
          $ref: '#/components/messages/consultationError',
        },
      },
    },
    consultations: {
      address: '/consultations',
      messages: {
        consultation_changed: {
          $ref: '#/components/messages/consultationChanged',
        },
      },
    },
    notifications: {
      address: '/notifications',
      messages: {
        notifications: { $ref: '#/components/messages/notificationChanged' },
        consultation_message_notification: {
          $ref: '#/components/messages/consultationMessageNotification',
        },
        account_banned: { $ref: '#/components/messages/accountBanned' },
      },
    },
    presence: {
      address: '/',
      messages: {
        userStatusChanged: { $ref: '#/components/messages/presenceChanged' },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'httpApiKey',
        in: 'user',
        description:
          'JWT in handshake.auth.token or Authorization: Bearer header',
      },
    },
    messages: {
      joinConsultation: {
        payload: { type: 'string', description: 'consultationId' },
      },
      leaveConsultation: {
        payload: { type: 'string', description: 'consultationId' },
      },
      sendConsultationMessage: {
        payload: {
          type: 'object',
          required: ['consultationId', 'senderType', 'content'],
          properties: {
            consultationId: { type: 'string' },
            senderType: { type: 'string', enum: ['patient', 'doctor'] },
            content: { type: 'string' },
            clientMessageId: { type: 'string' },
          },
        },
      },
      getConsultationMessages: {
        payload: {
          type: 'object',
          required: ['consultationId'],
          properties: {
            consultationId: { type: 'string' },
            cursor: { type: 'string' },
            limit: { type: 'integer', maximum: 100 },
          },
        },
      },
      consultationRoomResult: {
        payload: {
          type: 'object',
          required: ['consultationId'],
          properties: { consultationId: { type: 'string' } },
        },
      },
      consultationMessages: { payload: { type: 'object' } },
      consultationError: {
        description:
          'Payload for *_consultation_error, get_consultation_messages_error and send_consultation_message_error.',
        payload: {
          type: 'object',
          required: ['message'],
          properties: { message: { type: 'string' } },
        },
      },
      messageDocument: { payload: { type: 'object' } },
      consultationChanged: {
        payload: {
          type: 'object',
          required: ['action', 'consultationId', 'patientId', 'doctorId'],
        },
      },
      notificationChanged: {
        payload: {
          type: 'object',
          required: ['userId', 'action'],
        },
      },
      consultationMessageNotification: {
        payload: {
          type: 'object',
          required: [
            'consultationId',
            'lastMessageAt',
            'lastMessageId',
            'senderId',
            'senderType',
          ],
        },
      },
      accountBanned: { payload: { type: 'null' } },
      presenceChanged: {
        payload: {
          type: 'object',
          required: ['userId', 'status'],
          properties: {
            userId: { type: 'string' },
            status: { type: 'string', enum: ['online', 'offline'] },
          },
        },
      },
      throttleError: {
        name: 'exception',
        payload: {
          type: 'object',
          properties: { message: { const: 'Too many socket events' } },
        },
      },
    },
  },
  'x-runtime-policy': {
    cors: 'CORS_ORIGINS allowlist',
    throttle:
      'Per API process; default 30 events/10 seconds per user and handler',
    reconnect: 'Refetch REST state and rejoin authorized rooms',
  },
} as const;
