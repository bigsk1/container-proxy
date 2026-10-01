/* Firefox MV3 event page: register listeners synchronously on every wake. */
"use strict";

class ContainerProxyManager {
  constructor() {
    this.config = ContainerProxyConfig;
    this.containerProxies = new Map();
    this.invalidContainers = new Set();
    this.storageError = false;
    this.authAttempts = new Set();
    this.updates = Promise.resolve();
    const filter = { urls: ["<all_urls>"] };

    browser.proxy.onRequest.addListener(details => this.handleProxyRequest(details), filter);
    browser.webRequest.onBeforeRequest.addListener(details => this.guardRequest(details), filter, ["blocking"]);
    browser.webRequest.onAuthRequired.addListener(details => this.handleAuth(details), filter, ["blocking"]);
    const completed = details => this.authAttempts.delete(details.requestId);
    browser.webRequest.onCompleted.addListener(completed, filter);
    browser.webRequest.onErrorOccurred.addListener(completed, filter);
    browser.runtime.onMessage.addListener((message, sender) => this.handleMessage(message, sender));
    browser.contextualIdentities.onRemoved.addListener(({ contextualIdentity }) => {
      this.removeContainerProxy(contextualIdentity.cookieStoreId).catch(() => {});
    });

    this.ready = this.loadProxyConfigs();
  }

  async loadProxyConfigs() {
    try {
      const { containerProxies = {} } = await browser.storage.local.get("containerProxies");
      if (!this.config.record(containerProxies)) throw new Error("Invalid stored settings.");
      for (const [id, value] of Object.entries(containerProxies)) {
        try {
          this.config.containerId(id);
        } catch {
          continue; // Old orphan/default entries never become container routes.
        }
        try {
          this.containerProxies.set(id, this.config.normalize(value));
        } catch {
          // Keep the original setting so editing another container cannot erase it.
          // Treat malformed saved routes as blocked until repaired or removed.
          this.containerProxies.set(id, value);
          this.invalidContainers.add(id);
        }
      }
    } catch {
      this.storageError = true;
    }
  }

  async guardRequest(details) {
    await this.ready;
    const id = details.cookieStoreId;
    if (!id || !/^firefox-container-\d+$/.test(id)) return {};
    return this.storageError || this.invalidContainers.has(id) ? { cancel: true } : {};
  }

  async handleProxyRequest(details) {
    await this.ready;
    const id = details.cookieStoreId;
    if (this.storageError || this.invalidContainers.has(id)) return null; // guardRequest cancels before sending.
    const proxy = this.containerProxies.get(id);
    if (!proxy || !proxy.enabled) return null; // Respect Firefox's existing routing for unassigned contexts.
    // A trailing null stops Firefox falling back to a browser-defined proxy/direct connection.
    return [this.config.proxyInfo(proxy, id), null];
  }

  async handleAuth(details) {
    await this.ready;
    if (details.isProxy !== true || this.storageError || this.invalidContainers.has(details.cookieStoreId)) return {};
    const proxy = this.containerProxies.get(details.cookieStoreId);
    if (!proxy?.enabled || !["HTTP", "HTTPS"].includes(proxy.type) || !proxy.username) return {};
    try {
      const matches = endpoint => endpoint && this.config.normalizeHost(endpoint.host) === proxy.host && endpoint.port === proxy.port;
      // Check both the challenger and the proxy Firefox actually selected. This also
      // prevents a late challenge from an old endpoint receiving a new proxy's secrets.
      if (!matches(details.challenger) || !matches(details.proxyInfo) || details.proxyInfo.type !== this.config.TYPES[proxy.type]) return {};
    } catch {
      return {};
    }
    if (typeof details.requestId !== "string") return {};
    if (this.authAttempts.has(details.requestId) || this.authAttempts.size >= 10000) return { cancel: true };
    this.authAttempts.add(details.requestId);
    return { authCredentials: { username: proxy.username, password: proxy.password } };
  }

  queueUpdate(operation) {
    const result = this.updates.then(async () => {
      await this.ready;
      if (this.storageError) throw new Error("Saved settings could not be loaded. Restart Firefox before making changes.");
      return operation();
    });
    this.updates = result.catch(() => {});
    return result;
  }

  async persist(next, invalid = this.invalidContainers) {
    try {
      await browser.storage.local.set({ containerProxies: Object.fromEntries(next) });
    } catch {
      throw new Error("Firefox could not save your settings. No changes were applied.");
    }
    // Publish only after storage succeeds. Queued mutations cannot lose each other's changes.
    this.containerProxies = next;
    this.invalidContainers = invalid;
  }

  async requireContainer(id) {
    this.config.containerId(id);
    try {
      await browser.contextualIdentities.get(id);
    } catch {
      throw new Error("This container no longer exists. Refresh and choose another.");
    }
  }

  setContainerProxy(id, value) {
    return this.queueUpdate(async () => {
      await this.requireContainer(id);
      const normalized = this.config.normalize(value);
      const next = new Map(this.containerProxies);
      next.set(id, normalized);
      const invalid = new Set(this.invalidContainers);
      invalid.delete(id);
      await this.persist(next, invalid);
    });
  }

  removeContainerProxy(id) {
    return this.queueUpdate(async () => {
      this.config.containerId(id);
      const next = new Map(this.containerProxies);
      next.delete(id);
      const invalid = new Set(this.invalidContainers);
      invalid.delete(id);
      await this.persist(next, invalid);
    });
  }

  importConfigs(backup) {
    return this.queueUpdate(async () => {
      const containers = await browser.contextualIdentities.query({});
      const entries = this.config.parseBackup(backup, containers);
      const next = new Map(this.containerProxies);
      const invalid = new Set(this.invalidContainers);
      for (const { containerId, proxyConfig } of entries) {
        next.set(containerId, proxyConfig);
        invalid.delete(containerId);
      }
      await this.persist(next, invalid);
      return entries.length;
    });
  }

  async handleMessage(message, sender) {
    // Only this extension's own UI pages may read secrets or change routes.
    const root = browser.runtime.getURL("");
    if (sender.id !== browser.runtime.id || ![`${root}popup.html`, `${root}options.html`].includes(sender.url)) return undefined;
    try {
      await this.ready;
      if (!this.config.record(message)) throw new Error("Invalid request.");
      switch (message.action) {
        case "getState": {
          if (this.storageError) throw new Error("Saved settings could not be loaded. Container requests are blocked; restart Firefox to retry.");
          // Read after pending changes so open UI never sees partially saved state.
          await this.updates;
          const proxies = Object.fromEntries([...this.containerProxies].map(([id, value]) => [id, this.invalidContainers.has(id) ? { invalid: true, enabled: true } : value]));
          const hasPermission = await browser.permissions.contains({ origins: ["<all_urls>"] });
          return { ok: true, proxies, hasPermission };
        }
        case "setProxy":
          await this.setContainerProxy(message.containerId, message.proxyConfig);
          return { ok: true };
        case "removeProxy":
          await this.removeContainerProxy(message.containerId);
          return { ok: true };
        case "toggleProxy":
          await this.queueUpdate(async () => {
            await this.requireContainer(message.containerId);
            const value = this.containerProxies.get(message.containerId);
            if (!value || this.invalidContainers.has(message.containerId)) throw new Error("Edit this proxy before enabling it.");
            const next = new Map(this.containerProxies);
            next.set(message.containerId, { ...value, enabled: !value.enabled });
            await this.persist(next);
          });
          return { ok: true };
        case "importConfig":
          if (JSON.stringify(message.backup).length > this.config.MAX_IMPORT_BYTES) throw new Error("Backup is too large (maximum 1 MiB).");
          return { ok: true, imported: await this.importConfigs(message.backup) };
        default:
          throw new Error("Unknown request.");
      }
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }
}

const proxyManager = new ContainerProxyManager();
