"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const message = (text, error = false) => window.ui.showMessage(text, error, "backupStatus");
  document.getElementById("extensionVersion").textContent = browser.runtime.getManifest().version;
  document.getElementById("exportConfig").addEventListener("click", async () => {
    try {
      const includeCredentials = document.getElementById("includeCredentials").checked;
      if (includeCredentials && !confirm("This file will contain proxy usernames and passwords in plain text. Save it in a private location and do not share it. Continue?")) return;
      const state = await window.ui.request({ action: "getState" });
      const containers = await browser.contextualIdentities.query({});
      if (Object.values(state.proxies).some(proxy => proxy.invalid)) throw new Error("Repair or remove invalid proxy settings before exporting.");
      const backup = ContainerProxyConfig.makeBackup(containers, state.proxies, browser.runtime.getManifest().version, includeCredentials);
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "container-proxy-" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      message(includeCredentials ? "Backup exported with plain text credentials." : "Backup exported without credentials. Re-enter credentials after restoring.");
      document.getElementById("includeCredentials").checked = false;
    } catch (error) { message(error.message, true); }
  });
  document.getElementById("importConfig").addEventListener("click", () => document.getElementById("importFile").click());
  document.getElementById("importFile").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;
    const button = document.getElementById("importConfig");
    button.disabled = true;
    try {
      if (file.size > ContainerProxyConfig.MAX_IMPORT_BYTES) throw new Error("Backup is too large (maximum 1 MiB).");
      let backup;
      try { backup = JSON.parse(await file.text()); } catch { throw new Error("The file is not valid JSON."); }
      const containers = await browser.contextualIdentities.query({});
      const entries = ContainerProxyConfig.parseBackup(backup, containers);
      const names = entries.map(entry => containers.find(container => container.cookieStoreId === entry.containerId).name);
      const credentials = entries.some(entry => entry.proxyConfig.username || entry.proxyConfig.password);
      const warning = "Replace proxy assignments for: " + names.join(", ") + "?\n\n" +
        "This changes where these containers send new requests." +
        (credentials ? " The file contains plain text credentials." : " Re-enter credentials after restoring if needed.") +
        "\nOnly import backups you trust.";
      if (!confirm(warning)) return;
      const result = await window.ui.request({ action: "importConfig", backup });
      await window.ui.refresh();
      message(result.imported + " proxy assignments imported. Reload existing tabs to use the updated routes.");
    } catch (error) { message(error.message, true); }
    finally { event.target.value = ""; button.disabled = false; }
  });
});
