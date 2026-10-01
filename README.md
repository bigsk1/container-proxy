# Container Proxy

Assign a different HTTP, HTTPS, SOCKS5 or legacy SOCKS4 proxy to each Firefox container. Settings stay in your Firefox profile; the extension has no runtime dependencies, analytics or remote code.

Version **1.1.0** requires **Firefox 140 or later on desktop**. The extension ID remains container-proxy@bigsk1.com, so an approved update can reuse your existing installation and settings.

## Install and use

Install the signed add-on from [Mozilla Add-ons](https://addons.mozilla.org/en-US/firefox/addon/container-proxy-v1-0-3/). That URL is the existing listing; it will continue to show the published version until the new version is submitted and approved.

1. Create containers using Firefox’s new tab button or container settings.
2. Open the extension and choose **Assign proxy** for a container.
3. Enter the proxy protocol, hostname or IP, port, and optional label and credentials.
4. Save, then use **New tab** to open that container. Routing starts without opening the extension again.
5. Reload existing tabs after changing routes. Previously established connections are not disconnected by changing an assignment.

If Firefox has not granted website access, the popup displays **Grant website access**. Routing cannot work without that access. Updates adding permissions may need to be accepted in Firefox before the extension runs.

**Proxy enabled** means an assignment is enabled; it does not certify a successful connection. **Validate** checks the settings format. To check a connection, browse in a new container tab and use a destination you trust to verify the exit IP. The extension does not contact an external IP-check or test service automatically.

You can edit or pause routes in either the popup or the settings page. Paused, unassigned, default and private contexts use Firefox’s existing routing, including any browser-wide proxy configured separately.

## Protocols and protection

| Protocol | Connection to proxy | DNS handling |
| --- | --- | --- |
| HTTP | No transport encryption provided by the proxy protocol | Handled by the HTTP proxy for proxied destinations |
| HTTPS | TLS between Firefox and the proxy | Handled by the HTTP proxy for proxied destinations |
| SOCKS5 | No transport encryption provided by SOCKS itself | Remote DNS enabled for supported requests |
| SOCKS4 | Legacy protocol, no transport encryption or password authentication | Local DNS; use SOCKS5 for remote DNS |

HTTPS websites retain their own TLS protection when tunneled through a proxy. SOCKS5 is useful for remote DNS but is not encryption by itself. A proxy provider can observe metadata and any unencrypted traffic sent through it.

Enabled assignments return a proxy list ending with null, which [prevents Firefox’s fallback to a browser-defined proxy](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/proxy/onRequest). Invalid saved assignments are displayed as needing repair, and their container requests are blocked until repaired or removed. Storage read failures block intercepted container requests instead of treating them as unconfigured.

This is a browser proxy manager. It does not cover WebRTC UDP, other applications, every Firefox system request, or traffic outside Firefox’s proxy API. Revoking website access, disabling/uninstalling the extension, or another extension taking over routing removes its protection. Review Firefox’s WebRTC and proxy settings if you need stronger IP protection.

For a local Gluetun HTTP proxy, use the address and port reachable from Firefox, such as 127.0.0.1:8888 when that port is published on your machine. Use the authentication configured on your proxy.

## Backups

**Settings & backups** manages routes directly and imports/exports JSON backups.

- Usernames and passwords are excluded by default. Re-enter them after restoring if your proxy needs authentication.
- Including credentials requires an explicit checkbox and confirmation. That file contains plain text secrets; store it privately.
- Imports accept legacy Container Proxy backups and version 1 backups. All assignments are validated before one storage write.
- Containers are matched by unique name, rather than trusting container IDs from another Firefox profile. Create matching names before restoring.
- Imports show the affected containers and require confirmation before replacing their assignments. Unrelated assignments are preserved.

## Privacy and permissions

No telemetry, remote scripts, browsing logs, or developer-operated network services are used. Proxy hosts, labels and credentials are stored in browser.storage.local. **The extension does not encrypt this storage**; protect your Firefox profile and backups. See [PRIVACY.md](PRIVACY.md).

| Permission | Purpose |
| --- | --- |
| storage | Save local proxy assignments |
| contextualIdentities, cookies | Read/manage container identities and their cookie-store IDs; no cookie contents are read |
| proxy | Choose a proxy per request |
| webRequest, webRequestBlocking | Authenticate verified proxy challenges, cancel requests for invalid/unavailable settings, and clear auth retry state |
| all URLs | Route requests across sites, including subresources; proxy API routing requires host access |

The manifest declares no data collection through [Firefox’s built-in data-consent system](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/). HTTP/HTTPS proxy credentials are released only for a genuine proxy authentication challenge whose challenger and selected proxy match the enabled container assignment. SOCKS credentials are passed through the proxy API.

## Development and verification

Use Node.js 22 or later:

    npm ci --ignore-scripts
    npm test
    npm run lint
    npm audit --audit-level=low
    npm run build

Tests cover initialization, auth destination checks, protocol/DNS mapping, persistence errors, concurrent saves and backup validation. Mozilla’s web-ext is pinned in the lockfile and used only for development. The release bundle contains no npm packages.

For a temporary install, open about:debugging → **This Firefox** → **Load Temporary Add-on**, then select this directory’s manifest.json. This install disappears when Firefox closes.

The build creates web-ext-artifacts/container_proxy-1.1.0.zip from an explicit source-file allowlist. Submit that archive as a new version of the existing AMO listing. A ZIP is an upload artifact; ordinary Firefox release installations require Mozilla’s signed XPI. See [RELEASE.md](RELEASE.md) for the manual checks and submission steps.

GitHub Actions runs tests, Mozilla lint, dependency audit and packaging on pushes and pull requests. Dependabot checks development tools and pinned Actions weekly.

## Changes and reporting

See [CHANGELOG.md](CHANGELOG.md). Report ordinary issues using this repository’s issue tracker. For security reports, use GitHub’s private vulnerability reporting where available; see [SECURITY.md](SECURITY.md).

The interface improvements use familiar proxy-manager features such as pause/resume, labels, backups and direct container actions. No FoxyProxy code is included.

Licensed under [MIT](LICENSE).
