import { EventEmitter } from "node:events";

import type { Speed } from "../../shared/tessera";
import { Preference } from "../database";
import { startedService } from "../daemon";

// Как Speeds.kt и SpeedTest.kt на Android: замер ядра по серверу networkQuality от Apple через сам способ,
// по одному за раз — одновременные замеры делили бы канал. Ждущие очереди тоже «замеряем».
// Удачные замеры хранятся у профиля: Авто по скорости выбирает по ним и после перезапуска.

/** Обещание в интерфейсе: «тратит до 30 МБ на каждый способ». Запас — на запаздывание остановки. */
export const SPEED_TEST_LIMIT_MB = 30;
const LIMIT_BYTES = 25_000_000;
// Ядро делит время пополам между скачиванием и отдачей, отдачу не ждём
const MAX_RUNTIME_SECONDS = 20;
// Через сколько приходит следующий отчёт ядра о ходе замера
const PROGRESS_INTERVAL_MS = 500;
const CONFIG_URL = "https://mensura.cdn-apple.com/api/v1/gm/config";
const PHASE_DOWNLOAD = 1;

type Saved = Record<string, Record<string, number>>;

function parseSaved(value: unknown): Saved {
  if (typeof value !== "object" || value === null) {
    throw new Error("invalid speeds preference");
  }
  return value as Saved;
}

const savedPreference = new Preference<Saved>("tessera_speeds", {}, parseSaved);

class Speeds extends EventEmitter {
  results = new Map<string, Speed>();
  batch = false;
  private queue: string[] = [];
  // Что было замерено до постановки в очередь: остановят замер — вернётся оно, а не пустота
  private previous = new Map<string, Speed>();
  private profileId: string | null = null;
  private running: AbortController | null = null;

  /** Выбран профиль: прежние замеры не про него, а его собственные — сохранены. */
  load(id: string | null) {
    if (id === this.profileId) {
      return;
    }
    this.stop();
    this.profileId = id;
    const saved = id === null ? {} : (savedPreference.get()[id] ?? {});
    this.results = new Map(Object.entries(saved).map(([tag, mbps]) => [tag, { kind: "done", mbps }]));
    this.emit("change");
  }

  enqueue(tags: string[]) {
    const added = tags.filter((tag) => this.results.get(tag)?.kind !== "testing");
    if (added.length === 0) {
      return;
    }
    if (added.length > 1 || this.running !== null) {
      this.batch = true;
    }
    for (const tag of added) {
      const old = this.results.get(tag);
      if (old !== undefined) {
        this.previous.set(tag, old);
      }
      this.results.set(tag, { kind: "testing" });
    }
    this.queue.push(...added);
    this.emit("change");
    if (this.running === null) {
      void this.drain();
    }
  }

  /** Замерить и дождаться: остановит человек — вернётся то, что успели. */
  measure(tags: string[]): Promise<void> {
    this.enqueue(tags);
    return new Promise((resolve) => {
      const check = () => {
        if (!tags.some((tag) => this.results.get(tag)?.kind === "testing")) {
          this.off("change", check);
          resolve();
        }
      };
      this.on("change", check);
      check();
    });
  }

  stop() {
    this.running?.abort();
    this.running = null;
    this.queue = [];
    for (const [tag, speed] of this.results) {
      if (speed.kind === "testing") {
        this.results.delete(tag);
      }
    }
    for (const [tag, speed] of this.previous) {
      this.results.set(tag, speed);
    }
    this.previous.clear();
    this.batch = false;
    this.emit("change");
  }

  /** Ответил на пинг — способ, который не удалось замерить раньше, можно замерить снова. */
  forgetFailed(tags: Iterable<string>) {
    let changed = false;
    for (const tag of tags) {
      if (this.results.get(tag)?.kind === "failed") {
        this.results.delete(tag);
        changed = true;
      }
    }
    if (changed) {
      this.emit("change");
    }
  }

  /** Профили удалены — их замеры больше ни к чему. */
  forgetAllExcept(ids: ReadonlySet<string>) {
    const saved = savedPreference.get();
    if (Object.keys(saved).some((id) => !ids.has(id))) {
      savedPreference.set(Object.fromEntries(Object.entries(saved).filter(([id]) => ids.has(id))));
    }
  }

  private async drain() {
    const controller = new AbortController();
    this.running = controller;
    while (this.queue.length > 0 && !controller.signal.aborted) {
      const tag = this.queue.shift()!;
      const mbps = await measure(tag, controller.signal);
      if (controller.signal.aborted) {
        break;
      }
      this.previous.delete(tag);
      this.results.set(tag, mbps === null ? { kind: "failed" } : { kind: "done", mbps });
      this.save();
      this.emit("change");
    }
    if (this.running === controller) {
      this.running = null;
      this.batch = false;
      this.emit("change");
    }
  }

  // Не удалось — прежняя скорость тоже не хранится: способ, который сейчас не замерить, не самый быстрый
  private save() {
    if (this.profileId === null) {
      return;
    }
    const done: Record<string, number> = {};
    for (const [tag, speed] of this.results) {
      if (speed.kind === "done") {
        done[tag] = speed.mbps;
      }
    }
    savedPreference.set({ ...savedPreference.get(), [this.profileId]: done });
  }
}

export const speeds = new Speeds();

// Трафик считаем по скорости, которую сообщает ядро: счётчика по приложению, как на Android, здесь нет
async function measure(tag: string, stop: AbortSignal): Promise<number | null> {
  if (startedService === null) {
    return null;
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  stop.addEventListener("abort", abort);
  let downloading = false;
  let lastElapsedMs = 0;
  let estimated = 0;
  let capacity = 0;
  const result = (bitsPerSecond: number) => (bitsPerSecond > 0 ? bitsPerSecond / 1_000_000 : null);
  try {
    const updates = startedService.startNetworkQualityTest(
      { configURL: CONFIG_URL, outboundTag: tag, serial: true, http3: false, maxRuntimeSeconds: MAX_RUNTIME_SECONDS },
      { signal: controller.signal },
    );
    for await (const progress of updates) {
      if (progress.error !== "") {
        return null;
      }
      const reported = Number(progress.downloadCapacity);
      if (progress.isFinal || progress.phase > PHASE_DOWNLOAD) {
        return result(reported > 0 ? reported : capacity);
      }
      if (progress.phase !== PHASE_DOWNLOAD) {
        continue;
      }
      // После замера задержки ядро начинает отсчёт времени заново
      if (!downloading) {
        downloading = true;
        lastElapsedMs = 0;
      }
      const elapsedMs = Number(progress.elapsedMs);
      const bytesPerSecond = reported / 8;
      estimated += (bytesPerSecond * Math.max(0, elapsedMs - lastElapsedMs)) / 1000;
      lastElapsedMs = elapsedMs;
      if (reported > 0) {
        capacity = reported;
      }
      if (estimated + (bytesPerSecond * PROGRESS_INTERVAL_MS) / 1000 >= LIMIT_BYTES) {
        return result(capacity);
      }
    }
    return result(capacity);
  } catch {
    return null;
  } finally {
    stop.removeEventListener("abort", abort);
    controller.abort();
  }
}
