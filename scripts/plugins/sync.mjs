import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const pluginPath = "plugins/ongleam-beta";
const manifest = JSON.parse(await readFile(new URL(`${pluginPath}/plugin.json`, root), "utf8"));
const { name, version, description, author } = manifest;
assert.match(name, /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);
assert.match(version, /^\d+\.\d+\.\d+$/);
assert.equal(pluginPath, `plugins/${name}`);
assert.ok(typeof description === "string" && description.trim());
assert.ok(typeof author?.name === "string" && author.name.trim());
const check = process.argv[2] === "--check";
assert.ok(process.argv.length === 2 || (process.argv.length === 3 && check), "Usage: sync.mjs [--check]");

const identity = { name, version, description, author };
const interfaceMetadata = manifest.extensions?.["com.openai"]?.interface;
const source = `./${pluginPath}`;
const mcp = JSON.parse(await readFile(new URL(`${pluginPath}/mcp.json`, root), "utf8"));
assert.deepEqual(Object.keys(mcp.mcpServers), ["ongleam"]);
assert.equal(mcp.mcpServers.ongleam.type, "streamable-http");
assert.equal(mcp.mcpServers.ongleam.url, "https://beta-api.ongleam.com/mcp");
const outputs = [
  [`${pluginPath}/.claude-plugin/plugin.json`, { ...identity, skills: "./skills/", mcpServers: "./.mcp.json" }],
  [`${pluginPath}/.codex-plugin/plugin.json`, { ...identity, skills: "./skills/", mcpServers: "./.mcp.json", interface: interfaceMetadata }],
  [`${pluginPath}/.mcp.json`, { mcpServers: { ongleam: { type: "http", url: mcp.mcpServers.ongleam.url } } }],
  [".claude-plugin/marketplace.json", {
    name, description, owner: author, plugins: [{ name, description, source }]
  }],
  [".agents/plugins/marketplace.json", {
    name,
    plugins: [{ name, source: { source: "local", path: source },
      policy: { installation: "AVAILABLE", authentication: "ON_USE" }, category: "Productivity" }]
  }]
];

for (const [path, content] of outputs) {
  const file = new URL(path, root);
  const expected = `${JSON.stringify(content, null, 2)}\n`;
  if (check) {
    assert.equal(await readFile(file, "utf8"), expected, `${path}: run bun run plugins:sync`);
  } else {
    await mkdir(new URL(".", file), { recursive: true });
    await writeFile(file, expected, "utf8");
  }
}

const skill = await readFile(new URL(`${pluginPath}/skills/use-ongleam/SKILL.md`, root), "utf8");
assert.match(skill, /^---\r?\nname: use-ongleam\r?\ndescription: .+\r?\n---\r?\n/);
console.log(check ? "Plugin manifests and shared skill checked" : "Plugin manifests synchronized");
