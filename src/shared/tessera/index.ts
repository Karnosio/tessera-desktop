export const TESSERA_ADVANCED_OPEN = "tessera:advanced-open";
export const TESSERA_CLIPBOARD_READ = "tessera:clipboard-read";
export const TESSERA_CONVERT = "tessera:convert";
export const TESSERA_SUBSCRIPTION = "tessera:subscription";
export const TESSERA_CONVERTED = "tessera:converted";
export const TESSERA_MARK_CONVERTED = "tessera:mark-converted";
export const TESSERA_AUTO_CALL = "tessera:auto-call";
export const TESSERA_AUTO_CHANGED = "tessera:auto-changed";

export type AutoCriterion = "ping" | "speed";

export type Speed = { kind: "testing" } | { kind: "done"; mbps: number } | { kind: "failed" };

/** Авто и замеры живут в основном процессе: туннель работает и без окна. */
export interface AutoState {
  criterion: AutoCriterion;
  /** Кто ведёт Авто в выбранном профиле: ядро (urltest по пингу) или приложение (по скорости или без urltest). */
  mode: "off" | "core" | "app";
  /** В выбранном профиле способ выбрал человек, а не Авто. */
  manual: boolean;
  /** Замеры выбранного профиля. */
  speeds: Record<string, Speed>;
  /** Идёт замер нескольких способов — его можно остановить. */
  batch: boolean;
  /** Растёт с каждым выбором в селекторах: ядро о выборе не сообщает, окну пора перечитать группы. */
  selections: number;
}

export interface AutoBridge {
  state(): Promise<AutoState>;
  onChanged(listener: (state: AutoState) => void): () => void;
  setCriterion(criterion: AutoCriterion): Promise<void>;
  /** Выбор человека: `[селектор, что выбрать]`; `manual: false` — вернуть Авто. */
  select(choices: Array<[string, string]>, manual: boolean): Promise<void>;
  measure(tags: string[]): Promise<void>;
  stopMeasuring(): Promise<void>;
  forgetFailed(tags: string[]): Promise<void>;
}

export type SkipReason = "xhttp" | "mkcp" | "vless-encryption" | "unsupported" | "broken";

/** Способ, который не вошёл в профиль. `protocol` — что именно не умеем, для «unsupported». */
export interface Skipped {
  name: string;
  reason: SkipReason;
  protocol?: string;
}

/** Профиль собран приложением, а не пришёл готовым, — человек должен это видеть (§3.1). */
export interface Conversion {
  format: "links" | "clash" | "wireguard";
  ways: number;
  skipped: Skipped[];
}

/** «unsupported» — формат не узнан; «nothing» — способы есть, но ни один ядро не умеет. */
export type ConversionFailure = "unsupported" | "nothing";

export type ConvertResult =
  | { ok: true; config: string; conversion: Conversion; singleName: string | null }
  | { ok: false; failure: ConversionFailure; skipped: Skipped[] };

/** Что панель сообщила о подписке при последнем скачивании. */
export interface SubscriptionInfo {
  title?: string;
  updateIntervalMinutes?: number;
  conversion?: Conversion;
  failure?: ConversionFailure;
  skipped?: Skipped[];
}

/** Ошибка сборки, как её видит окно: сообщение upstream передаёт как есть. */
export const CONVERSION_ERROR_PREFIX = "tessera-conversion:";

export interface ConvertedProfiles {
  ids: string[];
  urls: string[];
}

export interface TesseraBridge {
  openAdvanced(): Promise<void>;
  readClipboardText(): Promise<string>;
  convert(text: string): Promise<ConvertResult>;
  subscription(url: string): Promise<SubscriptionInfo | null>;
  convertedProfiles(): Promise<ConvertedProfiles>;
  markConverted(id: string): Promise<void>;
  auto: AutoBridge;
}
