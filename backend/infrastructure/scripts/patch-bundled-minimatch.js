/**
 * Patches the bundled minimatch inside aws-cdk-lib with the project-level copy.
 *
 * aws-cdk-lib bundles minimatch, so npm overrides cannot reach it.
 * This script copies the direct minimatch dependency (which is at a patched
 * version) over the bundled copy to resolve ReDoS advisories
 * GHSA-7r86-cg39-jmmj and GHSA-23c5-xmqv-rm74.
 *
 * TODO: Remove this workaround once aws-cdk-lib ships with minimatch >= 10.2.3.
 */

const fs = require("fs");
const path = require("path");

const bundledDir = path.join(
  __dirname,
  "..",
  "node_modules",
  "aws-cdk-lib",
  "node_modules",
  "minimatch"
);

if (!fs.existsSync(bundledDir)) {
  process.exit(0);
}

const sourceDir = path.dirname(require.resolve("minimatch/package.json"));

const bundledPkg = JSON.parse(
  fs.readFileSync(path.join(bundledDir, "package.json"), "utf8")
);
const sourcePkg = JSON.parse(
  fs.readFileSync(path.join(sourceDir, "package.json"), "utf8")
);

if (bundledPkg.version === sourcePkg.version) {
  process.exit(0);
}

fs.cpSync(sourceDir, bundledDir, { recursive: true });

const updatedPkg = JSON.parse(
  fs.readFileSync(path.join(bundledDir, "package.json"), "utf8")
);
console.log(
  `patched aws-cdk-lib bundled minimatch: ${bundledPkg.version} -> ${updatedPkg.version}`
);
