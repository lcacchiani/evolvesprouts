/**
 * Patches bundled dependencies inside aws-cdk-lib that npm overrides cannot reach
 * (they are nested with inBundle: true in the lockfile).
 *
 * - minimatch: ReDoS advisories GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74
 * - yaml: GHSA-48c2-rrv3-qjmp (stack overflow via deeply nested YAML)
 *
 * TODO: Remove minimatch workaround once aws-cdk-lib ships with minimatch >= 10.2.3.
 * TODO: Remove yaml workaround once aws-cdk-lib depends on yaml >= 1.10.3.
 */

const fs = require("fs");
const path = require("path");

/**
 * @param {string} bundledFolderName - directory name under aws-cdk-lib/node_modules
 * @param {string} npmPackageName - package to copy from (top-level dependency)
 * @param {(name: string) => string} resolveSourceRoot - returns filesystem path to package root
 */
function patchBundledDep(bundledFolderName, npmPackageName, resolveSourceRoot) {
  const bundledDir = path.join(
    __dirname,
    "..",
    "node_modules",
    "aws-cdk-lib",
    "node_modules",
    bundledFolderName
  );

  if (!fs.existsSync(bundledDir)) {
    return;
  }

  const sourceDir = resolveSourceRoot(npmPackageName);

  const bundledPkg = JSON.parse(
    fs.readFileSync(path.join(bundledDir, "package.json"), "utf8")
  );
  const sourcePkg = JSON.parse(
    fs.readFileSync(path.join(sourceDir, "package.json"), "utf8")
  );

  if (bundledPkg.version === sourcePkg.version) {
    return;
  }

  fs.cpSync(sourceDir, bundledDir, { recursive: true });

  const updatedPkg = JSON.parse(
    fs.readFileSync(path.join(bundledDir, "package.json"), "utf8")
  );
  console.log(
    `patched aws-cdk-lib bundled ${npmPackageName}: ${bundledPkg.version} -> ${updatedPkg.version}`
  );
}

patchBundledDep("minimatch", "minimatch", (name) =>
  path.dirname(require.resolve(`${name}/package.json`))
);
patchBundledDep("yaml", "yaml", (name) =>
  path.dirname(require.resolve(name))
);
