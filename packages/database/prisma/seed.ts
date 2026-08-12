import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config();

const sql = neon(process.env.DATABASE_URL as string);

const TIME_SLOTS = [
  { id: "slot-10-12", startTime: "10:00", endTime: "12:00", displayName: "10:00 - 12:00" },
  { id: "slot-12-14", startTime: "12:00", endTime: "14:00", displayName: "12:00 - 14:00" },
  { id: "slot-14-16", startTime: "14:00", endTime: "16:00", displayName: "14:00 - 16:00" },
  { id: "slot-16-18", startTime: "16:00", endTime: "18:00", displayName: "16:00 - 18:00" },
  { id: "slot-18-20", startTime: "18:00", endTime: "20:00", displayName: "18:00 - 20:00" },
  { id: "slot-20-22", startTime: "20:00", endTime: "22:00", displayName: "20:00 - 22:00" },
] as const;

async function main() {
  for (const slot of TIME_SLOTS) {
    await sql`
      INSERT INTO "TimeSlot" (id, "startTime", "endTime", "displayName")
      VALUES (${slot.id}, ${slot.startTime}, ${slot.endTime}, ${slot.displayName})
      ON CONFLICT (id) DO UPDATE SET
        "startTime" = EXCLUDED."startTime",
        "endTime" = EXCLUDED."endTime",
        "displayName" = EXCLUDED."displayName"
    `;
  }
  console.log(`Seeded ${TIME_SLOTS.length} time slots.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
