import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const source = await readFile(new URL("./workspace-switcher.tsx", import.meta.url), "utf8");

describe("workspace switcher config", () => {
  it("contains dashboard and workbench destinations", async () => {
  assert.match(source, /key:\s*"dashboard"[\s\S]*href:\s*"\/dashboard"[\s\S]*labelKey:\s*"workspace\.dashboard"/);
  assert.match(source, /key:\s*"workbench"[\s\S]*href:\s*"\/workbench"[\s\S]*labelKey:\s*"workspace\.workbench"/);
});

it("wraps the dropdown label in a Base UI menu group", async () => {
  assert.match(source, /<DropdownMenuGroup>[\s\S]*<DropdownMenuLabel>\{t\("workspace\.switchWorkspace"\)\}<\/DropdownMenuLabel>/);
});
});
