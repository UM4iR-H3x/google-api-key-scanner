
let currentTabId = -1;
let foundKeys = [];
let searchTerm = '';

document.addEventListener('DOMContentLoaded', async function() {
    console.log('[Google API Key Scanner] Popup initialized');
    
    setupEventListeners();
    await getCurrentTab();
    loadKeys();
    startRealTimeUpdates();
});

function setupEventListeners() {
    document.getElementById('search-box').addEventListener('input', function(e) {
        searchTerm = e.target.value.toLowerCase();
        renderKeys();
    });

    document.getElementById('validate-all-btn').addEventListener('click', validateAllKeys);

    document.getElementById('export-btn').addEventListener('click', exportKeys);

    document.getElementById('clear-btn').addEventListener('click', clearKeys);
}

async function getCurrentTab() {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
            currentTabId = tabs[0].id;
            updateUrlDisplay(tabs[0].url);
        }
    } catch (error) {
        console.error('Failed to get current tab:', error);
    }
}

async function loadKeys() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'get_keys' });
        if (response && response.keys) {
            foundKeys = response.keys;
            updateStats();
            renderKeys();
        }
    } catch (error) {
        console.error('Failed to load keys:', error);
        showError('Failed to load keys');
    }
}

function startRealTimeUpdates() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'key_validated' && message.tabId === currentTabId) {
            updateKeyValidation(message.key, message.result);
        }
    });

    setInterval(loadKeys, 2000);
}

function updateUrlDisplay(url) {
    const display = document.getElementById('url-display');
    if (url) {
        try {
            const hostname = new URL(url).hostname;
            display.textContent = hostname;
        } catch (error) {
            display.textContent = 'Invalid URL';
        }
    } else {
        display.textContent = 'No page loaded';
    }
}

function updateStats() {
    const validCount = foundKeys.filter(key => key.validationStatus === 'valid').length;
    const invalidCount = foundKeys.filter(key => key.validationStatus === 'invalid').length;
    
    document.getElementById('key-count').textContent = foundKeys.length;
    document.getElementById('valid-count').textContent = validCount;
    document.getElementById('invalid-count').textContent = invalidCount;
}

function renderKeys() {
    const container = document.getElementById('content');
    
    let filteredKeys = foundKeys.filter(key => {
        if (!searchTerm) return true;
        
        return key.key.toLowerCase().includes(searchTerm) ||
               key.source.toLowerCase().includes(searchTerm) ||
               (key.context && key.context.toLowerCase().includes(searchTerm)) ||
               (key.url && key.url.toLowerCase().includes(searchTerm));
    });

    if (filteredKeys.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>${foundKeys.length === 0 ? 'No API Keys Detected' : 'No Matching Keys'}</h3>
                <p>${foundKeys.length === 0 ? 
                    'Navigate to a webpage with exposed Google API keys to see them here' : 
                    'Try adjusting your search terms'}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filteredKeys.map(key => createKeyElement(key)).join('');
    
    attachKeyEventListeners();
}

function createKeyElement(key) {
    const statusClass = key.validationStatus || 'pending';
    const statusText = key.validationStatus === 'valid' ? 'Valid' : 
                      key.validationStatus === 'invalid' ? 'Invalid' : 'Pending';
    
    const validationResult = key.validationResult;
    let services = [];
    let geminiResult = null;
    
    if (validationResult) {
        services = validationResult.accessibleServices || [];
        geminiResult = services.find(s => s.service === 'gemini');
    }
    
    const servicesHtml = services.map(service => 
        `<span class="service-badge">${service.service}</span>`
    ).join('');

    return `
        <div class="key-item ${statusClass}" data-key="${key.key}">
            <div class="key-header">
                <div class="key-value">${escapeHtml(key.key)}</div>
                <div class="key-status status-${statusClass}">${statusText}</div>
            </div>
            
            <div class="key-details">
                <div class="detail-item">
                    <div class="detail-label">Source:</div>
                    <div class="detail-value">${escapeHtml(key.source)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">URL:</div>
                    <div class="detail-value">${escapeHtml(extractHostname(key.url))}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Context:</div>
                    <div class="detail-value">${escapeHtml(key.context || 'N/A')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Time:</div>
                    <div class="detail-value">${formatTime(key.timestamp)}</div>
                </div>
                ${validationResult ? `
                    <div class="detail-item">
                        <div class="detail-label">Gemini Status:</div>
                        <div class="detail-value vulnerability-${geminiResult?.vulnerable ? 'critical' : 'safe'}">
                            ${geminiResult?.vulnerable ? '🚨 VULNERABLE' : '✅ Safe'}
                        </div>
                    </div>
                    ${geminiResult?.status ? `
                        <div class="detail-item">
                            <div class="detail-label">HTTP Status:</div>
                            <div class="detail-value">${geminiResult.status} ${geminiResult.statusText || ''}</div>
                        </div>
                    ` : ''}
                ` : ''}
            </div>
            
            ${geminiResult ? `
                <div class="gemini-response">
                    <div class="detail-label">🚨 Gemini API Response:</div>
                    <div class="response-container">
                        <div class="curl-command">
                            <strong>Command:</strong> ${escapeHtml(geminiResult.curlCommand)}
                        </div>
                        <div class="response-status ${geminiResult.vulnerable ? 'vulnerable' : 'safe'}">
                            <strong>Status:</strong> ${geminiResult.status} - ${geminiResult.vulnerable ? 'VULNERABLE' : 'Not Vulnerable'}
                        </div>
                        <div class="response-body">
                            <strong>Response:</strong>
                            <pre>${escapeHtml(geminiResult.response || 'No response')}</pre>
                        </div>
                        <div class="impact-assessment ${geminiResult.vulnerable ? 'critical' : 'low'}">
                            <strong>Impact:</strong> ${escapeHtml(geminiResult.impact || 'Unknown')}
                        </div>
                    </div>
                </div>
            ` : ''}
            
            ${servicesHtml ? `<div class="services">${servicesHtml}</div>` : ''}
            
            <div class="key-actions">
                <button class="action-btn copy-btn" data-key="${key.key}">📋 Copy</button>
                <button class="action-btn validate-btn" data-key="${key.key}">✓ Validate</button>
                <button class="action-btn test-btn" data-key="${key.key}">🧪 Test</button>
                <button class="action-btn details-btn" data-key="${key.key}">📄 Details</button>
            </div>
        </div>
    `;
}

function attachKeyEventListeners() {
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const key = this.dataset.key;
            copyToClipboard(key);
            showNotification('Key copied to clipboard!');
        });
    });

    document.querySelectorAll('.validate-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const key = this.dataset.key;
            validateKey(key);
        });
    });

    document.querySelectorAll('.test-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const key = this.dataset.key;
            testKeyInConsole(key);
        });
    });

    document.querySelectorAll('.details-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const key = this.dataset.key;
            showKeyDetails(key);
        });
    });
}

async function validateKey(key) {
    try {
        showNotification('Validating key...');
        const response = await chrome.runtime.sendMessage({ 
            type: 'validate_key', 
            key: key 
        });
        
        if (response) {
            updateKeyValidation(key, response);
            showNotification('Key validation complete!');
        }
    } catch (error) {
        console.error('Validation failed:', error);
        showNotification('Validation failed', 'error');
    }
}

async function validateAllKeys() {
    const pendingKeys = foundKeys.filter(key => 
        key.validationStatus !== 'valid' && key.validationStatus !== 'invalid'
    );
    
    if (pendingKeys.length === 0) {
        showNotification('All keys already validated');
        return;
    }

    showNotification(`Validating ${pendingKeys.length} key(s)...`);
    
    for (const keyObj of pendingKeys) {
        await validateKey(keyObj.key);
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

function updateKeyValidation(key, result) {
    const keyIndex = foundKeys.findIndex(k => k.key === key);
    if (keyIndex !== -1) {
        foundKeys[keyIndex].validationResult = result;
        foundKeys[keyIndex].validationStatus = result.isValid ? 'valid' : 'invalid';
        updateStats();
        renderKeys();
    }
}

function testKeyInConsole(key) {
    const testCommands = `
fetch('https://generativelanguage.googleapis.com/v1beta/models?key=${key}')
  .then(r => r.json())
  .then(console.log);

fetch('https://maps.googleapis.com/maps/api/geocode/json?address=test&key=${key}')
  .then(r => r.json())
  .then(console.log);
`;
    
    copyToClipboard(testCommands);
    showNotification('Test commands copied! Open console and paste to test');
}

function showKeyDetails(key) {
    const keyObj = foundKeys.find(k => k.key === key);
    if (!keyObj) return;
    
    const details = JSON.stringify(keyObj, null, 2);
    copyToClipboard(details);
    showNotification('Key details copied to clipboard');
}

async function exportKeys() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'export_keys' });
        
        if (response) {
            const blob = new Blob([JSON.stringify(response, null, 2)], { 
                type: 'application/json' 
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `google-api-keys-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            showNotification('Keys exported successfully!');
        }
    } catch (error) {
        console.error('Export failed:', error);
        showNotification('Export failed', 'error');
    }
}

async function clearKeys() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'clear_keys' });
        if (response && response.success) {
            foundKeys = [];
            updateStats();
            renderKeys();
            showNotification('Keys cleared');
        }
    } catch (error) {
        console.error('Clear failed:', error);
        showNotification('Clear failed', 'error');
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch(err => {
        console.error('Failed to copy:', err);
    });
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.style.background = type === 'error' ? '#f56565' : '#48bb78';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function showError(message) {
    const container = document.getElementById('content');
    container.innerHTML = `
        <div class="empty-state">
            <h3>Error</h3>
            <p>${escapeHtml(message)}</p>
        </div>
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function extractHostname(url) {
    try {
        return new URL(url).hostname;
    } catch (error) {
        return url;
    }
}

function formatTime(timestamp) {
    try {
        const date = new Date(timestamp);
        return date.toLocaleTimeString();
    } catch (error) {
        return 'Unknown';
    }
}
