/* An allowlist prevents local backups, secrets and development files entering the AMO bundle. */
const { mkdir, readFile, writeFile } = require("node:fs/promises");
const path = require("node:path");
const JSZip = require("jszip");
const files = require("./extension-files.cjs");

const root = path.resolve(__dirname, "..");

async function build() {
  const zip = new JSZip();
  for (const file of files) zip.file(file, await readFile(path.join(root, file)));
  const manifest = JSON.parse(await zip.file("manifest.json").async("string"));
  for (const field of ["name", "version"]) {
    if (typeof manifest[field] !== "string" || !manifest[field].length) {
      throw new Error(`Manifest must include a nonempty ${field}.`);
    }
  }
  const filename = `${manifest.name}-${manifest.version}.zip`.toLowerCase().replace(/[^a-z0-9.-]+/g, "_");
  const artifacts = path.join(root, "web-ext-artifacts");
  const buffer = await zip.generateAsync({ compression: "DEFLATE", type: "nodebuffer" });
  await mkdir(artifacts, { recursive: true });
  await writeFile(path.join(artifacts, filename), buffer);
  console.log(`Your web extension is ready: web-ext-artifacts/${filename}`);
}

build().catch(error => { console.error(error); process.exitCode = 1; });
