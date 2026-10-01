# Privacy policy — Container Proxy 1.1.0

Container Proxy assigns user-selected proxy servers to Firefox containers. It has no analytics, advertising, telemetry, remote code, developer-operated backend, automatic IP-check service, or browsing-history log.

## Local information

Proxy protocol, hostname/IP, port, optional label, enabled state, username and password are saved locally in the Firefox profile using browser.storage.local. The extension does not encrypt this storage and does not use Firefox Sync. Someone who can read your profile files may be able to read these settings.

The extension reads container identities and cookie-store IDs to select the correct route. It does not read cookie contents or retain requested website URLs. The extension’s popup and settings pages can read its own saved proxy settings.

## Network information

Firefox sends requests through the proxy you configure. The proxy receives destination metadata and can see traffic that is not protected by end-to-end encryption. HTTP and SOCKS protocols do not independently encrypt the transport to the proxy; HTTPS proxy transport uses TLS.

Proxy credentials are supplied to configured SOCKS proxies through Firefox’s proxy API, or to enabled HTTP/HTTPS proxies after checking the proxy authentication challenge and selected endpoint. The extension does not send proxy credentials to website authentication challenges.

The author receives none of this information. Container Proxy declares no data collection in Firefox’s manifest consent system.

## Backups and deletion

Exported backups omit usernames and passwords by default. If you explicitly include credentials, the downloaded JSON contains them in plain text. The extension does not upload backups. Imports are user-selected local files and require confirmation before replacing matching container assignments.

Use **Remove** to delete an assignment. Removing a Firefox container removes its assignment. Uninstalling the extension normally removes its local extension storage; downloaded backups remain where you saved them and must be deleted separately.

## Limits

Container Proxy covers supported Firefox proxy requests. It does not provide a system VPN or protect WebRTC UDP, other applications, every system request, or traffic while the extension lacks website access or is disabled. Paused or unassigned containers, default tabs and private windows retain Firefox’s existing routing.

For questions, use this repository’s issue tracker. Do not post passwords, credential-bearing backups or private browsing information in public issues.
