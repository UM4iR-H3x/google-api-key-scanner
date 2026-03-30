
const validationCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function validateGoogleAPIKey(apiKey) {
    const cached = validationCache.get(apiKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.result;
    }

    const validationResults = {
        key: apiKey,
        isValid: false,
        isRestricted: false,
        accessibleServices: [],
        errors: [],
        validationTime: new Date().toISOString()
    };

    const tests = [
        testGeminiAPI(apiKey),
        testMapsAPI(apiKey),
        testYouTubeAPI(apiKey),
        testGeneralGoogleAPI(apiKey)
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

    validationCache.set(apiKey, {
        result: validationResults,
        timestamp: Date.now()
    });

    return validationResults;
}

async function testGeminiAPI(apiKey) {
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
            {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            }
        );

        if (response.status === 200) {
            const data = await response.json();
            return {
                success: true,
                service: 'gemini',
                restricted: false,
                data: {
                    models: data.models?.length || 0,
                    endpoint: '/v1beta/models'
                }
            };
        } else if (response.status === 403) {
            const errorData = await response.json().catch(() => ({}));
            return {
                success: false,
                service: 'gemini',
                restricted: true,
                error: errorData.error?.message || 'Access forbidden'
            };
        } else {
            return {
                success: false,
                service: 'gemini',
                error: `HTTP ${response.status}`
            };
        }
    } catch (error) {
        return {
            success: false,
            service: 'gemini',
            error: error.message
        };
    }
}

async function testMapsAPI(apiKey) {
    try {
        const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=1600+Amphitheatre+Parkway,+Mountain+View,+CA&key=${apiKey}`,
            {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            }
        );

        if (response.status === 200) {
            const data = await response.json();
            return {
                success: true,
                service: 'maps',
                restricted: false,
                data: {
                    status: data.status,
                    results: data.results?.length || 0
                }
            };
        } else if (response.status === 403) {
            const errorData = await response.json().catch(() => ({}));
            return {
                success: false,
                service: 'maps',
                restricted: true,
                error: errorData.error?.message || 'Access forbidden'
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

async function testYouTubeAPI(apiKey) {
    try {
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&q=chrome&maxResults=1&key=${apiKey}`,
            {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            }
        );

        if (response.status === 200) {
            const data = await response.json();
            return {
                success: true,
                service: 'youtube',
                restricted: false,
                data: {
                    totalResults: data.pageInfo?.totalResults || 0,
                    items: data.items?.length || 0
                }
            };
        } else if (response.status === 403) {
            const errorData = await response.json().catch(() => ({}));
            return {
                success: false,
                service: 'youtube',
                restricted: true,
                error: errorData.error?.message || 'Access forbidden'
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

async function testGeneralGoogleAPI(apiKey) {
    try {
        const response = await fetch(
            `https://www.googleapis.com/oauth2/v2/userinfo?key=${apiKey}`,
            {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            }
        );

        if (response.status === 200) {
            return {
                success: true,
                service: 'general',
                restricted: false,
                data: 'API key is valid for general Google services'
            };
        } else {
            return {
                success: false,
                service: 'general',
                restricted: response.status === 403,
                error: `HTTP ${response.status}`
            };
        }
    } catch (error) {
        return {
            success: false,
            service: 'general',
            error: error.message
        };
    }
}

function getTestName(index) {
    const names = ['gemini', 'maps', 'youtube', 'general'];
    return names[index] || 'unknown';
}

function clearValidationCache() {
    validationCache.clear();
}

function getCacheStats() {
    return {
        size: validationCache.size,
        keys: Array.from(validationCache.keys())
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        validateGoogleAPIKey,
        testGeminiAPI,
        testMapsAPI,
        testYouTubeAPI,
        testGeneralGoogleAPI,
        clearValidationCache,
        getCacheStats
    };
}
