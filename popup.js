// Container Proxy - Popup JavaScript
class ContainerProxyUI {
    constructor() {
        this.containers = [];
        this.proxies = {};
        this.currentEditingContainer = null;
        this.init();
    }

    async init() {
        console.log('Container Proxy UI: Initializing...');
        await this.loadData();
        this.setupEventListeners();
        this.renderContainers();
    }

    async loadData() {
        try {
            // Load containers
            this.containers = await browser.contextualIdentities.query({});
            console.log('Loaded containers:', this.containers.length);

            // Load proxy configurations
            const response = await browser.runtime.sendMessage({ action: 'getAllProxies' });
            this.proxies = response || {};
            console.log('Loaded proxy configs:', Object.keys(this.proxies).length);
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load container data');
        }
    }

    setupEventListeners() {
        // Main buttons
        document.getElementById('openOptions').addEventListener('click', () => {
            browser.runtime.openOptionsPage();
        });

        document.getElementById('addProxy').addEventListener('click', () => {
            this.showProxyModal();
        });

        // Modal controls
        document.getElementById('closeModal').addEventListener('click', () => {
            this.hideProxyModal();
        });

        document.getElementById('cancelProxy').addEventListener('click', () => {
            this.hideProxyModal();
        });

        document.getElementById('testProxy').addEventListener('click', () => {
            this.testProxyConnection();
        });

        document.getElementById('proxyForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProxy();
        });

        // Close modal when clicking outside
        document.getElementById('proxyModal').addEventListener('click', (e) => {
            if (e.target.id === 'proxyModal') {
                this.hideProxyModal();
            }
        });
    }

    renderContainers() {
        const containerList = document.getElementById('containerList');
        
        if (this.containers.length === 0) {
            containerList.innerHTML = `
                <div class="loading">
                    <p>No containers found.</p>
                    <p>Create containers in Firefox to assign proxies.</p>
                </div>
            `;
            return;
        }

        const containerHTML = this.containers.map(container => {
            const proxy = this.proxies[container.cookieStoreId];
            const hasProxy = proxy && proxy.enabled;
            
            return `
                <div class="container-item ${hasProxy ? 'has-proxy' : ''}">
                    <div class="container-info">
                        <div class="container-icon" style="background-color: ${container.color}"></div>
                        <div class="container-details">
                            <h3>${this.escapeHtml(container.name)}</h3>
                            <p>${hasProxy ? `${proxy.type} - ${proxy.host}:${proxy.port}${proxy.label ? ` (${proxy.label})` : ''}` : 'No proxy assigned'}</p>
                        </div>
                    </div>
                    <div class="container-actions">
                        ${hasProxy ? 
                            `<span class="proxy-status enabled">Active</span>
                             <button class="btn btn-primary btn-small" data-action="edit" data-container="${container.cookieStoreId}">Edit</button>
                             <button class="btn btn-danger btn-small" data-action="remove" data-container="${container.cookieStoreId}">Remove</button>` :
                            `<button class="btn btn-primary btn-small" data-action="add" data-container="${container.cookieStoreId}" data-container-name="${this.escapeHtml(container.name)}">Add Proxy</button>`
                        }
                    </div>
                </div>
            `;
        }).join('');

        containerList.innerHTML = containerHTML;
        
        // Add event delegation for dynamically created buttons
        containerList.addEventListener('click', (e) => {
            if (e.target.dataset.action) {
                const action = e.target.dataset.action;
                const containerId = e.target.dataset.container;
                
                switch (action) {
                    case 'add':
                        this.showProxyModal(containerId);
                        break;
                    case 'edit':
                        this.editProxy(containerId);
                        break;
                    case 'remove':
                        this.removeProxy(containerId);
                        break;
                }
            }
        });
    }

    showProxyModal(containerId = null) {
        this.currentEditingContainer = containerId;
        const modal = document.getElementById('proxyModal');
        const title = document.getElementById('modalTitle');
        const containerSelect = document.getElementById('containerSelect');

        // Set title
        title.textContent = containerId ? 'Edit Proxy' : 'Add Proxy';

        // Populate container select
        containerSelect.innerHTML = '<option value="">Select a container...</option>';
        this.containers.forEach(container => {
            const option = document.createElement('option');
            option.value = container.cookieStoreId;
            option.textContent = container.name;
            option.selected = container.cookieStoreId === containerId;
            containerSelect.appendChild(option);
        });

        // If editing existing proxy, populate form with existing data
        if (containerId && this.proxies[containerId]) {
            const proxy = this.proxies[containerId];
            document.getElementById('proxyType').value = proxy.type;
            document.getElementById('proxyHost').value = proxy.host;
            document.getElementById('proxyPort').value = proxy.port;
            document.getElementById('proxyLabel').value = proxy.label || '';
            document.getElementById('proxyUsername').value = proxy.username || '';
            document.getElementById('proxyPassword').value = proxy.password || '';
            containerSelect.disabled = true;
        } else {
            // Clear form for new proxy
            document.getElementById('proxyForm').reset();
            
            // If adding to specific container, pre-select and disable dropdown
            if (containerId) {
                containerSelect.value = containerId;
                containerSelect.disabled = true;
            } else {
                containerSelect.disabled = false;
            }
        }

        modal.classList.add('show');
    }

    hideProxyModal() {
        const modal = document.getElementById('proxyModal');
        modal.classList.remove('show');
        this.currentEditingContainer = null;
    }

    async saveProxy() {
        const containerId = this.currentEditingContainer || document.getElementById('containerSelect').value;
        
        if (!containerId) {
            this.showError('Please select a container');
            return;
        }

        const username = document.getElementById('proxyUsername').value.trim();
        const password = document.getElementById('proxyPassword').value.trim();
        
        const proxyConfig = {
            type: document.getElementById('proxyType').value,
            host: document.getElementById('proxyHost').value.trim(),
            port: document.getElementById('proxyPort').value,
            label: document.getElementById('proxyLabel').value.trim() || null,
            username: username || null,
            password: password || null,
            enabled: true
        };

        // Basic validation
        if (!proxyConfig.host || !proxyConfig.port) {
            this.showError('Host and port are required');
            return;
        }

        try {
            const success = await browser.runtime.sendMessage({
                action: 'setProxy',
                containerId: containerId,
                proxyConfig: proxyConfig
            });

            if (success) {
                this.proxies[containerId] = proxyConfig;
                this.hideProxyModal();
                this.renderContainers();
                this.showSuccess('Proxy configuration saved successfully!');
            } else {
                this.showError('Failed to save proxy configuration');
            }
        } catch (error) {
            console.error('Error saving proxy:', error);
            this.showError('Error saving proxy: ' + error.message);
        }
    }

    async removeProxy(containerId) {
        if (!confirm('Remove proxy configuration for this container?')) {
            return;
        }

        try {
            const success = await browser.runtime.sendMessage({
                action: 'removeProxy',
                containerId: containerId
            });

            if (success) {
                delete this.proxies[containerId];
                this.renderContainers();
                this.showSuccess('Proxy configuration removed');
            } else {
                this.showError('Failed to remove proxy configuration');
            }
        } catch (error) {
            console.error('Error removing proxy:', error);
            this.showError('Error removing proxy: ' + error.message);
        }
    }

    editProxy(containerId) {
        this.showProxyModal(containerId);
    }

    async testProxyConnection() {
        const proxyConfig = {
            type: document.getElementById('proxyType').value,
            host: document.getElementById('proxyHost').value.trim(),
            port: document.getElementById('proxyPort').value,
            username: document.getElementById('proxyUsername').value.trim(),
            password: document.getElementById('proxyPassword').value.trim()
        };

        if (!proxyConfig.host || !proxyConfig.port) {
            this.showError('Please enter host and port first');
            return;
        }

        const testButton = document.getElementById('testProxy');
        const originalText = testButton.textContent;
        testButton.textContent = 'Testing...';
        testButton.disabled = true;

        try {
            const result = await browser.runtime.sendMessage({
                action: 'testProxy',
                proxyConfig: proxyConfig
            });

            if (result.success) {
                this.showSuccess(result.message);
            } else {
                this.showError(result.message);
            }
        } catch (error) {
            console.error('Error testing proxy:', error);
            this.showError('Proxy test failed: ' + error.message);
        } finally {
            testButton.textContent = originalText;
            testButton.disabled = false;
        }
    }

    showError(message) {
        console.error('Container Proxy Error:', message);
        alert('❌ Error: ' + message);
    }

    showSuccess(message) {
        console.log('Container Proxy Success:', message);
        // Create a temporary success message
        const successDiv = document.createElement('div');
        successDiv.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 10000;
            background: #28a745; color: white; padding: 12px 20px;
            border-radius: 4px; font-size: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;
        successDiv.textContent = '✅ ' + message;
        document.body.appendChild(successDiv);
        
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.parentNode.removeChild(successDiv);
            }
        }, 3000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.ui = new ContainerProxyUI();
});

// Make functions available globally for onclick handlers
window.ui = null;
