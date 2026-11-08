import { BrowserWindow, ipcMain } from "electron";

import { ServiceStatus_Type } from "../../shared/gen/daemon/started_service_pb";
import type { Group } from "../../shared/gen/daemon/started_service_pb";
import { TESSERA_AUTO_CALL, TESSERA_AUTO_CHANGED } from "../../shared/tessera";
import type { AutoCriterion, AutoState } from "../../shared/tessera";
import { candidates, choices, parseMethods } from "../../shared/tessera/methods";
import type { Method, Methods } from "../../shared/tessera/methods";
import { parseBooleanPreference, Preference } from "../database";
import { startedService } from "../daemon";
import { onProfilesChanged, profilesState } from "../profiles";
import { daemonState } from "../state";
import { speeds } from "./speeds";

// Как AutoPilot.kt на Android — Авто, которое не умеет ядро (§3.5): выбор по скорости канала и выбор в профиле
// без urltest. Живёт в основном процессе, пока работает туннель, — окно для этого не нужно. Выбирает через
// selectOutbound, конфиг не трогает. Раз в минуту проверяет способ, через который идёт трафик, и переключается,
// если тот не ответил; заново выбирает лучший раз в 3 минуты. По скорости — по замерам, незамеренные — по пингу.
// Само замеряет скорость только раз: когда человек выбрал «По скорости».

const CHECK_INTERVAL_MS = 60_000;
const RANK_INTERVAL_MS = 3 * 60_000;
const TOLERANCE_MS = 50;
// Конца проверки пинга ядро не сообщает: оно проверяет по 10 способов сразу, каждый до 15 секунд
const PING_TIMEOUT_MS = 15_000;
const PING_BATCH = 10;
const PING_MARGIN_MS = 5_000;

function parseCriterion(value: unknown): AutoCriterion {
  if (value !== "ping" && value !== "speed") {
    throw new Error("invalid auto criterion");
  }
  return value;
}

function parseIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error("invalid profile list");
  }
  return value.map(String);
}

const criterionPreference = new Preference<AutoCriterion>("tessera_auto_criterion", "ping", parseCriterion);
/** Выбрали «По скорости», а единственный замер, который Авто делает само, ещё не сделан. */
const speedTestPendingPreference = new Preference("tessera_auto_speed_test_pending", false, parseBooleanPreference);
/** Профили, где человек выбрал способ сам, а не Авто. */
const manualPreference = new Preference<string[]>("tessera_manual_profiles", [], parseIds);

let mode: AutoState["mode"] = "off";
let selections = 0;
let lastKey: string | null = null;
let driving: AbortController | null = null;
let selecting: Promise<void> = Promise.resolve();
// Ядро о выборе не сообщает: до следующей присылки групп помним, что выбрали здесь
const overrides = new Map<string, string>();
let lastGroups: Group[] = [];

function selectedProfileId(): string | null {
  return profilesState().selectedId;
}

function started(): boolean {
  return daemonState.status === ServiceStatus_Type.STARTED;
}

function currentMethods(): Methods | null {
  const groups = daemonState.groups.map((group) => {
    const selected = overrides.get(group.tag);
    return selected === undefined ? group : { ...group, selected };
  });
  return parseMethods(groups);
}

function state(): AutoState {
  const profileId = selectedProfileId();
  return {
    criterion: criterionPreference.get(),
    mode,
    manual: profileId !== null && manualPreference.get().includes(profileId),
    speeds: Object.fromEntries(speeds.results),
    batch: speeds.batch,
    selections,
  };
}

function broadcast() {
  const current = state();
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.webContents.isDestroyed()) {
      window.webContents.send(TESSERA_AUTO_CHANGED, current);
    }
  }
}

/** Выбор в селекторах по очереди: выбор человека не должен разминуться с выбором Авто мгновением раньше. */
function select(selection: Array<[string, string]>): Promise<void> {
  selecting = selecting.then(async () => {
    if (startedService === null) {
      return;
    }
    try {
      for (const [groupTag, outboundTag] of selection) {
        await startedService.selectOutbound({ groupTag, outboundTag });
        overrides.set(groupTag, outboundTag);
      }
      // Открытые соединения остались бы на прежнем способе — выбор применяется сразу
      await startedService.closeAllConnections({});
    } catch {}
    selections++;
    broadcast();
  });
  return selecting;
}

function testedAt(tag: string): number {
  for (const group of daemonState.groups) {
    const item = group.items.find((candidate) => candidate.tag === tag);
    if (item !== undefined) {
      return Number(item.urlTestTime);
    }
  }
  return 0;
}

function sleep(durationMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, durationMs);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done);
  });
}

function waitFor(condition: () => boolean, timeoutMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, timeoutMs);
    function check() {
      if (condition()) {
        done();
      }
    }
    function done() {
      clearTimeout(timer);
      daemonState.off("change", check);
      signal.removeEventListener("abort", done);
      resolve();
    }
    daemonState.on("change", check);
    signal.addEventListener("abort", done);
    check();
  });
}

/** Проверить пинг у группы или способа и дождаться ответа; null — проверку не удалось начать. */
async function ping(target: string, tags: string[], signal: AbortSignal): Promise<Set<string> | null> {
  if (startedService === null) {
    return null;
  }
  const since = Math.floor(Date.now() / 1000);
  try {
    await startedService.uRLTest({ outboundTag: target });
  } catch {
    return null;
  }
  const batches = Math.max(1, Math.ceil(tags.length / PING_BATCH));
  await waitFor(() => tags.every((tag) => testedAt(tag) >= since), PING_TIMEOUT_MS * batches + PING_MARGIN_MS, signal);
  return new Set(tags.filter((tag) => testedAt(tag) >= since));
}

// По пингу, как urltest ядра: прежний способ остаётся, пока лучший не быстрее него заметно
function quickest(alive: Method[], current: Method | undefined): Method | undefined {
  const best = alive.reduce<Method | undefined>((min, method) => (min === undefined || method.delayMs < min.delayMs ? method : min), undefined);
  if (best === undefined) {
    return undefined;
  }
  const kept = alive.find((method) => method.tag === current?.tag);
  return kept === undefined || best.delayMs + TOLERANCE_MS < kept.delayMs ? best : kept;
}

// По скорости: замеренные — по ней, остальные следом по пингу
function fastest(alive: Method[], current: Method | undefined): Method | undefined {
  const mbps = (method: Method) => {
    const speed = speeds.results.get(method.tag);
    return speed?.kind === "done" ? speed.mbps : null;
  };
  const measured = alive.filter((method) => mbps(method) !== null);
  if (measured.length === 0) {
    return quickest(alive, current);
  }
  return measured.reduce((best, method) => (mbps(method)! > mbps(best)! ? method : best));
}

async function drive(selector: string, criterion: AutoCriterion, signal: AbortSignal) {
  const bySpeed = criterion === "speed";
  let rankedAt = 0;
  while (!signal.aborted) {
    const methods = currentMethods();
    if (methods === null) {
      return;
    }
    const list = candidates(methods);
    if (list.length === 0) {
      return;
    }
    const speedTestDue = bySpeed && speedTestPendingPreference.get();
    // Выбранный в селекторе способ; нет — там группа или direct, выбирать надо сейчас
    const current = list.find((method) => method.selected);
    // Только что взяли управление — выбрать сразу, не дожидаясь срока
    const rankDue = rankedAt === 0 || speedTestDue || Date.now() - rankedAt >= RANK_INTERVAL_MS;
    if (current !== undefined && !rankDue) {
      // Проверяем только тот, через который идёт трафик
      const alive = await ping(current.tag, [current.tag], signal);
      if (alive === null || alive.has(current.tag)) {
        await sleep(CHECK_INTERVAL_MS, signal);
        continue;
      }
    }
    const alive = await ping(
      selector,
      list.map((method) => method.tag),
      signal,
    );
    if (signal.aborted) {
      return;
    }
    if (alive === null) {
      await sleep(CHECK_INTERVAL_MS, signal);
      continue;
    }
    speeds.forgetFailed(alive);
    if (speedTestDue && alive.size > 0) {
      await speeds.measure(list.filter((method) => alive.has(method.tag)).map((method) => method.tag));
      // Выключили посреди замера — замерить при следующем включении. Остановил человек — так и оставить
      if (!started() || signal.aborted) {
        return;
      }
      speedTestPendingPreference.set(false);
    }
    rankedAt = Date.now();
    const fresh = candidates(currentMethods() ?? methods).filter((method) => alive.has(method.tag));
    const best = bySpeed ? fastest(fresh, current) : quickest(fresh, current);
    if (best !== undefined && best.tag !== current?.tag && !signal.aborted) {
      await select(choices(methods, best));
    }
    await sleep(CHECK_INTERVAL_MS, signal);
  }
}

// Кто ведёт Авто, решается заново при каждом изменении: туннель, группы, профиль, критерий, ручной выбор
function evaluate() {
  if (daemonState.groups !== lastGroups) {
    lastGroups = daemonState.groups;
    overrides.clear();
  }
  const profileId = selectedProfileId();
  speeds.load(profileId);
  const methods = started() ? currentMethods() : null;
  let key: string | null = null;
  let next: AutoState["mode"] = "off";
  if (profileId !== null && methods !== null && methods.selector !== null) {
    const criterion = criterionPreference.get();
    const urltest = methods.auto?.tag ?? null;
    next = criterion === "ping" && urltest !== null ? "core" : "app";
    const manual = manualPreference.get().includes(profileId);
    key = JSON.stringify([profileId, next, criterion, methods.selector, urltest, manual, candidates(methods).map((method) => method.tag)]);
  }
  if (next !== mode) {
    mode = next;
    broadcast();
  }
  if (key === lastKey) {
    return;
  }
  lastKey = key;
  driving?.abort();
  driving = null;
  if (key === null || methods === null || profileId === null || manualPreference.get().includes(profileId)) {
    return;
  }
  const selector = methods.selector!;
  if (mode === "core") {
    // Вернулись к Авто ядра, а в селекторе остался способ, выбранный приложением
    if (methods.auto !== null && !methods.auto.selected) {
      void select([[selector, methods.auto.tag!]]);
    }
    return;
  }
  const controller = new AbortController();
  driving = controller;
  void drive(selector, criterionPreference.get(), controller.signal);
}

function setManual(profileId: string, manual: boolean) {
  const current = manualPreference.get();
  const next = manual ? [...new Set([...current, profileId])] : current.filter((id) => id !== profileId);
  if (next.length !== current.length) {
    manualPreference.set(next);
  }
}

// Профиль удалён — его выбор и замеры больше ни к чему
function forgetRemoved() {
  const ids = new Set(profilesState().profiles.map((profile) => profile.id));
  const manual = manualPreference.get();
  if (manual.some((id) => !ids.has(id))) {
    manualPreference.set(manual.filter((id) => ids.has(id)));
  }
  speeds.forgetAllExcept(ids);
}

const handlers: Record<string, (...callArguments: never[]) => Promise<unknown>> = {
  async state() {
    return state();
  },
  async setCriterion(criterion: AutoCriterion) {
    const parsed = parseCriterion(criterion);
    if (parsed === criterionPreference.get()) {
      return;
    }
    criterionPreference.set(parsed);
    speedTestPendingPreference.set(parsed === "speed");
    evaluate();
    broadcast();
  },
  async select(selection: Array<[string, string]>, manual: boolean) {
    const profileId = selectedProfileId();
    if (profileId === null) {
      return;
    }
    // Сначала — чей выбор: Авто приложения должно остановиться раньше, чем выбрало бы своё
    setManual(profileId, manual === true);
    evaluate();
    if (Array.isArray(selection) && selection.length > 0) {
      await select(selection.map(([group, tag]) => [String(group), String(tag)]));
    }
    broadcast();
  },
  async measure(tags: string[]) {
    speeds.enqueue(tags.map(String));
  },
  async stopMeasuring() {
    speeds.stop();
  },
  async forgetFailed(tags: string[]) {
    speeds.forgetFailed(tags.map(String));
  },
};

export function registerAuto() {
  ipcMain.handle(TESSERA_AUTO_CALL, async (_event, method: string, ...callArguments: unknown[]) => {
    const handler = handlers[method];
    if (handler === undefined) {
      throw new Error(`unknown auto method: ${method}`);
    }
    return handler(...(callArguments as never[]));
  });
  let wasStarted = started();
  daemonState.on("change", () => {
    // Выключили — замеры этого включения больше не нужны
    if (wasStarted && !started()) {
      speeds.stop();
    }
    wasStarted = started();
    evaluate();
  });
  onProfilesChanged(() => {
    forgetRemoved();
    evaluate();
    broadcast();
  });
  speeds.on("change", broadcast);
  evaluate();
}
