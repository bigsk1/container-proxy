# Container Proxy

A modern Firefox extension for assigning different proxies to Firefox containers, enabling secure and organized browsing with multiple proxy configurations.

## 🌟 Features

- **Container-Based Proxy Assignment**: Assign different proxies to different Firefox containers
- **Multiple Proxy Types**: Support for HTTP, HTTPS, and SOCKS5 proxies
- **Proxy Labels**: Add custom labels/comments to identify your proxies (e.g., "Seattle Server", "Work VPN")
- **Dark Mode Support**: Automatic dark theme based on system preferences
- **Export/Import**: Backup and restore your proxy configurations
- **Connection Testing**: Test proxy connections before saving
- **Modern UI**: Clean, intuitive interface with responsive design

## 📦 Installation

### From Release (Recommended)
1. Download the latest release from the [Releases](../../releases) page
2. Open Firefox and go to `about:addons`
3. Click the gear icon and select "Install Add-on From File"
4. Select the downloaded `.zip` file

### Manual Installation (Development)
1. Clone or download this repository
2. Open Firefox and go to `about:debugging`
3. Click "This Firefox" → "Load Temporary Add-on"
4. Navigate to the `container-proxy-modern` folder and select `manifest.json`

## 🚀 Quick Start

### 1. Set up Firefox Containers
- Go to Firefox Settings → General → Tabs
- Enable "Multi-Account Containers"
- Create containers for different purposes (Work, Personal, etc.)

### 2. Configure Proxies
- Click the Container Proxy extension icon
- Click "Add Proxy" for any container
- Fill in your proxy details:
  - **Type**: HTTP, HTTPS, or SOCKS5
  - **Host**: Your proxy server IP/hostname
  - **Port**: Proxy server port
  - **Label**: Optional description (e.g., "Seattle Server")
  - **Credentials**: Username/password if required

### 3. Browse Securely
- Open tabs in different containers
- Each container will automatically use its assigned proxy
- Default container remains unproxied

## 🔧 Supported Proxy Types

### HTTP Proxy
- Standard HTTP proxy
- Traffic to proxy is unencrypted
- Good for basic routing

### HTTPS Proxy
- Encrypted connection to proxy
- More secure than HTTP
- Recommended for sensitive browsing

### SOCKS5 Proxy (Recommended)
- Most secure proxy type
- Supports DNS routing through proxy
- Best choice for privacy

## 🛡️ Security & Privacy

### ✅ Security Features
- **DNS Protection**: SOCKS5 proxies route DNS through the proxy
- **Credential Security**: Credentials only sent when explicitly provided
- **Container Isolation**: Each container uses its own proxy independently
- **No Data Logging**: Extension doesn't log or store browsing data

### ⚠️ Security Considerations
- **HTTP Proxies**: Traffic to proxy is unencrypted (use HTTPS/SOCKS5 when possible)
- **WebRTC Leaks**: Disable WebRTC in Firefox to prevent IP leaks
- **Default Container**: Default Firefox container doesn't use proxy
- **Credentials Storage**: Stored locally in Firefox (encrypted by Firefox)

**Recommendation**: Use SOCKS5 proxies with services like Gluetun for best security.

## 🐳 Gluetun Setup Example

If you're using Gluetun containers for VPN routing:

```
Type: HTTP
Host: 172.17.0.2 (your Gluetun container IP)
Port: 8888
Username: (leave empty)
Password: (leave empty)
Label: Gluetun VPN
```

## 📋 Permissions Explained

This extension requires the following permissions:

- **`webRequest`**: To intercept web requests for proxy routing
- **`webRequestBlocking`**: To modify requests before they're sent
- **`proxy`**: To configure proxy settings
- **`contextualIdentities`**: To work with Firefox containers
- **`storage`**: To save proxy configurations
- **`<all_urls>`**: To route traffic from all websites through proxies

These permissions are necessary for any proxy extension to function properly.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Privacy Policy

Container Proxy is committed to protecting your privacy:

- **No Data Collection**: This extension does not collect, store, or transmit any personal data
- **Local Storage Only**: All proxy configurations are stored locally in Firefox's encrypted storage
- **No Analytics**: No tracking, analytics, or telemetry of any kind
- **Open Source**: Full source code available at https://github.com/bigsk1/container-proxy
- **No External Connections**: Extension only communicates with your configured proxy servers

This extension operates entirely offline except for connecting to your specified proxy servers.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Bug Reports & Feature Requests

Please use the [GitHub Issues](../../issues) page to report bugs or request features.

## 🔗 Related Projects

- [Firefox Multi-Account Containers](https://addons.mozilla.org/en-US/firefox/addon/multi-account-containers/)
- [Gluetun VPN Container](https://github.com/qdm12/gluetun)

---

**Made with ❤️ for privacy-conscious browsing**
