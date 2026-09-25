import { SetMetadata } from '@nestjs/common';

export const WS_THROTTLE_METADATA = 'ws_throttle_policy';

export type WsThrottlePolicy = {
  limit?: number;
  ttlMs?: number;
};

export const WsThrottle = (policy: WsThrottlePolicy = {}) =>
  SetMetadata(WS_THROTTLE_METADATA, policy);
