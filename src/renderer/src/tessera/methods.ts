import type { Group } from "@dashboard/gen/daemon/started_service_pb";

// Как Methods.kt на Android: выбирают в первом селекторе верхнего уровня, первая группа urltest в нём — «Авто».
// Только группы ядра, конфиг не читается (принцип №1). Полная шторка способов — шаг 8 плана.

export interface MethodSummary {
  /** Выбрано Авто, `name` — способ, который оно взяло. */
  auto: boolean;
  /** Способ, через который идёт трафик; null — неизвестен. */
  name: string | null;
  delayMs: number;
}

const URLTEST = "urltest";

// Группа внутри группы: трафик идёт через то, что выбрано в самой вложенной
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

export function summarize(groups: Group[]): MethodSummary | null {
  const byTag = new Map(groups.map((group) => [group.tag, group]));
  const nested = new Set(groups.flatMap((group) => group.items.map((item) => item.tag)));
  const top = groups.filter((group) => !nested.has(group.tag));
  const selector = top.find((group) => group.selectable);
  if (selector === undefined) {
    const auto = top.find((group) => group.type === URLTEST);
    if (auto === undefined) {
      return null;
    }
    const name = resolve(auto.selected, byTag);
    return { auto: true, name, delayMs: delay(auto, name) };
  }
  const autoTag = selector.items.find((item) => byTag.get(item.tag)?.type === URLTEST)?.tag;
  const name = resolve(selector.selected, byTag);
  const owner = groups.find((group) => group.items.some((item) => item.tag === name));
  return { auto: selector.selected === autoTag, name, delayMs: owner === undefined ? 0 : delay(owner, name) };
}

function delay(group: Group, tag: string | null): number {
  return group.items.find((item) => item.tag === tag)?.urlTestDelay ?? 0;
}
