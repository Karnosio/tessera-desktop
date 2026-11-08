import type { Group, GroupItem } from "../gen/daemon/started_service_pb";

// Как Methods.kt на Android: способы — из групп ядра, конфиг не читается (принцип №1).
// Выбирают в первом селекторе верхнего уровня, первая группа urltest в нём — «Авто».
// Вложенные селекторы — серверы: их способы идут отдельными разделами.

export interface Method {
  tag: string;
  type: string;
  /** Селектор, в котором способ выбирается; null — выбрать нельзя. */
  group: string | null;
  selected: boolean;
  /** Когда ядро последний раз удачно проверило пинг, секунды Unix; 0 — результата нет. */
  testedAt: number;
  delayMs: number;
}

export interface Auto {
  /** Группа urltest; null — Авто ведёт приложение. */
  tag: string | null;
  selected: boolean;
  /** Способ, который Авто взяло сейчас. */
  now: string | null;
  testedAt: number;
  delayMs: number;
}

/** `server` — название вложенного селектора; null — способы самого селектора. */
export interface MethodSection {
  server: string | null;
  methods: Method[];
}

export interface Methods {
  /** Селектор, в котором выбирают; null — выбора в профиле нет, есть только Авто. */
  selector: string | null;
  auto: Auto | null;
  sections: MethodSection[];
  /** Способ, через который идёт трафик: выбранный вручную или тот, что взяло Авто. */
  current: string | null;
}

const URLTEST = "urltest";
const DIRECT = "direct";

const GROUP_TYPES = new Set([URLTEST, "selector"]);

export function allMethods(methods: Methods): Method[] {
  return methods.sections.flatMap((section) => section.methods);
}

export function isDirect(method: Method): boolean {
  return method.type === DIRECT;
}

/** Сколько способов подключения: `direct` в селекторе — выбор «без сервера», а не способ. */
export function methodCount(methods: Methods): number {
  return allMethods(methods).filter((method) => !isDirect(method)).length;
}

/** Из чего выбирает Авто приложения: способы, которые можно выбрать, без `direct` и без групп. */
export function candidates(methods: Methods): Method[] {
  return allMethods(methods).filter((method) => method.group !== null && !isDirect(method) && !GROUP_TYPES.has(method.type));
}

/** Что выбрать в селекторах ради способа: способ сервера — в его селекторе, а сервер — в главном. */
export function choices(methods: Methods, method: Method): Array<[string, string]> {
  const group = method.group;
  if (group === null) {
    return [];
  }
  return group === methods.selector || methods.selector === null
    ? [[group, method.tag]]
    : [
        [group, method.tag],
        [methods.selector, group],
      ];
}

function toMethod(item: GroupItem, group: string | null, selected: boolean): Method {
  return {
    tag: item.tag,
    type: item.type,
    group,
    selected,
    testedAt: Number(item.urlTestTime),
    delayMs: item.urlTestDelay,
  };
}

// Группа внутри группы: трафик идёт через то, что выбрано в самой вложенной. Пока ядро не выбрало, выбора нет
function resolve(tag: string, byTag: Map<string, Group>): string | null {
  const seen = new Set<string>();
  let current = tag;
  for (;;) {
    if (current === "") {
      return null;
    }
    const group = byTag.get(current);
    if (group === undefined) {
      return current;
    }
    if (seen.has(current)) {
      return null;
    }
    seen.add(current);
    current = group.selected;
  }
}

export function parseMethods(groups: Group[]): Methods | null {
  const byTag = new Map(groups.map((group) => [group.tag, group]));
  const nested = new Set(groups.flatMap((group) => group.items.map((item) => item.tag)));
  const top = groups.filter((group) => !nested.has(group.tag));
  const selector = top.find((group) => group.selectable);
  if (selector === undefined) {
    // Выбора нет, только Авто: его способы видно, но выбрать нельзя
    const auto = top.find((group) => group.type === URLTEST);
    if (auto === undefined) {
      return null;
    }
    const now = resolve(auto.selected, byTag);
    const methods = auto.items.map((item) => toMethod(item, null, false));
    const nowItem = methods.find((method) => method.tag === now);
    return {
      selector: null,
      auto: { tag: auto.tag, selected: true, now, testedAt: nowItem?.testedAt ?? 0, delayMs: nowItem?.delayMs ?? 0 },
      sections: [{ server: null, methods }],
      current: now,
    };
  }
  const autoItem = selector.items.find((item) => byTag.get(item.tag)?.type === URLTEST);
  const own = selector.items.filter((item) => item.tag !== autoItem?.tag && byTag.get(item.tag)?.selectable !== true);
  const servers = selector.items.flatMap((item) => {
    const group = byTag.get(item.tag);
    return group?.selectable === true ? [group] : [];
  });
  const sections: MethodSection[] = [];
  if (own.length > 0) {
    sections.push({ server: null, methods: own.map((item) => toMethod(item, selector.tag, selector.selected === item.tag)) });
  }
  for (const server of servers) {
    const chosen = selector.selected === server.tag;
    sections.push({
      server: server.tag,
      methods: server.items.map((item) => toMethod(item, server.tag, chosen && server.selected === item.tag)),
    });
  }
  // Пинг у группы в селекторе — пинг способа, который она выбрала сейчас
  const autoGroup = autoItem === undefined ? undefined : byTag.get(autoItem.tag);
  const auto: Auto | null =
    autoItem === undefined
      ? null
      : {
          tag: autoItem.tag,
          selected: selector.selected === autoItem.tag,
          now: autoGroup === undefined ? null : resolve(autoGroup.selected, byTag),
          testedAt: Number(autoItem.urlTestTime),
          delayMs: autoItem.urlTestDelay,
        };
  return { selector: selector.tag, auto, sections, current: resolve(selector.selected, byTag) };
}
