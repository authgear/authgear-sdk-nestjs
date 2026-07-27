---
name: update-deps
description: Scan this repo's npm dependencies for known vulnerabilities, auto-apply non-breaking fixes, flag any that need a breaking upgrade, and produce a report. Use when the user asks to audit, scan, or check dependencies for vulnerabilities/CVEs, or to update vulnerable packages.
allowed-tools: Bash(npm audit:*), Bash(npm ci:*), Bash(npm test:*), Bash(npm run:*), Bash(npm outdated:*), Bash(npm ls:*), Bash(npm install:*), Bash(git status:*), Bash(git diff:*)
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

If something fails, inspect whether it's caused by the dependency bump. If so, pin the package to a version that resolves the vulnerability without the regression — see step 4a — and re-verify. If no version satisfies both, back the specific package out (`npm install <pkg>@<previous-version>`) and move it into the "needs manual review" bucket in the report instead of silently leaving a broken tree.

## 4a. Pinning a transitive package via `overrides`

Prefer this whenever the package that needs pinning is **not** already a direct dependency in `package.json` (i.e. it's pulled in transitively). Do **not** use `npm install <pkg>@<version>` for this — that silently adds it as a new direct dependency, which misrepresents the dependency tree (it looks like the project itself depends on it, when really you're just constraining a transitive resolution).

Instead, add/edit an entry under `"overrides"` in `package.json` (create the key if it doesn't exist yet; if one already exists — e.g. this repo's `docs/package.json` already overrides `postcss` — add your entry alongside it rather than replacing it).

**Before adding the override**, check whether the package resolves to more than one distinct version in the tree, and who requires each:

```bash
npm ls <pkg>
```

If only one version/parent shows up, a plain top-level override is safe:

```json
"overrides": {
  "<pkg>": "<pinned-version>"
}
```

If multiple parents resolve to **different** versions of `<pkg>` (e.g. package `x` needs `a@0.0.1` and package `y` needs `a@1.0.1`, and only `x`'s copy is the vulnerable/broken one), a blanket override forces every consumer onto the same version — including ones that were never vulnerable and may not be compatible with the pinned version. In that case scope the override to only the offending parent using npm's nested override syntax instead:

```json
"overrides": {
  "x": {
    "a": "0.0.2"
  }
}
```

This pins `a` only when it's resolved as a dependency of `x`; `y`'s `a@1.0.1` is untouched.

**After adding/editing the override**, always run `npm install` then re-run `npm ls <pkg>` and diff it against the pre-override output — confirm every parent that needs a *different* version of `<pkg>` still gets it, and only the intended parent(s) picked up the pin. Then re-run `npm audit` and the project's build/test checks (step 4) to confirm the fix holds without collateral damage.

## 5. Re-scan to confirm

Run `npm audit --json` again in each directory to get the "after" snapshot. Diff before vs. after to know exactly which advisories were resolved and which remain.

## 6. Check for stale overrides

In each directory, inspect the full `"overrides"` block in `package.json` (including entries predating this audit, not just ones you just added). For each entry:

- Confirm the overridden package is still present in the tree at all: `npm ls <pkg>`. If it's gone (no longer a dependency of anything), the override is dead weight.
- Check whether the override is still necessary: temporarily remove the entry, run `npm install`, then `npm audit` and the build/test checks from step 4. If the tree still resolves to a safe, working version without the override, it's stale.
- If an override is stale, restore/remove it as appropriate and flag it in the report rather than leaving it silently in place — stale overrides accumulate and make future audits harder to reason about (is this pin still load-bearing, or a fossil from a past fix?).

If removing an override for testing purposes, always restore the working (overridden or fixed) state afterward before moving on — don't leave the tree in the "removed" state without re-verifying it's actually fine.

## 7. Report

Produce a concise markdown report (print it in the chat; don't create a repo file unless asked) with:

- **Summary** — counts by severity, before vs. after, per project (root / docs).
- **Fixed** — table of package, severity, advisory, old → new version, and whether it was fixed via a normal bump or an `overrides` pin (note if scoped to a specific parent).
- **Remaining — requires breaking change** — table of package, severity, advisory, current version, range still vulnerable, and the minimum version that fixes it (with the major bump it requires, e.g. `eslint 8.57.0 → 9.x`). Mention which direct dependency in `package.json` owns each one.
- **Remaining — no fix available** — anything upstream hasn't patched yet.
- **Overrides** — any new override added (package, pinned version, scope, and why a plain bump wasn't enough), and any stale overrides found/removed.

If any package landed in "requires breaking change," explicitly ask the user whether they want to proceed with that upgrade (they may need to review the package's changelog/migration guide first, since these SDKs and build tools can have real breaking API changes). Don't run the major-version install yourself unless the user confirms.

Finally, remind the user to review `git diff` on `package.json`/`package-lock.json` before committing.
