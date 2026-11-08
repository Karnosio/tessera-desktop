import { androidStrings } from "./ui/strings";

export type Language = "ru" | "uk";

// Как на Android: украинский по языку системы, иначе русский — английской локализации у Slate нет.
export const language: Language = navigator.languages.some((tag) => tag.toLowerCase().startsWith("uk"))
  ? "uk"
  : "ru";

// Только на Windows: службы, починки и окна «Для опытных» на телефоне нет.
const desktopStrings: Record<Language, Record<string, string>> = {
  ru: {
    tsd_service_connecting: "Связываемся со службой Slate…",
    tsd_service_not_installed: "Служба Slate не установлена",
    tsd_service_not_running: "Служба Slate не запущена",
    tsd_service_unavailable: "Нет связи со службой Slate",
    tsd_service_version: "Служба Slate другой версии",
    tsd_service_description: "Без неё включить нельзя. Нажмите «Починить» — Windows попросит разрешение.",
    tsd_service_other_user: "Slate сейчас включён у другого пользователя этого компьютера",
    tsd_service_other_user_description: "Если забрать себе, у него Slate выключится.",
    tsd_repair: "Починить",
    tsd_take_over: "Забрать себе",
    tsd_open_at_login: "Открывать Slate при входе в Windows",
    tsd_open_at_login_description: "Значком в трее, без окна. Включённое подключение после перезагрузки вернётся и так",
  },
  uk: {
    tsd_service_connecting: "Зв’язуємося зі службою Slate…",
    tsd_service_not_installed: "Службу Slate не встановлено",
    tsd_service_not_running: "Службу Slate не запущено",
    tsd_service_unavailable: "Немає зв’язку зі службою Slate",
    tsd_service_version: "Служба Slate іншої версії",
    tsd_service_description: "Без неї увімкнути не можна. Натисніть «Полагодити» — Windows попросить дозвіл.",
    tsd_service_other_user: "Slate зараз увімкнено в іншого користувача цього комп’ютера",
    tsd_service_other_user_description: "Якщо забрати собі, у нього Slate вимкнеться.",
    tsd_repair: "Полагодити",
    tsd_take_over: "Забрати собі",
    tsd_open_at_login: "Відкривати Slate під час входу у Windows",
    tsd_open_at_login_description: "Значком у треї, без вікна. Увімкнене підключення після перезавантаження повернеться і так",
  },
};

function lookup(key: string): string | Record<string, string> {
  const value = desktopStrings[language][key] ?? androidStrings[language][key] ?? androidStrings.ru[key];
  if (value === undefined) {
    throw new Error(`missing string ${key}`);
  }
  return value;
}

// Форматы Android: %s, %d и с номером — %1$s.
function format(template: string, args: (string | number)[]): string {
  let next = 0;
  return template.replace(/%(?:(\d+)\$)?([sd])/g, (_match, position: string | undefined) =>
    String(args[position === undefined ? next++ : Number(position) - 1]),
  );
}

export function t(key: string, ...args: (string | number)[]): string {
  const value = lookup(key);
  if (typeof value !== "string") {
    throw new Error(`string ${key} has plural forms`);
  }
  return format(value, args);
}

const pluralRules = new Intl.PluralRules(language);

export function plural(key: string, count: number): string {
  const forms = lookup(key);
  if (typeof forms === "string") {
    throw new Error(`string ${key} has no plural forms`);
  }
  return format(forms[pluralRules.select(count)] ?? forms.other, [count]);
}

export function ago(timestamp: number, now: number): string {
  const minutes = Math.floor((now - timestamp) / 60_000);
  if (minutes < 1) {
    return t("ts_just_now");
  }
  if (minutes < 60) {
    return t("ts_ago", plural("ts_minutes", minutes));
  }
  if (minutes < 24 * 60) {
    return t("ts_ago", plural("ts_hours", Math.floor(minutes / 60)));
  }
  return t("ts_ago", plural("ts_days", Math.floor(minutes / (24 * 60))));
}
