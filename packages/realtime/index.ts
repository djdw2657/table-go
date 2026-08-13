"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useRef } from "react";
import { keys } from "./keys";

let browserClient: ReturnType<typeof createClient> | undefined;

// Neither app uses Supabase Auth (apps/web is unauthenticated by design,
// apps/app uses Clerk), so this always connects as the `anon` role. The
// `reservations` broadcast topic only ever carries a content-free "something
// changed" signal (see the `broadcast_reservation_changes` DB trigger), so
// anon read access to it is safe — see packages/database's migration notes.
function getRealtimeClient() {
  if (!browserClient) {
    const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = keys();
    browserClient = createClient(
      NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }
  return browserClient;
}

// Subscribes to the single global `reservations` broadcast topic and calls
// `onChange` whenever a Reservation or Waitlist row is inserted, updated, or
// deleted anywhere — the callback is expected to re-run whatever existing
// server action already fetches the data a given screen needs (e.g.
// getAvailability, getFilteredReservations), never to read the broadcast
// payload itself (it's intentionally empty).
export function useReservationChangeSignal(onChange: () => void) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const client = getRealtimeClient();
    let cancelled = false;

    const channel = client.channel("reservations", {
      config: { private: true },
    });

    for (const event of ["INSERT", "UPDATE", "DELETE"]) {
      channel.on("broadcast", { event }, () => {
        if (!cancelled) {
          onChangeRef.current();
        }
      });
    }

    client.realtime.setAuth().then(() => {
      if (!cancelled) {
        channel.subscribe();
      }
    });

    return () => {
      cancelled = true;
      client.removeChannel(channel);
    };
  }, []);
}
