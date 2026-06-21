import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const source = await readFile(new URL("./site-header.tsx", import.meta.url), "utf8");

describe("site header preferences", () => {
  it("renders locale, palette, and theme controls in the dashboard header", () => {
    assert.match(source, /import \{ LocaleSwitcher \} from "@\/components\/locale-switcher"/);
    assert.match(source, /import \{ PaletteToggle \} from "@\/components\/palette-toggle"/);
    assert.match(source, /import \{ ThemeToggle \} from "@\/components\/theme-toggle"/);
    assert.match(source, /<LocaleSwitcher \/>[\s\S]*<PaletteToggle \/>[\s\S]*<ThemeToggle \/>/);
  });
});
