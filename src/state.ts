import type { StyleMap } from "./style.ts";

const removed = Symbol("removed");

type Change = {
  children: Map<PropertyKey, Change>;
  deleted?: boolean;
  set?: boolean;
  value?: unknown;
};

export type StyleOptions = {
  isolated?: boolean;
  notify?: () => void;
  onClose?: (run: () => void) => void;
  sourceId?: string;
};

function change(): Change {
  return { children: new Map() };
}

function clone(value: unknown, rule: Change): unknown {
  if (rule.deleted) return removed;
  let output = rule.set ? rule.value : value;
  if (!rule.children.size) return output;
  if (Array.isArray(output)) output = [...output];
  else if (output && typeof output === "object") output = { ...output };
  else output = {};
  for (const [key, child] of rule.children) {
    const next = clone((output as any)[key], child);
    if (next === removed) delete (output as any)[key];
    else (output as any)[key] = next;
  }
  return output;
}

function find(rule: Change, path: PropertyKey[], create = false) {
  let current = rule;
  for (const key of path) {
    let next = current.children.get(key);
    if (!next) {
      if (!create) return;
      next = change();
      current.children.set(key, next);
    }
    current = next;
  }
  return current;
}

function read(value: unknown, path: PropertyKey[]) {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== "object") return;
    current = (current as any)[key];
  }
  return current;
}

export type StyleState<Styles extends StyleMap> = {
  id: string;
  refresh: () => Styles;
  rules: Styles;
  value: () => Styles;
};

export function styleState<Styles extends StyleMap>(
  factory: () => Styles,
  options: StyleOptions = {},
): StyleState<Styles> {
  const changes = change();
  const proxies = new Map<string, object>();
  let base = factory();
  if (!base || typeof base !== "object" || Array.isArray(base)) {
    throw new Error("Luon style must be an object.");
  }
  let current = clone(base, changes) as Styles;
  const id = options.isolated
    ? `${options.sourceId || "style"}-${(++styleId).toString(36)}`
    : options.sourceId || "";
  if (options.isolated && id) {
    options.onClose?.(() => {
      if (typeof document !== "undefined") {
        document.querySelector(`style[data-luon-style="${id}"]`)?.remove();
      }
    });
  }

  function update() {
    current = clone(base, changes) as Styles;
  }

  function proxy(path: PropertyKey[]): any {
    const key = path.map(String).join("\0");
    const saved = proxies.get(key);
    if (saved) return saved;
    const value = read(current, path);
    const target = Array.isArray(value) ? [] : {};
    const result = new Proxy(target, {
      deleteProperty(_target, name) {
        const before = read(current, [...path, name]);
        const rule = find(changes, [...path, name], true)!;
        rule.deleted = true;
        rule.set = false;
        rule.children.clear();
        update();
        if (before !== undefined) options.notify?.();
        return true;
      },
      get(_target, name) {
        const next = read(current, [...path, name]);
        if (!next || typeof next !== "object") return next;
        return proxy([...path, name]);
      },
      getOwnPropertyDescriptor(_target, name) {
        if (Array.isArray(target) && name === "length") {
          return Reflect.getOwnPropertyDescriptor(target, name);
        }
        return {
          configurable: true,
          enumerable: true,
          value: read(current, [...path, name]),
          writable: true,
        };
      },
      has(_target, name) {
        const value = read(current, path);
        return Boolean(value && typeof value === "object" && name in value);
      },
      ownKeys() {
        const value = read(current, path);
        return value && typeof value === "object"
          ? Reflect.ownKeys(value)
          : [];
      },
      set(_target, name, value) {
        const before = read(current, [...path, name]);
        const rule = find(changes, [...path, name], true)!;
        rule.deleted = false;
        rule.set = true;
        rule.value = value;
        rule.children.clear();
        update();
        if (!Object.is(before, value)) options.notify?.();
        return true;
      },
    });
    proxies.set(key, result);
    return result;
  }

  return {
    id,
    refresh() {
      if (options.isolated) {
        base = factory();
        update();
      }
      return current;
    },
    rules: proxy([]),
    value: () => current,
  };
}

let styleId = 0;
