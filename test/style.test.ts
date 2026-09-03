import { afterEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

import {
  deepView,
  dynamicView,
  recipeStyle,
  styleState,
  styleView,
} from "../src/index.ts";

const window = new Window();
Object.assign(globalThis, { document: window.document });

afterEach(() => {
  document.head.replaceChildren();
});

describe("Luon Style", () => {
  test("expands standalone package recipes", () => {
    const $ = recipeStyle({
      $line: "border border-slate-200",
      $panel: "$line rounded-xl",
    });
    expect($("grid $panel", false, ["p-4"])).toBe(
      "grid border border-slate-200 rounded-xl p-4",
    );
  });

  test("preserves mutations and notifies its owner", () => {
    let width = 480;
    let changed = 0;
    const source = styleState(() => ({ main: { width } }), {
      isolated: true,
      notify: () => changed++,
      sourceId: "panel",
    });

    source.rules.main.width = 300;
    width = 720;

    expect(source.refresh().main.width).toBe(300);
    expect(changed).toBe(1);
    expect(source.id).toStartWith("panel-");
  });

  test("creates scoped CSS and reusable class names", () => {
    const style = styleView("abc123", {
      main: {
        fontSize: 16,
        lineHeight: 1.5,
        opacity: 0.8,
        padding: 24,
        width: "80%",
      },
    });
    const css = document.head.textContent;

    expect(style.main).toBe("luon-abc123-0");
    expect(css).toContain(':where([data-luon-s="abc123"]):where(main)');
    expect(css).toContain("font-size:16px");
    expect(css).toContain("line-height:1.5");
    expect(css).toContain("padding:24px");
  });

  test("supports class arrays and dynamic component rules", () => {
    const style = styleView("tailwind", {
      main: ["mx-auto max-w-xl", ["space-y-3", "rounded-md"]],
    });
    expect(style.main).toBe("mx-auto max-w-xl space-y-3 rounded-md");

    expect(dynamicView(
      () => ({ opacity: 0.5, width: 480 }),
      { width: 720 },
    )).toEqual({ opacity: 0.5, width: 720 });
    expect(deepView("luon-button", {
      class: "primary",
      type: "button",
    })).toEqual({
      class: ["luon-button", "primary"],
      type: "button",
    });
  });

  test("expands local class recipes recursively", () => {
    const style = styleView("recipes", {
      $control: "rounded-lg font-semibold",
      $primary: ["$control", "bg-cyan-300 text-slate-950"],
      button: "$primary px-4 py-2",
    });

    expect(style.$control).toBe("rounded-lg font-semibold");
    expect(style.$primary).toBe(
      "rounded-lg font-semibold bg-cyan-300 text-slate-950",
    );
    expect(style.button).toBe(
      "rounded-lg font-semibold bg-cyan-300 text-slate-950 px-4 py-2",
    );
    expect(document.head.textContent).toBe("");
  });

  test("reports invalid local recipe references", () => {
    expect(() => styleView("missing", {
      button: "$control px-4",
    })).toThrow("Unknown Luon style recipe: $control");

    expect(() => styleView("circular", {
      $a: "$b",
      $b: "$a",
      button: "$a",
    })).toThrow("Circular Luon style recipe: $a -> $b -> $a");

    expect(() => styleView("object", {
      $panel: { padding: 12 },
      main: "$panel",
    })).toThrow("Luon style recipe $panel must be a class list");
  });
});
