"use server";

import { database } from "@repo/database";
import { revalidatePath } from "next/cache";

export async function cancelReservation(id: string) {
  await database.reservation.update({
    where: { id },
    // Clearing activeSlotKey frees the (date, slotId) unique key back up so
    // the slot can be rebooked (see schema.prisma for why this field exists).
    data: { status: "CANCELLED", activeSlotKey: null },
  });
  revalidatePath("/admin");
}
