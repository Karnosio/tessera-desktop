import type { DesktopHost, DesktopProfile } from "@dashboard/app/desktop";

import { t } from "./i18n";

export type ImportError = "empty" | "unsupported" | "links" | "download" | "rejected";

export type ImportOutcome =
  | { kind: "added"; name: string; existed: boolean }
  | { kind: "failed"; error: ImportError; detail?: string };

type Input =
  | { kind: "subscription"; url: string; name?: string }
  | { kind: "config"; content: string }
  | { kind: "links" }
  | { kind: "unsupported" }
  | { kind: "empty" };

// Ссылки Xray-панелей, Clash и WireGuard собирает конвертер — на Windows его ещё нет (шаг 8 плана).
const CONVERTIBLE = /^(vless|vmess|trojan|ss|ssr|hysteria2?|hy2|tuic|anytls|naive\+https?|naive\+quic|socks5?|http2|wireguard|wg):\/\/|^\s*proxies\s*:|^\s*\[Interface\]/im;

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
  return CONVERTIBLE.test(value) ? { kind: "links" } : { kind: "unsupported" };
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
      return { kind: "added", name: existing.name, existed: true };
    }
    const profileName = name ?? new URL(url).hostname;
    await host.profiles.create({ name: profileName, type: "remote", remoteUrl: url, autoUpdate: true });
    return { kind: "added", name: profileName, existed: false };
  } catch (error) {
    const detail = message(error);
    return { kind: "failed", error: downloadFailed(detail) ? "download" : "rejected", detail };
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

async function importInput(
  host: DesktopHost,
  profiles: DesktopProfile[],
  input: Input,
  name: string,
): Promise<ImportOutcome> {
  switch (input.kind) {
    case "subscription":
      return importSubscription(host, profiles, input.url, input.name);
    case "config":
      return importConfig(host, input.content, name);
    default:
      return { kind: "failed", error: input.kind } satisfies ImportOutcome;
  }
}

export function importText(host: DesktopHost, profiles: DesktopProfile[], text: string): Promise<ImportOutcome> {
  return importInput(host, profiles, recognize(text), t("ts_new_profile"));
}

export function importRemote(
  host: DesktopHost,
  profiles: DesktopProfile[],
  request: { name: string; url: string },
): Promise<ImportOutcome> {
  return importSubscription(host, profiles, request.url, request.name.trim() || undefined);
}

export async function importFile(
  host: DesktopHost,
  profiles: DesktopProfile[],
  file: { fileName: string; data: Uint8Array },
): Promise<ImportOutcome> {
  const baseName = file.fileName.replace(/\.[^.]+$/, "") || t("ts_new_profile");
  if (/\.bpf$/i.test(file.fileName)) {
    try {
      const { name } = await host.profiles.decodeData(file.data);
      await host.profiles.importData(file.fileName, file.data);
      return { kind: "added", name: name || baseName, existed: false };
    } catch (error) {
      return { kind: "failed", error: "rejected", detail: message(error) };
    }
  }
  const text = new TextDecoder().decode(file.data);
  return importInput(host, profiles, recognize(text), baseName);
}
