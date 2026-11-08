import { isCollection, parseDocument, visit, type ScalarTag } from "yaml";

import { broken, Parsed, Skip, skippedBy, unsupported, type Json, type JsonObject, type Skipped, type Way } from "./conversion";
import { doubleToString, numberToInt, toBigIntOrNull, toIntOrNull, trim } from "./jvm";
import {
  hysteriaPorts, http as httpTransport, prefix, reserved, server, shadowsocksMethod, tls, transport as xrayTransport, truthy,
  VMESS_SECURITY, websocket, wireguardPeer, type Reality,
} from "./options";

/*
 * Подписка Clash / mihomo: из YAML берётся только `proxies`. Группы и правила Clash не переносим —
 * у них своя логика, а профиль собирается по одному шаблону для всех форматов.
 */

// `(?m)^` Java: начало строки и после NEL тоже
const PROXIES = /(?:^|(?<=[\n\r\u0085\u2028\u2029]))proxies[ \t\n\x0B\f\r]*:/;

export const matches = (text: string): boolean => PROXIES.test(text);

type YamlMap = Map<unknown, unknown>;

export function parse(text: string): Parsed | null {
  const root = load(text);
  if (!(root instanceof Map)) return null;
  const items = root.get("proxies");
  if (!Array.isArray(items)) return null;
  const ways: Way[] = [];
  const skipped: Skipped[] = [];
  for (const proxy of items.filter((item): item is YamlMap => item instanceof Map)) {
    const name = str(proxy, "name") ?? ([str(proxy, "server"), str(proxy, "port")].filter((part) => part !== null).join(":") || "?");
    try {
      ways.push(way(proxy, name));
    } catch (error) {
      skipped.push(skippedBy(name, error));
    }
  }
  return new Parsed("clash", ways, skipped, text);
}

/*
 * YAML читается как SnakeYAML Engine 2.10 на Android с настройками по умолчанию — схема JSON:
 * числа только вида `443`, `-1`, `1.5e3`, а `0123`, `True`, `~`, `0x1F` остаются строками; Java-типы значений
 * (целые — bigint, Double — number) нужны, чтобы `toString()` дал то же, что на Android.
 * Повторный ключ, подстановка `${…}`, больше 50 ссылок на коллекции — документ не читается.
 */
const CODE_POINT_LIMIT = 32 * 1024 * 1024;
const COLLECTION_ALIAS_LIMIT = 50;

const yamlTag = (name: string) => `tag:yaml.org,2002:${name}`;

// Без явного тега значение определяет регулярное выражение; с тегом `!!int` и подобными — сам конструктор SnakeYAML
const SCALARS: Array<[name: string, test: RegExp, resolve: (value: string) => unknown]> = [
  ["null", /^(?:null)?$/, () => null],
  ["bool", /^(?:true|false)$/, (value) => (value === "true" ? true : value === "false" ? false : null)],
  ["int", /^-?(?:0|[1-9][0-9]*)$/, (value) => toBigIntOrNull(value) ?? undefined],
  ["float", /^(?:-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?|-?\.inf|\.nan)$/, (value) => javaFloat(value) ?? undefined],
  ["env", /^\$\{[ \t\n\x0B\f\r]*\w+(?::?[-?]\w*)?[ \t\n\x0B\f\r]*\}$/, () => undefined],
];

const JSON_SCALARS: ScalarTag[] = SCALARS.flatMap(([name, test, construct]) => {
  const resolve = (value: string, onError: (message: string) => void) => {
    const result = construct(value);
    if (result === undefined) onError(`${name} ${value}`);
    return result;
  };
  return [
    { tag: yamlTag(name), default: true, test, resolve },
    { tag: yamlTag(name), resolve },
  ];
});

/** `ConstructYamlJsonFloat`: знак отдельно, остальное — `Double.valueOf`. */
function javaFloat(value: string): number | null {
  if (value === ".inf") return Infinity;
  if (value === "-.inf") return -Infinity;
  if (value === ".nan") return NaN;
  const negative = value[0] === "-";
  const rest = value.replace(/^[-+]/, "").replace(/^[\0- ]+|[\0- ]+$/g, "");
  const match = /^([-+]?)(?:(NaN)|(Infinity)|((?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][-+]?[0-9]+)?)[fFdD]?)$/.exec(rest);
  if (!match) return null;
  const number = match[2] ? NaN : match[3] ? Infinity : parseFloat(match[4]);
  return (match[1] === "-" ? -number : number) * (negative ? -1 : 1);
}

// Символы вне c-printable YAML SnakeYAML не читает нигде, даже в комментариях
const NON_PRINTABLE = /[^\t\n\r\x20-\x7E\x85\xA0-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/u;

function load(text: string): unknown {
  if (NON_PRINTABLE.test(text)) return undefined;
  if (text.length > CODE_POINT_LIMIT && codePoints(text) > CODE_POINT_LIMIT) return undefined;
  try {
    // Одиночный CR для SnakeYAML — перенос строки, для yaml — нет
    const source = text.replace(/\r(?!\n)/g, "\n");
    if ((source.match(/^%YAML[ \t]/gm)?.length ?? 0) > 1) return undefined;
    const doc = parseDocument(source, { schema: "failsafe", customTags: JSON_SCALARS, merge: false, resolveKnownTags: false });
    if (doc.errors.length > 0) return undefined;
    for (const warning of doc.warnings) {
      // Неизвестный тег для SnakeYAML — ошибка, а не строка; из версий YAML он принимает любую 1.x
      if (warning.code === "TAG_RESOLVE_FAILED") return undefined;
      const version = /^Unsupported YAML version (\d+)\./.exec(warning.message);
      if (version && Number(version[1]) !== 1) return undefined;
    }
    let aliases = 0;
    visit(doc, {
      Alias(_, alias) {
        if (isCollection(alias.resolve(doc))) aliases++;
      },
    });
    if (aliases > COLLECTION_ALIAS_LIMIT) return undefined;
    return doc.toJS({ mapAsMap: true, maxAliasCount: -1 });
  } catch {
    return undefined;
  }
}

function codePoints(text: string): number {
  let count = text.length;
  for (let i = 0; i < text.length - 1; i++) {
    const high = text.charCodeAt(i);
    const low = text.charCodeAt(i + 1);
    if (high >= 0xd800 && high <= 0xdbff && low >= 0xdc00 && low <= 0xdfff) {
      count--;
      i++;
    }
  }
  return count;
}

/** `toString()` значения YAML на JVM. */
function javaString(value: unknown): string {
  if (value == null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number") return doubleToString(value);
  if (Array.isArray(value)) return `[${value.map(javaString).join(", ")}]`;
  if (value instanceof Map) return `{${[...value].map(([key, item]) => `${javaString(key)}=${javaString(item)}`).join(", ")}}`;
  return String(value);
}

function str(map: YamlMap, key: string): string | null {
  const value = map.get(key);
  if (value == null) return null;
  const text = trim(javaString(value));
  return text === "" ? null : text;
}

function int(map: YamlMap, key: string): number | null {
  const value = map.get(key);
  if (typeof value === "bigint" || typeof value === "number") return numberToInt(value);
  return value == null ? null : toIntOrNull(trim(javaString(value)));
}

function bool(map: YamlMap, key: string): boolean {
  const value = map.get(key);
  return typeof value === "boolean" ? value : truthy(value == null ? null : javaString(value));
}

function mapOf(map: YamlMap | null | undefined, key: string): YamlMap | null {
  const value = map?.get(key);
  return value instanceof Map ? value : null;
}

/** Список строк; одиночное значение — список из одного. */
function strings(map: YamlMap, key: string): string[] {
  const value = map.get(key);
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const text = item == null ? "" : trim(javaString(item));
      return text === "" ? [] : [text];
    });
  }
  if (value == null) return [];
  return javaString(value).split(",").map(trim).filter((item) => item !== "");
}

function way(proxy: YamlMap, name: string): Way {
  const type = str(proxy, "type")?.toLowerCase() ?? broken();
  let options: JsonObject;
  switch (type) {
    case "ss":
      options = shadowsocks(proxy);
      break;
    case "vmess":
      options = vmess(proxy);
      break;
    case "vless":
      options = vless(proxy);
      break;
    case "trojan":
      options = trojan(proxy);
      break;
    case "hysteria2":
    case "hy2":
      options = hysteria2(proxy);
      break;
    case "hysteria":
      options = hysteria(proxy);
      break;
    case "tuic":
      options = tuic(proxy);
      break;
    case "anytls":
      options = anytls(proxy);
      break;
    case "socks5":
      options = socks(proxy);
      break;
    case "http":
      options = http(proxy);
      break;
    case "wireguard":
      return { name, options: wireguard(proxy), endpoint: true };
    default:
      return unsupported(type);
  }
  return { name, options, endpoint: false };
}

function shadowsocks(proxy: YamlMap): JsonObject {
  const options: JsonObject = { type: "shadowsocks" };
  proxyServer(options, proxy);
  options.method = shadowsocksMethod(str(proxy, "cipher"));
  options.password = str(proxy, "password") ?? broken();
  const plugin = str(proxy, "plugin");
  if (plugin !== null) {
    const settings = mapOf(proxy, "plugin-opts");
    if (plugin === "obfs") {
      options.plugin = "obfs-local";
      const mode = settings && str(settings, "mode");
      const host = settings && str(settings, "host");
      options.plugin_opts = [mode && `obfs=${mode}`, host && `obfs-host=${host}`].filter(Boolean).join(";");
    } else if (plugin === "v2ray-plugin") {
      const mode = settings && str(settings, "mode");
      if (mode != null && mode !== "websocket") unsupported(`v2ray-plugin ${mode}`);
      options.plugin = "v2ray-plugin";
      const host = settings && str(settings, "host");
      const path = settings && str(settings, "path");
      const parts = [settings && bool(settings, "tls") ? "tls" : null, host && `host=${host}`, path && `path=${path}`].filter(Boolean);
      if (parts.length > 0) options.plugin_opts = parts.join(";");
    } else {
      unsupported(`Shadowsocks ${plugin}`);
    }
  }
  if (bool(proxy, "udp-over-tcp")) {
    // У mihomo версия по умолчанию 1, у ядра — 2
    options.udp_over_tcp = { enabled: true, version: int(proxy, "udp-over-tcp-version") ?? 1 };
  }
  multiplex(options, proxy);
  return options;
}

function vmess(proxy: YamlMap): JsonObject {
  const options: JsonObject = { type: "vmess" };
  proxyServer(options, proxy);
  options.uuid = str(proxy, "uuid") ?? broken();
  const cipher = str(proxy, "cipher")?.toLowerCase();
  options.security = cipher != null && VMESS_SECURITY.has(cipher) ? cipher : "auto";
  const alterId = int(proxy, "alterId");
  if (alterId !== null && alterId > 0) options.alter_id = alterId;
  if (bool(proxy, "global-padding")) options.global_padding = true;
  if (bool(proxy, "authenticated-length")) options.authenticated_length = true;
  stream(options, proxy, bool(proxy, "tls"));
  return options;
}

function vless(proxy: YamlMap): JsonObject {
  const encryption = str(proxy, "encryption");
  if (encryption !== null && encryption !== "none") throw new Skip("vless-encryption");
  const options: JsonObject = { type: "vless" };
  proxyServer(options, proxy);
  options.uuid = str(proxy, "uuid") ?? broken();
  const flow = str(proxy, "flow");
  if (flow !== null) options.flow = flow.startsWith("xtls-rprx-vision") ? "xtls-rprx-vision" : unsupported(flow);
  stream(options, proxy, bool(proxy, "tls"));
  return options;
}

function trojan(proxy: YamlMap): JsonObject {
  const ssOptions = mapOf(proxy, "ss-opts");
  if (ssOptions && bool(ssOptions, "enabled")) unsupported("Trojan-Go");
  const options: JsonObject = { type: "trojan" };
  proxyServer(options, proxy);
  options.password = str(proxy, "password") ?? broken();
  stream(options, proxy, true);
  return options;
}

function realityOf(proxy: YamlMap): Reality | null {
  const settings = mapOf(proxy, "reality-opts");
  return settings && { publicKey: str(settings, "public-key") ?? broken(), shortId: str(settings, "short-id") };
}

/** Транспорт, TLS и мультиплекс у vmess, vless и trojan. */
function stream(options: JsonObject, proxy: YamlMap, tlsOn: boolean): void {
  const settings = transport(proxy);
  if (settings) options.transport = settings;
  if (tlsOn) {
    const reality = realityOf(proxy);
    options.tls = tls(str(proxy, "servername") ?? str(proxy, "sni"), {
      insecure: bool(proxy, "skip-cert-verify"),
      alpn: strings(proxy, "alpn"),
      fingerprint: str(proxy, "client-fingerprint"),
      reality,
    });
  }
  multiplex(options, proxy);
}

function transport(proxy: YamlMap): JsonObject | null {
  const network = str(proxy, "network")?.toLowerCase() ?? null;
  switch (network) {
    case null:
    case "tcp":
      return null;
    case "ws": {
      const ws = mapOf(proxy, "ws-opts");
      const headers = mapOf(ws, "headers");
      const host = headers && str(headers, "Host");
      if (ws && bool(ws, "v2ray-http-upgrade")) return xrayTransport("httpupgrade", host, str(ws, "path"), null, null);
      return websocket(host, ws && str(ws, "path"), ws && int(ws, "max-early-data"), ws && str(ws, "early-data-header-name"));
    }
    case "grpc": {
      const grpc = mapOf(proxy, "grpc-opts");
      return xrayTransport("grpc", null, null, grpc && str(grpc, "grpc-service-name"), null);
    }
    case "h2": {
      const h2 = mapOf(proxy, "h2-opts");
      return httpTransport(h2 && strings(h2, "host").join(","), h2 && str(h2, "path"));
    }
    // network: http у Clash — маскировка TCP под HTTP/1.1, как headerType=http у Xray
    case "http": {
      const settings = mapOf(proxy, "http-opts");
      const headers = mapOf(settings, "headers");
      return httpTransport(headers && strings(headers, "Host").join(","), settings && (strings(settings, "path")[0] ?? null), (settings && str(settings, "method")) ?? "GET");
    }
    default:
      return xrayTransport(network, null, null, null, null);
  }
}

function multiplex(options: JsonObject, proxy: YamlMap): void {
  const smux = mapOf(proxy, "smux");
  if (!smux || !bool(smux, "enabled")) return;
  const settings: JsonObject = { enabled: true };
  const protocol = str(smux, "protocol");
  if (protocol !== null && ["smux", "yamux", "h2mux"].includes(protocol)) settings.protocol = protocol;
  const maxConnections = int(smux, "max-connections");
  if (maxConnections !== null) settings.max_connections = maxConnections;
  const minStreams = int(smux, "min-streams");
  if (minStreams !== null) settings.min_streams = minStreams;
  const maxStreams = int(smux, "max-streams");
  if (maxStreams !== null) settings.max_streams = maxStreams;
  if (bool(smux, "padding")) settings.padding = true;
  options.multiplex = settings;
}

function hysteria2(proxy: YamlMap): JsonObject {
  const options: JsonObject = { type: "hysteria2" };
  hysteriaPorts(options, str(proxy, "server"), str(proxy, "ports") ?? str(proxy, "port"));
  const password = str(proxy, "password");
  if (password !== null) options.password = password;
  const up = mbps(str(proxy, "up"));
  if (up !== null) options.up_mbps = up;
  const down = mbps(str(proxy, "down"));
  if (down !== null) options.down_mbps = down;
  const obfs = str(proxy, "obfs");
  if (obfs !== null) {
    if (obfs !== "salamander" && obfs !== "gecko") unsupported(`Hysteria2 obfs ${obfs}`);
    const settings: JsonObject = { type: obfs };
    const obfsPassword = str(proxy, "obfs-password");
    if (obfsPassword !== null) settings.password = obfsPassword;
    options.obfs = settings;
  }
  options.tls = tls(str(proxy, "sni"), { insecure: bool(proxy, "skip-cert-verify"), alpn: strings(proxy, "alpn") });
  return options;
}

function hysteria(proxy: YamlMap): JsonObject {
  const protocol = str(proxy, "protocol");
  if (protocol !== null && protocol !== "udp") unsupported(`Hysteria ${protocol}`);
  const options: JsonObject = { type: "hysteria" };
  hysteriaPorts(options, str(proxy, "server"), str(proxy, "ports") ?? str(proxy, "port"));
  options.up_mbps = mbps(str(proxy, "up")) ?? 10;
  options.down_mbps = mbps(str(proxy, "down")) ?? 50;
  const authStr = str(proxy, "auth-str");
  if (authStr !== null) options.auth_str = authStr;
  // auth у Clash — base64 байтов, ядро ждёт в auth то же самое
  const auth = str(proxy, "auth");
  if (auth !== null) options.auth = auth;
  const obfs = str(proxy, "obfs");
  if (obfs !== null) options.obfs = obfs;
  options.tls = tls(str(proxy, "sni"), { insecure: bool(proxy, "skip-cert-verify"), alpn: strings(proxy, "alpn") });
  return options;
}

function tuic(proxy: YamlMap): JsonObject {
  if (str(proxy, "token") !== null) unsupported("TUIC v4");
  const options: JsonObject = { type: "tuic" };
  proxyServer(options, proxy);
  options.uuid = str(proxy, "uuid") ?? broken();
  const password = str(proxy, "password");
  if (password !== null) options.password = password;
  const congestion = str(proxy, "congestion-controller");
  if (congestion !== null && ["cubic", "new_reno", "bbr"].includes(congestion)) options.congestion_control = congestion;
  const relay = str(proxy, "udp-relay-mode");
  if (relay !== null && ["native", "quic"].includes(relay)) options.udp_relay_mode = relay;
  if (bool(proxy, "reduce-rtt")) options.zero_rtt_handshake = true;
  const heartbeat = int(proxy, "heartbeat-interval");
  if (heartbeat !== null) options.heartbeat = `${heartbeat}ms`;
  options.tls = tls(str(proxy, "sni"), {
    insecure: bool(proxy, "skip-cert-verify"),
    alpn: strings(proxy, "alpn"),
    disableSni: bool(proxy, "disable-sni"),
  });
  return options;
}

function anytls(proxy: YamlMap): JsonObject {
  const options: JsonObject = { type: "anytls" };
  proxyServer(options, proxy);
  options.password = str(proxy, "password") ?? broken();
  const checkInterval = int(proxy, "idle-session-check-interval");
  if (checkInterval !== null) options.idle_session_check_interval = `${checkInterval}s`;
  const timeout = int(proxy, "idle-session-timeout");
  if (timeout !== null) options.idle_session_timeout = `${timeout}s`;
  const minIdle = int(proxy, "min-idle-session");
  if (minIdle !== null) options.min_idle_session = minIdle;
  const reality = realityOf(proxy);
  options.tls = tls(str(proxy, "sni"), {
    insecure: bool(proxy, "skip-cert-verify"),
    alpn: strings(proxy, "alpn"),
    fingerprint: str(proxy, "client-fingerprint"),
    reality,
  });
  return options;
}

function socks(proxy: YamlMap): JsonObject {
  if (bool(proxy, "tls")) unsupported("SOCKS5 + TLS");
  const options: JsonObject = { type: "socks" };
  proxyServer(options, proxy);
  credentials(options, proxy);
  return options;
}

function http(proxy: YamlMap): JsonObject {
  const options: JsonObject = { type: "http" };
  proxyServer(options, proxy);
  credentials(options, proxy);
  if (bool(proxy, "tls")) options.tls = tls(str(proxy, "sni"), { insecure: bool(proxy, "skip-cert-verify") });
  return options;
}

function credentials(options: JsonObject, proxy: YamlMap): void {
  const username = str(proxy, "username");
  if (username !== null) options.username = username;
  const password = str(proxy, "password");
  if (password !== null) options.password = password;
}

function wireguard(proxy: YamlMap): JsonObject {
  if (mapOf(proxy, "amnezia-wg-option")) unsupported("AmneziaWG");
  const options: JsonObject = { type: "wireguard" };
  const addresses = [str(proxy, "ip"), str(proxy, "ipv6")].filter((address) => address !== null);
  options.address = addresses.length > 0 ? addresses.map(prefix) : broken();
  options.private_key = str(proxy, "private-key") ?? broken();
  const mtu = int(proxy, "mtu");
  if (mtu !== null) options.mtu = mtu;
  // Пиры — списком или, если пир один, прямо в описании прокси
  const listed = proxy.get("peers");
  const peers = Array.isArray(listed) ? listed.filter((peer): peer is YamlMap => peer instanceof Map) : [];
  options.peers = (peers.length > 0 ? peers : [proxy]).map((peer) => {
    const allowedIps = strings(peer, "allowed-ips");
    const bytes = peer.get("reserved");
    return wireguardPeer(
      str(peer, "server"),
      int(peer, "port"),
      str(peer, "public-key"),
      str(peer, "pre-shared-key"),
      allowedIps.length > 0 ? allowedIps : undefined,
      int(peer, "persistent-keepalive") ?? int(proxy, "persistent-keepalive"),
      Array.isArray(bytes) ? bytes.map(byteOf) : reserved(str(peer, "reserved")),
    );
  });
  return options;
}

// `(it as Number).toInt()`: не число — ошибка приведения, способ повреждён
function byteOf(value: unknown): Json {
  if (typeof value !== "bigint" && typeof value !== "number") throw new TypeError("reserved");
  return numberToInt(value);
}

const proxyServer = (options: JsonObject, proxy: YamlMap): void => server(options, str(proxy, "server"), int(proxy, "port"));

const MBPS = /^[ \t\n\x0B\f\r]*([0-9]+)[ \t\n\x0B\f\r]*([kmgt]?)(bps)?[ \t\n\x0B\f\r]*(?:\r\n|[\n\r\u0085\u2028\u2029])?$/i;

/** Скорость Clash: `30`, `30 Mbps`, `1 Gbps` → мегабиты. */
function mbps(value: string | null): number | null {
  const match = value == null ? null : MBPS.exec(value);
  if (!match) return null;
  // `toInt()` Kotlin: переполнение — исключение, способ повреждён
  const number = toIntOrNull(match[1]) ?? broken();
  switch (match[2].toLowerCase()) {
    case "k":
      return Math.max(Math.trunc(number / 1000), 1);
    case "g":
      return Math.imul(number, 1000);
    case "t":
      return Math.imul(number, 1_000_000);
    default:
      return number;
  }
}
