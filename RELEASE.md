# Releasing Container Proxy 1.1.0

## Validation recorded on October 1, 2026

- All 16 automated regression tests passed.
- Mozilla web-ext 10.7.0 reported zero errors, notices and warnings.
- The npm dependency audit reported zero known vulnerabilities; all packages are development dependencies.
- Browser UI checks covered first load, safe text rendering, editing/saving, cleared password fields and light/dark options pages.
- Firefox 157.0 installed the temporary add-on and loaded its popup successfully. A local HTTP proxy authenticated with exact credential whitespace. An unavailable assigned proxy did not send a direct request to a local destination.
- Forced MV3 background suspension restored the saved route on the first container request without opening the popup; the first reopened popup showed the saved assignment.
- The built archive contains exactly nine allowlisted files, each matching the current source. It remains an unsigned submission artifact.

The real-browser checks used disposable credentials and a temporary Firefox profile. Hosted GitHub Actions, AMO review/signing, Firefox ESR 140 and the full protocol matrix below remain release checks.

## Prepare and test

Run the commands in README.md. Mozilla lint must report zero errors and warnings, and the dependency audit must report no known vulnerabilities. Review any dependency updates rather than applying audit fixes blindly.

Before publication, test in Firefox desktop 140 ESR and the current stable release with a disposable profile:

1. Upgrade from 1.0.3 with saved proxy assignments. Accept any added Firefox permissions. Confirm the first popup shows them and the first new container tab is routed immediately.
2. Verify HTTP, HTTPS and SOCKS5 with and without credentials, SOCKS4 where used, IPv4/IPv6 endpoints, remote DNS, and a real destination reporting the exit IP.
3. Stop a configured proxy. Confirm its container fails to connect instead of using ordinary routing; other unassigned containers retain Firefox’s configured behavior.
4. Confirm an origin authentication challenge does not receive proxy credentials, and genuine proxy authentication works. Incorrect credentials must stop retrying.
5. Check pause/resume, editing/removing routes, new tabs, container deletion and a browser restart. Reload existing tabs after changes.
6. Export without credentials; inspect the JSON. Explicitly export with credentials only using disposable secrets. Import legacy and new backups into matching and mismatched container profiles; malformed files must leave all assignments unchanged.
7. Check first-click loading, a missing website permission, empty containers, keyboard navigation, dialog focus/Escape, and light/dark themes.

Keep backups and real proxy credentials out of the repository and release archive.

## Build and submit

The build command creates web-ext-artifacts/container_proxy-1.1.0.zip containing only:

- manifest.json
- proxy-config.js and background.js
- popup.html, popup.js and popup.css
- options.html and options.js
- icon.svg

The source is plain, readable JavaScript/CSS/HTML; npm tools are not shipped. Preserve extension ID container-proxy@bigsk1.com.

In the AMO developer dashboard, choose the **existing listing**, upload this ZIP as a new version, provide CHANGELOG.md release notes and link the privacy policy. Explain the added cookies permission: container identity access needs it, and no cookie contents are read. Include the proxy authentication fix and the supported Firefox minimum in reviewer notes.

AMO performs its own validation, signing and review. Download the signed XPI when approved and test installation/update before publishing a GitHub release. A ZIP is the upload artifact; ordinary users need the signed XPI for permanent installation. A successful local lint does not guarantee approval.

## Store description notes

Use the current description from README.md. Remove claims that Firefox storage is encrypted by this extension, SOCKS encrypts proxy transport, connections are automatically tested, or every type of browser traffic is protected. Retain the existing listing URL; its slug containing 1.0.3 is independent of the uploaded version.
