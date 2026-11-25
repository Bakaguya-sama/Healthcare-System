import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const E2_REMOVE_CONTACT_LOOKUP_VERSION = 202611241000;
export const E2_REMOVE_CONTACT_LOOKUP_NAME = 'e2-remove-contact-lookup';
export const E2_REMOVE_CONTACT_LOOKUP_CHECKSUM = migrationChecksum({
  version: E2_REMOVE_CONTACT_LOOKUP_VERSION,
  name: E2_REMOVE_CONTACT_LOOKUP_NAME,
  collection: 'familycontactlookups',
  action: 'drop-obsolete-one-time-contact-lookup-collection',
});

/** Removes the temporary lookup-token store; contact search now reads users. */
export async function applyE2RemoveContactLookup(db: Db): Promise<void> {
  const collections = await db
    .listCollections({ name: 'familycontactlookups' }, { nameOnly: true })
    .toArray();
  if (collections.length > 0) {
    await db.dropCollection('familycontactlookups');
  }
}
