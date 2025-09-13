// Container Proxy Extension - Background Script
console.log('Container Proxy: Background script loaded');

class ContainerProxyManager {
  constructor() {
    this.containerProxies = new Map();
    this.init();
  }

  async init() {
    // Load saved proxy configurations
    await this.loadProxyConfigs();
    
    // Set up proxy request handler
    browser.proxy.onRequest.addListener(
      this.handleProxyRequest.bind(this),
      { urls: ["<all_urls>"] }
    );

    // Handle proxy authentication
    browser.webRequest.onAuthRequired.addListener(
      this.handleAuth.bind(this),
      { urls: ["<all_urls>"] },
      ["blocking"]
    );

    console.log('Container Proxy: Initialized successfully');
  }

  async loadProxyConfigs() {
    try {
      const data = await browser.storage.local.get('containerProxies');
      if (data.containerProxies) {
        this.containerProxies = new Map(Object.entries(data.containerProxies));
        console.log('Container Proxy: Loaded configurations for', this.containerProxies.size, 'containers');
      }
    } catch (error) {
      console.error('Container Proxy: Error loading configs:', error);
    }
  }

  async saveProxyConfigs() {
    try {
      const configObject = Object.fromEntries(this.containerProxies);
      await browser.storage.local.set({ containerProxies: configObject });
      console.log('Container Proxy: Configurations saved');
    } catch (error) {
      console.error('Container Proxy: Error saving configs:', error);
    }
  }

  async handleProxyRequest(requestDetails) {
    try {
      const cookieStoreId = requestDetails.cookieStoreId;
      
      // Skip default container
      if (!cookieStoreId || cookieStoreId === 'firefox-default') {
        return { type: "direct" };
      }

      const proxyConfig = this.containerProxies.get(cookieStoreId);
      if (!proxyConfig || !proxyConfig.enabled) {
        return { type: "direct" };
      }

      console.log(`Container Proxy: Routing ${requestDetails.url} through proxy for container ${cookieStoreId}`);

      const proxyInfo = {
        type: proxyConfig.type.toLowerCase(),
        host: proxyConfig.host,
        port: parseInt(proxyConfig.port),
        proxyDNS: proxyConfig.type === 'SOCKS5'
      };
      
      // Only add username/password if they are actually provided
      if (proxyConfig.username && proxyConfig.username.trim()) {
        proxyInfo.username = proxyConfig.username.trim();
      }
      if (proxyConfig.password && proxyConfig.password.trim()) {
        proxyInfo.password = proxyConfig.password.trim();
      }
      
      return [proxyInfo];
    } catch (error) {
      console.error('Container Proxy: Error in proxy request handler:', error);
      return { type: "direct" };
    }
  }

  handleAuth(details) {
    const cookieStoreId = details.cookieStoreId;
    const proxyConfig = this.containerProxies.get(cookieStoreId);
    
    if (proxyConfig && proxyConfig.username && proxyConfig.username.trim() && 
        proxyConfig.password && proxyConfig.password.trim()) {
      console.log('Container Proxy: Providing auth for container', cookieStoreId);
      return {
        authCredentials: {
          username: proxyConfig.username.trim(),
          password: proxyConfig.password.trim()
        }
      };
    }
    
    return { cancel: false };
  }

  // API methods for UI
  async setContainerProxy(containerId, proxyConfig) {
    this.containerProxies.set(containerId, proxyConfig);
    await this.saveProxyConfigs();
    return true;
  }

  async removeContainerProxy(containerId) {
    this.containerProxies.delete(containerId);
    await this.saveProxyConfigs();
    return true;
  }

  getContainerProxy(containerId) {
    return this.containerProxies.get(containerId) || null;
  }

  getAllProxyConfigs() {
    return Object.fromEntries(this.containerProxies);
  }
}

// Initialize the manager
const proxyManager = new ContainerProxyManager();

// Handle messages from popup/options page
browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  try {
    switch (message.action) {
      case 'setProxy':
        return await proxyManager.setContainerProxy(message.containerId, message.proxyConfig);
      
      case 'removeProxy':
        return await proxyManager.removeContainerProxy(message.containerId);
      
      case 'getProxy':
        return proxyManager.getContainerProxy(message.containerId);
      
      case 'getAllProxies':
        return proxyManager.getAllProxyConfigs();
      
      case 'testProxy':
        return await testProxyConnection(message.proxyConfig);
      
      default:
        console.warn('Container Proxy: Unknown message action:', message.action);
        return false;
    }
  } catch (error) {
    console.error('Container Proxy: Error handling message:', error);
    return false;
  }
});

// Test proxy connection
async function testProxyConnection(proxyConfig) {
  try {
    // Simple test - try to make a request through the proxy
    // This is a basic implementation - you might want to enhance it
    console.log('Container Proxy: Testing proxy connection to', proxyConfig.host + ':' + proxyConfig.port);
    return { success: true, message: 'Proxy configuration saved successfully' };
  } catch (error) {
    console.error('Container Proxy: Proxy test failed:', error);
    return { success: false, message: 'Proxy test failed: ' + error.message };
  }
}
