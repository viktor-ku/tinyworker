#!/usr/bin/env bun
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Bun's shell runner
const $ = Bun.$;

const ALLOWED_NAMES = new Set(["core"]);
const PACKAGE_JSON_BY_NAME = {
  core: join("packages", "tinyworker-core", "package.json"),
};

// Strict-ish SemVer: 1.2.3, 1.2.3-alpha.1, 1.2.3+build.7, 1.2.3-alpha.1+build.7
const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

function die(msg, code = 1) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(code);
}

function ok(msg) {
  console.log(`✓ ${msg}`);
}

function parseArg(arg) {
  // Must be exactly "name@version" (one @)
  const parts = arg.split("@");
  if (parts.length !== 2) return null;
  const [name, version] = parts;
  if (!name || !version) return null;
  return { name, version };
}

async function ensureCleanGit() {
  const res = await $`git status --porcelain`.quiet();
  if (res.exitCode !== 0)
    die("Failed to run git status. Are you in a git repo?");
  if (res.stdout.trim().length !== 0) {
    die("Working tree is not clean. Commit/stash your changes first.");
  }
}

async function ensureTagDoesNotExist(tag) {
  // exit code 0 if exists
  const res = await $`git rev-parse -q --verify refs/tags/${tag}`.quiet();
  if (res.exitCode === 0) die(`Tag already exists: ${tag}`);
}

async function readJson(path) {
  const raw = await readFile(path, "utf8");
  return { raw, obj: JSON.parse(raw) };
}

function stringifyJsonPreserveNewline(obj, hadTrailingNewline) {
  const json = JSON.stringify(obj, null, 2) + "\n";
  return hadTrailingNewline ? json : json.trimEnd();
}

async function main() {
  const input = process.argv[2];
  if (!input) {
    die("Missing argument. Usage: bun scripts/release.js core@1.2.3");
  }

  const parsed = parseArg(input);
  if (!parsed) {
    die("Invalid format. Expected exactly: core@<semver> (e.g. core@1.2.3)");
  }

  const { name, version } = parsed;

  if (!ALLOWED_NAMES.has(name)) {
    die(
      `Invalid name "${name}". Allowed names: ${[...ALLOWED_NAMES].join(", ")}`,
    );
  }

  if (!SEMVER_RE.test(version)) {
    die(
      `Invalid semver "${version}". Expected e.g. 1.2.3, 1.2.3-alpha.1, 1.2.3+build.7`,
    );
  }

  const pkgPath = PACKAGE_JSON_BY_NAME[name];
  if (!pkgPath) die(`No package.json mapping configured for "${name}"`);

  const tag = `${name}@${version}`;
  const commitMsg = `chore(release): bump ${name} to ${version}`;

  ok(`Input OK: name="${name}", version="${version}"`);
  ok(`Package file: ${pkgPath}`);
  ok(`Commit message: ${commitMsg}`);
  ok(`Git tag: ${tag}`);

  await ensureCleanGit();
  await ensureTagDoesNotExist(tag);

  // Update package.json version
  const { raw, obj } = await readJson(pkgPath);

  if (typeof obj !== "object" || obj === null)
    die(`${pkgPath} is not valid JSON object`);
  if (typeof obj.version !== "string")
    die(`${pkgPath} has no "version" string field`);

  if (obj.version === version) {
    die(
      `package.json already has version ${version}. Refusing to create a no-op release.`,
      2,
    );
  }

  const hadTrailingNewline = raw.endsWith("\n");
  obj.version = version;
  const updated = stringifyJsonPreserveNewline(obj, hadTrailingNewline);
  await writeFile(pkgPath, updated, "utf8");
  ok(
    `Updated ${pkgPath} version: ${raw.match(/"version"\s*:\s*"([^"]+)"/)?.[1] ?? "?"} → ${version}`,
  );

  // Commit
  await $`git add ${pkgPath}`;
  const commitRes = await $`git commit -m ${commitMsg}`.quiet();
  if (commitRes.exitCode !== 0)
    die("git commit failed (maybe hooks failed or nothing to commit?)");
  ok("Committed version bump");

  // Tag
  const tagRes = await $`git tag ${tag}`.quiet();
  if (tagRes.exitCode !== 0) die("git tag failed");
  ok("Created tag");

  // Push commit + tag
  // Push current HEAD, then tag explicitly
  const pushCommit = await $`git push origin HEAD`.quiet();
  if (pushCommit.exitCode !== 0) die("git push (commit) failed");
  ok("Pushed commit to origin");

  const pushTag = await $`git push origin ${tag}`.quiet();
  if (pushTag.exitCode !== 0) die("git push (tag) failed");
  ok("Pushed tag to origin");

  console.log(`\n🎉 Release prepared: ${tag}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
