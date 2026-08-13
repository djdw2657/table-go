import { keys as email } from "@repo/email/keys";
import { keys as flags } from "@repo/feature-flags/keys";
import { keys as core } from "@repo/next-config/keys";
import { keys as observability } from "@repo/observability/keys";
import { keys as rateLimit } from "@repo/rate-limit/keys";
import { keys as security } from "@repo/security/keys";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
  extends: [core(), email(), observability(), flags(), security(), rateLimit()],
  server: {
    // Where the "새 예약 1건" restaurant-notification email is sent.
    RESTAURANT_NOTIFICATION_EMAIL: z.string().email().optional(),
  },
  client: {},
  runtimeEnv: {
    RESTAURANT_NOTIFICATION_EMAIL: process.env.RESTAURANT_NOTIFICATION_EMAIL,
  },
});
