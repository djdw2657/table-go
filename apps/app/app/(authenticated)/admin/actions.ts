"use server";

import { database } from "@repo/database";
import { revalidatePath } from "next/cache";

export async function cancelReservation(id: string) {
  await database.reservation.delete({ where: { id } });
  revalidatePath("/admin");
}
