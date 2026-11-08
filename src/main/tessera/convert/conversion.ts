import { build } from "./configTemplate";
import { base64, decodeUtf8, isWhitespace, trimChars } from "./jvm";

/** Во что было завёрнуто присланное — от этого зависит, как объяснить сборку человеку. */
export type SourceFormat = "links" | "clash" | "wireguard";

export type SkipReason = "xhttp" | "mkcp" | "vless-encryption" | "unsupported" | "broken";

/** Способ, который не вошёл в профиль. `protocol` — что именно не умеем, для `unsupported`. */
export interface Skipped {
  name: string;
  reason: SkipReason;
  protocol?: string;
}

export type Json = string | number | boolean | Json[] | JsonObject;
export interface JsonObject {
  [key: string]: Json;
}

/** Способ подключения для ядра: outbound, а у WireGuard — endpoint. */
export interface Way {
  name: string;
  options: JsonObject;
  endpoint: boolean;
}

/** Способ не войдёт в профиль: ядро его не умеет или ссылка повреждена. */
export class Skip extends Error {
  constructor(
    readonly reason: SkipReason,
    readonly protocol?: string,
  ) {
    super(protocol ? `${reason}: ${protocol}` : reason);
  }
}

export function broken(): never {
  throw new Skip("broken");
}

export function unsupported(protocol: string): never {
  throw new Skip("unsupported", protocol);
}

/** Любая другая ошибка разбора — повреждённый способ. */
export function skippedBy(name: string, error: unknown): Skipped {
  if (!(error instanceof Skip)) return { name, reason: "broken" };
  return error.protocol === undefined ? { name, reason: error.reason } : { name, reason: error.reason, protocol: error.protocol };
}

// JsonObject в Kotlin равен по содержимому, порядок ключей не важен
function canonical(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Разобранное: способы, которые вошли в профиль, и те, что не вошли. `source` — присланный текст, как есть. */
export class Parsed {
  readonly ways: Way[];

  constructor(
    readonly format: SourceFormat,
    ways: Way[],
    readonly skipped: Skipped[],
    readonly source: string,
  ) {
    // Один способ под двумя записями — не два способа: s-ui отдаёт naive и как naive+https://, и как http2://
    const seen = new Set<string>();
    this.ways = ways.filter((way) => {
      const key = `${way.endpoint}${canonical(way.options)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  get count(): number {
    return this.ways.length;
  }

  /** Имя единственного способа: им называем профиль из одной ссылки. */
  get singleName(): string | null {
    return this.ways.length === 1 ? this.ways[0].name : null;
  }

  /** Конфиг для ядра. Нарушение принципа №1, неизбежное для не-JSON форматов: собирает его приложение. */
  config(): string {
    return build(this.ways);
  }
}

/** base64 обоих алфавитов, с отступом и без, с переносами строк — как его отдают панели. */
export function decodeBase64(value: string): string | null {
  let compact = "";
  for (let i = 0; i < value.length; i++) if (!isWhitespace(value.charCodeAt(i))) compact += value[i];
  compact = trimChars(compact, "=", false);
  if (compact === "" || !/^[A-Za-z0-9+/_-]*$/.test(compact)) return null;
  const standard = compact.replaceAll("-", "+").replaceAll("_", "/");
  const bytes = base64(standard + "=".repeat((4 - (standard.length % 4)) % 4));
  return bytes && decodeUtf8(bytes);
}
