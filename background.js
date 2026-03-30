/**
 * Background Service Worker for Google API Key Scanner
 * Manages key validation, storage, and notifications
 */

// Storage for found keys per tab
const tabKeys = new Map();
let selectedTabId = -1;

// Validation cache to avoid duplicate API calls
const validationCache = new Map();

// Debug flag
const DEBUG = false; // Disabled to reduce console noise

function debugLog(...args) {
    if (DEBUG) {
        console.log('[Google API Key Scanner BG]', ...args);
    }
}

// Essential logging function for important events
function logImportant(...args) {
    console.log('[Google API Key Scanner BG]', ...args);
}

/**
 * Initialize the background service worker
 */
chrome.runtime.onInstalled.addListener(() => {
    logImportant('Google API Key Scanner extension installed');
    
    // Set default settings
    chrome.storage.sync.set({
        enabled: true,
        showNotifications: true,
        autoValidate: true,
        highlightKeys: true
    });
});

/**
 * Handle tab activation
 */
chrome.tabs.onActivated.addListener((activeInfo) => {
    selectedTabId = activeInfo.tabId;
    updateBadge();
});

/**
 * Handle tab updates
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        // Clear keys for this tab when page loads
        if (tabKeys.has(tabId)) {
            tabKeys.delete(tabId);
        }
        updateBadge();
    }
});

/**
 * Handle messages from content script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const tabId = sender.tab?.id || selectedTabId;
    
    switch (message.type) {
        case 'keys_found':
            handleKeysFound(message.keys, tabId, message.url);
            break;
            
        case 'show_notification':
            if (message.title && message.message) {
                showNotification(message.title, message.message);
            }
            break;
            
        case 'get_keys':
            sendResponse({ keys: tabKeys.get(tabId) || [] });
            break;
            
        case 'validate_key':
            validateAPIKey(message.key).then(result => {
                sendResponse(result);
            });
            return true; // Keep message channel open for async response
            
        case 'clear_keys':
            tabKeys.delete(tabId);
            updateBadge();
            sendResponse({ success: true });
            break;
            
        case 'export_keys':
            exportAllKeys().then(data => {
                sendResponse(data);
            });
            return true;
    }
});

/**
 * Handle newly found API keys
 * @param {Array} keys - Array of found keys
 * @param {number} tabId - Tab ID
 * @param {string} url - Source URL
 */
async function handleKeysFound(keys, tabId, url) {
    if (!tabKeys.has(tabId)) {
        tabKeys.set(tabId, []);
    }
    
    const existingKeys = tabKeys.get(tabId);
    let newKeysFound = false;
    
    for (const keyData of keys) {
        // Check if key already exists for this tab
        const existingIndex = existingKeys.findIndex(k => k.key === keyData.key);
        
        if (existingIndex === -1) {
            // New key found
            existingKeys.push({
                ...keyData,
                validationStatus: 'pending',
                id: generateKeyId()
            });
            newKeysFound = true;
            
            // Auto-validate if enabled
            const settings = await getSettings();
            if (settings.autoValidate) {
                validateAPIKey(keyData.key).then(validationResult => {
                    updateKeyValidation(tabId, keyData.key, validationResult);
                });
            }
        }
    }
    
    if (newKeysFound) {
        updateBadge();
        
        // Show notification
        const settings = await getSettings();
        if (settings.showNotifications) {
            try {
                const hostname = new URL(url).hostname;
                showNotification(
                    'Google API Key Detected!',
                    `Found ${keys.length} key(s) on ${hostname}`
                );
            } catch (error) {
                showNotification(
                    'Google API Key Detected!',
                    `Found ${keys.length} key(s)`
                );
            }
        }
    }
}

/**
 * Validate a Google API key
 * @param {string} apiKey - The API key to validate
 * @returns {Promise<Object>} - Validation result
 */
async function validateAPIKey(apiKey) {
    // Check cache first
    if (validationCache.has(apiKey)) {
        const cached = validationCache.get(apiKey);
        if (Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 minutes cache
            return cached.result;
        }
    }
    
    const validationResults = {
        key: apiKey,
        isValid: false,
        isRestricted: false,
        accessibleServices: [],
        errors: [],
        validationTime: new Date().toISOString()
    };
    
    // Test against different Google APIs
    const tests = [
        testGeminiAPI(apiKey),
        testMapsAPI(apiKey),
        testYouTubeAPI(apiKey)
    ];
    
    try {
        const results = await Promise.allSettled(tests);
        
        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value.success) {
                validationResults.isValid = true;
                validationResults.accessibleServices.push(result.value.service);
                
                if (result.value.restricted) {
                    validationResults.isRestricted = true;
                }
            } else if (result.status === 'rejected') {
                validationResults.errors.push({
                    service: getTestName(index),
                    error: result.reason.message
                });
            }
        });
        
    } catch (error) {
        validationResults.errors.push({
            service: 'general',
            error: error.message
        });
    }
    
    // Cache result
    validationCache.set(apiKey, {
        result: validationResults,
        timestamp: Date.now()
    });
    
    return validationResults;
}

/**
 * Test Gemini API access (critical based on TruffleSecurity research)
 * @param {string} apiKey - API key to test
 * @returns {Promise<Object>} - Test result with full response
 */
async function testGeminiAPI(apiKey) {
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
            {
                method: 'GET'
            }
        );
        
        const responseText = await response.text();
        
        if (response.status === 200) {
            try {
                const data = JSON.parse(responseText);
                return {
                    success: true,
                    service: 'gemini',
                    restricted: false,
                    vulnerable: true,
                    status: response.status,
                    statusText: response.statusText,
                    response: responseText,
                    data: data,
                    models: data.models?.length || 0,
                    endpoint: '/v1beta/models',
                    curlCommand: `curl "https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}"`,
                    impact: 'CRITICAL - Can access Gemini AI models and potentially uploaded files'
                };
            } catch (parseError) {
                return {
                    success: true,
                    service: 'gemini',
                    restricted: false,
                    vulnerable: true,
                    status: response.status,
                    statusText: response.statusText,
                    response: responseText,
                    parseError: parseError.message,
                    endpoint: '/v1beta/models',
                    curlCommand: `curl "https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}"`,
                    impact: 'CRITICAL - API responds but response format is unusual'
                };
            }
        } else if (response.status === 403) {
            try {
                const errorData = JSON.parse(responseText);
                return {
                    success: false,
                    service: 'gemini',
                    restricted: true,
                    vulnerable: false,
                    status: response.status,
                    statusText: response.statusText,
                    response: responseText,
                    error: errorData.error?.message || 'Access forbidden',
                    errorDetails: errorData,
                    endpoint: '/v1beta/models',
                    curlCommand: `curl "https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}"`,
                    impact: 'LOW - Access forbidden, key may be restricted'
                };
            } catch (parseError) {
                return {
                    success: false,
                    service: 'gemini',
                    restricted: true,
                    vulnerable: false,
                    status: response.status,
                    statusText: response.statusText,
                    response: responseText,
                    error: 'Access forbidden',
                    parseError: parseError.message,
                    endpoint: '/v1beta/models',
                    curlCommand: `curl "https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}"`,
                    impact: 'LOW - Access forbidden'
                };
            }
        } else {
            return {
                success: false,
                service: 'gemini',
                restricted: false,
                vulnerable: false,
                status: response.status,
                statusText: response.statusText,
                response: responseText,
                error: `HTTP ${response.status}`,
                endpoint: '/v1beta/models',
                curlCommand: `curl "https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}"`,
                impact: 'UNKNOWN - Unexpected HTTP status'
            };
        }
    } catch (error) {
        return {
            success: false,
            service: 'gemini',
            restricted: false,
            vulnerable: false,
            error: error.message,
            endpoint: '/v1beta/models',
            curlCommand: `curl "https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}"`,
            impact: 'ERROR - Failed to make request'
        };
    }
}

/**
 * Test Maps API access
 * @param {string} apiKey - API key to test
 * @returns {Promise<Object>} - Test result
 */
async function testMapsAPI(apiKey) {
    try {
        const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=test&key=${apiKey}`,
            {
                method: 'GET'
            }
        );
        
        if (response.status === 200) {
            return {
                success: true,
                service: 'maps',
                restricted: false
            };
        } else if (response.status === 403) {
            return {
                success: false,
                service: 'maps',
                restricted: true
            };
        } else {
            return {
                success: false,
                service: 'maps',
                error: `HTTP ${response.status}`
            };
        }
    } catch (error) {
        return {
            success: false,
            service: 'maps',
            error: error.message
        };
    }
}

/**
 * Test YouTube API access
 * @param {string} apiKey - API key to test
 * @returns {Promise<Object>} - Test result
 */
async function testYouTubeAPI(apiKey) {
    try {
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&key=${apiKey}`,
            {
                method: 'GET'
            }
        );
        
        if (response.status === 200) {
            return {
                success: true,
                service: 'youtube',
                restricted: false
            };
        } else if (response.status === 403) {
            return {
                success: false,
                service: 'youtube',
                restricted: true
            };
        } else {
            return {
                success: false,
                service: 'youtube',
                error: `HTTP ${response.status}`
            };
        }
    } catch (error) {
        return {
            success: false,
            service: 'youtube',
            error: error.message
        };
    }
}

/**
 * Get test name by index
 * @param {number} index - Test index
 * @returns {string} - Test name
 */
function getTestName(index) {
    const names = ['gemini', 'maps', 'youtube'];
    return names[index] || 'unknown';
}

/**
 * Update key validation result
 * @param {number} tabId - Tab ID
 * @param {string} key - API key
 * @param {Object} validationResult - Validation result
 */
function updateKeyValidation(tabId, key, validationResult) {
    if (!tabKeys.has(tabId)) return;
    
    const keys = tabKeys.get(tabId);
    const keyIndex = keys.findIndex(k => k.key === key);
    
    if (keyIndex !== -1) {
        keys[keyIndex].validationResult = validationResult;
        keys[keyIndex].validationStatus = validationResult.isValid ? 'valid' : 'invalid';
        
        // Send update to popup if it's open
        chrome.runtime.sendMessage({
            type: 'key_validated',
            tabId: tabId,
            key: key,
            result: validationResult
        });
    }
}

/**
 * Update extension badge with key count
 */
function updateBadge() {
    const keys = tabKeys.get(selectedTabId) || [];
    const count = keys.length;
    
    chrome.action.setBadgeText({ text: count > 0 ? count.toString() : '' });
    chrome.action.setBadgeBackgroundColor({ 
        color: count > 0 ? '#FF4444' : '#4CAF50' 
    });
}

/**
 * Show browser notification
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 */
function showNotification(title, message) {
    chrome.notifications.create({
        type: 'basic',
        title: title,
        message: message
    });
}

/**
 * Get extension settings
 * @returns {Promise<Object>} - Settings object
 */
async function getSettings() {
    return new Promise((resolve) => {
        chrome.storage.sync.get({
            enabled: true,
            showNotifications: true,
            autoValidate: true,
            highlightKeys: true
        }, resolve);
    });
}

/**
 * Generate unique ID for key
 * @returns {string} - Unique ID
 */
function generateKeyId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Export all keys from all tabs
 * @returns {Promise<Object>} - Export data
 */
async function exportAllKeys() {
    const exportData = {
        timestamp: new Date().toISOString(),
        totalKeys: 0,
        tabs: {}
    };
    
    for (const [tabId, keys] of tabKeys.entries()) {
        try {
            const tab = await chrome.tabs.get(tabId);
            exportData.tabs[tabId] = {
                url: tab.url,
                title: tab.title,
                keys: keys
            };
            exportData.totalKeys += keys.length;
        } catch (error) {
            // Tab might be closed
        }
    }
    
    return exportData;
}

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
    console.log('[Google API Key Scanner] Extension started');
});
