import type { DesktopHost, DesktopProfile } from "@dashboard/app/desktop";
import { CONVERSION_ERROR_PREFIX } from "@shared/tessera";
import type { Conversion, Skipped } from "@shared/tessera";

import { t } from "./i18n";

export type ImportError = "empty" | "unsupported" | "nothing" | "download" | "rejected";

export type ImportOutcome =
  | { kind: "added"; name: string; existed: boolean; conversion?: Conversion }
  | { kind: "failed"; error: ImportError; detail?: string; skipped?: Skipped[] };

type Input =
  | { kind: "subscription"; url: string; name?: string }
  | { kind: "config"; content: string }
  | { kind: "text"; text: string }
  | { kind: "unsupported" }
  | { kind: "empty" };

function recognize(text: string): Input {
  const value = text.trim();
  if (value === "") {
    return { kind: "empty" };
  }
  if (/^sing-box:\/\/import-remote-profile/i.test(value)) {
    return remoteProfileLink(value) ?? { kind: "unsupported" };
  }
  if (/^https?:\/\//i.test(value) && !/\s/.test(value)) {
    return { kind: "subscription", url: value };
  }
  if (value.startsWith("{")) {
    return { kind: "config", content: text };
  }
  // Ссылки, Clash, WireGuard — или что-то неизвестное: решает конвертер
  return { kind: "text", text: value };
}

// Ссылка, которую выдают панели для sing-box: sing-box://import-remote-profile?url=…#Название
function remoteProfileLink(link: string): Input | null {
  try {
    const parsed = new URL(link);
    const url = parsed.searchParams.get("url");
    if (url === null || url.trim() === "") {
      return null;
    }
    const name = decodeURIComponent(parsed.hash.slice(1)).trim();
    return { kind: "subscription", url, name: name === "" ? undefined : name };
  } catch {
    return null;
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Ошибки upstream: fetchRemoteContent — «HTTP …» или сетевые, остальное — проверка конфига ядром.
export function downloadFailed(detail: string): boolean {
  return /^HTTP |fetch failed|timeout|aborted|ENOTFOUND|ECONN|EAI_AGAIN|certificate/i.test(detail);
}

async function failure(url: string, detail: string): Promise<ImportOutcome> {
  if (detail.includes(CONVERSION_ERROR_PREFIX)) {
    const info = await window.tessera.subscription(url);
    return { kind: "failed", error: info?.failure ?? "unsupported", skipped: info?.skipped };
  }
  return { kind: "failed", error: downloadFailed(detail) ? "download" : "rejected", detail };
}

async function createdId(host: DesktopHost, before: Set<string>): Promise<string | undefined> {
  const { profiles } = await host.profiles.list();
  return profiles.find((profile) => !before.has(profile.id))?.id;
}

async function importSubscription(
  host: DesktopHost,
  profiles: DesktopProfile[],
  url: string,
  name: string | undefined,
): Promise<ImportOutcome> {
  const existing = profiles.find((profile) => profile.type === "remote" && profile.remoteUrl === url);
  try {
    if (existing !== undefined) {
      await host.profiles.updateRemote(existing.id);
      await host.profiles.select(existing.id);
      const info = await window.tessera.subscription(url);
      return { kind: "added", name: existing.name, existed: true, conversion: info?.conversion };
    }
    const before = new Set((await host.profiles.list()).profiles.map((profile) => profile.id));
    await host.profiles.create({ name: name ?? new URL(url).hostname, type: "remote", remoteUrl: url, autoUpdate: true });
    // Название и интервал обновления панель сообщает в заголовках — узнаём их, только скачав
    const info = await window.tessera.subscription(url);
    const id = await createdId(host, before);
    let profileName = name ?? new URL(url).hostname;
    if (id !== undefined && info !== null) {
      const title = name === undefined ? info.title : undefined;
      if (title !== undefined || info.updateIntervalMinutes !== undefined) {
        await host.profiles.updateMetadata(id, { name: title, autoUpdateIntervalMinutes: info.updateIntervalMinutes });
        profileName = title ?? profileName;
      }
    }
    return { kind: "added", name: profileName, existed: false, conversion: info?.conversion };
  } catch (error) {
    return failure(url, message(error));
  }
}

// sing-box JSON уходит в ядро байт-в-байт: upstream только проверяет его и сохраняет как есть.
async function importConfig(host: DesktopHost, content: string, name: string): Promise<ImportOutcome> {
  try {
    await host.profiles.create({ name, type: "local", content });
    return { kind: "added", name, existed: false };
  } catch (error) {
    return { kind: "failed", error: "rejected", detail: message(error) };
  }
}

// Сборка нарушает принцип №1 — профиль помечается, и человек видит, что его собрали (§3.1)
async function importConverted(host: DesktopHost, text: string, name: string | undefined): Promise<ImportOutcome> {
  const result = await window.tessera.convert(text);
  if (!result.ok) {
    return { kind: "failed", error: result.failure, skipped: result.skipped };
  }
  const profileName = name ?? result.singleName ?? t("ts_new_profile");
  try {
    const before = new Set((await host.profiles.list()).profiles.map((profile) => profile.id));
    await host.profiles.create({ name: profileName, type: "local", content: result.config });
    const id = await createdId(host, before);
    if (id !== undefined) {
      await window.tessera.markConverted(id);
    }
    return { kind: "added", name: profileName, existed: false, conversion: result.conversion };
  } catch (error) {
    return { kind: "failed", error: "rejected", detail: message(error) };
  }
}

async function importInput(
  host: DesktopHost,
  profiles: DesktopProfile[],
  input: Input,
  name: string | undefined,
): Promise<ImportOutcome> {
  switch (input.kind) {
    case "subscription":
      return importSubscription(host, profiles, input.url, input.name);
    case "config":
      return importConfig(host, input.content, name ?? t("ts_new_profile"));
    case "text":
      return importConverted(host, input.text, name);
    default:
      return { kind: "failed", error: input.kind } satisfies ImportOutcome;
  }
}

export function importText(host: DesktopHost, profiles: DesktopProfile[], text: string): Promise<ImportOutcome> {
  return importInput(host, profiles, recognize(text), undefined);
}

// Ссылка без #Название: upstream подставляет адрес панели — тогда название берём из заголовков подписки
function linkName(request: { name: string; url: string }): string | undefined {
  const name = request.name.trim();
  try {
    return name === "" || name === new URL(request.url).host ? undefined : name;
  } catch {
    return name === "" ? undefined : name;
  }
}

export function importRemote(
  host: DesktopHost,
  profiles: DesktopProfile[],
  request: { name: string; url: string },
): Promise<ImportOutcome> {
  return importSubscription(host, profiles, request.url, linkName(request));
}

export async function importFile(
  host: DesktopHost,
  profiles: DesktopProfile[],
  file: { fileName: string; data: Uint8Array },
): Promise<ImportOutcome> {
  const baseName = file.fileName.replace(/\.[^.]+$/, "").trim() || undefined;
  if (/\.bpf$/i.test(file.fileName)) {
    try {
      const { name } = await host.profiles.decodeData(file.data);
      await host.profiles.importData(file.fileName, file.data);
      return { kind: "added", name: name || baseName || t("ts_new_profile"), existed: false };
    } catch (error) {
      return { kind: "failed", error: "rejected", detail: message(error) };
    }
  }
  const text = new TextDecoder().decode(file.data);
  return importInput(host, profiles, recognize(text), baseName);
}
