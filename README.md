# @luon/style

Part of [Luon](https://www.luon.dev) — Reactive scoped style rules for Luon Views.

[Package guide](https://pkg.luon.dev/packages/style/) ·
[Source](https://github.com/predeve/luon-style) ·
[Developer tools](https://www.luon.dev/tools)

## Install

```bash
bun add @luon/style --registry https://pkg.luon.dev
```

## Who it is for

View compiler authors and low-level tools using scoped Luon styles.

## Core concepts

### Scoped CSS generation

styleView converts typed rule objects into a component layer and returns the generated class names used by a View.

### Reactive style state

styleState keeps runtime mutations separate from the original style factory and notifies the owning renderer only when values change.

### Dynamic and deep rules

dynamicView evaluates prop-aware style functions; deepView attaches rules to child component props without owning their renderer.

### Class normalization

classText flattens strings, arrays, and conditional objects into the final class attribute.

### Local class recipes

$ keys name reusable class lists that expand only inside the same style or deepStyle object.

## Quick reference

### Style value forms

Choose the form that matches the style source.

| Value | Meaning |
| --- | --- |
| "px-4 rounded-lg" | Tailwind class list |
| ["px-4", "rounded-lg"] | Nested class lists |
| { color: "red" } | Scoped CSS properties |
| props => ({ ... }) | Prop-aware dynamic rule |
| $surface | Local reusable class recipe |

### Low-level APIs

View normally connects these APIs to its reserved style exports.

| API | Responsibility |
| --- | --- |
| styleView | Generate and install scoped CSS |
| styleState | Own mutable runtime style rules |
| dynamicView | Evaluate prop-aware rules |
| deepView | Attach rules to child component props |
| classText | Flatten conditional class values |
| recipeStyle | Expand local $ recipes |

## Examples

### Generate scoped classes

Low-level renderers can install the generated style and use its names.

```ts
import { styleView } from "@luon/style";

const classes = styleView("profile", {
  $surface: "rounded-2xl border bg-white",
  card: "$surface p-6 shadow-sm",
  title: { color: "#0f766e", fontWeight: 700 },
});

element.className = classes.card;
```

### Mutate style state

The rules proxy records changes while value returns the current map.

```ts
import { styleState } from "@luon/style";

const styles = styleState(() => ({
  card: { opacity: 1, padding: 16 },
}), { notify: render });

styles.rules.card.opacity = 0.5;
const current = styles.value();
```

### Normalize conditional classes

Nested arrays and truthy object keys are accepted.

```ts
import { classText } from "@luon/style";

classText([
  "rounded-lg px-4",
  ["shadow-sm"],
  { "opacity-50": disabled, "ring-2": selected },
]);
```

## API reference

### `classText(value)`

Flatten strings, arrays, and conditional classes.

### `styleView(id, styles, scoped?)`

Generate and install scoped CSS.

### `styleState(factory, options?)`

Create mutable reactive style state.

### `dynamicView(rule, current?)`

Evaluate and merge dynamic styles.

### `deepView(rule, props)`

Apply deep rules to component props.

### `recipeStyle(styles)`

Resolve local $ recipes into reusable class lists.

## Runtime flow

1. Create a stable style identifier for the owning View.
2. Generate scoped selectors and install one style element.
3. Read class names from the generated result.
4. Refresh isolated rules and remove their style element on close.

## Boundaries

- Ordinary Site Views should use reserved style and deepStyle exports.
- @luon/view owns Act notifications and lifecycle cleanup.
- This package owns CSS conversion and state, not TSX compilation.

## More documentation

- [Style language](https://docs.luon.dev/frontend/style)
- [View language](https://docs.luon.dev/frontend/view)

## License

[MIT](LICENSE) © predeve
