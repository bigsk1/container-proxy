const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function event() {
  const listeners = [];
  return { listeners, addListener: fn => listeners.push(fn), emit: (...args) => Promise.all(listeners.map(fn => fn(...args))) };
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fixture(settings = {}, options = {}) {
  let saved = structuredClone(settings);
  const containers = options.containers || [
    { cookieStoreId: "firefox-container-1", name: "Work", color: "blue" },
    { cookieStoreId: "firefox-container-2", name: "Personal", color: "green" }
  ];
  const browser = {
    runtime: { id: "test@container-proxy", getURL: file => "moz-extension://test/" + file, onMessage: event() },
    proxy: { onRequest: event() },
    webRequest: { onBeforeRequest: event(), onAuthRequired: event(), onCompleted: event(), onErrorOccurred: event() },
    permissions: { contains: async () => options.permission !== false },
    contextualIdentities: {
      query: async () => containers,
      get: async id => {
        const found = containers.find(container => container.cookieStoreId === id);
        if (!found) throw new Error("Unknown container.");
        return found;
      },
      onRemoved: event()
    },
    storage: {
      local: {
        get: () => options.load ? options.load.promise : Promise.resolve({ containerProxies: structuredClone(saved) }),
        set: async value => {
          if (options.failSave) throw new Error("Disk unavailable.");
          if (options.saveWait) await options.saveWait.promise;
          saved = structuredClone(value.containerProxies);
        }
      }
    }
  };
  const context = vm.createContext({ browser, URL, TextEncoder, console });
  for (const file of ["proxy-config.js", "background.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), context, { filename: file });
  }
  const manager = vm.runInContext("proxyManager", context);
  const config = context.ContainerProxyConfig;
  const sender = { id: browser.runtime.id, url: browser.runtime.getURL("popup.html") };
  return { browser, manager, config, saved: () => saved, message: data => manager.handleMessage(data, sender), sender };
}

const proxy = overrides => ({ type: "HTTP", host: "proxy.example.com", port: "8080", username: "alice", password: " secret ", enabled: true, ...overrides });
const plain = value => JSON.parse(JSON.stringify(value));
module.exports = { fixture, deferred, proxy, plain };
