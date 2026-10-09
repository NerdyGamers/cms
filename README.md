# Serverless CMS

A zero-server content management system: a static public site plus a browser-based
admin backend. Pages are Markdown files in this repo; the admin edits them through
the GitHub API, and GitHub Pages serves the site. Every edit is a git commit, so
you get full version history for free.

- **Public site:** `https://<owner>.github.io/<repo>/`
- **Admin backend:** `https://<owner>.github.io/<repo>/admin/`

## One-time setup

1. Create a **fine-grained personal access token**:
   GitHub → Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token.
   - Repository access: **Only select repositories** → this repo
   - Permissions: **Contents → Read and write**
2. Open the admin backend URL above and paste in:
   - repo owner, repo name, branch (`main`)
   - the token
3. Hit **Connect**. The token is stored only in your browser's localStorage —
   it is never sent anywhere except `api.github.com`.

## Using the backend

- **Pages** — create, edit, reorder (↑↓), publish/draft, and delete pages.
  Saving commits the Markdown file and updates the page index. The public site
  rebuilds on GitHub Pages, usually within a minute.
- **Media** — upload images (committed to `assets/`), then "Copy Markdown"
  to paste an image into a page.
- **Settings** — site title and tagline.

Keyboard: `Ctrl+S` / `Cmd+S` saves while editing.

## How it works

```
content/
  config.json      site title + tagline
  index.json       page manifest (slug, title, draft, order) — maintained by the admin
  pages/*.md       one Markdown file per page, with YAML-ish frontmatter
assets/            uploaded images
admin/             the backend UI (static, talks to api.github.com)
index.html         the public site (static, renders Markdown client-side)
lib/               vendored marked.js + tiny frontmatter/sanitizer helpers
```

The public site fetches `content/index.json` and renders each page's Markdown
in the browser — no build step, no server. Draft pages are excluded from
navigation and return a 404.

## Notes & limits

- GitHub Pages rebuilds take ~30–60s after each save.
- The Contents API is fine for text and small images; keep uploads under ~2MB.
- A custom domain can be added later via Settings → Pages → Custom domain
  (plus a `CNAME` file at the repo root).
- `marked` (MIT) is vendored in `lib/` so the site has zero runtime CDN dependencies.
