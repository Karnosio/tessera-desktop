import { useEffect, useMemo, useRef, useState } from "react";

import type { DaemonApi } from "@dashboard/api/daemon";
import type { Group } from "@dashboard/gen/daemon/started_service_pb";
import type { AutoState, Speed } from "@shared/tessera";
import { allMethods, choices, parseMethods } from "@shared/tessera/methods";
import type { Method, Methods } from "@shared/tessera/methods";

import type { LatencyState } from "./ui/bundle.js";

export interface Ping {
  state: LatencyState;
  ms?: number;
}

export interface MethodSummary {
  /** Способ, через который идёт трафик; null — неизвестен. */
  name: string | null;
  auto: boolean;
  /** Задан в самом профиле: выбирать не из чего. */
  fixed: boolean;
  ping?: Ping;
  /** Авто выбирает по скорости канала: на главном вместо пинга — скорость. */
  speed?: Speed;
}

export interface MethodsModel {
  /** Способы, пока туннель включён; null — ядро ещё не ответило или выбирать не из чего (`loaded`). */
  methods: Methods | null;
  loaded: boolean;
  pinging: boolean;
  summary: MethodSummary;
  ping(tag: string | null, testedAt: number, delayMs: number): Ping;
  pingAll(): void;
  /** Открыли шторку посмотреть — пусть сразу видно, кто отвечает. Чаще раза в минуту не проверяем. */
  pingOnOpen(): void;
  select(method: Method): void;
  selectAuto(): void;
}

const SLOW_MS = 250;
const PING_REFRESH_MS = 60_000;
// Ядро проверяет по 10 способов сразу, каждый до 15 секунд, а неудачу не хранит
const PING_TIMEOUT_MS = 15_000;
const PING_BATCH = 10;
const PING_MARGIN_MS = 5_000;

interface PendingPing {
  since: number;
  tags: string[];
  timer: number;
}

function testedAt(groups: Group[], tag: string): number {
  for (const group of groups) {
    const item = group.items.find((candidate) => candidate.tag === tag);
    if (item !== undefined) {
      return Number(item.urlTestTime);
    }
  }
  return 0;
}

// Авто ведёт приложение (по скорости или в профиле нет urltest): в селекторе стоит способ, который выбрало оно,
// а выбрано ли Авто, знает только приложение
function drivenByApp(methods: Methods, autoSelected: boolean): Methods {
  const now = allMethods(methods).find((method) => method.tag === methods.current);
  return {
    ...methods,
    auto: {
      tag: methods.auto?.tag ?? null,
      selected: autoSelected,
      now: methods.current,
      testedAt: now?.testedAt ?? 0,
      delayMs: now?.delayMs ?? 0,
    },
    sections: autoSelected
      ? methods.sections.map((section) => ({ ...section, methods: section.methods.map((method) => ({ ...method, selected: false })) }))
      : methods.sections,
  };
}

export function useMethods(
  api: DaemonApi,
  groups: { groups: Group[]; loaded: boolean },
  started: boolean,
  profileId: string | null,
  auto: AutoState,
): MethodsModel {
  const loaded = started && groups.loaded;
  const methods = useMemo(() => {
    const parsed = loaded ? parseMethods(groups.groups) : null;
    return parsed !== null && auto.mode === "app" ? drivenByApp(parsed, !auto.manual) : parsed;
  }, [loaded, groups.groups, auto.mode, auto.manual]);
  const [pingSince, setPingSince] = useState<number | null>(null);
  const [dead, setDead] = useState<ReadonlySet<string>>(new Set());
  // Выбор с прошлого включения: тег способа, null — Авто. Пока выключено, ядро его не скажет
  const [lastChoice, setLastChoice] = useState<string | null>(null);
  const pending = useRef<PendingPing | null>(null);
  const lastPingAt = useRef(0);
  const pingWanted = useRef(false);
  const groupsRef = useRef(groups.groups);
  groupsRef.current = groups.groups;

  const finishPing = () => {
    const current = pending.current;
    if (current === null) {
      return;
    }
    clearTimeout(current.timer);
    pending.current = null;
    const answered = current.tags.filter((tag) => testedAt(groupsRef.current, tag) >= current.since);
    void window.tessera.auto.forgetFailed(answered);
    setDead((old) => new Set([...old, ...current.tags].filter((tag) => !answered.includes(tag))));
    setPingSince(null);
  };

  const stopPing = () => {
    if (pending.current !== null) {
      clearTimeout(pending.current.timer);
      pending.current = null;
    }
    pingWanted.current = false;
    setPingSince(null);
    setDead(new Set());
  };

  // Конца проверки ядро не сообщает: ждём, пока у всех появится свежий результат
  useEffect(() => {
    const current = pending.current;
    if (current !== null && current.tags.every((tag) => testedAt(groups.groups, tag) >= current.since)) {
      finishPing();
    }
  }, [groups.groups]);

  useEffect(() => {
    if (methods !== null) {
      setLastChoice(methods.auto?.selected === true ? null : methods.current);
    }
  }, [methods]);

  // Выбор сделало Авто в основном процессе или сам человек: ядро о нём не сообщает, группы перечитываем
  const selections = useRef(auto.selections);
  useEffect(() => {
    if (auto.selections !== selections.current) {
      selections.current = auto.selections;
      api.groups.reconnectNow();
    }
  }, [api, auto.selections]);

  // Выключили: кто не отвечал, после включения может ответить
  useEffect(() => {
    if (!started) {
      stopPing();
    }
  }, [started]);

  useEffect(() => {
    stopPing();
    lastPingAt.current = 0;
    setLastChoice(null);
  }, [profileId]);

  useEffect(() => () => stopPing(), []);

  const pingAll = () => {
    if (methods === null || pending.current !== null) {
      return;
    }
    const target = methods.selector ?? methods.auto?.tag;
    if (target == null) {
      return;
    }
    const tags = allMethods(methods).map((method) => method.tag);
    lastPingAt.current = Date.now();
    const since = Math.floor(lastPingAt.current / 1000);
    const batches = Math.max(1, Math.ceil(tags.length / PING_BATCH));
    pending.current = { since, tags, timer: window.setTimeout(finishPing, PING_TIMEOUT_MS * batches + PING_MARGIN_MS) };
    setPingSince(since);
    api.urlTest(target).catch(() => {
      if (pending.current?.since === since) {
        clearTimeout(pending.current.timer);
        pending.current = null;
        setPingSince(null);
      }
    });
  };

  useEffect(() => {
    if (methods !== null && pingWanted.current) {
      pingWanted.current = false;
      pingAll();
    }
  }, [methods]);

  const pingOnOpen = () => {
    if (Date.now() - lastPingAt.current < PING_REFRESH_MS) {
      return;
    }
    if (methods === null) {
      pingWanted.current = started;
      return;
    }
    pingAll();
  };

  const apply = (selection: Array<[string, string]>, manual: boolean) => {
    void window.tessera.auto.select(selection, manual).catch(() => {});
  };

  const ping = (tag: string | null, tested: number, delayMs: number): Ping => {
    if (pingSince !== null && tested < pingSince) {
      return { state: "testing" };
    }
    if (tested > 0) {
      return { state: delayMs < SLOW_MS ? "good" : "slow", ms: delayMs };
    }
    return { state: tag !== null && dead.has(tag) ? "dead" : "unknown" };
  };

  const bySpeed = auto.mode === "app" && auto.criterion === "speed" && !auto.manual;
  let summary: MethodSummary;
  if (!loaded) {
    summary = { name: lastChoice, auto: lastChoice === null, fixed: false };
  } else if (methods === null) {
    summary = { name: null, auto: false, fixed: true };
  } else if (methods.auto?.selected === true) {
    const current = methods.auto;
    summary = {
      name: current.now,
      auto: true,
      fixed: false,
      ping: ping(current.now, current.testedAt, current.delayMs),
      speed: bySpeed && current.now !== null ? auto.speeds[current.now] : undefined,
    };
  } else {
    const current = allMethods(methods).find((method) => method.selected);
    summary =
      current === undefined
        ? { name: methods.current, auto: false, fixed: false }
        : { name: current.tag, auto: false, fixed: false, ping: ping(current.tag, current.testedAt, current.delayMs) };
  }

  return {
    methods,
    loaded,
    pinging: pingSince !== null,
    summary,
    ping,
    pingAll,
    pingOnOpen,
    select: (method) => {
      if (methods !== null) {
        apply(choices(methods, method), true);
      }
    },
    // Авто ядра выбирается в селекторе, Авто приложения выберет способ само
    selectAuto: () => {
      if (methods?.selector == null) {
        return;
      }
      const urltest = methods.auto?.tag;
      apply(auto.mode === "core" && urltest != null ? [[methods.selector, urltest]] : [], false);
    },
  };
}
