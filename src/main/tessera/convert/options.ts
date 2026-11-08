import { broken, Skip, unsupported, type Json, type JsonObject } from "./conversion";
import { after, allDigits, base64, before, equalsIgnoreCase, isBlank, toIntOrNull, trim } from "./jvm";

// Части опций ядра 1.14, общие для ссылок и Clash. Имена полей — как в option/*.go sing-box

/** Отпечатки uTLS, которые знает ядро. Остальные (у Xray есть `randomizednoalpn`, `unsafe`) — как Chrome. */
const FINGERPRINTS = new Set(["chrome", "firefox", "edge", "safari", "360", "qq", "ios", "android", "random", "randomized"]);

export interface Reality {
  publicKey: string;
  shortId: string | null;
}

type Text = string | null | undefined;

const present = (value: Text): value is string => value != null && !isBlank(value);

/** `a,b,,c` → `[a, b, c]`. */
export const list = (value: Text): string[] => (value == null ? [] : value.split(",").map(trim).filter((item) => item !== ""));

export function server(options: JsonObject, host: Text, port: number | null | undefined): void {
  options.server = present(host) ? host : broken();
  options.server_port = port != null && port >= 1 && port <= 65535 ? port : broken();
}

/**
 * Порты для прыжков Hysteria: `443,5000-6000` → `["443:443", "5000:6000"]`, как их читает ядро.
 * s-ui пишет диапазон уже через двоеточие. Один порт без диапазонов — обычный `server_port`.
 */
export function hysteriaPorts(options: JsonObject, host: Text, ports: Text, extra: Text = null): void {
  const ranges = [ports, extra]
    .filter((value): value is string => value != null)
    .flatMap((value) => value.split(/[,/]/))
    .map(trim)
    .filter((range) => range !== "");
  if (ranges.length === 1 && allDigits(ranges[0])) {
    server(options, host, toIntOrNull(ranges[0]));
    return;
  }
  options.server = present(host) ? host : broken();
  const portRanges = ranges.map((range) => {
    const bounds = range.split(/[-:]/);
    const start = toIntOrNull(trim(bounds[0]));
    if (start === null || start < 1 || start > 65535) broken();
    const end = toIntOrNull(trim(bounds[bounds.length - 1]));
    if (end === null || end < start || end > 65535) broken();
    if (bounds.length > 2) broken();
    return `${start}:${end}`;
  });
  if (portRanges.length === 0) broken();
  options.server_ports = portRanges;
}

interface TlsOptions {
  insecure?: boolean;
  alpn?: string[];
  fingerprint?: Text;
  reality?: Reality | null;
  disableSni?: boolean;
}

/** `utls` — только для TLS поверх TCP: у QUIC-протоколов и naive ядро его не принимает. */
export function tls(serverName: Text, { insecure = false, alpn = [], fingerprint = null, reality = null, disableSni = false }: TlsOptions = {}): JsonObject {
  const options: JsonObject = { enabled: true };
  if (present(serverName)) options.server_name = serverName;
  if (disableSni) options.disable_sni = true;
  if (insecure && reality === null) options.insecure = true;
  if (alpn.length > 0) options.alpn = alpn;
  // REALITY без uTLS ядро не запускает
  const lowered = fingerprint?.toLowerCase();
  const utls = lowered != null && !isBlank(lowered) ? lowered : reality !== null ? "chrome" : null;
  if (utls !== null) options.utls = { enabled: true, fingerprint: FINGERPRINTS.has(utls) ? utls : "chrome" };
  if (reality !== null) {
    const settings: JsonObject = { enabled: true, public_key: isBlank(reality.publicKey) ? broken() : reality.publicKey };
    if (present(reality.shortId)) settings.short_id = reality.shortId;
    options.reality = settings;
  }
  return options;
}

/**
 * Транспорт V2Ray по параметрам Xray. `network` — `type` ссылки или `network` Clash; null в ответе — обычный TCP.
 * XHTTP и mKCP есть только в Xray: такой способ не войдёт в профиль, и человек это увидит.
 */
export function transport(network: Text, host: Text, path: Text, serviceName: Text, headerType: Text): JsonObject | null {
  switch (network?.toLowerCase() ?? "") {
    // Маскировка TCP под HTTP у Xray — это HTTP-транспорт ядра без TLS; Xray шлёт GET, ядро по умолчанию PUT
    case "":
    case "tcp":
    case "raw":
      return equalsIgnoreCase(headerType, "http") ? http(host, path, "GET") : null;
    case "ws":
    case "websocket":
      return websocket(host, path);
    case "grpc":
    case "gun": {
      const options: JsonObject = { type: "grpc" };
      if (present(serviceName)) options.service_name = serviceName;
      return options;
    }
    case "http":
    case "h2":
      return http(host, path);
    case "httpupgrade": {
      const options: JsonObject = { type: "httpupgrade" };
      if (present(host)) options.host = host;
      const cleanPath = path == null ? null : splitEarlyData(path)[0];
      if (cleanPath) options.path = cleanPath;
      return options;
    }
    case "quic":
      return { type: "quic" };
    case "xhttp":
    case "splithttp":
      throw new Skip("xhttp");
    case "kcp":
    case "mkcp":
      throw new Skip("mkcp");
    default:
      return unsupported(network!);
  }
}

export function http(hosts: Text, path: Text, method: Text = null): JsonObject {
  const options: JsonObject = { type: "http" };
  const names = list(hosts);
  if (names.length > 0) options.host = names;
  if (path) options.path = path;
  if (method != null) options.method = method;
  return options;
}

/** Ранние данные Xray приходят в пути: `/ws?ed=2048`. Ядру они нужны отдельно, с заголовком, как у Xray. */
export function websocket(host: Text, path: Text, maxEarlyData: number | null = null, earlyDataHeader: Text = null): JsonObject {
  const [cleanPath, earlyData] = splitEarlyData(path ?? "");
  const options: JsonObject = { type: "ws" };
  if (cleanPath !== "") options.path = cleanPath;
  if (present(host)) options.headers = { Host: host };
  const early = maxEarlyData !== null && maxEarlyData > 0 ? maxEarlyData : earlyData;
  if (early !== null && early > 0) {
    options.max_early_data = early;
    options.early_data_header_name = present(earlyDataHeader) ? earlyDataHeader : "Sec-WebSocket-Protocol";
  }
  return options;
}

function splitEarlyData(path: string): [string, number | null] {
  const query = after(path, "?", "");
  if (query === "") return [path, null];
  const params = query.split("&");
  const ed = params.find((param) => param.startsWith("ed="));
  const earlyData = ed === undefined ? null : toIntOrNull(ed.slice(3));
  if (earlyData === null) return [path, null];
  const rest = params.filter((param) => !param.startsWith("ed=")).join("&");
  return [before(path, "?") + (rest === "" ? "" : `?${rest}`), earlyData];
}

const SHADOWSOCKS_METHODS = new Set([
  "none", "aes-128-gcm", "aes-192-gcm", "aes-256-gcm", "chacha20-ietf-poly1305", "xchacha20-ietf-poly1305",
  "2022-blake3-aes-128-gcm", "2022-blake3-aes-256-gcm", "2022-blake3-chacha20-poly1305",
  "aes-128-ctr", "aes-192-ctr", "aes-256-ctr", "aes-128-cfb", "aes-192-cfb", "aes-256-cfb", "rc4-md5", "chacha20-ietf", "xchacha20",
]);

/** Шифр Shadowsocks, как его знает ядро. `chacha20-poly1305` — так его называют некоторые панели. */
export function shadowsocksMethod(method: Text): string {
  const value = method == null ? "" : trim(method).toLowerCase();
  if (value === "chacha20-poly1305") return "chacha20-ietf-poly1305";
  if (value === "xchacha20-poly1305") return "xchacha20-ietf-poly1305";
  if (SHADOWSOCKS_METHODS.has(value)) return value;
  if (value === "") broken();
  return unsupported(`Shadowsocks ${value}`);
}

export const VMESS_SECURITY = new Set(["auto", "none", "zero", "aes-128-cfb", "aes-128-gcm", "chacha20-poly1305"]);

/** Пир WireGuard; по умолчанию через него идёт всё. */
export function wireguardPeer(
  host: Text,
  port: number | null | undefined,
  publicKey: Text,
  preSharedKey: Text,
  allowedIps: string[] = ["0.0.0.0/0", "::/0"],
  keepalive: number | null = null,
  reserved: Json[] | null = null,
): JsonObject {
  const peer: JsonObject = {};
  peer.address = present(host) ? host : broken();
  peer.port = port != null && port >= 1 && port <= 65535 ? port : broken();
  peer.public_key = present(publicKey) ? publicKey : broken();
  if (present(preSharedKey)) peer.pre_shared_key = preSharedKey;
  peer.allowed_ips = allowedIps.map(prefix);
  if (keepalive !== null && keepalive > 0) peer.persistent_keepalive_interval = keepalive;
  if (reserved !== null) peer.reserved = reserved;
  return peer;
}

/** Адрес интерфейса WireGuard: без маски — один адрес. */
export function prefix(address: string): string {
  const value = trim(address);
  if (value.includes("/")) return value;
  return value.includes(":") ? `${value}/128` : `${value}/32`;
}

/** `reserved` WireGuard (Cloudflare WARP): `1,2,3` или base64 трёх байт. */
export function reserved(value: Text): number[] | null {
  const text = value == null ? "" : trim(value);
  if (text === "") return null;
  if (text.includes(",") || allDigits(text)) {
    return text.split(",").map((item) => {
      const byte = toIntOrNull(trim(item));
      return byte !== null && byte >= 0 && byte <= 255 ? byte : broken();
    });
  }
  const bytes = base64(text);
  return bytes ? [...bytes] : broken();
}

export const truthy = (value: Text): boolean => value != null && ["1", "true", "yes"].includes(trim(value).toLowerCase());
