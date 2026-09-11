"use client";

import { useSyncExternalStore } from "react";
import { ZoneToday } from "@/components/zone-today";
import { ZonePeople } from "@/components/zone-people";
import { ZoneMoney } from "@/components/zone-money";
import { PulseRail } from "@/components/pulse-rail";

const XL = "(min-width: 1280px)";
const emptySubscribe = () => () => {};

function subscribeXl(onStoreChange: () => void) {
  const mq = window.matchMedia(XL);
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

/**
 * Overview layout. Zones always stack: Today → People → Money.
 * Pulse is a sticky right rail from 1280px up (Tailwind `xl`); below that it
 * is its own route in the bottom navigation (/pulse), not a tab on this page.
 */
export function OverviewLayout() {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const wide = useSyncExternalStore(
    subscribeXl,
    () => window.matchMedia(XL).matches,
    () => false
  );

  return (
    <div className="grid min-h-full min-w-0 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 px-4 pt-6 pb-12 md:px-8">
        <div className="mx-auto w-full min-w-0 max-w-[1440px]">
          <ZoneToday />
          <ZonePeople className="mt-6" />
          <ZoneMoney className="mt-6 md:mt-8" />
        </div>
      </div>

      {mounted && wide ? (
        <aside aria-label="Pulse" className="min-h-full min-w-0">
          <PulseRail />
        </aside>
      ) : null}
    </div>
  );
}
