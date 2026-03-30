/**
 * Google API Key Validation System
 * Validates detected keys against Google APIs to check if they're active and what services they can access
 */

// Cache for validation results to avoid duplicate API calls
const validationCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Validate a Google API key by testing against various Google services
 * @param {string} apiKey - The API key to validate
 * @returns {Promise<Object>} - Validation result with status and accessible services
 */
async function validateGoogleAPIKey(apiKey) {
    // Check cache first
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

    // Test against different Google APIs
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

    // Cache the result
    validationCache.set(apiKey, {
        result: validationResults,
        timestamp: Date.now()
    });

    return validationResults;
}

/**
 * Test Gemini API access (most critical based on TruffleSecurity research)
 * @param {string} apiKey - API key to test
 * @returns {Promise<Object>} - Test result
 */
async function testGeminiAPI(apiKey) {
    try {
        // Test the /models endpoint as mentioned in the blog post
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

/**
 * Test Google Maps API access
 * @param {string} apiKey - API key to test
 * @returns {Promise<Object>} - Test result
 */
async function testMapsAPI(apiKey) {
    try {
        // Test with a simple geocoding request
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

/**
 * Test YouTube API access
 * @param {string} apiKey - API key to test
 * @returns {Promise<Object>} - Test result
 */
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

/**
 * Test general Google API access
 * @param {string} apiKey - API key to test
 * @returns {Promise<Object>} - Test result
 */
async function testGeneralGoogleAPI(apiKey) {
    try {
        // Test a general endpoint that should work for most keys
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

/**
 * Get test name by index
 * @param {number} index - Test index
 * @returns {string} - Test name
 */
function getTestName(index) {
    const names = ['gemini', 'maps', 'youtube', 'general'];
    return names[index] || 'unknown';
}

/**
 * Clear validation cache
 */
function clearValidationCache() {
    validationCache.clear();
}

/**
 * Get cache statistics
 * @returns {Object} - Cache stats
 */
function getCacheStats() {
    return {
        size: validationCache.size,
        keys: Array.from(validationCache.keys())
    };
}

// Export for use in other modules
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
