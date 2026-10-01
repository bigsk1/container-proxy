/* An allowlist prevents local backups, secrets and development files entering the AMO bundle. */
const { copyFileSync, mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const staging = mkdtempSync(path.join(tmpdir(), "container-proxy-build-"));
const files = ["manifest.json", "proxy-config.js", "background.js", "popup.html", "popup.js", "popup.css", "options.html", "options.js", "icon.svg"];
try {
  for (const file of files) copyFileSync(path.join(root, file), path.join(staging, file));
  execFileSync(process.execPath, [
    path.join(root, "node_modules", "web-ext", "bin", "web-ext.js"), "build",
    "--source-dir", staging, "--artifacts-dir", path.join(root, "web-ext-artifacts"), "--overwrite-dest"
  ], { cwd: root, stdio: "inherit" });
} finally {
  rmSync(staging, { recursive: true, force: true });
}
