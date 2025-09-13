// Container Proxy - Options Page JavaScript
document.addEventListener('DOMContentLoaded', async () => {
    await loadContainerOverview();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('manageProxies').addEventListener('click', openExtensionPopup);
    document.getElementById('exportConfig').addEventListener('click', exportConfig);
    document.getElementById('importConfig').addEventListener('click', importConfig);
}

async function loadContainerOverview() {
    try {
        console.log('Loading container overview...');
        const containers = await browser.contextualIdentities.query({});
        console.log('Found containers:', containers.length);
        
        const proxies = await browser.runtime.sendMessage({ action: 'getAllProxies' }) || {};
        console.log('Found proxy configs:', Object.keys(proxies).length, proxies);
        
        const overview = document.getElementById('containerOverview');
        
        if (containers.length === 0) {
            overview.innerHTML = `
                <p>No containers found. <a href="#" onclick="openContainerManager()">Create some containers</a> to get started.</p>
            `;
            return;
        }

        const containerHTML = containers.map(container => {
            const proxy = proxies[container.cookieStoreId];
            const hasProxy = proxy && proxy.enabled;
            
            return `
                <div class="container-item ${hasProxy ? 'has-proxy' : ''}">
                    <div class="container-info">
                        <div class="container-icon" style="background-color: ${container.color}"></div>
                        <div class="container-details">
                            <h3>${escapeHtml(container.name)}</h3>
                            <p><strong>ID:</strong> ${container.cookieStoreId}</p>
                            <p><strong>Proxy:</strong> ${hasProxy ? `${proxy.type} - ${proxy.host}:${proxy.port}` : 'None assigned'}</p>
                        </div>
                    </div>
                    <div class="container-actions">
                        ${hasProxy ? 
                            '<span class="proxy-status enabled">Proxy Active</span>' :
                            '<span class="proxy-status disabled">No Proxy</span>'
                        }
                    </div>
                </div>
            `;
        }).join('');

        overview.innerHTML = containerHTML;
    } catch (error) {
        console.error('Error loading container overview:', error);
        document.getElementById('containerOverview').innerHTML = 
            '<p style="color: red;">Error loading container information.</p>';
    }
}

function openExtensionPopup() {
    // Open the extension popup in a centered window
    const width = 500;
    const height = 600;
    const left = Math.round((screen.width / 2) - (width / 2));
    const top = Math.round((screen.height / 2) - (height / 2));
    
    browser.windows.create({
        url: browser.runtime.getURL('popup.html'),
        type: 'popup',
        width: width,
        height: height,
        left: left,
        top: top
    });
}

function openContainerManager() {
    // Open Firefox's container management page
    browser.tabs.create({ url: 'about:preferences#containers' });
}

async function exportConfig() {
    try {
        const proxies = await browser.runtime.sendMessage({ action: 'getAllProxies' }) || {};
        const containers = await browser.contextualIdentities.query({});
        
        const config = {
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            containers: containers.map(c => ({
                id: c.cookieStoreId,
                name: c.name,
                color: c.color,
                proxy: proxies[c.cookieStoreId] || null
            }))
        };
        
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `container-proxy-config-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        alert('Configuration exported successfully!');
    } catch (error) {
        console.error('Error exporting config:', error);
        alert('Error exporting configuration: ' + error.message);
    }
}

function importConfig() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const config = JSON.parse(text);
            
            if (!config.containers || !Array.isArray(config.containers)) {
                throw new Error('Invalid configuration file format');
            }
            
            let imported = 0;
            for (const container of config.containers) {
                if (container.proxy) {
                    await browser.runtime.sendMessage({
                        action: 'setProxy',
                        containerId: container.id,
                        proxyConfig: container.proxy
                    });
                    imported++;
                }
            }
            
            alert(`Configuration imported successfully! ${imported} proxy configurations restored.`);
            await loadContainerOverview();
        } catch (error) {
            console.error('Error importing config:', error);
            alert('Error importing configuration: ' + error.message);
        }
    };
    
    input.click();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
