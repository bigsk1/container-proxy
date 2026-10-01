"use strict";

class ContainerProxyUI {
  constructor() {
    this.containers = [];
    this.proxies = {};
    this.hasPermission = false;
    this.loading = true;
    this.refreshSequence = 0;
    this.dialog = document.getElementById("proxyModal");
    this.setupEventListeners();
    this.ready = this.refresh();
  }

  async request(message) {
    const response = await browser.runtime.sendMessage(message);
    if (!response?.ok) throw new Error(response?.error || "The extension could not respond. Try Refresh.");
    return response;
  }

  showMessage(message, error = false, target = "statusMessage") {
    const element = document.getElementById(target);
    element.textContent = message;
    element.classList.toggle("error", error);
    element.hidden = !message;
  }

  async refresh() {
    const sequence = ++this.refreshSequence;
    try {
      const [containers, state, tabs] = await Promise.all([
        browser.contextualIdentities.query({}), this.request({ action: "getState" }),
        browser.tabs.query({ active: true, currentWindow: true })
      ]);
      if (sequence !== this.refreshSequence) return;
      this.containers = containers;
      this.proxies = state.proxies;
      this.hasPermission = state.hasPermission;
      this.currentContainer = tabs[0]?.cookieStoreId;
      this.loading = false;
      document.getElementById("permissionNotice").hidden = this.hasPermission;
      if (document.getElementById("statusMessage").classList.contains("error")) this.showMessage("");
      this.renderContainers();
      document.getElementById("addProxy").disabled = !containers.length;
    } catch (error) {
      if (sequence !== this.refreshSequence) return;
      this.loading = true;
      document.getElementById("addProxy").disabled = true;
      document.getElementById("containerList").replaceChildren();
      this.showMessage(error.message, true);
      document.getElementById("summary").textContent = "Settings unavailable";
    }
  }

  setupEventListeners() {
    document.getElementById("refresh").addEventListener("click", () => this.refresh());
    document.getElementById("openOptions")?.addEventListener("click", () => browser.runtime.openOptionsPage());
    document.getElementById("addProxy").addEventListener("click", () => this.showProxyModal());
    document.getElementById("grantPermission").addEventListener("click", () => {
      // Request directly in the click event so Firefox recognizes the user gesture.
      browser.permissions.request({ origins: ["<all_urls>"] }).then(granted => {
        if (!granted) throw new Error("Website access is required for container proxy routing.");
        return this.refresh();
      }).catch(error => this.showMessage(error.message, true));
    });
    document.getElementById("containerList").addEventListener("click", event => {
      const button = event.target.closest("button[data-action]");
      if (button) this.runAction(button);
    });
    document.getElementById("closeModal").addEventListener("click", () => this.dialog.close());
    document.getElementById("cancelProxy").addEventListener("click", () => this.dialog.close());
    this.dialog.addEventListener("close", () => {
      document.getElementById("proxyForm").reset();
      document.getElementById("proxyPassword").type = "password";
      document.getElementById("showPassword").checked = false;
      this.showMessage("", false, "formStatus");
      this.currentEditingContainer = null;
    });
    document.getElementById("showPassword").addEventListener("change", event => {
      document.getElementById("proxyPassword").type = event.target.checked ? "text" : "password";
    });
    document.getElementById("validateProxy").addEventListener("click", () => {
      try {
        this.readForm();
        this.showMessage("Settings are valid. This does not test the connection.", false, "formStatus");
      } catch (error) { this.showMessage(error.message, true, "formStatus"); }
    });
    document.getElementById("proxyForm").addEventListener("submit", event => {
      event.preventDefault();
      this.saveProxy();
    });
    const changed = () => this.refresh();
    browser.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.containerProxies) changed();
    });
    browser.contextualIdentities.onCreated.addListener(changed);
    browser.contextualIdentities.onUpdated.addListener(changed);
    browser.contextualIdentities.onRemoved.addListener(changed);
    browser.permissions.onAdded.addListener(changed);
    browser.permissions.onRemoved.addListener(changed);
  }

  renderContainers() {
    const list = document.getElementById("containerList");
    list.replaceChildren();
    const enabled = this.containers.filter(container => this.proxies[container.cookieStoreId]?.enabled && !this.proxies[container.cookieStoreId]?.invalid).length;
    document.getElementById("summary").textContent = this.containers.length + " containers · " + enabled + " proxies enabled";
    if (!this.containers.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Create a container from Firefox’s new tab button, then assign a proxy here.";
      list.append(empty);
      return;
    }
    for (const container of this.containers) {
      const proxy = this.proxies[container.cookieStoreId];
      const item = document.createElement("article");
      item.className = "container-item";
      if (container.cookieStoreId === this.currentContainer) item.classList.add("current");
      const info = document.createElement("div");
      info.className = "container-info";
      const dot = document.createElement("span");
      dot.className = "container-color";
      dot.style.backgroundColor = container.colorCode || "#72818d";
      dot.setAttribute("aria-hidden", "true");
      const details = document.createElement("div");
      details.className = "container-details";
      const name = document.createElement("h2");
      name.textContent = container.name;
      if (container.cookieStoreId === this.currentContainer) {
        const current = document.createElement("span");
        current.className = "current-label";
        current.textContent = "Current tab";
        name.append(current);
      }
      const endpoint = document.createElement("p");
      endpoint.className = "endpoint";
      endpoint.textContent = proxy?.invalid ? "Saved settings need repair" : proxy ?
        proxy.type + " · " + (proxy.host.includes(":") ? "[" + proxy.host + "]" : proxy.host) + ":" + proxy.port : "Uses Firefox routing";
      const status = document.createElement("p");
      status.className = "route-status";
      status.textContent = proxy?.invalid ? "Blocked until edited or removed" : proxy?.enabled ? this.hasPermission ?
        "Proxy enabled · no direct fallback" : "Routing unavailable · grant website access" : proxy ? "Paused · uses Firefox routing" : "No proxy assigned";
      status.classList.toggle("enabled", !!proxy?.enabled && !proxy.invalid && this.hasPermission);
      details.append(name, endpoint, status);
      if (proxy?.label) {
        const label = document.createElement("p");
        label.className = "proxy-label";
        label.textContent = proxy.label;
        details.append(label);
      }
      info.append(dot, details);
      const actions = document.createElement("div");
      actions.className = "container-actions";
      const addButton = (action, label, className = "") => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn btn-small " + className;
        button.textContent = label;
        button.dataset.action = action;
        button.dataset.container = container.cookieStoreId;
        button.setAttribute("aria-label", label + ": " + container.name);
        actions.append(button);
      };
      addButton("open", "New tab");
      if (proxy) {
        if (!proxy.invalid) addButton("toggle", proxy.enabled ? "Pause" : "Enable");
        addButton("edit", "Edit", "btn-primary");
        addButton("remove", "Remove", "btn-danger");
      } else addButton("edit", "Assign proxy", "btn-primary");
      item.append(info, actions);
      list.append(item);
    }
  }

  async runAction(button) {
    button.disabled = true;
    const id = button.dataset.container;
    try {
      switch (button.dataset.action) {
        case "open":
          await browser.tabs.create({ cookieStoreId: id });
          break;
        case "edit":
          this.showProxyModal(id);
          break;
        case "toggle":
          if (this.proxies[id].enabled && !confirm("Pause this proxy? This container will use Firefox’s normal routing. Reload existing tabs after changing routing.")) break;
          await this.request({ action: "toggleProxy", containerId: id });
          await this.refresh();
          this.showMessage("Routing updated. Reload existing tabs to apply it to new requests.");
          break;
        case "remove":
          if (!confirm("Remove this proxy? This container will use Firefox’s normal routing.")) break;
          await this.request({ action: "removeProxy", containerId: id });
          await this.refresh();
          this.showMessage("Proxy removed.");
          break;
      }
    } catch (error) { this.showMessage(error.message, true); }
    finally { button.disabled = false; }
  }

  showProxyModal(id = null) {
    if (this.loading) return;
    this.currentEditingContainer = id;
    const form = document.getElementById("proxyForm");
    form.reset();
    this.showMessage("", false, "formStatus");
    const select = document.getElementById("containerSelect");
    select.replaceChildren();
    for (const container of this.containers) {
      const option = document.createElement("option");
      option.value = container.cookieStoreId;
      option.textContent = container.name;
      select.append(option);
    }
    select.disabled = !!id;
    if (id) select.value = id;
    const proxy = id && this.proxies[id];
    document.getElementById("modalTitle").textContent = proxy ? "Edit proxy" : "Assign a proxy";
    if (proxy && !proxy.invalid) {
      for (const [field, key] of [["proxyType", "type"], ["proxyHost", "host"], ["proxyPort", "port"], ["proxyLabel", "label"], ["proxyUsername", "username"], ["proxyPassword", "password"]]) {
        document.getElementById(field).value = proxy[key] ?? "";
      }
      document.getElementById("proxyEnabled").checked = proxy.enabled;
    }
    this.dialog.showModal();
    document.getElementById("proxyHost").focus();
  }

  readForm() {
    return ContainerProxyConfig.normalize({
      type: document.getElementById("proxyType").value, host: document.getElementById("proxyHost").value,
      port: document.getElementById("proxyPort").value, label: document.getElementById("proxyLabel").value,
      username: document.getElementById("proxyUsername").value, password: document.getElementById("proxyPassword").value,
      enabled: document.getElementById("proxyEnabled").checked
    });
  }

  async saveProxy() {
    const save = document.getElementById("saveProxy");
    save.disabled = true;
    try {
      await this.request({ action: "setProxy", containerId: document.getElementById("containerSelect").value, proxyConfig: this.readForm() });
      this.dialog.close();
      await this.refresh();
      this.showMessage("Proxy saved. Reload existing tabs to use the updated route.");
    } catch (error) { this.showMessage(error.message, true, "formStatus"); }
    finally { save.disabled = false; }
  }
}

document.addEventListener("DOMContentLoaded", () => { window.ui = new ContainerProxyUI(); });
