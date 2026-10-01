/* Shared, dependency-free validation for UI, storage and runtime messages. */
globalThis.ContainerProxyConfig = (() => {
  "use strict";

  const TYPES = Object.freeze({ HTTP: "http", HTTPS: "https", SOCKS5: "socks", SOCKS4: "socks4" });
  const MAX_IMPORT_BYTES = 1024 * 1024;

  function record(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function normalizeHost(value) {
    if (typeof value !== "string") throw new Error("Enter a proxy hostname or IP address.");
    const host = value.trim();
    if (!host || host.length > 253 || /[\s/@?#\\%]/u.test(host)) {
      throw new Error("Use a hostname or IP address without a URL, path or credentials.");
    }
    if (host.startsWith("[") && !host.endsWith("]")) throw new Error("Enter the port in the separate port field.");
    let parsed;
    try {
      const address = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
      parsed = new URL(`http://${address}/`);
    } catch {
      throw new Error("Enter a valid proxy hostname or IP address.");
    }
    if (parsed.port || parsed.username || parsed.password || parsed.pathname !== "/") {
      throw new Error("Enter the port in the separate port field.");
    }
    const normalized = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
    if (!normalized.includes(":") && !normalized.split(".").every(part => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(part))) {
      throw new Error("Enter a valid proxy hostname.");
    }
    return normalized;
  }

  function text(value, name, maxLength) {
    if (value === undefined || value === null) return "";
    if (typeof value !== "string" || value.length > maxLength || /[\u0000-\u001f\u007f]/u.test(value)) {
      throw new Error(`${name} must be text without control characters (maximum ${maxLength} characters).`);
    }
    return value;
  }

  function normalize(value) {
    if (!record(value)) throw new Error("Invalid proxy configuration.");
    const inputType = typeof value.type === "string" ? value.type.toUpperCase() : "";
    const type = inputType === "SOCKS" ? "SOCKS5" : inputType;
    if (!Object.hasOwn(TYPES, type)) throw new Error("Choose HTTP, HTTPS, SOCKS5 or SOCKS4.");
    if ((typeof value.port !== "string" && typeof value.port !== "number") || !/^\d+$/.test(String(value.port))) {
      throw new Error("Port must be a whole number between 1 and 65535.");
    }
    const port = Number(value.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Port must be between 1 and 65535.");
    if (value.enabled !== undefined && typeof value.enabled !== "boolean") throw new Error("Enabled must be true or false.");
    const username = text(value.username, "Username", 1024);
    const password = text(value.password, "Password", 1024);
    if (!username && password) throw new Error("A password requires a username.");
    if (type === "SOCKS4" && password) throw new Error("SOCKS4 does not support password authentication. Use SOCKS5 instead.");
    if (type === "SOCKS5" && (new TextEncoder().encode(username).length > 255 || new TextEncoder().encode(password).length > 255)) {
      throw new Error("SOCKS5 credentials must each fit in 255 bytes.");
    }
    return { type, host: normalizeHost(value.host), port, label: text(value.label, "Label", 120).trim(), username, password, enabled: value.enabled ?? true };
  }

  function containerId(value) {
    if (typeof value !== "string" || !/^firefox-container-[1-9]\d*$/.test(value)) {
      throw new Error("Choose an existing Firefox container.");
    }
    return value;
  }

  function proxyInfo(config, id) {
    const proxy = { type: TYPES[config.type], host: config.host, port: config.port, connectionIsolationKey: id };
    if (config.type === "SOCKS5" || config.type === "SOCKS4") {
      proxy.proxyDNS = config.type === "SOCKS5";
      if (config.username) proxy.username = config.username;
      if (config.type === "SOCKS5" && config.username) proxy.password = config.password;
    }
    return proxy;
  }

  function makeBackup(containers, proxies, version, includeCredentials = false) {
    return {
      format: "container-proxy", schemaVersion: 1, version, timestamp: new Date().toISOString(),
      includesCredentials: includeCredentials,
      containers: containers.map(container => {
        const saved = proxies[container.cookieStoreId];
        const proxy = saved && !saved.invalid ? normalize(saved) : null;
        if (proxy && !includeCredentials) { proxy.username = ""; proxy.password = ""; }
        return { id: container.cookieStoreId, name: container.name, color: container.color, proxy };
      })
    };
  }

  function parseBackup(value, containers) {
    if (!record(value) || !Array.isArray(value.containers) || value.containers.length > 1000) {
      throw new Error("Choose a Container Proxy JSON backup with at most 1000 containers.");
    }
    if ((value.format !== undefined && value.format !== "container-proxy") || (value.schemaVersion !== undefined && value.schemaVersion !== 1)) {
      throw new Error("Unsupported backup format or schema version.");
    }
    const entries = [];
    const seen = new Set();
    // Resolve by unique name before ID: container IDs can refer to different identities in another profile.
    for (const entry of value.containers) {
      if (!record(entry) || typeof entry.name !== "string") throw new Error("Each backup entry needs a container name.");
      if (entry.proxy === null || entry.proxy === undefined) continue;
      const matches = containers.filter(container => container.name === entry.name);
      if (matches.length !== 1) throw new Error(`Create exactly one container named “${entry.name}” before importing.`);
      const id = containerId(matches[0].cookieStoreId);
      if (seen.has(id)) throw new Error("The backup contains duplicate container assignments.");
      seen.add(id);
      entries.push({ containerId: id, proxyConfig: normalize(entry.proxy) });
    }
    if (!entries.length) throw new Error("This backup has no proxy assignments to import.");
    return entries;
  }

  return Object.freeze({ TYPES, MAX_IMPORT_BYTES, record, normalizeHost, normalize, containerId, proxyInfo, makeBackup, parseBackup });
})();
