import { ipcMain } from "electron";

import { Preference } from "../database";
import {
  CONVERSION_ERROR_PREFIX,
  TESSERA_CONVERT,
  TESSERA_CONVERTED,
  TESSERA_MARK_CONVERTED,
  TESSERA_SUBSCRIPTION,
} from "../../shared/tessera";
import type { ConvertedProfiles, ConvertResult, SubscriptionInfo } from "../../shared/tessera";
import { parse } from "./convert";

// Как ProfileImport.prepare на Android: sing-box JSON уходит в ядро байт-в-байт (принцип №1),
// ссылки, Clash и WireGuard собирает конвертер — и об этом знает человек: профиль помечен «Собран из ссылок».

function parseConverted(value: unknown): ConvertedProfiles {
  const candidate = value as Partial<ConvertedProfiles> | null;
  if (!Array.isArray(candidate?.ids) || !Array.isArray(candidate?.urls)) {
    throw new Error("invalid converted profiles preference");
  }
  return { ids: candidate.ids.map(String), urls: candidate.urls.map(String) };
}

const convertedPreference = new Preference<ConvertedProfiles>("tessera_converted", { ids: [], urls: [] }, parseConverted);
const subscriptions = new Map<string, SubscriptionInfo>();

export function convertText(text: string): ConvertResult {
  const parsed = parse(text);
  if (parsed === null) {
    return { ok: false, failure: "unsupported", skipped: [] };
  }
  if (parsed.count === 0) {
    return { ok: false, failure: "nothing", skipped: parsed.skipped };
  }
  return {
    ok: true,
    config: parsed.config(),
    conversion: { format: parsed.format, ways: parsed.count, skipped: parsed.skipped },
    singleName: parsed.singleName,
  };
}

function setConvertedUrl(url: string, converted: boolean) {
  const current = convertedPreference.get();
  const urls = current.urls.filter((candidate) => candidate !== url);
  convertedPreference.set({ ...current, urls: converted ? [...urls, url] : urls });
}

/** `profile-title` как есть или `base64:…`; без него — имя файла из `Content-Disposition` без расширения. */
function profileTitle(headers: Headers): string | undefined {
  let title = headers.get("profile-title")?.trim();
  if (title?.startsWith("base64:") === true) {
    try {
      title = Buffer.from(title.slice("base64:".length), "base64").toString("utf-8");
    } catch {
      title = undefined;
    }
  }
  if (title !== undefined && title.trim() !== "") {
    return title.trim();
  }
  const disposition = headers.get("content-disposition");
  if (disposition === null) {
    return undefined;
  }
  let filename = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(disposition)?.[1];
  if (filename !== undefined) {
    try {
      filename = decodeURIComponent(filename.replace(/^"|"$/g, ""));
    } catch {
      filename = undefined;
    }
  }
  filename ??= /filename="?([^";]+)"?/i.exec(disposition)?.[1];
  const name = filename?.replace(/\.[^.]*$/, "").trim();
  return name === "" ? undefined : name;
}

/** `profile-update-interval` — в часах, как у Clash; чаще раза в 15 минут фоновое обновление не ходит. */
function updateIntervalMinutes(headers: Headers): number | undefined {
  const hours = Number(headers.get("profile-update-interval")?.trim());
  return Number.isFinite(hours) && hours > 0 ? Math.max(15, Math.round(hours * 60)) : undefined;
}

/** Тело подписки → конфиг для ядра. Общее для добавления, «Обновить» и фонового обновления upstream. */
export function prepareSubscription(url: string, headers: Headers, body: string): string {
  const info: SubscriptionInfo = { title: profileTitle(headers), updateIntervalMinutes: updateIntervalMinutes(headers) };
  subscriptions.set(url, info);
  if (body.replace(/^﻿/, "").trimStart().startsWith("{")) {
    setConvertedUrl(url, false);
    return body;
  }
  const result = convertText(body);
  if (!result.ok) {
    info.failure = result.failure;
    info.skipped = result.skipped;
    throw new Error(`${CONVERSION_ERROR_PREFIX}${result.failure}`);
  }
  info.conversion = result.conversion;
  setConvertedUrl(url, true);
  return result.config;
}

export function registerSubscriptions() {
  ipcMain.handle(TESSERA_CONVERT, (_event, text: unknown) => {
    if (typeof text !== "string") {
      throw new Error("invalid text");
    }
    return convertText(text);
  });
  ipcMain.handle(TESSERA_SUBSCRIPTION, (_event, url: unknown) => (typeof url === "string" ? (subscriptions.get(url) ?? null) : null));
  ipcMain.handle(TESSERA_CONVERTED, () => convertedPreference.get());
  ipcMain.handle(TESSERA_MARK_CONVERTED, (_event, id: unknown) => {
    if (typeof id !== "string") {
      throw new Error("invalid profile id");
    }
    const current = convertedPreference.get();
    if (!current.ids.includes(id)) {
      convertedPreference.set({ ...current, ids: [...current.ids, id] });
    }
  });
}
