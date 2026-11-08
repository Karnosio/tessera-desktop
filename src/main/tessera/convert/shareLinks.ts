import { broken, decodeBase64, Parsed, Skip, skippedBy, unsupported, type JsonObject, type Skipped, type Way } from "./conversion";
import { after, before, equalsIgnoreCase, lines, toIntOrNull, trim, trimChars } from "./jvm";
import {
  hysteriaPorts, list, server, shadowsocksMethod, tls, transport, truthy, VMESS_SECURITY, wireguardPeer, prefix, reserved,
  type Reality,
} from "./options";

/*
 * Ссылки `vless://`, `hysteria2://` и подобные — по одной в строке, как в подписках Xray-панелей.
 * Формат — де-факто стандарт v2rayN и Xray; поля, которые панели называют по-разному, принимаются во всех вариантах.
 * `\s` здесь — пробелы ASCII, как в регулярных выражениях Java.
 */
const LINK = /^[A-Za-z][A-Za-z0-9+.-]*:\/\/[^ \t\n\x0B\f\r]/;

// Пробел в названии бывает и не закодирован, поэтому строку режем только перед следующей схемой
const NEXT_LINK = /[ \t\n\x0B\f\r]+(?=[A-Za-z][A-Za-z0-9+.-]*:\/\/)/;

export function parse(text: string): Parsed | null {
  const links = lines(text)
    .flatMap((line) => trim(line).split(NEXT_LINK))
    .map(trim)
    .filter((link) => LINK.test(link));
  if (links.length === 0) return null;
  const ways: Way[] = [];
  const skipped: Skipped[] = [];
  for (const link of links) {
    const name = linkName(link);
    try {
      ways.push(way(link, name));
    } catch (error) {
      skipped.push(skippedBy(name, error));
    }
  }
  return new Parsed("links", ways, skipped, text);
}

function linkName(link: string): string {
  const fragment = trim(percentDecode(after(link, "#", "")));
  if (fragment !== "") return fragment;
  const scheme = before(link, "://").toLowerCase();
  if (scheme === "vmess") {
    const ps = vmessJson(link)?.string("ps");
    if (ps != null) return ps;
  }
  const parsed = Link.parse(link);
  return parsed.host !== "" ? `${parsed.host}:${parsed.ports}` : scheme;
}

function way(link: string, name: string): Way {
  const scheme = before(link, "://").toLowerCase();
  const options = (() => {
    switch (scheme) {
      case "vless":
        return vless(Link.parse(link));
      case "vmess": {
        const json = vmessJson(link);
        return json ? vmessV2rayN(json) : vmessXray(Link.parse(link));
      }
      case "trojan":
        return trojan(Link.parse(link));
      case "ss":
        return shadowsocks(Link.parse(expandLegacy(link)));
      case "hysteria2":
      case "hy2":
        return hysteria2(Link.parse(link));
      case "hysteria":
        return hysteria(Link.parse(link));
      case "tuic":
        return tuic(Link.parse(link));
      case "anytls":
        return anytls(Link.parse(link));
      case "naive+https":
      case "naive+quic":
        return naive(Link.parse(link), scheme === "naive+quic");
      // Старая запись naive у NekoBox и s-ui: http2://base64(логин:пароль@сервер:порт)
      case "http2":
        return naive(Link.parse(expandLegacy(link)), false);
      case "socks":
      case "socks5":
        return socks(Link.parse(link));
      case "wireguard":
      case "wg":
        return null;
      default:
        return unsupported(scheme);
    }
  })();
  return options ? { name, options, endpoint: false } : { name, options: wireguard(Link.parse(link)), endpoint: true };
}

function vless(link: Link): JsonObject {
  const encryption = link.query("encryption");
  if (encryption != null && encryption !== "none") throw new Skip("vless-encryption");
  const options: JsonObject = { type: "vless" };
  server(options, link.host, link.port);
  options.uuid = link.userInfo ?? broken();
  const flow = link.query("flow");
  if (flow != null) options.flow = vision(flow);
  xrayStream(options, link, "none");
  return options;
}

function trojan(link: Link): JsonObject {
  const options: JsonObject = { type: "trojan" };
  server(options, link.host, link.port);
  options.password = link.userInfo ?? broken();
  xrayStream(options, link, "tls");
  return options;
}

/** vmess в записи Xray: `vmess://uuid@сервер:порт?…`, шифр — в `encryption`. */
function vmessXray(link: Link): JsonObject {
  const options: JsonObject = { type: "vmess" };
  server(options, link.host, link.port);
  options.uuid = link.userInfo ?? broken();
  options.security = security(link.query("encryption"));
  xrayStream(options, link, "none");
  return options;
}

const security = (value: string | null): string => {
  const lowered = value?.toLowerCase();
  return lowered != null && VMESS_SECURITY.has(lowered) ? lowered : "auto";
};

/** vmess в записи v2rayN: base64 от JSON. REALITY эта запись выразить не умеет — у s-ui он так и теряется. */
function vmessV2rayN(json: VmessJson): JsonObject {
  const options: JsonObject = { type: "vmess" };
  const port = json.string("port");
  server(options, json.string("add"), port == null ? null : toIntOrNull(port));
  options.uuid = json.string("id") ?? broken();
  options.security = security(json.string("scy"));
  const aid = json.string("aid");
  const alterId = aid == null ? null : toIntOrNull(aid);
  if (alterId !== null && alterId > 0) options.alter_id = alterId;
  const host = json.string("host");
  const path = json.string("path");
  // У grpc имя сервиса лежит в path
  const stream = transport(json.string("net"), host, path, path, json.string("type"));
  if (stream) options.transport = stream;
  const insecure = truthy(json.string("allowInsecure")) || truthy(json.string("insecure"));
  const kind = json.string("tls")?.toLowerCase() ?? "none";
  if (kind === "tls") {
    options.tls = tls(json.string("sni") ?? (host == null ? null : before(host, ",")), {
      insecure,
      alpn: list(json.string("alpn")),
      fingerprint: json.string("fp"),
    });
  } else if (kind === "reality") {
    options.tls = realityTls(json.string("sni") ?? host, json.string("fp"), json.string("pbk"), json.string("sid"));
  } else if (kind !== "none") {
    unsupported(kind);
  }
  return options;
}

/** Транспорт и TLS у vless, trojan и vmess в записи Xray. */
function xrayStream(options: JsonObject, link: Link, defaultSecurity: string): void {
  const host = link.query("host");
  const stream = transport(link.query("type"), host, link.query("path"), link.query("serviceName"), link.query("headerType"));
  if (stream) options.transport = stream;
  const kind = (link.query("security") ?? defaultSecurity).toLowerCase();
  if (kind === "tls" || kind === "xtls") {
    options.tls = tls(link.query("sni") ?? (host == null ? null : before(host, ",")), {
      insecure: link.insecure,
      alpn: list(link.query("alpn")),
      fingerprint: link.query("fp"),
    });
  } else if (kind === "reality") {
    options.tls = realityTls(link.query("sni") ?? host, link.query("fp"), link.query("pbk"), link.query("sid"));
  } else if (kind !== "none") {
    unsupported(kind);
  }
}

function realityTls(serverName: string | null, fingerprint: string | null, publicKey: string | null, shortId: string | null): JsonObject {
  const reality: Reality = { publicKey: publicKey ?? broken(), shortId };
  return tls(serverName, { fingerprint, reality });
}

/** Ядро знает один flow; `-udp443` у Xray — тот же Vision, только пропускающий QUIC. */
const vision = (flow: string): string => (flow.startsWith("xtls-rprx-vision") ? "xtls-rprx-vision" : unsupported(flow));

function shadowsocks(link: Link): JsonObject {
  const options: JsonObject = { type: "shadowsocks" };
  server(options, link.host, link.port);
  // SIP002: base64url(шифр:пароль) или, для шифров 2022, шифр:пароль с процентным кодированием
  const userInfo = link.userInfo ?? broken();
  const decoded = userInfo.includes(":") ? userInfo : decodeBase64(userInfo);
  const credentials = decoded != null && decoded.includes(":") ? decoded : broken();
  options.method = shadowsocksMethod(before(credentials, ":"));
  options.password = after(credentials, ":");
  const plugin = link.query("plugin");
  if (plugin != null) {
    const name = trim(before(plugin, ";"));
    if (name === "obfs-local" || name === "simple-obfs") options.plugin = "obfs-local";
    else if (name === "v2ray-plugin") options.plugin = "v2ray-plugin";
    else unsupported(`Shadowsocks ${name}`);
    const pluginOptions = after(plugin, ";", "");
    if (pluginOptions !== "") options.plugin_opts = pluginOptions;
  }
  return options;
}

/** Пароль Hysteria2 — весь userinfo: при авторизации `логин:пароль` сервер ждёт именно эту строку. */
function hysteria2(link: Link): JsonObject {
  const options: JsonObject = { type: "hysteria2" };
  hysteriaPorts(options, link.host, link.ports, link.query("mport"));
  if (link.userInfo != null) options.password = link.userInfo;
  const up = link.int("upmbps");
  if (up !== null) options.up_mbps = up;
  const down = link.int("downmbps");
  if (down !== null) options.down_mbps = down;
  const obfs = link.query("obfs");
  if (obfs != null && obfs !== "none") {
    if (obfs !== "salamander" && obfs !== "gecko") unsupported(`Hysteria2 obfs ${obfs}`);
    const settings: JsonObject = { type: obfs };
    const password = link.query("obfs-password");
    if (password != null) settings.password = password;
    options.obfs = settings;
  }
  options.tls = tls(link.query("sni"), { insecure: link.insecure, alpn: list(link.query("alpn")) });
  return options;
}

function hysteria(link: Link): JsonObject {
  const protocol = link.query("protocol");
  if (protocol != null && protocol !== "udp") unsupported(`Hysteria ${protocol}`);
  const options: JsonObject = { type: "hysteria" };
  hysteriaPorts(options, link.host, link.ports, link.query("mport"));
  // Без скоростей ядро способ не запустит, а ссылки их часто не несут. Значения — как в примерах Hysteria
  options.up_mbps = link.int("upmbps") ?? 10;
  options.down_mbps = link.int("downmbps") ?? 50;
  const auth = link.query("auth");
  if (auth != null) options.auth_str = auth;
  const xplus = link.query("obfs");
  const obfs = link.query("obfsParam") ?? (xplus !== "xplus" ? xplus : null);
  if (obfs != null) options.obfs = obfs;
  options.tls = tls(link.query("peer") ?? link.query("sni"), { insecure: link.insecure, alpn: list(link.query("alpn")) });
  return options;
}

function tuic(link: Link): JsonObject {
  const options: JsonObject = { type: "tuic" };
  server(options, link.host, link.port);
  options.uuid = link.user ?? broken();
  if (link.password != null) options.password = link.password;
  const congestion = link.query("congestion_control")?.toLowerCase();
  if (congestion != null && ["cubic", "new_reno", "bbr"].includes(congestion)) options.congestion_control = congestion;
  const relay = link.query("udp_relay_mode")?.toLowerCase();
  if (relay != null && ["native", "quic"].includes(relay)) options.udp_relay_mode = relay;
  options.tls = tls(link.query("sni"), {
    insecure: link.insecure,
    alpn: list(link.query("alpn")),
    disableSni: truthy(link.query("disable_sni")),
  });
  return options;
}

function anytls(link: Link): JsonObject {
  const options: JsonObject = { type: "anytls" };
  server(options, link.host, link.port);
  options.password = link.userInfo ?? broken();
  options.tls = equalsIgnoreCase(link.query("security"), "reality")
    ? realityTls(link.query("sni"), link.query("fp"), link.query("pbk"), link.query("sid"))
    : tls(link.query("sni"), { insecure: link.insecure, alpn: list(link.query("alpn")), fingerprint: link.query("fp") });
  return options;
}

/** У naive ядро принимает из TLS только имя сервера: `insecure`, `alpn` и uTLS для него запрещены. */
function naive(link: Link, quic: boolean): JsonObject {
  const options: JsonObject = { type: "naive" };
  server(options, link.host, link.port);
  if (link.user != null) options.username = link.user;
  if (link.password != null) options.password = link.password;
  const concurrency = link.int("insecure-concurrency");
  if (concurrency !== null) options.insecure_concurrency = concurrency;
  if (quic) options.quic = true;
  const settings: JsonObject = { enabled: true };
  const serverName = link.query("peer") ?? link.query("sni");
  if (serverName != null) settings.server_name = serverName;
  options.tls = settings;
  return options;
}

/** `socks5://логин:пароль@…` или, у v2rayN, `socks://base64(логин:пароль)@…`. */
function socks(link: Link): JsonObject {
  const options: JsonObject = { type: "socks" };
  server(options, link.host, link.port);
  const userInfo = link.userInfo;
  if (userInfo != null) {
    const decoded = userInfo.includes(":") ? null : decodeBase64(userInfo);
    const credentials = userInfo.includes(":") ? userInfo : decoded != null && decoded.includes(":") ? decoded : userInfo;
    options.username = before(credentials, ":");
    const password = after(credentials, ":", "");
    if (password !== "") options.password = password;
  }
  return options;
}

/** `wireguard://закрытый-ключ@сервер:порт?publickey=…&address=…`, как у v2rayN и WARP. */
function wireguard(link: Link): JsonObject {
  const options: JsonObject = { type: "wireguard" };
  const addresses = (link.query("address") ?? link.query("ip") ?? broken()).split(",").map(trim).filter((address) => address !== "");
  options.address = addresses.map(prefix);
  options.private_key = link.userInfo ?? link.query("privatekey") ?? link.query("secretkey") ?? broken();
  const mtu = link.int("mtu");
  if (mtu !== null) options.mtu = mtu;
  options.peers = [
    wireguardPeer(
      link.host,
      link.port,
      link.query("publickey") ?? link.query("peer-public-key"),
      link.query("presharedkey") ?? link.query("pre-shared-key"),
      undefined,
      null,
      reserved(link.query("reserved")),
    ),
  ];
  return options;
}

/** `ss://base64(шифр:пароль@сервер:порт)` и `http2://base64(…)` — старая запись, где закодировано всё до `?` и `#`. */
function expandLegacy(link: string): string {
  const rest = after(link, "://");
  const body = before(before(rest, "#"), "?");
  if (body.includes("@")) return link;
  const decoded = decodeBase64(trimChars(body, "/", false));
  if (decoded == null || !decoded.includes("@")) broken();
  return `${before(link, "://")}://${decoded}${rest.slice(body.length)}`;
}

interface VmessJson {
  string(key: string): string | null;
}

function vmessJson(link: string): VmessJson | null {
  const body = before(before(after(link, "://"), "#"), "?");
  if (body.includes("@")) return null;
  const text = decodeBase64(body);
  const fields = text == null ? null : readJsonObject(text);
  if (fields == null) return null;
  return {
    string(key) {
      const value = fields.get(key);
      const content = value == null ? null : trim(value);
      return content ? content : null;
    },
  };
}

const ESCAPES: Record<string, string> = { b: "\b", t: "\t", n: "\n", f: "\f", r: "\r", "/": "/", '"': '"', "\\": "\\" };

/**
 * JSON, как его читает kotlinx.serialization: значения без кавычек берутся как написаны (`0443`, `+443`, `xyz`),
 * управляющие символы внутри строк допустимы. Для полей объекта — содержимое примитива (у `null` это `"null"`)
 * или null, если там объект или массив.
 */
function readJsonObject(text: string): Map<string, string | null> | null {
  let i = 0;
  const fail = (): never => {
    throw new SyntaxError(`JSON: ${i}`);
  };
  const skipSpaces = () => {
    while (i < text.length && " \t\n\r".includes(text[i])) i++;
  };
  // Символ значения без кавычек: не служебный, не управляющий
  const literal = (index: number) => {
    const code = text.charCodeAt(index);
    return index < text.length && (code >= 0x7e || (code > 0x20 && !',:{}[]"\\'.includes(text[index])));
  };
  const peek = () => {
    skipSpaces();
    return text[i];
  };
  const expect = (char: string) => {
    if (peek() !== char) fail();
    i++;
  };
  const string = (): string => {
    expect('"');
    let out = "";
    let start = i;
    for (;;) {
      if (i >= text.length) fail();
      const char = text[i];
      if (char === '"') {
        out += text.slice(start, i++);
        return out;
      }
      if (char === "\\") {
        out += text.slice(start, i);
        const escape = text[i + 1];
        if (escape === "u") {
          const hex = text.slice(i + 2, i + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail();
          out += String.fromCharCode(parseInt(hex, 16));
          i += 6;
        } else {
          out += ESCAPES[escape] ?? fail();
          i += 2;
        }
        start = i;
      } else {
        i++;
      }
    }
  };
  const canConsumeValue = () => {
    const char = peek();
    return char !== undefined && !"}]:,".includes(char);
  };
  const value = (): string | null => {
    const char = peek();
    if (char === '"') return string();
    if (char === "{") {
      object();
      return null;
    }
    if (char === "[") {
      array();
      return null;
    }
    if (!literal(i)) fail();
    const start = i;
    while (literal(i)) i++;
    return text.slice(start, i);
  };
  const object = (): Map<string, string | null> => {
    expect("{");
    if (peek() === ",") fail();
    const fields = new Map<string, string | null>();
    let last = "{";
    while (canConsumeValue()) {
      const key = string();
      expect(":");
      fields.set(key, value());
      last = peek();
      i++;
      if (last === "}") return fields;
      if (last !== ",") fail();
    }
    if (last === ",") fail();
    expect("}");
    return fields;
  };
  // Как у kotlinx: после `]` массив читается дальше, если следом снова значение
  const array = (): void => {
    expect("[");
    if (peek() === ",") fail();
    let last = "[";
    while (canConsumeValue()) {
      value();
      last = peek();
      i++;
      if (last !== "," && last !== "]") fail();
    }
    if (last === "[") expect("]");
    else if (last === ",") fail();
  };
  try {
    const char = peek();
    const root = char === "{" ? object() : (value(), null);
    if (peek() !== undefined) fail();
    return root;
  } catch {
    return null;
  }
}

/**
 * Ссылка, разобранная без `URL`: тот отказывается от того, что панели выдают постоянно, —
 * base64 со слэшами в userinfo, нескольких портов через запятую, незакодированных пробелов в названии.
 */
class Link {
  constructor(
    /** Всё до `@`, раскодированное: у vless это uuid, у trojan — пароль целиком, даже с двоеточием. */
    readonly userInfo: string | null,
    readonly host: string,
    /** Порт как написан: у Hysteria это бывает список `443,5000-6000`. */
    readonly ports: string,
    private readonly params: Map<string, string>,
  ) {}

  get port(): number | null {
    return toIntOrNull(this.ports);
  }

  /** Для протоколов с логином и паролем: `логин:пароль`. */
  get user(): string | null {
    return this.userInfo == null ? null : before(this.userInfo, ":");
  }

  get password(): string | null {
    return this.userInfo != null && this.userInfo.includes(":") ? after(this.userInfo, ":") : null;
  }

  /** Имена параметров панели пишут по-разному (`allowInsecure`, `allow_insecure`), поэтому без учёта регистра. */
  query(name: string): string | null {
    const value = this.params.get(name.toLowerCase());
    return value != null && trim(value) !== "" ? value : null;
  }

  int(name: string): number | null {
    const value = this.query(name);
    return value == null ? null : toIntOrNull(value);
  }

  get insecure(): boolean {
    return ["allowInsecure", "allow_insecure", "insecure", "skip-cert-verify"].some((name) => truthy(this.query(name)));
  }

  static parse(link: string): Link {
    const rest = before(after(link, "://"), "#");
    const params = new Map<string, string>();
    for (const param of after(rest, "?", "").split("&")) {
      if (param !== "") params.set(percentDecode(before(param, "=")).toLowerCase(), trim(percentDecode(after(param, "=", ""))));
    }
    const main = before(rest, "?");
    const at = main.lastIndexOf("@");
    const userInfo = at >= 0 ? percentDecode(main.slice(0, at)) : null;
    const address = before(main.slice(at + 1), "/");
    const [host, ports] = address.startsWith("[")
      ? [before(address.slice(1), "]"), after(address, "]:", "")]
      : [before(address, ":"), after(address, ":", "")];
    return new Link(userInfo ? userInfo : null, host, ports === "" ? "443" : ports, params);
  }
}

/** Процентное кодирование без `decodeURIComponent`: тот падает на одиночном `%`, а он в паролях бывает. */
function percentDecode(value: string): string {
  if (!value.includes("%")) return value;
  const out: number[] = [];
  let i = 0;
  while (i < value.length) {
    const hex = value[i] === "%" && i + 2 < value.length ? toIntOrNull(value.substring(i + 1, i + 3), 16) : null;
    if (hex !== null) {
      out.push(hex & 0xff);
      i += 3;
    } else {
      const char = String.fromCodePoint(value.codePointAt(i)!);
      if (/^\p{Cs}$/u.test(char)) out.push(0x3f);
      else out.push(...Buffer.from(char, "utf8"));
      i += char.length;
    }
  }
  // Закодированную половину суррогатной пары Java заменяет одним U+FFFD, Node — тремя
  for (let j = 0; j + 2 < out.length; j++) {
    if (out[j] === 0xed && out[j + 1] >= 0xa0 && out[j + 1] <= 0xbf && out[j + 2] >= 0x80 && out[j + 2] <= 0xbf) out.splice(j, 3, 0xef, 0xbf, 0xbd);
  }
  return Buffer.from(out).toString("utf8");
}
