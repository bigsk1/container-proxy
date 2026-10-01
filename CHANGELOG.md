# Changelog

## 1.1.0

- Fix the first-open popup and first-request startup race. Register MV3 event listeners synchronously and wait for stored assignments before reading or routing.
- Fix proxy credential disclosure through website authentication. Check genuine proxy challenges, enabled state, challenger and selected proxy endpoints; limit repeated authentication attempts.
- Correct SOCKS5’s Firefox API mapping to socks, preserve credential whitespace and enable remote DNS. Add explicit legacy SOCKS4 support.
- Prevent assigned routes from silently falling back to a browser-defined/direct route. Block intercepted container requests with invalid or unreadable saved settings.
- Validate proxy settings in the background; serialize writes and report failed saves without changing the active route.
- Improve popup and settings with direct editing, current-container context, new container tabs, pause/resume, explicit loading/errors, keyboard-accessible dialogs and dark mode.
- Replace the placeholder connection test with accurate settings validation.
- Exclude credentials from exports by default. Validate imports atomically and match containers by unique name, with a replacement preview.
- Remove browsing URL and credential-bearing configuration logs; correct privacy and transport-encryption claims.
- Preserve extension identity and valid 1.0.3 settings. Add required container cookie permissions, local-only CSP and Firefox’s no-data-collection declaration.
- Require Firefox 140+ on desktop; add Android consent-version metadata without claiming a supported mobile container UI.
- Add regression tests, locked development tools, CI checks, dependency updates and an allowlisted release build.

Users of earlier versions should consider rotating proxy passwords after updating: previous authentication handling could disclose them to websites visited in a credential-configured container. No exploitation is established by the code review.

## 1.0.3

Previously published release.
