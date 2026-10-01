const test = require("node:test");
const assert = require("node:assert/strict");
const { fixture, proxy } = require("./helpers.cjs");

test("host normalization handles DNS, IDNs and IPv6 without accepting URLs or ports", () => {
  const { config } = fixture();
  for (const [input, expected] of [["PROXY.EXAMPLE.COM.", "proxy.example.com"], ["localhost", "localhost"], ["[2001:0db8::1]", "2001:db8::1"], ["2001:db8::1", "2001:db8::1"], ["bücher.example", "xn--bcher-kva.example"]]) {
    assert.equal(config.normalizeHost(input), expected);
  }
  for (const host of ["", "https://proxy.example", "user@proxy.example", "proxy.example/path", "proxy.example:8080", "[::1]:80", "proxy.example?x", "proxy.example#x", "proxy.example\\x", "%70roxy.example", "proxy example"]) {
    assert.throws(() => config.normalizeHost(host));
  }
});

test("all entry points use strict ports, types, credentials and flags", () => {
  const { config } = fixture();
  for (const overrides of [{ port: "8080junk" }, { port: 65536 }, { port: 0 }, { port: 1.5 }, { port: true }, { type: "PAC" }, { type: "__proto__" }, { username: {} }, { password: 123 }, { password: "\n" }, { enabled: "false" }, { label: "x".repeat(121) }, { type: "SOCKS5", username: "é".repeat(128) }]) {
    assert.throws(() => config.normalize(proxy(overrides)));
  }
  assert.equal(config.normalize(proxy({ type: "socks" })).type, "SOCKS5");
});

test("backups omit credentials by default, include them only explicitly, and preserve paused state", () => {
  const { config } = fixture();
  const containers = [{ cookieStoreId: "firefox-container-1", name: "Work", color: "blue" }];
  const proxies = { "firefox-container-1": proxy({ enabled: false }) };
  const safe = config.makeBackup(containers, proxies, "1.1.0");
  assert.equal(safe.includesCredentials, false);
  assert.equal(safe.containers[0].proxy.username, "");
  assert.equal(safe.containers[0].proxy.password, "");
  assert.equal(safe.containers[0].proxy.enabled, false);
  const secret = config.makeBackup(containers, proxies, "1.1.0", true);
  assert.equal(secret.containers[0].proxy.password, " secret ");
  assert.equal(proxies["firefox-container-1"].password, " secret ");
});

test("imports reject ambiguous names, duplicates, unsupported schemas and empty assignments", () => {
  const { config } = fixture();
  const containers = [{ cookieStoreId: "firefox-container-1", name: "Work" }];
  const entry = { name: "Work", proxy: proxy() };
  for (const value of [{}, { schemaVersion: 99, containers: [entry] }, { format: "foxyproxy", containers: [entry] }, { containers: [entry, entry] }, { containers: [{ name: "Missing", proxy: proxy() }] }, { containers: [] }]) {
    assert.throws(() => config.parseBackup(value, containers));
  }
  assert.throws(() => config.parseBackup({ containers: [entry] }, [...containers, { cookieStoreId: "firefox-container-2", name: "Work" }]));
});
