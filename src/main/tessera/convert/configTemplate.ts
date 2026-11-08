import type { Json, JsonObject, Way } from "./conversion";
import { isBlank, wellFormed } from "./jvm";

/*
 * Конфиг для способов, собранных из ссылок. Основа — пример клиента из документации ядра (docs/manual/proxy/client.md):
 * - `tun`, иначе приложение запустится прокси, а не VPN;
 * - DNS через прокси по TLS — запросы не видны провайдеру, который подменяет ответы; адреса серверов — системным DNS;
 * - только IPv4 в ответах DNS: у сервера IPv6 может не быть, а `tun` с IPv6 не даёт трафику уйти мимо туннеля;
 * - группы как у JSON-подписок s-ui: `proxy` — ручной выбор, `auto` (urltest) — выбор по пингу, он и по умолчанию;
 * - выбор в группах сохраняется в `cache_file` между включениями.
 * Локального прокси-порта нет намеренно: по открытому порту приложения вычисляют VPN.
 */

export const SELECTOR = "proxy";
export const AUTO = "auto";
const DIRECT = "direct";

export function build(ways: Way[]): string {
  if (ways.length === 0) throw new Error("Нет способов подключения");
  const tags = uniqueTags(ways.map((way) => way.name));
  const tagged = ways.map((way, i) => ({ endpoint: way.endpoint, options: withTag(way.options, tags[i]) }));
  const config: JsonObject = {
    dns: {
      servers: [
        { type: "tls", tag: "remote", server: "8.8.8.8" },
        { type: "local", tag: "local" },
      ],
      strategy: "ipv4_only",
    },
    inbounds: [
      {
        type: "tun",
        tag: "tun-in",
        address: ["172.19.0.1/30", "fdfe:dcba:9876::1/126"],
        auto_route: true,
        strict_route: true,
      },
    ],
    outbounds: [
      { type: "selector", tag: SELECTOR, outbounds: [AUTO, ...tags], default: AUTO },
      { type: "urltest", tag: AUTO, outbounds: tags },
      ...tagged.filter((way) => !way.endpoint).map((way) => way.options),
      { type: "direct", tag: DIRECT },
    ],
  };
  const endpoints = tagged.filter((way) => way.endpoint).map((way) => way.options);
  if (endpoints.length > 0) config.endpoints = endpoints;
  config.route = {
    rules: [
      { action: "sniff" },
      { protocol: "dns", action: "hijack-dns" },
      { ip_is_private: true, outbound: DIRECT },
    ],
    final: SELECTOR,
    auto_detect_interface: true,
    default_domain_resolver: "local",
  };
  config.experimental = { cache_file: { enabled: true } };
  return JSON.stringify(config, (_, value: Json) => (typeof value === "string" ? wellFormed(value) : value), 2) + "\n";
}

/** Названия способов — теги ядра: повторы нумеруем, имена групп не занимаем. */
function uniqueTags(names: string[]): string[] {
  const used = new Set([SELECTOR, AUTO, DIRECT]);
  return names.map((name) => {
    const base = isBlank(name) ? "?" : name;
    let tag = base;
    let n = 2;
    while (used.has(tag)) tag = `${base} ${n++}`;
    used.add(tag);
    return tag;
  });
}

// type и tag первыми — так конфиг читается глазами
function withTag(options: JsonObject, tag: string): JsonObject {
  const { type, ...rest } = options;
  return type === undefined ? { tag, ...rest } : { type, tag, ...rest };
}
