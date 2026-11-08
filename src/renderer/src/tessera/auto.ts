import { useSyncExternalStore } from "react";

import type { AutoState } from "@shared/tessera";

// Авто и замеры ведёт основной процесс: туннель работает и без окна. Здесь — только их состояние.

/** Обещание в интерфейсе: «тратит до 30 МБ на каждый способ». */
export const SPEED_TEST_LIMIT_MB = 30;

let state: AutoState = { criterion: "ping", mode: "off", manual: false, speeds: {}, batch: false, selections: 0 };
const listeners = new Set<() => void>();
let subscribed = false;

function update(next: AutoState) {
  state = next;
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  if (!subscribed) {
    subscribed = true;
    window.tessera.auto.onChanged(update);
    void window.tessera.auto.state().then(update);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAuto(): AutoState {
  return useSyncExternalStore(subscribe, () => state);
}
