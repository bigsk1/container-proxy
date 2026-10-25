const path = require("node:path");
const { createInstance } = require("addons-linter");
const files = require("./extension-files.cjs");

async function lint() {
  const { errors, warnings } = await createInstance({
    config: {
      _: [path.resolve(__dirname, "..")],
      logLevel: "fatal",
      output: "text",
      warningsAsErrors: true,
      minManifestVersion: 2,
      maxManifestVersion: 3,
      enableDataCollectionPermissions: true,
      // The directory walker first visits the source root with an empty name.
      shouldScanFile: file => file === "" || files.includes(file)
    }
  }).run();
  if (errors.length || warnings.length) process.exitCode = 1;
}

lint().catch(error => { console.error(error); process.exitCode = 1; });
