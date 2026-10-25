const test = require("node:test");
const assert = require("node:assert/strict");
const { copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const JSZip = require("jszip");

const root = path.resolve(__dirname, "..");
// This release contract is also documented in RELEASE.md.
const releaseFiles = [
  "manifest.json", "proxy-config.js", "background.js", "popup.html", "popup.js",
  "popup.css", "options.html", "options.js", "icon.svg"
];

function project(t) {
  const directory = mkdtempSync(path.join(tmpdir(), "container-proxy-tooling-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const file of releaseFiles) copyFileSync(path.join(root, file), path.join(directory, file));
  cpSync(path.join(root, "scripts"), path.join(directory, "scripts"), { recursive: true });
  symlinkSync(path.join(root, "node_modules"), path.join(directory, "node_modules"), "junction");
  return directory;
}

function run(directory, script) {
  const result = spawnSync(process.execPath, [path.join(directory, "scripts", `${script}.cjs`)], {
    cwd: directory, encoding: "utf8", timeout: 60000
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return { status: result.status, output: result.stdout + result.stderr };
}

test("release ZIP excludes local secrets and tooling, preserves source bytes, and overwrites old builds", async t => {
  const directory = project(t);
  writeFileSync(path.join(directory, ".env"), "DISPOSABLE_TEST_SECRET=must-not-ship");
  mkdirSync(path.join(directory, "backups"));
  writeFileSync(path.join(directory, "backups", "proxy.json"), '{"password":"must-not-ship"}');
  writeFileSync(path.join(directory, "unexpected.js"), "this is not extension source");
  const manifest = JSON.parse(readFileSync(path.join(directory, "manifest.json"), "utf8"));
  const archive = path.join(directory, "web-ext-artifacts", `container_proxy-${manifest.version}.zip`);
  mkdirSync(path.dirname(archive));
  writeFileSync(archive, "stale archive");

  const result = run(directory, "build");
  assert.equal(result.status, 0, result.output);
  const zip = await JSZip.loadAsync(readFileSync(archive), { checkCRC32: true });
  assert.deepEqual(Object.keys(zip.files).sort(), [...releaseFiles].sort());
  for (const file of releaseFiles) {
    assert.deepEqual(await zip.file(file).async("nodebuffer"), readFileSync(path.join(directory, file)));
  }
});

test("build fails if a required source file or manifest version is missing", t => {
  const directory = project(t);
  rmSync(path.join(directory, "options.js"));
  let result = run(directory, "build");
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /options\.js/);

  copyFileSync(path.join(root, "options.js"), path.join(directory, "options.js"));
  const manifest = JSON.parse(readFileSync(path.join(directory, "manifest.json"), "utf8"));
  delete manifest.version;
  writeFileSync(path.join(directory, "manifest.json"), JSON.stringify(manifest));
  result = run(directory, "build");
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /nonempty version/);
});

test("Mozilla lint scans release sources, ignores development files, and fails on warnings and errors", t => {
  const directory = project(t);
  writeFileSync(path.join(directory, "unshipped.js"), "function (");
  let result = run(directory, "lint");
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /warnings\s+0/);

  const script = path.join(directory, "popup.js");
  const original = readFileSync(script, "utf8");
  writeFileSync(script, `${original}\neval("1 + 1");\n`);
  result = run(directory, "lint");
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /errors\s+0/);
  assert.match(result.output, /warnings\s+[1-9]/);
  assert.match(result.output, /DANGEROUS_EVAL/);

  writeFileSync(script, `${original}\nfunction (\n`);
  result = run(directory, "lint");
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /errors\s+[1-9]/);
});
