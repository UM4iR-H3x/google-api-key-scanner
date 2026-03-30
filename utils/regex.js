
const GOOGLE_API_KEY_REGEX = /AIza[0-9A-Za-z-_]{35}/g;

const OBFUSCATED_PATTERNS = [
    /AIza[0-9A-Za-z-_]{10}[\s\+\-\*\/\.]+[0-9A-Za-z-_]{10}[\s\+\-\*\/\.]+[0-9A-Za-z-_]{10}[\s\+\-\*\/\.]+[0-9A-Za-z-_]{4}/g,
    /"AIza[0-9A-Za-z-_]{35}"/g,
    /AIza[0-9A-Za-z-_]+['"`\s\+]+[0-9A-Za-z-_]+['"`\s\+]+[0-9A-Za-z-_]+/g
];

const CONTEXT_PATTERNS = [
    /(?:api[_-]?key|apikey|api[_-]?secret|google[_-]?key|maps[_-]?key|gcp[_-]?key|firebase[_-]?key)[\s]*[:=][\s]*['"`]*AIza[0-9A-Za-z-_]{35}['"`]*/gi,
    /(?:key|secret)[\s]*[:=][\s]*['"`]*AIza[0-9A-Za-z-_]{35}['"`]*/gi
];

function extractGoogleAPIKeys(text) {
    const keys = new Set();
    
    const primaryMatches = text.match(GOOGLE_API_KEY_REGEX) || [];
    primaryMatches.forEach(key => keys.add(key));
    
    CONTEXT_PATTERNS.forEach(pattern => {
        const matches = text.match(pattern) || [];
        matches.forEach(match => {
            const extractedKey = match.match(/AIza[0-9A-Za-z-_]{35}/);
            if (extractedKey) {
                keys.add(extractedKey[0]);
            }
        });
    });
    
    OBFUSCATED_PATTERNS.forEach(pattern => {
        const matches = text.match(pattern) || [];
        matches.forEach(match => {
            const cleaned = match.replace(/[\s\+\-\*\/\.'"`]/g, '');
            if (cleaned.match(/^AIza[0-9A-Za-z-_]{35}$/)) {
                keys.add(cleaned);
            }
        });
    });
    
    return Array.from(keys);
}

function isValidGoogleAPIKeyFormat(key) {
    return GOOGLE_API_KEY_REGEX.test(key);
}

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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        GOOGLE_API_KEY_REGEX,
        extractGoogleAPIKeys,
        isValidGoogleAPIKeyFormat,
        extractKeysFromJS,
        detectKeyType
    };
}
