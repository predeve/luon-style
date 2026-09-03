import { classText } from "./class.ts";

export type StyleValue = string | number | null | undefined;

export type StyleClass = false | null | string | undefined
  | readonly StyleClass[];

export type StyleRule = {
  [name: string]: StyleRule | StyleValue;
};

export type StyleFn<Props = Record<string, unknown>> = (
  props: Props,
) => Record<string, StyleValue>;

export type StyleMap = Record<string, StyleClass | StyleRule | StyleFn<any>>;

type StyleResult<Styles extends StyleMap> = {
  [Name in keyof Styles]: Styles[Name] extends (...args: infer Args) => infer Result
    ? (...args: Args) => Result
    : string;
};

const unitless = new Set([
  "animationIterationCount",
  "aspectRatio",
  "borderImageOutset",
  "borderImageSlice",
  "borderImageWidth",
  "columnCount",
  "columns",
  "fillOpacity",
  "flex",
  "flexGrow",
  "flexShrink",
  "fontWeight",
  "gridArea",
  "gridColumn",
  "gridColumnEnd",
  "gridColumnStart",
  "gridRow",
  "gridRowEnd",
  "gridRowStart",
  "lineClamp",
  "lineHeight",
  "opacity",
  "order",
  "orphans",
  "scale",
  "stopOpacity",
  "strokeMiterlimit",
  "strokeOpacity",
  "tabSize",
  "widows",
  "zIndex",
  "zoom",
]);

function property(name: string) {
  if (name === "cssFloat") return "float";
  if (name.startsWith("--")) return name;
  return name
    .replace(/^ms([A-Z])/, "-ms-$1")
    .replace(/^Webkit([A-Z])/, "-webkit-$1")
    .replace(/^Moz([A-Z])/, "-moz-$1")
    .replace(/[A-Z]/g, (value) => `-${value.toLowerCase()}`);
}

function cssValue(name: string, value: StyleValue) {
  if (typeof value !== "number") return String(value);
  if (!value || name.startsWith("--") || unitless.has(name)) {
    return String(value);
  }
  return `${value}px`;
}

function recipeToken(value: string) {
  return /^\$[A-Za-z][A-Za-z0-9_-]*$/.test(value);
}

function recipeView(styles: StyleMap) {
  const saved = new Map<string, string>();

  function resolve(name: string, stack: string[] = []): string {
    const prior = saved.get(name);
    if (prior !== undefined) return prior;
    if (stack.includes(name)) {
      throw new Error(
        `Circular Luon style recipe: ${[...stack, name].join(" -> ")}`,
      );
    }
    const rule = styles[name];
    if (rule === undefined) {
      throw new Error(`Unknown Luon style recipe: ${name}`);
    }
    if (typeof rule !== "string" && !Array.isArray(rule)) {
      throw new Error(`Luon style recipe ${name} must be a class list.`);
    }
    const next = [...stack, name];
    const value = classText(rule)
      .split(/\s+/)
      .filter(Boolean)
      .flatMap((item) => (
        recipeToken(item) ? resolve(item, next).split(/\s+/) : item
      ))
      .filter(Boolean)
      .join(" ");
    saved.set(name, value);
    return value;
  }

  function expand(rule: StyleClass) {
    return classText(rule)
      .split(/\s+/)
      .filter(Boolean)
      .flatMap((item) => (
        recipeToken(item) ? resolve(item).split(/\s+/) : item
      ))
      .filter(Boolean)
      .join(" ");
  }

  return { expand, resolve };
}

export function recipeStyle(styles: StyleMap) {
  const recipe = recipeView(styles);
  return (...rules: unknown[]) => recipe.expand(rules as StyleClass);
}

type Selector = {
  named: boolean;
  strong?: boolean;
  value: string;
};

function selectorText(id: string, selector: Selector) {
  if (selector.strong) return selector.value;
  return selector.named
    ? `:where(${selector.value})`
    : `:where([data-luon-s="${id}"]):where(${selector.value})`;
}

function ruleText(
  id: string,
  selectors: Selector[],
  rule: StyleRule,
): string {
  const declarations: string[] = [];
  const nested: Array<[string, StyleRule]> = [];
  for (const [name, value] of Object.entries(rule)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "object") nested.push([name, value]);
    else declarations.push(`${property(name)}:${cssValue(name, value)}`);
  }
  const output: string[] = [];
  if (declarations.length) {
    output.push(
      `${selectors.map((item) => selectorText(id, item)).join(",")}`
        + `{${declarations.join(";")}}`,
    );
  }
  for (const [name, value] of nested) {
    if (name.startsWith("@")) {
      output.push(`${name}{${ruleText(id, selectors, value)}}`);
      continue;
    }
    const next = selectors.map((selector) => ({
      ...selector,
      value: name.includes("&")
        ? name.replaceAll("&", selector.value)
        : `${selector.value} ${name}`,
    }));
    output.push(ruleText(id, next, value));
  }
  return output.join("");
}

function styleText(
  id: string,
  styles: StyleMap,
  names: Record<string, string | StyleFn<any>>,
  scoped: boolean,
) {
  const output: string[] = [];
  const direct = new Set<string>();
  const recipes = recipeView(styles);
  let index = 0;
  for (const [selector, rule] of Object.entries(styles)) {
    if (selector.startsWith("$")) {
      names[selector] = recipes.resolve(selector);
      continue;
    }
    if (rule == null || rule === false) {
      names[selector] = "";
      continue;
    }
    if (typeof rule === "string" || Array.isArray(rule)) {
      direct.add(selector);
      names[selector] = recipes.expand(rule);
      continue;
    }
    if (typeof rule === "function") {
      names[selector] = rule;
      continue;
    }
    if (selector.startsWith("@")) {
      const inner: string[] = [];
      for (const [name, value] of Object.entries(rule)) {
        if (typeof value === "function") continue;
        const current = names[name];
        if (typeof current === "function" || direct.has(name)) {
          if (scoped) {
            inner.push(ruleText(
              id,
              [{ named: false, value: name }],
              value as StyleRule,
            ));
          }
          continue;
        }
        const key = typeof current === "string"
          ? current
          : `luon-${id}-${index++}`;
        names[name] = key;
        const selectors: Selector[] = [
          { named: true, strong: !scoped, value: `.${key}` },
        ];
        if (scoped) selectors.unshift({ named: false, value: name });
        inner.push(ruleText(id, selectors, value as StyleRule));
      }
      output.push(`${selector}{${inner.join("")}}`);
      continue;
    }
    const current = names[selector];
    const name = typeof current === "string"
      ? current
      : `luon-${id}-${index++}`;
    names[selector] = name;
    const selectors: Selector[] = [
      { named: true, strong: !scoped, value: `.${name}` },
    ];
    if (scoped) selectors.unshift({ named: false, value: selector });
    output.push(ruleText(id, selectors, rule as StyleRule));
  }
  const css = output.join("");
  return css ? `@layer components{${css}}` : "";
}

export function styleView<Styles extends StyleMap>(
  id: string,
  styles: Styles,
  scoped = true,
) {
  if (!styles || typeof styles !== "object" || Array.isArray(styles)) {
    throw new Error("Luon style must be an object.");
  }
  const names: Record<string, string | StyleFn<any>> = {};
  const css = styleText(id, styles, names, scoped);
  if (typeof document !== "undefined") {
    let element = document.querySelector<HTMLStyleElement>(
      `style[data-luon-style="${id}"]`,
    );
    if (!css) {
      element?.remove();
      return names as StyleResult<Styles>;
    }
    if (!element) {
      element = document.createElement("style");
      element.dataset.luonStyle = id;
      document.head.append(element);
    }
    if (element.textContent !== css) element.textContent = css;
  }
  return names as StyleResult<Styles>;
}

export function dynamicView(rule: unknown, current?: unknown) {
  const value = typeof rule === "function" ? rule() : rule;
  const base = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
  if (!current || typeof current !== "object" || Array.isArray(current)) {
    return base;
  }
  return { ...base, ...current };
}

export function deepView(
  rule: unknown,
  props: Record<string, unknown>,
) {
  const output = { ...props };
  if (typeof rule === "function") {
    output.style = dynamicView(() => rule(props), props.style);
    return output;
  }
  if (typeof rule !== "string") return output;
  if ("className" in output) {
    output.className = [rule, output.className];
  } else {
    output.class = [rule, output.class];
  }
  return output;
}
