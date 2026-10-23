#!/usr/bin/env node
/**
 * After a semver release (vX.Y.Z), update rolling git pin aliases (vX, vX.Y) and
 * supported-lines.json. Rolling GitHub Releases are prerelease and never "latest".
 * Consumers pin: github:antora-supplemental/facto-stack#vX.Y
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO = process.env.GITHUB_REPOSITORY || "antora-supplemental/facto-stack";
const GIT_PIN = `github:${REPO}`;

function sh(cmd, opts = {}) {
  const result = execSync(cmd, {
    encoding: "utf8",
    stdio: opts.silent ? "pipe" : "inherit",
    ...opts,
  });
  return typeof result === "string" ? result.trim() : "";
}

function shQuiet(cmd) {
  try {
    return sh(cmd, { silent: true });
  } catch {
    return "";
  }
}

function parseVersion(tag) {
  return tag.replace(/^v/, "").split("+")[0];
}

function compareSemver(a, b) {
  const pa = parseVersion(a).split(".").map(Number);
  const pb = parseVersion(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function isPureSemverTag(tag) {
  return /^v\d+\.\d+\.\d+$/.test(tag);
}

function allVersionTags() {
  const out = shQuiet('git tag -l "v[0-9]*.[0-9]*.[0-9]*"');
  return out ? out.split("\n").filter(isPureSemverTag) : [];
}

function highestInLine(tags, major, minor = null) {
  const filtered = tags.filter((t) => {
    const parts = parseVersion(t).split(".").map(Number);
    if (parts[0] !== major) return false;
    if (minor !== null && parts[1] !== minor) return false;
    return true;
  });
  return filtered.sort(compareSemver).at(-1) ?? "";
}

function minorLinesFromTags(tags, majorOnly = null) {
  const lines = new Set();
  for (const tag of tags) {
    const [ma, mi] = parseVersion(tag).split(".").map(Number);
    if (majorOnly !== null && ma !== majorOnly) continue;
    lines.add(`${ma}.${mi}`);
  }
  return [...lines].sort((a, b) => {
    const [ama, ami] = a.split(".").map(Number);
    const [bma, bmi] = b.split(".").map(Number);
    return ama - bma || ami - bmi;
  });
}

function updateRollingRelease(tagName, commitSha, title, notes) {
  shQuiet(`gh release delete ${tagName} --yes --cleanup-tag -R ${REPO}`);
  const notesFile = join(tmpdir(), `facto-stack-release-notes-${tagName.replace(/[^a-z0-9.-]/gi, "_")}.md`);
  writeFileSync(notesFile, notes);
  try {
    sh(
      `gh release create ${tagName} --target ${commitSha} --title "${title}" --notes-file "${notesFile}" --prerelease --latest=false -R ${REPO}`,
    );
  } finally {
    unlinkSync(notesFile);
  }
}

function rollingNotes(major, minor, currentVersion) {
  return [
    `Rolling git pin for the latest **v${major}.${minor}.x** patch (currently **v${currentVersion}**).`,
    "",
    "This Git tag moves when a new patch ships within the line. Marked prerelease so `releases/latest` still tracks normal semver releases.",
    "",
    `\`pnpm add ${GIT_PIN}#v${major}.${minor}\``,
    "",
    "See `supported-lines.json` in this repository for current line heads.",
  ].join("\n");
}

function majorRollingNotes(major, currentVersion) {
  return [
    `Rolling git pin for the latest **v${major}.x.x** release (currently **v${currentVersion}**).`,
    "",
    `This Git tag moves when a new minor or patch ships within the v${major} major line. Marked prerelease so \`releases/latest\` still tracks normal semver releases.`,
    "",
    `\`pnpm add ${GIT_PIN}#v${major}\``,
    "",
    `Prefer \`#v${major}.{minor}\` when you want patches only on one minor line (for example \`#v${major}.2\` for v${major}.2.x).`,
  ].join("\n");
}

function lineEntry(tagName, version) {
  const semver = parseVersion(version);
  const pinSuffix = tagName.replace(/^v/, "");
  const lineKey = pinSuffix.includes(".") ? pinSuffix : String(parseVersion(version).split(".")[0]);
  return {
    tag: tagName,
    current: semver,
    git_pin: `${GIT_PIN}#${tagName}`,
    line: lineKey,
  };
}

const version = process.env.VERSION?.replace(/^v/, "").split("+")[0] || process.argv[2];
const sha =
  process.env.RELEASE_SHA ||
  shQuiet(`git rev-list -n 1 "v${version}"`) ||
  process.env.GITHUB_SHA ||
  shQuiet("git rev-parse HEAD");

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("Usage: post-release.mjs <X.Y.Z>");
  process.exit(1);
}

const [major, minor] = version.split(".").map(Number);
const tags = allVersionTags();
const lineTag = `v${major}.${minor}`;
const lineHighest = highestInLine(tags, major, minor);
const lineHighestVersion = parseVersion(lineHighest);
const lineSha = shQuiet(`git rev-list -n 1 ${lineHighest}`) || sha;

console.log(`Post-release for v${version} (line ${major}.${minor} → ${lineHighestVersion})`);

updateRollingRelease(
  lineTag,
  lineSha,
  `v${major}.${minor} line (rolling)`,
  rollingNotes(major, minor, lineHighestVersion),
);

const highestMajorTag = highestInLine(tags, major);
const highestMajorVersion = parseVersion(highestMajorTag);
const highestMajorSha = shQuiet(`git rev-list -n 1 ${highestMajorTag}`) || sha;

if (highestMajorVersion === version) {
  updateRollingRelease(
    `v${major}`,
    highestMajorSha,
    `v${major} line (rolling)`,
    majorRollingNotes(major, highestMajorVersion),
  );
}

for (const line of minorLinesFromTags(tags, major)) {
  const [ma, mi] = line.split(".").map(Number);
  if (ma !== major || (ma === major && mi === minor)) continue;

  const highest = highestInLine(tags, ma, mi);
  if (!highest) continue;

  const highestVersion = parseVersion(highest);
  const highestSha = shQuiet(`git rev-list -n 1 ${highest}`);
  const tag = `v${ma}.${mi}`;
  const currentSha = shQuiet(`git rev-list -n 1 ${tag}`);

  if (currentSha === highestSha) {
    console.log(`Rolling tag ${tag} already at v${highestVersion}`);
    continue;
  }

  updateRollingRelease(
    tag,
    highestSha,
    `v${ma}.${mi} line (rolling)`,
    rollingNotes(ma, mi, highestVersion),
  );
}

const prev = existsSync("supported-lines.json")
  ? JSON.parse(readFileSync("supported-lines.json", "utf8"))
  : null;
const lines = { ...(prev?.lines || {}) };

for (const line of minorLinesFromTags(tags, major)) {
  const [ma, mi] = line.split(".").map(Number);
  const highest = highestInLine(tags, ma, mi);
  const current = parseVersion(highest);
  lines[line] = lineEntry(`v${ma}.${mi}`, current);
}

lines[String(major)] = lineEntry(`v${major}`, highestMajorVersion);

const latestAcross = tags.map(parseVersion).sort(compareSemver).at(-1) || highestMajorVersion;

const supported = {
  schema: 1,
  updated: new Date().toISOString(),
  product: "@antora-supplemental/facto-stack",
  latest: latestAcross,
  lines,
  notes:
    "Git tags remain pure semver (vX.Y.Z). Rolling aliases vX and vX.Y are git refs for pnpm/github: pins — not npm registry ranges.",
};

writeFileSync("supported-lines.json", `${JSON.stringify(supported, null, 2)}\n`);
console.log("Wrote supported-lines.json");
