/**
 * Template analyzer module
 */

/**
 * Analyze template and extract all Handlebars variables
 * @param {string} templateContent Template content
 * @returns {Object} Object with variable structure
 */
function analyzeTemplate(templateContent) {
    // Step 1: Extract all variables and handle pipes/helpers
    const allVariables = extractVariables(templateContent);
    
    // Step 2: Build the mock data structure
    return buildMockStructure(allVariables);
}

/**
 * Extract all variables from template content, handling pipes/helpers
 * @param {string} templateContent Template content
 * @returns {Array} Array of variable paths
 */
function extractVariables(templateContent) {
    const variables = [];
    // Enhanced regex to capture variables even with pipes/helpers
    // Captures content after the pipe or direct variable if no pipe exists
    const regex = /\{\{\s*(?:(?:[^}|]+)\|\s*)?([^}|]+)(?:\s*\|[^}]*)?}}/g;
    let match;

    while ((match = regex.exec(templateContent)) !== null) {
        const variablePath = match[1].trim();
        
        // Ignore common Handlebars helpers and blocks
        if (!variablePath.startsWith('if') && 
            !variablePath.startsWith('each') && 
            !variablePath.startsWith('#') && 
            !variablePath.startsWith('/') &&
            !variablePath.startsWith('else')) {
            variables.push(variablePath);
        }
    }

    return variables;
}

/**
 * Build mock data structure from extracted variables
 * @param {Array} variables Array of variable paths
 * @returns {Object} Structured mock data
 */
function buildMockStructure(variables) {
    const mockData = {};

    variables.forEach(variable => {
        // Check if it's a nested variable path (with dots)
        if (variable.includes('.')) {
            const parts = variable.split('.');
            
            // Build the nested structure recursively
            let current = mockData;
            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                if (!current[part]) {
                    current[part] = {};
                }
                current = current[part];
            }
            
            // Add default value for the last part
            const lastPart = parts[parts.length - 1];
            current[lastPart] = getDefaultValue();
        } else {
            // Simple variable (without nesting)
            mockData[variable] = getDefaultValue();
        }
    });

    return mockData;
}

/**
 * Generate default value for a field
 * @returns {string} Default value
 */
function getDefaultValue() {
    // Return a generic default value for any field
    return "Example Value";
}

module.exports = {
    analyzeTemplate,
    extractVariables,
    buildMockStructure,
    getDefaultValue
}; 