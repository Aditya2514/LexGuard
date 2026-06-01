/**
 * Maps raw jurisdictional strings to standardized State and Municipal body codes.
 */

const CITY_MAPPINGS = {
    "bengaluru": { state: "Karnataka", municipality: "BBMP" },
    "bangalore": { state: "Karnataka", municipality: "BBMP" },
    "mumbai": { state: "Maharashtra", municipality: "BMC" },
    "bombay": { state: "Maharashtra", municipality: "BMC" },
    "pune": { state: "Maharashtra", municipality: "PMC" },
    "new delhi": { state: "Delhi", municipality: "NDMC" },
    "delhi": { state: "Delhi", municipality: "NDMC" },
    "gurugram": { state: "Haryana", municipality: "MCG" },
    "gurgaon": { state: "Haryana", municipality: "MCG" },
    "noida": { state: "Uttar Pradesh", municipality: "NOIDA" },
    "hyderabad": { state: "Telangana", municipality: "GHMC" },
    "chennai": { state: "Tamil Nadu", municipality: "GCC" },
    "madras": { state: "Tamil Nadu", municipality: "GCC" }
};

const STATE_MAPPINGS = {
    "karnataka": "Karnataka",
    "maharashtra": "Maharashtra",
    "delhi": "Delhi",
    "tamil nadu": "Tamil Nadu",
    "gujarat": "Gujarat",
    "haryana": "Haryana",
    "telangana": "Telangana",
    "uttar pradesh": "Uttar Pradesh"
};

/**
 * Parses raw text (e.g., from enhancedGlobalContext.metadata.jurisdiction or governingLaw)
 * and returns the normalized state and municipality.
 * @param {string} rawText - The text to parse.
 * @returns {{ state: string, municipality: string|null }}
 */
function resolveJurisdiction(rawText) {
    if (!rawText) return { state: "Central", municipality: null };
    const lowerText = rawText.toLowerCase();

    // 1. Check for specific cities first (more granular)
    for (const [city, mapping] of Object.entries(CITY_MAPPINGS)) {
        if (lowerText.includes(city) || lowerText.includes(mapping.municipality.toLowerCase())) {
            return { state: mapping.state, municipality: mapping.municipality };
        }
    }

    // 2. Fallback to state level
    for (const [stateKey, stateValue] of Object.entries(STATE_MAPPINGS)) {
        if (lowerText.includes(stateKey)) {
            return { state: stateValue, municipality: null };
        }
    }

    // 3. Fallback to Central
    return { state: "Central", municipality: null };
}

module.exports = {
    resolveJurisdiction
};
