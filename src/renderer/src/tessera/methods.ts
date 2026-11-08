import { proxyDisplayType } from "@dashboard/api/format";
import type { Method } from "@shared/tessera/methods";

const UDP_TYPES = new Set(["hysteria", "hysteria2", "tuic", "wireguard"]);
const TCP_TYPES = new Set(["vless", "vmess", "trojan", "anytls", "shadowsocks", "shadowtls", "http", "socks", "ssh", "tor"]);

// UDP или TCP: когда сеть режет UDP, все UDP-способы отваливаются вместе. Ядро сообщает только протокол,
// поэтому VLESS, VMess и Trojan поверх QUIC тоже будут TCP.
function network(method: Method): string | null {
  if (UDP_TYPES.has(method.type)) {
    return "UDP";
  }
  return TCP_TYPES.has(method.type) ? "TCP" : null;
}

/** Протокол — если его не видно по названию, и UDP или TCP. */
export function methodDetail(method: Method): string | undefined {
  const display = proxyDisplayType(method.type);
  const type = display === "" || method.tag.toLowerCase().includes(display.toLowerCase()) ? null : display;
  const parts = [type, network(method)].filter((part) => part !== null);
  return parts.length === 0 ? undefined : parts.join(" · ");
}
