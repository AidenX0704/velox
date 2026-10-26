# Releasing Velox

Every GitHub Release publishes **user-facing release notes**, not a copy of
`CHANGELOG.md`. The changelog stays the authoring record; the release body is the
short story a user reads before installing.

## 1. Bump the version

```powershell
npm version 1.1.0 --no-git-tag-version   # package.json + package-lock.json
```

Electron Builder reads the version from `package.json`, so nothing else needs a
version string. `.github/workflows/release.yml` refuses to publish when the tag
and `package.json` disagree.

## 2. Author the changelog

Move the `## Unreleased` section of `CHANGELOG.md` under
`## <version> - <YYYY-MM-DD>`. Keep it exhaustive: it is the record of what
changed, including the unglamorous internals.

## 3. Write the release notes

Create `release-notes/v<version>.md`. The workflow **fails without it**, and it
must not be the changelog pasted in:

- Lead with two or three sentences on what this release means for a user.
- Group the rest under a few headings (`亮点` / `其它改进` / `升级说明`), one line
  per user-visible outcome, no file paths or refactor bookkeeping.
- End with a link to `CHANGELOG.md` for the full list.

## 4. Verify locally

```powershell
npm run lint
npm run typecheck
npm run test:rich-markdown; npm run test:document-images; npm run test:tab-close
npm exec -- electron-vite build
npm run check:bundle
npm exec -- electron-builder --win --x64 --publish never   # optional: packaging smoke test
```

The packaged app must launch. Note that this shell inherits
`ELECTRON_RUN_AS_NODE=1`, so run `Remove-Item Env:ELECTRON_RUN_AS_NODE` before
starting `dist/win-unpacked/Velox.exe` or Electron exits immediately as Node.

## 5. Publish

```powershell
git add -A
git commit -m "feat: ..."
git push origin main                 # triggers a build-only Release run
git tag -a v1.1.0 -m "Velox 1.1.0"
git push origin v1.1.0               # triggers the publishing Release run
```

Pushing the tag makes the workflow build Windows, macOS and Linux, then create or
update the GitHub Release with `release-notes/v<version>.md` as the body. When the
release already exists (a re-push or a manual dispatch), the notes are refreshed
through `gh release edit`, so a re-run never leaves stale notes behind.

To refresh notes for an existing release without rebuilding, either run
`gh release edit v1.1.0 --notes-file release-notes/v1.1.0.md` locally or dispatch
the `Release` workflow with the matching tag.
