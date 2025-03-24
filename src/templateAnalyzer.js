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
    // Main regex to capture Handlebars expressions
    const handlebarsExprRegex = /\{\{([^{}]*)\}\}/g;
    let match;

    while ((match = handlebarsExprRegex.exec(templateContent)) !== null) {
        const expr = match[1].trim();
        
        // Ignore block expressions like #if, #each, /if, etc.
        if (expr.startsWith('#') || expr.startsWith('/') || expr.startsWith('else')) {
            continue;
        }
        
        // Ignore common helpers
        if (expr.startsWith('if ') || expr.startsWith('each ') || 
            expr.startsWith('unless ') || expr.startsWith('with ')) {
            continue;
        }
        
        // Extract variables from expressions with helpers like formatDate, now, etc.
        if (expr.includes(' ')) {
            const parts = expr.split(' ');
            const helperName = parts[0];
            
            // Ignore helper calls without parameters or with literals
            if (parts.length === 1 || parts[1].startsWith('"') || parts[1].startsWith("'") || 
                parts[1].startsWith('(') || helperName === 'now') {
                continue;
            }
            
            // For helpers with parameters, analyze parameters to identify real variables
            for (let i = 1; i < parts.length; i++) {
                let param = parts[i].trim();
                
                // Ignore string or number literals
                if (param.startsWith('"') || param.startsWith("'") || !isNaN(parseFloat(param))) {
                    continue;
                }
                
                // Remove parentheses to capture variables inside expressions like (user.name)
                if (param.startsWith('(') && param.endsWith(')')) {
                    param = param.substring(1, param.length - 1).trim();
                }
                
                // Check if it's not another helper or helper expression
                if (!param.includes('(') && !param.includes(')') && param !== 'this') {
                    variables.push(param);
                }
            }
        } else {
            // Simple expression without spaces - likely a direct variable
            variables.push(expr);
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