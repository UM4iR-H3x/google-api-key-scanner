# 🔍 Google API Key Scanner

A professional Chrome extension for real-time detection of exposed Google API keys (AIza...) during web browsing, specifically designed for bug bounty reconnaissance and security research.

## 🚨 Critical Security Context

Based on [TruffleSecurity's research](https://trufflesecurity.com/blog/google-api-keys-werent-secrets-but-then-gemini-changed-the-rules), Google API keys that were previously considered "public identifiers" can now access sensitive Gemini API endpoints when the Gemini API is enabled on the same Google Cloud project. This creates a critical security vulnerability where:

1. **Retroactive Privilege Expansion** - Existing public keys silently gain access to sensitive APIs
2. **Insecure Defaults** - New API keys default to unrestricted access
3. **No Developer Notification** - No warnings when key privileges change

## ✨ Features

### 🔍 **Comprehensive Detection**
- **HTML Source Scanning** - Analyzes page content for API keys
- **JavaScript Analysis** - Scans inline and external scripts
- **Network Interception** - Monitors fetch/XHR responses
- **Dynamic Content** - Uses MutationObserver for real-time updates
- **Meta Tag Detection** - Checks meta tags and data attributes

### 🧪 **Advanced Validation**
- **Gemini API Testing** - Tests access to sensitive AI endpoints
- **Maps API Validation** - Checks Google Maps functionality
- **YouTube API Testing** - Validates video service access
- **Service Identification** - Identifies accessible Google services
- **Restriction Detection** - Determines if keys are properly restricted

### 🎯 **Bug Bounty Features**
- **Real-time Alerts** - Desktop notifications when keys are found
- **Badge Counters** - Visual indicator in browser toolbar
- **Export Functionality** - JSON export for reporting
- **Copy Commands** - Ready-to-use testing commands
- **Context Information** - Source location and code snippets

### 🛡️ **Security & Performance**
- **Local Validation** - No external key leakage
- **Request Caching** - Avoids duplicate API calls
- **Debounced Scanning** - Prevents performance issues
- **Manifest V3** - Future-proof Chrome extension

## 📦 Installation

1. **Clone/Download** this repository
2. Open Chrome → `chrome://extensions/`
3. Enable "Developer mode" (toggle top-right)
4. Click "Load unpacked" → Select the `google-api-key-scanner` folder
5. Extension icon appears in toolbar

## 🚀 Usage

### **Basic Operation**
1. **Navigate** to any website
2. **Click** the extension icon to view detected keys
3. **Monitor** real-time alerts as you browse
4. **Export** findings for bug bounty reports

### **Key Validation**
- **Auto-Validation** - Keys are automatically tested when found
- **Manual Testing** - Click "Validate" to re-test specific keys
- **Console Commands** - Use "Test" button for manual exploration

### **Search & Filter**
- **Real-time Search** - Filter keys by content or source
- **Service Filtering** - View keys by accessible services
- **URL Filtering** - Focus on specific domains

## 🎯 Bug Bounty Hunting

### **High-Value Targets**
- **OAuth Flows** - Authentication systems with embedded keys
- **Payment Integrations** - Financial services using Maps/Places APIs
- **Admin Dashboards** - Internal tools with Google service integrations
- **Third-Party Widgets** - Embedded Google services
- **Mobile Apps** - Web views with embedded keys

### **Common Vulnerabilities**
```javascript
// ❌ VULNERABLE - No origin validation
window.addEventListener('message', (e) => {
    fetch(`https://api.example.com/data?key=${e.data.apiKey}`);
});

// ❌ VULNERABLE - Key in frontend
const GOOGLE_API_KEY = "AIza..."; // Exposed in JavaScript

// ❌ VULNERABLE - No key restrictions
// Key can access all enabled APIs including Gemini
```

### **Testing Methodology**
1. **Discovery** - Use extension to find exposed keys
2. **Validation** - Confirm keys work with target APIs
3. **Impact Assessment** - Test sensitive endpoints (Gemini)
4. **Documentation** - Export findings with context
5. **Responsible Disclosure** - Report through proper channels

### **Critical Test Cases**
```bash
# Test Gemini API access (most critical)
curl "https://generativelanguage.googleapis.com/v1beta/models?key=AIza..."

# Test file access (potential data leakage)
curl "https://generativelanguage.googleapis.com/v1beta/files?key=AIza..."

# Test cached content (sensitive data exposure)
curl "https://generativelanguage.googleapis.com/v1beta/cachedContents?key=AIza..."
```

## 📊 Extension Architecture

```
google-api-key-scanner/
├── manifest.json          # Extension configuration
├── content.js            # Page scanning and detection
├── background.js         # Service worker and validation
├── popup.html           # Modern UI interface
├── popup.js             # UI logic and interactions
├── utils/
│   ├── regex.js         # Key pattern matching
│   └── validator.js     # API validation logic
└── icons/              # Extension icons
```

## 🔧 Technical Details

### **Detection Patterns**
- **Primary Regex**: `AIza[0-9A-Za-z-_]{35}`
- **Context Patterns**: API key assignments and configurations
- **Obfuscation Detection**: Handles split/encoded keys
- **Service-Specific**: Maps, Gemini, Firebase, YouTube detection

### **Validation Endpoints**
- **Gemini API**: `/v1beta/models` - Most critical for security
- **Maps API**: `/maps/api/geocode/json` - Common public usage
- **YouTube API**: `/youtube/v3/search` - Video service access
- **General API**: `/oauth2/v2/userinfo` - Basic validation

### **Performance Optimizations**
- **Debounced Scanning** - 1-second delay for DOM changes
- **Request Caching** - 5-minute cache for validation results
- **Selective Fetching** - Only scans text-based responses
- **Background Processing** - Validation runs in service worker

## 🛡️ Security Considerations

### **For Users**
- ✅ **Local Processing** - Keys never leave your browser
- ✅ **Safe Validation** - Uses official Google endpoints only
- ✅ **No Data Collection** - Extension doesn't track browsing
- ✅ **Open Source** - Code can be audited

### **For Website Owners**
- 🔒 **API Key Restrictions** - Limit keys to specific domains
- 🔒 **Service Separation** - Use different keys for different services
- 🔒 **Regular Rotation** - Change keys periodically
- 🔒 **Monitoring** - Track API usage and anomalies

## 📈 Impact Assessment

### **CVSS Scoring**
Exposed Google API keys with Gemini access typically score:
- **CVSS 7.5+** (High) - Due to potential data exposure
- **Business Impact** - Financial costs, data breaches
- **Exploitability** - Simple key extraction and API calls

### **Real-World Examples**
- **2,863 live keys** found in Common Crawl dataset
- **Major companies** affected including financial institutions
- **Google's own infrastructure** contained vulnerable keys

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - Feel free to use in security research and bug bounty hunting.

## ⚠️ Disclaimer

This tool is for **authorized security testing only**. Users are responsible for:
- Obtaining proper authorization before testing
- Following responsible disclosure practices
- Complying with applicable laws and terms of service
- Not using for malicious purposes

## 🙏 Acknowledgments

- **Truffle Security** - For the groundbreaking research on Google API key vulnerabilities
- **Security Community** - For ongoing collaboration in vulnerability research
- **Google** - For API documentation and security guidance

---

**Remember**: With great power comes great responsibility. Use this tool ethically and help make the web more secure! 🛡️
