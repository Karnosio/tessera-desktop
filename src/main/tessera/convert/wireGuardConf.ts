import { broken, Parsed, skippedBy, unsupported, type JsonObject } from "./conversion";
import { after, afterLast, before, beforeLast, equalsIgnoreCase, lines, toIntOrNull, trim, trimChars } from "./jvm";
import { list, prefix, wireguardPeer } from "./options";

// Файл `.conf` WireGuard → endpoint ядра. Поле `DNS` не переносим: DNS задаёт шаблон профиля

const NAME = "WireGuard";

// Ключи обфускации AmneziaWG. Ядро её не умеет, а без неё такой сервер не ответит
const AMNEZIA_KEYS = new Set(["jc", "jmin", "jmax", "s1", "s2", "s3", "s4", "h1", "h2", "h3", "h4", "i1", "i2", "i3", "i4", "i5"]);

export const matches = (text: string): boolean => lines(text).some((line) => equalsIgnoreCase(trim(line), "[Interface]"));

export function parse(text: string): Parsed {
  try {
    return new Parsed("wireguard", [{ name: NAME, options: endpoint(sections(text)), endpoint: true }], [], text);
  } catch (error) {
    return new Parsed("wireguard", [], [skippedBy(NAME, error)], text);
  }
}

type Section = [name: string, fields: Map<string, string>];

function endpoint(sections: Section[]): JsonObject {
  const face = sections.find(([name]) => name === "interface")?.[1] ?? broken();
  if ([...face.keys()].some((key) => AMNEZIA_KEYS.has(key))) unsupported("AmneziaWG");
  const options: JsonObject = { type: "wireguard" };
  const addresses = list(face.get("address")).map(prefix);
  options.address = addresses.length > 0 ? addresses : broken();
  options.private_key = face.get("privatekey") ?? broken();
  const mtu = face.get("mtu");
  const mtuValue = mtu == null ? null : toIntOrNull(mtu);
  if (mtuValue !== null) options.mtu = mtuValue;
  const peers = sections
    .filter(([name]) => name === "peer")
    .map(([, peer]) => {
      const address = peer.get("endpoint") ?? broken();
      const [host, port] = address.startsWith("[")
        ? [before(address.slice(1), "]"), after(address, "]:", "")]
        : [beforeLast(address, ":"), afterLast(address, ":", "")];
      const allowedIps = list(peer.get("allowedips"));
      const keepalive = peer.get("persistentkeepalive");
      return wireguardPeer(
        host,
        toIntOrNull(port),
        peer.get("publickey"),
        peer.get("presharedkey"),
        allowedIps.length > 0 ? allowedIps : undefined,
        keepalive == null ? null : toIntOrNull(keepalive),
      );
    });
  options.peers = peers.length > 0 ? peers : broken();
  return options;
}

/** INI: секции по порядку — пиров бывает несколько. Ключи без учёта регистра. */
function sections(text: string): Section[] {
  const result: Section[] = [];
  for (const raw of lines(text)) {
    const line = trim(before(raw, "#"));
    if (line === "") continue;
    if (line.startsWith("[")) {
      result.push([trim(trimChars(line, "[]")).toLowerCase(), new Map()]);
    } else if (line.includes("=")) {
      const key = trim(before(line, "=")).toLowerCase();
      const value = trim(after(line, "="));
      const section = result.at(-1)?.[1] ?? broken();
      // Address и AllowedIPs бывают и несколькими строками
      const previous = section.get(key);
      section.set(key, previous === undefined ? value : `${previous},${value}`);
    }
  }
  return result;
}
