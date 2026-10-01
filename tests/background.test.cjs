const test = require("node:test");
const assert = require("node:assert/strict");
const { fixture, deferred, proxy, plain } = require("./helpers.cjs");
const id = "firefox-container-1";

function challenge(overrides = {}) {
  return {
    cookieStoreId: id, isProxy: true, requestId: "auth-1",
    challenger: { host: "proxy.example.com", port: 8080 },
    proxyInfo: { host: "proxy.example.com", port: 8080, type: "http" },
    ...overrides
  };
}

test("first popup and first request wait for settings, with listeners already registered", async () => {
  const load = deferred();
  const { manager, browser, message } = fixture({}, { load });
  assert.equal(browser.proxy.onRequest.listeners.length, 1);
  assert.equal(browser.webRequest.onBeforeRequest.listeners.length, 1);
  assert.equal(browser.webRequest.onAuthRequired.listeners.length, 1);
  let loaded = false;
  const state = message({ action: "getState" }).then(result => { loaded = true; return result; });
  const route = manager.handleProxyRequest({ cookieStoreId: id });
  await Promise.resolve();
  assert.equal(loaded, false);
  load.resolve({ containerProxies: { [id]: proxy() } });
  assert.equal((await state).proxies[id].host, "proxy.example.com");
  const result = await route;
  assert.equal(result[0].host, "proxy.example.com");
  assert.equal(result[1], null);
});

test("origin auth never receives proxy credentials, including a matching host/port", async () => {
  const { manager } = fixture({ [id]: proxy() });
  for (const isProxy of [false, undefined, "true", 1]) {
    assert.deepEqual(plain(await manager.handleAuth(challenge({ isProxy }))), {});
  }
});

test("proxy auth requires an enabled HTTP/HTTPS route and both matching endpoints", async () => {
  const { manager } = fixture({ [id]: proxy() });
  const cases = [
    { challenger: undefined }, { challenger: { host: "attacker.example", port: 8080 } },
    { challenger: { host: "proxy.example.com.attacker.example", port: 8080 } },
    { challenger: { host: "proxy.example.com", port: 8081 } },
    { challenger: { host: "proxy.example.com/path", port: 8080 } },
    { challenger: { host: "proxy.example.com", port: "8080" } },
    { proxyInfo: undefined }, { proxyInfo: { host: "other.example", port: 8080, type: "http" } },
    { proxyInfo: { host: "proxy.example.com", port: 8080, type: "socks" } },
    { cookieStoreId: "firefox-default" }, { cookieStoreId: "firefox-container-99" }
  ];
  for (const overrides of cases) assert.deepEqual(plain(await manager.handleAuth(challenge(overrides))), {});
  for (const config of [proxy({ enabled: false }), proxy({ type: "SOCKS5" }), proxy({ username: "" , password: "" }), proxy({ username: 123 })]) {
    assert.deepEqual(plain(await fixture({ [id]: config }).manager.handleAuth(challenge())), {});
  }
});

test("legitimate proxy auth preserves whitespace, bounds retries, and cleans up", async () => {
  const { manager, browser } = fixture({ [id]: proxy({ username: " alice " }) });
  const first = await manager.handleAuth(challenge({ challenger: { host: "PROXY.EXAMPLE.COM.", port: 8080 } }));
  assert.deepEqual(plain(first), { authCredentials: { username: " alice ", password: " secret " } });
  assert.deepEqual(plain(await manager.handleAuth(challenge())), { cancel: true });
  await browser.webRequest.onCompleted.emit({ requestId: "auth-1" });
  assert.ok((await manager.handleAuth(challenge())).authCredentials);
  await browser.webRequest.onErrorOccurred.emit({ requestId: "auth-1" });
  assert.equal(manager.authAttempts.size, 0);
  const https = fixture({ [id]: proxy({ type: "HTTPS", password: "" }) });
  assert.deepEqual(plain(await https.manager.handleAuth(challenge({ proxyInfo: { host: "proxy.example.com", port: 8080, type: "https" } }))).authCredentials, { username: "alice", password: "" });
});

test("changing or removing a route cannot disclose new secrets to the previous endpoint", async () => {
  const { manager, message } = fixture({ [id]: proxy() });
  await manager.ready;
  await message({ action: "setProxy", containerId: id, proxyConfig: proxy({ host: "new.example.com", password: "new" }) });
  assert.deepEqual(plain(await manager.handleAuth(challenge())), {});
  await message({ action: "removeProxy", containerId: id });
  assert.deepEqual(plain(await manager.handleAuth(challenge({ challenger: { host: "new.example.com", port: 8080 } }))), {});
});

test("SOCKS types and remote DNS are correct; assigned routes have no direct fallback", async () => {
  for (const [type, expected] of [["HTTP", "http"], ["HTTPS", "https"], ["SOCKS5", "socks"], ["SOCKS4", "socks4"]]) {
    const { manager } = fixture({ [id]: proxy({ type, password: type === "SOCKS4" ? "" : " secret " }) });
    const result = await manager.handleProxyRequest({ cookieStoreId: id });
    assert.equal(result.length, 2);
    assert.equal(result[1], null);
    assert.equal(result[0].type, expected);
    assert.equal(result[0].port, 8080);
    assert.equal(result[0].connectionIsolationKey, id);
    if (type.startsWith("SOCKS")) {
      assert.equal(result[0].proxyDNS, type === "SOCKS5");
      assert.equal(result[0].username, "alice");
      if (type === "SOCKS5") assert.equal(result[0].password, " secret ");
    } else assert.equal(result[0].password, undefined);
  }
});

test("unassigned, default, private and paused contexts respect browser routing", async () => {
  const { manager } = fixture({ [id]: proxy({ enabled: false }), "firefox-default": proxy() });
  for (const cookieStoreId of [id, "firefox-default", "firefox-private", "firefox-container-2", undefined]) {
    assert.equal(await manager.handleProxyRequest({ cookieStoreId }), null);
    assert.deepEqual(plain(await manager.guardRequest({ cookieStoreId })), {});
  }
});

test("storage failures and invalid saved routes block container requests and remain visible", async () => {
  const load = deferred();
  const f = fixture({}, { load });
  load.reject(new Error("Disk failed."));
  assert.deepEqual(plain(await f.manager.guardRequest({ cookieStoreId: id })), { cancel: true });
  assert.equal((await f.message({ action: "getState" })).ok, false);
  assert.equal((await f.message({ action: "setProxy", containerId: id, proxyConfig: proxy() })).ok, false);
  const invalid = fixture({ [id]: proxy({ port: "8080junk" }) });
  assert.deepEqual(plain(await invalid.manager.guardRequest({ cookieStoreId: id })), { cancel: true });
  assert.equal((await invalid.message({ action: "getState" })).proxies[id].invalid, true);
  await invalid.message({ action: "setProxy", containerId: id, proxyConfig: proxy() });
  assert.deepEqual(plain(await invalid.manager.guardRequest({ cookieStoreId: id })), {});
});

test("failed persistence keeps the prior route and reports failure", async () => {
  const { manager, message, saved } = fixture({ [id]: proxy() }, { failSave: true });
  const result = await message({ action: "setProxy", containerId: id, proxyConfig: proxy({ host: "new.example.com" }) });
  assert.equal(result.ok, false);
  assert.equal((await manager.handleProxyRequest({ cookieStoreId: id }))[0].host, "proxy.example.com");
  assert.equal(saved()[id].host, "proxy.example.com");
});

test("concurrent mutations retain both routes and reject nonexistent/default containers", async () => {
  const { message, saved } = fixture();
  const results = await Promise.all([
    message({ action: "setProxy", containerId: id, proxyConfig: proxy() }),
    message({ action: "setProxy", containerId: "firefox-container-2", proxyConfig: proxy({ host: "second.example.com" }) })
  ]);
  assert.ok(results.every(result => result.ok));
  assert.equal(Object.keys(saved()).length, 2);
  for (const containerId of ["firefox-default", "__proto__", "firefox-container-99"]) {
    assert.equal((await message({ action: "setProxy", containerId, proxyConfig: proxy() })).ok, false);
  }
});

test("runtime messages from websites, other extensions or content scripts cannot read secrets", async () => {
  const { manager, sender } = fixture({ [id]: proxy() });
  for (const denied of [{ ...sender, url: "https://attacker.example/" }, { ...sender, id: "other" }, { ...sender, url: "moz-extension://test/content.js" }]) {
    assert.equal(await manager.handleMessage({ action: "getState" }, denied), undefined);
  }
});

test("import validates every assignment before writing; names prevent cross-profile ID collisions", async () => {
  const { message, saved } = fixture({ [id]: proxy() });
  const bad = { containers: [{ name: "Work", id, proxy: proxy({ host: "new.example.com" }) }, { name: "Personal", proxy: proxy({ port: 0 }) }] };
  assert.equal((await message({ action: "importConfig", backup: bad })).ok, false);
  assert.equal(saved()[id].host, "proxy.example.com");
  const good = { version: "1.0.0", containers: [{ name: "Personal", id, proxy: proxy({ host: "personal.example.com" }) }] };
  assert.equal((await message({ action: "importConfig", backup: good })).imported, 1);
  assert.equal(saved()["firefox-container-2"].host, "personal.example.com");
  assert.equal(saved()[id].host, "proxy.example.com");
});
