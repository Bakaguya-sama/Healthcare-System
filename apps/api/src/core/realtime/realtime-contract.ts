export const realtimeContract = {
  asyncapi: '3.0.0',
  info: {
    title: 'Healthcare realtime contract',
    version: '1.1.0',
    description: 'RF-7 consultation chat contract. Legacy session event aliases remain supported.',
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
        get_consultation_messages: { $ref: '#/components/messages/getConsultationMessages' },
        consultation_message_v1: { $ref: '#/components/messages/messageDocument' },
        join_session: { $ref: '#/components/messages/joinSession' },
        leave_session: { $ref: '#/components/messages/leaveSession' },
        send_message: { $ref: '#/components/messages/sendMessage' },
        get_session_messages: {
          $ref: '#/components/messages/getSessionMessages',
        },
        new_message: { $ref: '#/components/messages/messageDocument' },
      },
    },
    session: {
      address: '/session',
      messages: {
        session_changed: { $ref: '#/components/messages/sessionChanged' },
      },
    },
    notifications: {
      address: '/notifications',
      messages: {
        notifications: { $ref: '#/components/messages/notificationChanged' },
        chat_notification: { $ref: '#/components/messages/chatNotification' },
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
      joinSession: { payload: { type: 'string', description: 'sessionId' } },
      leaveSession: { payload: { type: 'string', description: 'sessionId' } },
      joinConsultation: { payload: { type: 'string', description: 'consultationId' } },
      leaveConsultation: { payload: { type: 'string', description: 'consultationId' } },
      sendMessage: {
        payload: {
          type: 'object',
          required: ['consultationId', 'senderType', 'content'],
          properties: { consultationId: { type: 'string' }, clientMessageId: { type: 'string' } },
        },
      },
      getSessionMessages: {
        payload: {
          type: 'object',
          required: ['doctorSessionId'],
          properties: { doctorSessionId: { type: 'string' } },
        },
      },
      getConsultationMessages: {
        payload: {
          type: 'object',
          required: ['consultationId'],
          properties: { consultationId: { type: 'string' }, cursor: { type: 'string' }, limit: { type: 'integer' } },
        },
      },
      messageDocument: { payload: { type: 'object' } },
      sessionChanged: {
        payload: {
          type: 'object',
          required: ['action', 'sessionId', 'patientId', 'doctorId'],
        },
      },
      notificationChanged: {
        payload: {
          type: 'object',
          required: ['userId', 'action'],
        },
      },
      chatNotification: {
        payload: {
          type: 'object',
          required: [
            'sessionId',
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
