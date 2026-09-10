"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { browserClient } from "./supabase";

/** Invalidate the overview when matters or activity change. */
export function useRealtimeOverview() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = browserClient
      .channel("overview")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matters" },
        () => {
          void qc.invalidateQueries({ queryKey: ["overview"] });
          void qc.invalidateQueries({ queryKey: ["matters-all"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity" },
        () => {
          void qc.invalidateQueries({ queryKey: ["overview"] });
          void qc.invalidateQueries({ queryKey: ["matters-all"] });
        }
      )
      .subscribe();
    return () => {
      browserClient.removeChannel(channel);
    };
  }, [qc]);
}
