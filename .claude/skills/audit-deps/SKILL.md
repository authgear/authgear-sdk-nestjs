---
name: audit-deps
description: Scan this repo's npm dependencies for known vulnerabilities, auto-apply non-breaking fixes, flag any that need a breaking upgrade, and produce a report. Use when the user asks to audit, scan, or check dependencies for vulnerabilities/CVEs, or to update vulnerable packages.
allowed-tools: Bash(npm audit:*), Bash(npm ci:*), Bash(npm test:*), Bash(npm run:*), Bash(npm outdated:*), Bash(git status:*), Bash(git diff:*)
---

# Audit and fix vulnerable dependencies

This repo has two independent npm projects, each with its own lockfile — audit both:

- root (`/`) — the SDK package plus the `example` workspace, sharing the root `package-lock.json`
- `docs/` — the documentation site, with its own `docs/package-lock.json`

Run the steps below **separately in each directory** that has a `package-lock.json`.

## 1. Baseline scan

In each project directory:

```bash
npm audit --json
```

Parse the JSON `vulnerabilities` object. For each entry, note `name`, `severity`, `range` (vulnerable version range), and `fixAvailable`:

- `fixAvailable: true` → a fix exists inside current semver ranges (non-breaking).
- `fixAvailable: false` → no fix exists yet upstream.
- `fixAvailable: { name, version, isSemVerMajor: true }` → a fix exists but requires a semver-major bump (breaking change) of `name` to `version`.

Save this as the "before" snapshot — you'll diff against it later.

## 2. Apply non-breaking fixes

Still in the same directory:

```bash
npm audit fix
```

Do **not** pass `--force` in this step — that would allow major/breaking upgrades to be applied silently, which violates step 3 below. Plain `npm audit fix` only touches versions that already satisfy the existing `package.json` ranges.

## 3. Identify breaking-change fixes (do not apply automatically)

For any vulnerability still present after step 2 whose `fixAvailable` was an object with `isSemVerMajor: true`, find out exactly what upgrade would be required without applying it:

```bash
npm audit fix --force --dry-run --json
```

Read the resulting `vulnerabilities`/`metadata` and the `add`/`change` lines to determine, per package: current version → required version, and which direct dependency in `package.json` would need its declared range bumped.

Do **not** run `npm audit fix --force` for real. Leave these packages untouched — they're reported to the user, not auto-upgraded (see step 6).

## 4. Verify nothing broke

After step 2's fixes, in each directory that was changed, run the project's own checks:

- root: `npm run lint`, `npm test`, `npm run build`
- `docs/`: `npm run build` (or whatever build script exists)

If something fails, inspect whether it's caused by the dependency bump. If so, back the specific package out (`npm install <pkg>@<previous-version>`) and move it into the "needs manual review" bucket in the report instead of silently leaving a broken tree.

## 5. Re-scan to confirm

Run `npm audit --json` again in each directory to get the "after" snapshot. Diff before vs. after to know exactly which advisories were resolved and which remain.

## 6. Report

Produce a concise markdown report (print it in the chat; don't create a repo file unless asked) with:

- **Summary** — counts by severity, before vs. after, per project (root / docs).
- **Fixed** — table of package, severity, advisory, old → new version.
- **Remaining — requires breaking change** — table of package, severity, advisory, current version, range still vulnerable, and the minimum version that fixes it (with the major bump it requires, e.g. `eslint 8.57.0 → 9.x`). Mention which direct dependency in `package.json` owns each one.
- **Remaining — no fix available** — anything upstream hasn't patched yet.

If any package landed in "requires breaking change," explicitly ask the user whether they want to proceed with that upgrade (they may need to review the package's changelog/migration guide first, since these SDKs and build tools can have real breaking API changes). Don't run the major-version install yourself unless the user confirms.

Finally, remind the user to review `git diff` on `package.json`/`package-lock.json` before committing.
