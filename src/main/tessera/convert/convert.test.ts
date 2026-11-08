import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { accessSync, constants, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import type { JsonObject, Parsed, Way } from "./conversion";
import { parse as convert } from "./index";

// Те же случаи, что ConverterTest.kt на Android, под теми же именами

const UUID = "294ed298-1255-4f4d-8893-276feb8714d3";
const PBK = "yxvJNws8MSDiH0HhLB89dNK_gzpxUNf4RPP0fQPkymo";
const WG_PRIVATE = "rJzWcweIqBIPq7WGm6OmGm1IsBS5BrwNlMxUSAkcyyI=";
const WG_PUBLIC = "0gh5AmRjRtuZvmj9pzhHX9qdv9vYJ8nGU2I479zoRFE=";
const WG_PSK = "jQ03iC6uj3YMh039MVpJRGLHtgYoziCiinwTVYXIi1Q=";
const SS_KEY = "5MAXI0NfatrAs4o45KLjHw==";
const SS_SIP002 = "Y2hhY2hhMjAtaWV0Zi1wb2x5MTMwNTpzM2NyZXQ";
const SS_LEGACY = "YWVzLTI1Ni1nY206cGFzc0AxOTguNTEuMTAwLjc6ODM4OA==";
const HTTP2_NAIVE = "YWxpY2U6cDRzc0BuYWl2ZS5leGFtcGxlLmNvbTo0NDM=";

const b64 = (text: string) => Buffer.from(text).toString("base64");

/** `trimIndent()` Kotlin: общий отступ долой, пустые первая и последняя строки тоже. */
function trimIndent(text: string): string {
  const lines = text.split(/\r\n|\n|\r/);
  const indents = lines.filter((line) => line.trim() !== "").map((line) => line.length - line.trimStart().length);
  const indent = indents.length > 0 ? Math.min(...indents) : 0;
  return lines
    .filter((line, i) => !((i === 0 || i === lines.length - 1) && line.trim() === ""))
    .map((line) => line.slice(indent))
    .join("\n");
}

function parse(text: string): Parsed {
  const parsed = convert(trimIndent(text));
  assert.ok(parsed);
  return parsed;
}

function single(link: string): Way {
  const parsed = parse(link);
  assert.deepEqual(parsed.skipped, []);
  assert.equal(parsed.ways.length, 1);
  return parsed.ways[0];
}

const options = (parsed: Parsed) => parsed.ways.map((way) => way.options);

const ALL_LINKS = `
  vless://${UUID}@vl.example.com:443?type=tcp&security=reality&pbk=${PBK}&sid=6ba85179e30d4fc2&sni=www.example.org&fp=chrome&flow=xtls-rprx-vision#vless-reality
  vless://${UUID}@vl.example.com:443?type=ws&security=tls&host=cdn.example.com&path=%2Fws%3Fed%3D2048#vless-ws
  vless://${UUID}@vl.example.com:443?type=httpupgrade&security=tls&host=cdn.example.com&path=%2Fup#vless-httpupgrade
  vless://${UUID}@vl.example.com:443?type=http&security=tls&host=a.example.com,b.example.com&path=%2Fh2#vless-h2
  vless://${UUID}@vl.example.com:80?type=tcp&headerType=http&host=a.example.com&path=%2F#vless-tcp-http
  vmess://${b64(`{"v":"2","ps":"vmess-grpc","add":"vm.example.com","port":"443","id":"${UUID}","aid":"0","net":"grpc","path":"tun","tls":"tls","sni":"vm.example.com"}`)}
  trojan://pw@tr.example.com:443?type=grpc&serviceName=tun&sni=tr.example.com#trojan-grpc
  ss://${SS_SIP002}@198.51.100.7:8388#ss
  ss://2022-blake3-aes-128-gcm:${SS_KEY.replaceAll("=", "%3D")}@198.51.100.7:8389#ss-2022
  ss://${SS_SIP002}@198.51.100.7:8390/?plugin=v2ray-plugin%3Btls%3Bhost%3Dexample.com#ss-v2ray-plugin
  hysteria2://pw@hy.example.com:443,20000-30000/?sni=hy.example.com&obfs=salamander&obfs-password=x#hy2
  hysteria://hy1.example.com:443?protocol=udp&auth=pw&peer=hy1.example.com&upmbps=10&downmbps=50&obfsParam=x#hy1
  tuic://${UUID}:pw@tu.example.com:443?congestion_control=bbr&alpn=h3&sni=tu.example.com#tuic
  anytls://pw@any.example.com:20443?security=reality&pbk=${PBK}&sid=0a1b2c&fp=chrome&sni=www.example.org#anytls
  naive+https://alice:p4ss@naive.example.com:443?peer=naive.example.com#naive
  naive+quic://alice:p4ss@naive.example.com:443#naive-quic
  socks5://u:p@198.51.100.9:1080#socks
  wireguard://${WG_PRIVATE.replaceAll("+", "%2B")}@162.159.192.1:2408?publickey=${WG_PUBLIC.replaceAll("+", "%2B")}&address=172.16.0.2/32&reserved=1,2,3#warp
`;

const CLASH = `
  proxies:
    - {name: ss, type: ss, server: 198.51.100.7, port: 8388, cipher: aes-128-gcm, password: pw, plugin: obfs, plugin-opts: {mode: tls, host: bing.com}}
    - {name: vless, type: vless, server: vl.example.com, port: 443, uuid: ${UUID}, tls: true, servername: www.example.org, client-fingerprint: chrome, reality-opts: {public-key: ${PBK}, short-id: 6ba85179}}
    - {name: vmess, type: vmess, server: vm.example.com, port: 443, uuid: ${UUID}, alterId: 0, cipher: auto, tls: true, network: ws, ws-opts: {path: /vm, headers: {Host: cdn.example.com}}}
    - {name: trojan, type: trojan, server: tr.example.com, port: 443, password: pw, network: grpc, grpc-opts: {grpc-service-name: tun}, smux: {enabled: true, protocol: h2mux}}
    - {name: hy2, type: hysteria2, server: hy.example.com, port: 443, ports: 20000-30000, password: pw, up: "30 Mbps", down: 100}
    - {name: tuic, type: tuic, server: tu.example.com, port: 443, uuid: ${UUID}, password: pw, alpn: [h3], congestion-controller: bbr, reduce-rtt: true}
    - {name: anytls, type: anytls, server: any.example.com, port: 443, password: pw, client-fingerprint: chrome}
    - {name: wg, type: wireguard, server: 162.159.192.1, port: 2408, ip: 172.16.0.2, ipv6: 2606:4700::1, private-key: ${WG_PRIVATE}, public-key: ${WG_PUBLIC}, reserved: [1, 2, 3]}
    - {name: http, type: http, server: 198.51.100.9, port: 8080, username: u, password: p, tls: true}
`;

test("vlessReality", () => {
  const way = single(
    `vless://${UUID}@vl.example.com:443?type=tcp&security=reality&pbk=${PBK}&sid=6ba85179e30d4fc2&sni=www.example.org&fp=firefox&flow=xtls-rprx-vision-udp443#VLESS%20%C2%B7%20REALITY`,
  );
  assert.equal(way.name, "VLESS · REALITY");
  assert.deepEqual(way.options, {
    type: "vless",
    server: "vl.example.com",
    server_port: 443,
    uuid: UUID,
    flow: "xtls-rprx-vision",
    tls: {
      enabled: true,
      server_name: "www.example.org",
      utls: { enabled: true, fingerprint: "firefox" },
      reality: { enabled: true, public_key: PBK, short_id: "6ba85179e30d4fc2" },
    },
  });
});

test("xrayOnlyWaysAreSkippedWithReason", () => {
  const parsed = parse(`
    vless://${UUID}@a.example.com:443?type=xhttp&security=reality&pbk=${PBK}#xhttp
    vless://${UUID}@a.example.com:443?type=kcp#kcp
    vless://${UUID}@a.example.com:443?encryption=mlkem768x25519plus.native.0rtt.abc#enc
    ssr://abc#ssr
    trojan://pass@a.example.com:443#ok
  `);
  assert.deepEqual(
    parsed.ways.map((way) => way.name),
    ["ok"],
  );
  assert.deepEqual(parsed.skipped, [
    { name: "xhttp", reason: "xhttp" },
    { name: "kcp", reason: "mkcp" },
    { name: "enc", reason: "vless-encryption" },
    { name: "ssr", reason: "unsupported", protocol: "ssr" },
  ]);
});

test("vmessV2rayNWithWebSocketEarlyData", () => {
  const vmess = `{"v":"2","ps":"VMess WS","add":"vm.example.com","port":"443","id":"${UUID}","aid":"0","scy":"auto","net":"ws",
    "type":"none","host":"cdn.example.com","path":"/vm?ed=2048","tls":"tls","sni":"","alpn":"h2,http/1.1","fp":"chrome"}`;
  const way = single(`vmess://${b64(vmess)}`);
  assert.equal(way.name, "VMess WS");
  assert.deepEqual(way.options, {
    type: "vmess",
    server: "vm.example.com",
    server_port: 443,
    uuid: UUID,
    security: "auto",
    transport: { type: "ws", path: "/vm", headers: { Host: "cdn.example.com" }, max_early_data: 2048, early_data_header_name: "Sec-WebSocket-Protocol" },
    tls: { enabled: true, server_name: "cdn.example.com", alpn: ["h2", "http/1.1"], utls: { enabled: true, fingerprint: "chrome" } },
  });
});

test("trojanGrpcIsTlsByDefault", () => {
  const way = single("trojan://p%40ss:word@tr.example.com:8443?type=grpc&serviceName=tun&sni=tr.example.com&allowInsecure=1#Trojan");
  assert.deepEqual(way.options, {
    type: "trojan",
    server: "tr.example.com",
    server_port: 8443,
    password: "p@ss:word",
    transport: { type: "grpc", service_name: "tun" },
    tls: { enabled: true, server_name: "tr.example.com", insecure: true },
  });
});

test("shadowsocksForms", () => {
  const parsed = parse(`
    ss://${SS_SIP002}@198.51.100.7:8388#sip002
    ss://2022-blake3-aes-128-gcm:${SS_KEY.replaceAll("=", "%3D").replaceAll("+", "%2B")}@198.51.100.7:8389#ss2022
    ss://${SS_LEGACY}#legacy
    ss://${SS_SIP002}@198.51.100.7:8390/?plugin=obfs-local%3Bobfs%3Dhttp%3Bobfs-host%3Dexample.com#obfs
  `);
  assert.deepEqual(parsed.skipped, []);
  const [sip002, ss2022, legacy, obfs] = options(parsed);
  assert.deepEqual(sip002, { type: "shadowsocks", server: "198.51.100.7", server_port: 8388, method: "chacha20-ietf-poly1305", password: "s3cret" });
  assert.equal(ss2022.password, SS_KEY);
  assert.deepEqual(legacy, { type: "shadowsocks", server: "198.51.100.7", server_port: 8388, method: "aes-256-gcm", password: "pass" });
  assert.equal(obfs.plugin, "obfs-local");
  assert.equal(obfs.plugin_opts, "obfs=http;obfs-host=example.com");
});

test("hysteria2PortHopping", () => {
  const way = single("hysteria2://user:pa%20ss@hy.example.com:443,20000-30000/?sni=hy.example.com&obfs=salamander&obfs-password=x&insecure=1#Hy2");
  assert.deepEqual(way.options, {
    type: "hysteria2",
    server: "hy.example.com",
    server_ports: ["443:443", "20000:30000"],
    password: "user:pa ss",
    obfs: { type: "salamander", password: "x" },
    tls: { enabled: true, server_name: "hy.example.com", insecure: true },
  });
  // s-ui пишет диапазон в mport и уже через двоеточие
  const sui = single("hysteria2://pw@hy.example.com:443?security=tls&fastopen=0&mport=20000:30000#hy");
  assert.deepEqual(sui.options.server_ports, ["443:443", "20000:30000"]);
});

test("tuicAndAnyTls", () => {
  const tuic = single(`tuic://${UUID}:secret@tu.example.com:443?congestion_control=bbr&udp_relay_mode=native&alpn=h3&sni=tu.example.com&security=tls&insecure=1#TUIC`);
  assert.deepEqual(tuic.options, {
    type: "tuic",
    server: "tu.example.com",
    server_port: 443,
    uuid: UUID,
    password: "secret",
    congestion_control: "bbr",
    udp_relay_mode: "native",
    tls: { enabled: true, server_name: "tu.example.com", insecure: true, alpn: ["h3"] },
  });
  // Как отдаёт s-ui: REALITY в параметрах anytls
  const anytls = single(`anytls://pw@any.example.com:20443?security=reality&pbk=${PBK}&sid=0a1b2c&fp=chrome&sni=www.example.org#anytls-20443`);
  assert.deepEqual(anytls.options, {
    type: "anytls",
    server: "any.example.com",
    server_port: 20443,
    password: "pw",
    tls: {
      enabled: true,
      server_name: "www.example.org",
      utls: { enabled: true, fingerprint: "chrome" },
      reality: { enabled: true, public_key: PBK, short_id: "0a1b2c" },
    },
  });
});

test("naiveFormsOfOneServerCollapse", () => {
  const parsed = parse(`
    http2://${HTTP2_NAIVE}?padding=1&peer=naive.example.com&tfo=0#naive
    naive+https://alice:p4ss@naive.example.com:443?padding=1&peer=naive.example.com&tfo=0#naive
    naive+quic://alice:p4ss@naive.example.com:443?padding=1&peer=naive.example.com&tfo=0#naive
  `);
  assert.equal(parsed.count, 2);
  assert.deepEqual(parsed.ways[0].options, {
    type: "naive",
    server: "naive.example.com",
    server_port: 443,
    username: "alice",
    password: "p4ss",
    tls: { enabled: true, server_name: "naive.example.com" },
  });
  assert.equal(parsed.ways[1].options.quic, true);
});

test("wireguardLink", () => {
  const way = single(
    `wireguard://${WG_PRIVATE.replaceAll("+", "%2B").replaceAll("/", "%2F")}@162.159.192.1:2408?publickey=${WG_PUBLIC.replaceAll("+", "%2B")}&address=172.16.0.2,2606:4700::1&reserved=1,2,3&mtu=1280#WARP`,
  );
  assert.equal(way.endpoint, true);
  assert.deepEqual(way.options, {
    type: "wireguard",
    address: ["172.16.0.2/32", "2606:4700::1/128"],
    private_key: WG_PRIVATE,
    mtu: 1280,
    peers: [{ address: "162.159.192.1", port: 2408, public_key: WG_PUBLIC, allowed_ips: ["0.0.0.0/0", "::/0"], reserved: [1, 2, 3] }],
  });
});

test("base64Subscription", () => {
  const parsed = parse(b64(`trojan://a@x.example.com:443#one\r\nvless://${UUID}@y.example.com:443?security=tls#two\r\n`));
  assert.equal(parsed.format, "links");
  assert.deepEqual(
    parsed.ways.map((way) => way.name),
    ["one", "two"],
  );
});

test("clash", () => {
  const parsed = parse(`
    mixed-port: 7890
    proxies:
      - {name: "ss", type: ss, server: 198.51.100.7, port: 8388, cipher: aes-128-gcm, password: pw, plugin: obfs, plugin-opts: {mode: tls, host: bing.com}}
      - name: reality
        type: vless
        server: vl.example.com
        port: 443
        uuid: ${UUID}
        network: tcp
        tls: true
        servername: www.example.org
        flow: xtls-rprx-vision
        client-fingerprint: chrome
        reality-opts:
          public-key: ${PBK}
          short-id: 6ba85179
      - {name: ws, type: vmess, server: vm.example.com, port: 443, uuid: ${UUID}, alterId: 0, cipher: auto, tls: true, network: ws, ws-opts: {path: /vm, headers: {Host: cdn.example.com}}}
      - {name: hy2, type: hysteria2, server: hy.example.com, port: 443, ports: 20000-30000, password: pw, up: "30 Mbps", down: 100, sni: hy.example.com}
      - {name: wg, type: wireguard, server: 162.159.192.1, port: 2408, ip: 172.16.0.2, private-key: ${WG_PRIVATE}, public-key: ${WG_PUBLIC}, reserved: [1, 2, 3], udp: true}
      - {name: xhttp, type: vless, server: a.example.com, port: 443, uuid: ${UUID}, network: xhttp, tls: true}
      - {name: snell, type: snell, server: a.example.com, port: 443, psk: x}
    proxy-groups:
      - {name: PROXY, type: select, proxies: [ss, reality]}
  `);
  assert.equal(parsed.format, "clash");
  assert.deepEqual(
    parsed.ways.map((way) => way.name),
    ["ss", "reality", "ws", "hy2", "wg"],
  );
  assert.deepEqual(parsed.skipped, [
    { name: "xhttp", reason: "xhttp" },
    { name: "snell", reason: "unsupported", protocol: "snell" },
  ]);
  const [ss, reality, ws, hy2, wg] = options(parsed);
  assert.equal(ss.plugin_opts, "obfs=tls;obfs-host=bing.com");
  assert.deepEqual(reality.tls, {
    enabled: true,
    server_name: "www.example.org",
    utls: { enabled: true, fingerprint: "chrome" },
    reality: { enabled: true, public_key: PBK, short_id: "6ba85179" },
  });
  assert.deepEqual(ws.transport, { type: "ws", path: "/vm", headers: { Host: "cdn.example.com" } });
  assert.equal(hy2.up_mbps, 30);
  assert.deepEqual(hy2.server_ports, ["20000:30000"]);
  assert.deepEqual((wg.peers as JsonObject[])[0].reserved, [1, 2, 3]);
});

test("wireguardConf", () => {
  const parsed = parse(`
    [Interface]
    PrivateKey = ${WG_PRIVATE}
    Address = 10.8.0.2/24, fd00::2/64
    DNS = 1.1.1.1
    MTU = 1420

    [Peer]
    PublicKey = ${WG_PUBLIC}
    PresharedKey = ${WG_PSK}
    AllowedIPs = 0.0.0.0/0, ::/0
    Endpoint = vpn.example.com:51820
    PersistentKeepalive = 25
  `);
  assert.equal(parsed.format, "wireguard");
  assert.equal(parsed.ways.length, 1);
  assert.deepEqual(parsed.ways[0].options, {
    type: "wireguard",
    address: ["10.8.0.2/24", "fd00::2/64"],
    private_key: WG_PRIVATE,
    mtu: 1420,
    peers: [
      {
        address: "vpn.example.com",
        port: 51820,
        public_key: WG_PUBLIC,
        pre_shared_key: WG_PSK,
        allowed_ips: ["0.0.0.0/0", "::/0"],
        persistent_keepalive_interval: 25,
      },
    ],
  });
});

test("amneziaIsNamed", () => {
  const parsed = parse(`[Interface]\nPrivateKey = ${WG_PRIVATE}\nAddress = 10.8.0.2/32\nJc = 4\nH1 = 1\n[Peer]\nPublicKey = ${WG_PUBLIC}\nEndpoint = 1.2.3.4:51820\n`);
  assert.deepEqual(parsed.skipped, [{ name: "WireGuard", reason: "unsupported", protocol: "AmneziaWG" }]);
});

test("notAProfile", () => {
  assert.equal(convert("привет, вот ваш доступ"), null);
  assert.equal(convert("hello"), null);
});

test("tagsAreUniqueAndGroupsComeFirst", () => {
  const config = JSON.parse(parse("trojan://a@x.example.com:443#auto\ntrojan://b@x.example.com:443#auto").config());
  const outbounds = config.outbounds as JsonObject[];
  assert.deepEqual(
    outbounds.map((outbound) => outbound.tag),
    ["proxy", "auto", "auto 2", "auto 3", "direct"],
  );
  assert.deepEqual(outbounds[0].outbounds, ["auto", "auto 2", "auto 3"]);
  assert.deepEqual(outbounds[1].outbounds, ["auto 2", "auto 3"]);
});

// Ниже — то, в чём JS по умолчанию разошёлся бы с Android; ожидания сверены с Kotlin

test("clashScalarsAsOnAndroid", () => {
  const ss = (value: string) => `proxies:\n  - {name: a, type: ss, server: 1.2.3.4, port: 443, cipher: aes-128-gcm, password: ${value}}`;
  const password = (value: string) => convert(ss(value))?.ways[0]?.options.password;
  // Схема JSON SnakeYAML: не число — строка как написана
  assert.equal(password("0123"), "0123");
  assert.equal(password("True"), "True");
  assert.equal(password("~"), "~");
  assert.equal(password("0x1F"), "0x1F");
  // Числа — через toString() Java
  assert.equal(password("1e3"), "1000.0");
  assert.equal(password("1.50"), "1.5");
  assert.equal(password("123456789012345678901234567890"), "123456789012345678901234567890");
  assert.equal(password("'0123'"), "0123");
  assert.equal(password("[a, b]"), "[a, b]");
  assert.equal(password("{a: 1, b: [x, ~]}"), "{a=1, b=[x, ~]}");

  const trojan = (port: string) => convert(`proxies:\n  - {name: t, type: trojan, server: h.example.com, password: pw, port: ${port}}`);
  assert.equal(trojan('"443"')?.ways[0].options.server_port, 443);
  assert.equal(trojan("443.9")?.ways[0].options.server_port, 443);
  assert.equal(trojan("4294967739")?.ways[0].options.server_port, 443);
  assert.equal(trojan("0443")?.ways[0].options.server_port, 443);
  assert.deepEqual(trojan("0x1BB")?.skipped, [{ name: "t", reason: "broken" }]);

  // Документ, который SnakeYAML не читает целиком
  assert.equal(convert(ss("${HOME}")), null);
  assert.equal(convert(ss("x, port: 444")), null);
  assert.equal(convert(ss("x\x01")), null);
  assert.equal(convert(ss("!!binary aGk=")), null);
});

test("vmessJsonAsKotlinx", () => {
  // kotlinx берёт значения без кавычек как написаны, null — строкой "null"
  const way = single(`vmess://${b64('{"add":"a.example.com","port":0443,"id":abc,"ps":null}')}`);
  assert.equal(way.name, "null");
  assert.equal(way.options.server_port, 443);
  assert.equal(way.options.uuid, "abc");
  const comma = parse(`vmess://${b64('{"add":"a.example.com","port":443,"id":"x",}')}`);
  assert.equal(comma.count, 0);
});

test("sourceIsTrimmedAndDecoded", () => {
  const links = "trojan://a@x.example.com:443#one";
  assert.equal(convert(`\n  \uFEFF${links}\n`)?.source, links);
  assert.equal(convert(b64(links))?.source, links);
});

/** Собранный конфиг принимает ядро: нужен CLI sing-box, `SING_BOX=путь pnpm test`; рядом с ним — libcronet.so для naive. */
function executable(path: string | undefined): path is string {
  if (!path) return false;
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

const singBox = process.env.SING_BOX;

test("coreAcceptsConfigs", { skip: executable(singBox) ? false : "SING_BOX не задан" }, () => {
  const core = singBox!;
  const inputs = {
    links: ALL_LINKS,
    clash: CLASH,
    wireguard: `[Interface]\nPrivateKey = ${WG_PRIVATE}\nAddress = 10.8.0.2/32\n[Peer]\nPublicKey = ${WG_PUBLIC}\nEndpoint = [2001:db8::1]:51820\n`,
  };
  const directory = mkdtempSync(join(tmpdir(), "slate-convert-"));
  try {
    for (const [name, text] of Object.entries(inputs)) {
      const parsed = parse(text);
      assert.deepEqual(parsed.skipped, [], name);
      const file = join(directory, `${name}.json`);
      writeFileSync(file, parsed.config());
      const result = spawnSync(core, ["check", "-c", file], { env: { ...process.env, LD_LIBRARY_PATH: dirname(core) }, encoding: "utf8" });
      assert.equal(result.status, 0, `${name}: ${result.stdout}${result.stderr}`);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
