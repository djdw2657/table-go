import { database } from "@repo/database";
import { resend } from "@repo/email";
import { WaitlistNotificationEmail } from "@repo/email/templates/waitlist-notification";
import { env } from "@/env";

// Same logic as apps/web/app/[locale]/reservations/reservation-shared.ts's
// cascadeWaitlistNotification (and apps/app's admin copy) — duplicated
// because apps/web, apps/app, and apps/api are separately deployed Next.js
// apps that can't import each other's route-local code; only packages/* is
// shared, and this mixes @repo/database + @repo/email with domain rules
// that don't belong in either provider-swappable package. Keep all three
// copies in sync if this logic changes.
const WAITLIST_NOTIFY_WINDOW_HOURS = 24;

export async function cascadeWaitlistNotification(date: Date, slotId: string) {
  const next = await database.waitlist.findFirst({
    orderBy: { createdAt: "asc" },
    where: { date, slotId, status: "WAITING" },
  });
  if (!next) {
    return;
  }

  const notifiedAt = new Date();
  const notifyExpiresAt = new Date(
    notifiedAt.getTime() + WAITLIST_NOTIFY_WINDOW_HOURS * 60 * 60 * 1000
  );
  await database.waitlist.update({
    data: { notifiedAt, notifyExpiresAt, status: "NOTIFIED" },
    where: { id: next.id },
  });

  if (!resend) {
    return;
  }
  const timeSlot = await database.timeSlot.findUnique({
    where: { id: slotId },
  });
  const claimUrl = `${env.NEXT_PUBLIC_WEB_URL}/waitlist/${next.token}`;

  try {
    await resend.emails.send({
      from: env.RESEND_FROM ?? "onboarding@resend.dev",
      react: WaitlistNotificationEmail({
        claimUrl,
        customerName: next.customerName,
        date: date.toISOString().slice(0, 10),
        expiresInHours: WAITLIST_NOTIFY_WINDOW_HOURS,
        restaurantName: "테이블GO",
        timeRange: timeSlot?.displayName ?? "",
      }),
      subject: "[테이블GO] 대기 자리가 났습니다",
      to: next.customerEmail,
    });
  } catch (error) {
    console.error("Failed to send waitlist notification email:", error);
  }
}
