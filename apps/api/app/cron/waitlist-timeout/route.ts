import { database } from "@repo/database";
import { cascadeWaitlistNotification } from "./waitlist-cascade";

// Waitlist entries that were NOTIFIED (offered a freed-up seat) but never
// claimed it within the 24h window expire and cascade to the next WAITING
// entry for the same date+slot, if any.
export const GET = async () => {
  const expired = await database.waitlist.findMany({
    where: { status: "NOTIFIED", notifyExpiresAt: { lt: new Date() } },
  });

  for (const entry of expired) {
    await database.waitlist.update({
      data: { status: "EXPIRED" },
      where: { id: entry.id },
    });
    await cascadeWaitlistNotification(entry.date, entry.slotId);
  }

  return new Response(`OK (${expired.length} expired)`, { status: 200 });
};
