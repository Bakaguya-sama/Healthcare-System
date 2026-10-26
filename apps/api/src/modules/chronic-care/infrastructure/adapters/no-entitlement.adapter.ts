import { Injectable } from '@nestjs/common';
import type {
  CareEntitlement,
  CareProgramAccessPort,
} from '../../application/ports/care-program-access.port';
/** Safe default until CC-012 provides the billing entitlement adapter. */
@Injectable()
export class NoEntitlementAdapter implements CareProgramAccessPort {
  async check(): Promise<CareEntitlement> {
    return { eligible: false, reasonCode: 'entitlement_unavailable' };
  }
}
