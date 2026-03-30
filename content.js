/**
 * Content Script for Google API Key Scanner
 * Scans web pages in real-time for exposed Google API keys
 */

// Import utilities (in content script, we'll need to inject them)
const GOOGLE_API_KEY_REGEX = /AIza[0-9A-Za-z-_]{35}/g;

// Track already scanned URLs to avoid duplicates
const scannedUrls = new Set();
const foundKeys = new Map();

// Debug flag
const DEBUG = false; // Disabled to reduce console noise

function debugLog(...args) {
    if (DEBUG) {
        console.log('[Google API Key Scanner]', ...args);
    }
}

// Essential logging function for important events
function logImportant(...args) {
    console.log('[Google API Key Scanner]', ...args);
}

// Debounce function to avoid excessive scanning
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Extract Google API keys from text
 * @param {string} text - Text to search
 * @returns {Array} - Array of unique keys
 */
function extractKeys(text) {
    const matches = text.match(GOOGLE_API_KEY_REGEX) || [];
    return [...new Set(matches)];
}

/**
 * Scan the current page content
 */
function scanPage() {
    const currentUrl = window.location.href;
    debugLog('Scanning page:', currentUrl);

    const pageKeys = new Set();

    // 1. Scan HTML content
    const htmlContent = document.documentElement.outerHTML;
    const htmlKeys = extractKeys(htmlContent);
    htmlKeys.forEach(key => {
        pageKeys.add(key);
        foundKeys.set(key, {
            key: key,
            source: 'html',
            url: currentUrl,
            timestamp: new Date().toISOString(),
            context: 'Found in HTML content'
        });
    });

    // 2. Scan inline scripts
    const scripts = document.querySelectorAll('script:not([src])');
    scripts.forEach((script, index) => {
        if (script.textContent) {
            const scriptKeys = extractKeys(script.textContent);
            scriptKeys.forEach(key => {
                pageKeys.add(key);
                foundKeys.set(key, {
                    key: key,
                    source: 'inline_script',
                    url: currentUrl,
                    timestamp: new Date().toISOString(),
                    context: `Inline script ${index + 1}`,
                    snippet: script.textContent.substring(0, 200) + '...'
                });
            });
        }
    });

    // 3. Scan external scripts
    const externalScripts = document.querySelectorAll('script[src]');
    externalScripts.forEach(script => {
        const src = script.src;
        if (src && !scannedUrls.has(src)) {
            scannedUrls.add(src);
            fetchExternalScript(src);
        }
    });

    // 4. Scan meta tags
    const metaTags = document.querySelectorAll('meta');
    metaTags.forEach(tag => {
        const content = tag.getAttribute('content') || '';
        const name = tag.getAttribute('name') || tag.getAttribute('property') || '';
        const metaKeys = extractKeys(content);
        if (metaKeys.length > 0) {
            metaKeys.forEach(key => {
                pageKeys.add(key);
                foundKeys.set(key, {
                    key: key,
                    source: 'meta_tag',
                    url: currentUrl,
                    timestamp: new Date().toISOString(),
                    context: `Meta tag: ${name}`,
                    content: content
                });
            });
        }
    });

    // 5. Scan all elements with data attributes
    const allElements = document.querySelectorAll('*');
    let elementCount = 0;
    
    allElements.forEach(element => {
        if (elementCount > 1000) return; // Limit to prevent performance issues
        
        const attributes = element.attributes;
        for (let attr of attributes) {
            if (attr.name.startsWith('data-') || attr.name === 'src' || attr.name === 'href') {
                const dataKeys = extractKeys(attr.value);
                if (dataKeys.length > 0) {
                    dataKeys.forEach(key => {
                        pageKeys.add(key);
                        foundKeys.set(key, {
                            key: key,
                            source: 'element_attribute',
                            url: currentUrl,
                            timestamp: new Date().toISOString(),
                            context: `${element.tagName} ${attr.name}`,
                            value: attr.value
                        });
                    });
                }
            }
        }
        elementCount++;
    });

    // Send found keys to background script
    if (pageKeys.size > 0) {
        const keysArray = Array.from(foundKeys.values());
        logImportant(`Found ${pageKeys.size} Google API key(s) on ${new URL(currentUrl).hostname}`);
        
        chrome.runtime.sendMessage({
            type: 'keys_found',
            keys: keysArray,
            url: currentUrl
        }).catch(error => {
            debugLog('Failed to send keys:', error);
        });

        // Show visual feedback
        highlightKeysInPage(Array.from(pageKeys));
    }
}

/**
 * Fetch and scan external JavaScript file
 * @param {string} url - URL of the external script
 */
async function fetchExternalScript(url) {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/javascript, text/javascript, */*'
            }
        });

        if (response.ok) {
            const scriptContent = await response.text();
            const scriptKeys = extractKeys(scriptContent);
            
            scriptKeys.forEach(key => {
                foundKeys.set(key, {
                    key: key,
                    source: 'external_script',
                    url: url,
                    timestamp: new Date().toISOString(),
                    context: 'External JavaScript file',
                    snippet: scriptContent.substring(0, 200) + '...'
                });
            });

            if (scriptKeys.length > 0) {
                chrome.runtime.sendMessage({
                    type: 'keys_found',
                    keys: Array.from(scriptKeys).map(key => foundKeys.get(key)),
                    url: url
                });
            }
        }
    } catch (error) {
        console.warn('[Google API Key Scanner] Failed to fetch external script:', url, error);
    }
}

/**
 * Intercept network requests to scan responses
 */
function interceptNetworkRequests() {
    // Override fetch
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const [url, options] = args;
        
        return originalFetch.apply(this, args).then(response => {
            // Only scan JSON responses to avoid scanning binary data
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json') || contentType.includes('text/')) {
                response.clone().text().then(text => {
                    const keys = extractKeys(text);
                    if (keys.length > 0) {
                        keys.forEach(key => {
                            foundKeys.set(key, {
                                key: key,
                                source: 'network_response',
                                url: url,
                                timestamp: new Date().toISOString(),
                                context: 'Network API response',
                                contentType: contentType
                            });
                        });

                        chrome.runtime.sendMessage({
                            type: 'keys_found',
                            keys: Array.from(keys).map(key => foundKeys.get(key)),
                            url: url
                        });
                    }
                }).catch(() => {
                    // Ignore errors in response cloning
                });
            }
            
            return response;
        });
    };

    // Override XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url, ...args) {
        this._url = url;
        return originalXHROpen.apply(this, [method, url, ...args]);
    };

    XMLHttpRequest.prototype.send = function(data) {
        const xhr = this;
        
        const originalOnReadyStateChange = xhr.onreadystatechange;
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4 && xhr.status === 200) {
                const contentType = xhr.getResponseHeader('content-type') || '';
                if (contentType.includes('application/json') || contentType.includes('text/')) {
                    try {
                        const responseText = xhr.responseText;
                        const keys = extractKeys(responseText);
                        if (keys.length > 0) {
                            keys.forEach(key => {
                                foundKeys.set(key, {
                                    key: key,
                                    source: 'xhr_response',
                                    url: xhr._url,
                                    timestamp: new Date().toISOString(),
                                    context: 'XHR response',
                                    contentType: contentType
                                });
                            });

                            chrome.runtime.sendMessage({
                                type: 'keys_found',
                                keys: Array.from(keys).map(key => foundKeys.get(key)),
                                url: xhr._url
                            });
                        }
                    } catch (e) {
                        // Ignore parsing errors
                    }
                }
            }
            
            if (originalOnReadyStateChange) {
                originalOnReadyStateChange.apply(this, arguments);
            }
        };

        return originalXHRSend.apply(this, arguments);
    };
}

/**
 * Monitor DOM changes for dynamically added content
 */
function setupMutationObserver() {
    const observer = new MutationObserver(debounce((mutations) => {
        let shouldRescan = false;
        
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if script or meta tag was added
                        if (node.tagName === 'SCRIPT' || node.tagName === 'META' || 
                            node.querySelector('script, meta')) {
                            shouldRescan = true;
                        }
                    }
                });
            } else if (mutation.type === 'attributes') {
                // Check if data attributes changed
                if (mutation.attributeName && mutation.attributeName.startsWith('data-')) {
                    shouldRescan = true;
                }
            }
        });

        if (shouldRescan) {
            setTimeout(scanPage, 1000); // Delay to allow content to load
        }
    }, 1000));

    observer.observe(document, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-*']
    });
}

/**
 * Highlight found keys in the page for visual feedback
 * @param {Array} keys - Array of found keys
 */
function highlightKeysInPage(keys) {
    if (!DEBUG) return; // Only highlight in debug mode
    
    keys.forEach(key => {
        try {
            // Create a highlight style
            const style = document.createElement('style');
            style.textContent = `
                .google-api-key-highlight {
                    background: linear-gradient(45deg, #ff6b6b, #ffd93d) !important;
                    color: #000 !important;
                    padding: 2px 4px !important;
                    border-radius: 3px !important;
                    font-weight: bold !important;
                    box-shadow: 0 0 10px rgba(255, 107, 107, 0.5) !important;
                }
            `;
            document.head.appendChild(style);
            
            // Highlight in HTML
            const html = document.documentElement.outerHTML;
            const highlightedHtml = html.replace(new RegExp(key, 'g'), `<span class="google-api-key-highlight">${key}</span>`);
            
            // Log highlighting
            debugLog(`Highlighted key: ${key.substring(0, 10)}...`);
        } catch (error) {
            debugLog('Failed to highlight key:', error);
        }
    });
}

/**
 * Initialize the content script
 */
function initialize() {
    logImportant('Google API Key Scanner initialized');
    
    // Immediate scan
    setTimeout(scanPage, 1000);
    
    // Scan on DOM content loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scanPage);
    }
    
    // Scan after page fully loads
    window.addEventListener('load', debounce(scanPage, 2000));
    
    // Set up monitoring
    interceptNetworkRequests();
    setupMutationObserver();
    
    // Also scan every 5 seconds for dynamic content
    setInterval(() => {
        const currentUrl = window.location.href;
        if (!scannedUrls.has(currentUrl)) {
            scanPage();
        }
    }, 5000);
}

// Start the scanner immediately
initialize();
