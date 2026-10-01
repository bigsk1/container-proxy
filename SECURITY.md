# Security

Use the newest published version of Container Proxy on a maintained Firefox release. Version 1.1.0 addresses an authentication bug that could send configured proxy credentials to a website requesting origin authentication.

Please report suspected vulnerabilities through this repository’s **Security → Report a vulnerability** feature, if enabled. If unavailable, open an issue requesting a private reporting channel without posting exploit details, passwords or private backups.

Include the extension and Firefox versions, relevant configuration with credentials removed, reproduction steps and expected behavior. The repository does not promise a response deadline.

Security-sensitive areas include proxy credential release, startup/routing behavior, configuration validation, local secret handling, and release packaging. Proxy-provider behavior, WebRTC UDP and non-Firefox traffic are outside the extension’s routing boundary.
