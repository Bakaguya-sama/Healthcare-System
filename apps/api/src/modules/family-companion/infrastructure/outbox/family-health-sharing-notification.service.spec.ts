import { Types } from 'mongoose';
import { FamilyHealthSharingNotificationService } from './family-health-sharing-notification.service';

describe('family health sharing notification', () => {
  it('notifies only the current active revision using a stable idempotency key', async () => {
    const id = new Types.ObjectId();
    const recipient = new Types.ObjectId();
    const query = {
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({ _id: id, familyUserId: recipient }),
    };
    const links = { findOne: jest.fn().mockReturnValue(query) };
    const sharings = {
      exists: jest
        .fn()
        .mockResolvedValueOnce({ _id: id })
        .mockResolvedValueOnce(null),
    };
    const notifications = { create: jest.fn().mockResolvedValue({}) };
    const service = new FamilyHealthSharingNotificationService(
      links as never,
      sharings as never,
      notifications as never,
    );
    const event = {
      familyLinkId: String(id),
      invitationVersion: 1,
      revision: 2,
    };
    await service.deliver(event);
    await service.deliver(event);
    expect(notifications.create).toHaveBeenCalledTimes(1);
    expect(notifications.create).toHaveBeenCalledWith(
      String(recipient),
      expect.objectContaining({
        idempotencyKey: `family.health-sharing.notification.${String(id)}.1.2`,
      }),
    );
  });
});
