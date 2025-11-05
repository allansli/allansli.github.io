# Repository Guidelines

## Project Structure & Module Organization
- Root `index.html` contains the full site markup, inline styling, and component sections (hero, stats, experience, contact). Keep related sections grouped and comment major blocks when adding new ones.
- Add reusable assets (images, icons, fonts) under `assets/` if needed; reference them with relative paths and optimize for web delivery.
- Keep experimental drafts outside the repository or in clearly named branches; the published branch should remain production-ready.

## Build, Test, and Development Commands
- Local preview: `python3 -m http.server 4000` (run from the repo root) to view the site at `http://localhost:4000`.
- Optional hot reload: `npx live-server --port=4000` if you prefer auto-refresh during styling iterations.
- Deployment relies on GitHub Pages; push to `main` and confirm the build passes in repository settings.

## Coding Style & Naming Conventions
- HTML: follow semantic elements (e.g., `<section>`, `<article>`) and indent nested blocks with four spaces. Keep class names descriptive (e.g., `hero-content`) and consistent with existing naming.
- CSS: prefer custom properties defined in `:root` for shared colors and shadows. Group selectors by section and order declarations: layout, spacing, typography, effects.
- Maintain a light DOM: avoid inline scripts; place future JavaScript in `assets/js/` and wrap logic in `DOMContentLoaded`.

## Testing Guidelines
- Manual checks: validate layout at 320px, 768px, and 1280px widths, plus both light and dark OS themes.
- Accessibility: run `npx @axe-core/cli http://localhost:4000` or browser dev tools to confirm contrast, landmarks, and keyboard navigation.
- HTML validation: `npx htmlhint index.html` before submitting major structural changes.

## Commit & Pull Request Guidelines
- Use short, imperative commit messages (`Improve hero spacing`, `Add testimonials section`), mirroring the existing Git history.
- Each PR should include: 1) concise summary of the change, 2) screenshots or screen recordings when visuals shift, 3) notes on accessibility or performance considerations.
- Reference related issues with `Closes #ID` and call out any follow-up tasks explicitly.

## Deployment & Configuration Tips
- After merging, allow GitHub Pages a few minutes to refresh. Verify the live site matches local output and purge browser caches if styles appear outdated.
- For asset-heavy updates, compress images beforehand and run them through an optimizer to keep load times snappy.
