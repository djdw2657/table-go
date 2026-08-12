import { database } from "@repo/database";

export const GET = async () => {
  await database.reservation.count();

  return new Response("OK", { status: 200 });
};
