/**
 * Google API Key Detection Patterns
 * Based on TruffleSecurity research: https://trufflesecurity.com/blog/google-api-keys-werent-secrets-but-then-gemini-changed-the-rules
 */

// Google API keys follow the pattern: AIza[0-9A-Za-z-_]{35}
const GOOGLE_API_KEY_REGEX = /AIza[0-9A-Za-z-_]{35}/g;

// Additional patterns to catch common variations and obfuscations
const OBFUSCATED_PATTERNS = [
    // Split keys
    /AIza[0-9A-Za-z-_]{10}[\s\+\-\*\/\.]+[0-9A-Za-z-_]{10}[\s\+\-\*\/\.]+[0-9A-Za-z-_]{10}[\s\+\-\*\/\.]+[0-9A-Za-z-_]{4}/g,
    // Base64 encoded (partial detection)
    /"AIza[0-9A-Za-z-_]{35}"/g,
    // Concatenated strings
    /AIza[0-9A-Za-z-_]+['"`\s\+]+[0-9A-Za-z-_]+['"`\s\+]+[0-9A-Za-z-_]+/g
];

// Context patterns that might indicate API keys
const CONTEXT_PATTERNS = [
    /(?:api[_-]?key|apikey|api[_-]?secret|google[_-]?key|maps[_-]?key|gcp[_-]?key|firebase[_-]?key)[\s]*[:=][\s]*['"`]*AIza[0-9A-Za-z-_]{35}['"`]*/gi,
    /(?:key|secret)[\s]*[:=][\s]*['"`]*AIza[0-9A-Za-z-_]{35}['"`]*/gi
];

/**
 * Extract Google API keys from text content
 * @param {string} text - Text to search for API keys
 * @returns {Array} - Array of unique API keys found
 */
function extractGoogleAPIKeys(text) {
    const keys = new Set();
    
    // Primary pattern matching
    const primaryMatches = text.match(GOOGLE_API_KEY_REGEX) || [];
    primaryMatches.forEach(key => keys.add(key));
    
    // Context-aware matching
    CONTEXT_PATTERNS.forEach(pattern => {
        const matches = text.match(pattern) || [];
        matches.forEach(match => {
            const extractedKey = match.match(/AIza[0-9A-Za-z-_]{35}/);
            if (extractedKey) {
                keys.add(extractedKey[0]);
            }
        });
    });
    
    // Check for obfuscated patterns (basic deobfuscation)
    OBFUSCATED_PATTERNS.forEach(pattern => {
        const matches = text.match(pattern) || [];
        matches.forEach(match => {
            // Remove common obfuscation characters
            const cleaned = match.replace(/[\s\+\-\*\/\.'"`]/g, '');
            if (cleaned.match(/^AIza[0-9A-Za-z-_]{35}$/)) {
                keys.add(cleaned);
            }
        });
    });
    
    return Array.from(keys);
}

/**
 * Validate if a string looks like a Google API key
 * @param {string} key - Key to validate
 * @returns {boolean} - True if it matches Google API key format
 */
function isValidGoogleAPIKeyFormat(key) {
    return GOOGLE_API_KEY_REGEX.test(key);
}

/**
 * Extract keys from JavaScript code with context awareness
 * @param {string} code - JavaScript code to analyze
 * @returns {Array} - Array of keys with their context
 */
function extractKeysFromJS(code) {
    const keys = [];
    const lines = code.split('\n');
    
    lines.forEach((line, index) => {
        const foundKeys = extractGoogleAPIKeys(line);
        foundKeys.forEach(key => {
            keys.push({
                key: key,
                line: index + 1,
                context: line.trim(),
                type: detectKeyType(line)
            });
        });
    });
    
    return keys;
}

/**
 * Detect the type of API key based on context
 * @param {string} context - The line containing the key
 * @returns {string} - Type of key (maps, gemini, firebase, unknown)
 */
function detectKeyType(context) {
    const lowerContext = context.toLowerCase();
    
    if (lowerContext.includes('maps') || lowerContext.includes('geocod') || lowerContext.includes('places')) {
        return 'maps';
    } else if (lowerContext.includes('gemini') || lowerContext.includes('generativelanguage') || lowerContext.includes('ai')) {
        return 'gemini';
    } else if (lowerContext.includes('firebase') || lowerContext.includes('firestore') || lowerContext.includes('database')) {
        return 'firebase';
    } else if (lowerContext.includes('youtube') || lowerContext.includes('video')) {
        return 'youtube';
    } else if (lowerContext.includes('drive') || lowerContext.includes('docs') || lowerContext.includes('sheets')) {
        return 'workspace';
    }
    
    return 'unknown';
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        GOOGLE_API_KEY_REGEX,
        extractGoogleAPIKeys,
        isValidGoogleAPIKeyFormat,
        extractKeysFromJS,
        detectKeyType
    };
}
