/**
 * Template analyzer module
 */

/**
 * Analyze template and extract all Handlebars variables
 * @param {string} templateContent Template content
 * @returns {Object} Object with variable structure
 */
function analyzeTemplate(templateContent) {
    const variables = {};
    const regex = /\{\{([^}]+)\}\}/g;
    let match;

    while ((match = regex.exec(templateContent)) !== null) {
        const path = match[1].trim();
        const parts = path.split('.');
        let current = variables;
        
        // Create nested structure
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!current[part]) {
                current[part] = {};
            }
            current = current[part];
        }
        
        // Add default value for the last part
        const lastPart = parts[parts.length - 1];
        current[lastPart] = getDefaultValue(lastPart);
    }

    return variables;
}

/**
 * Generate default value based on variable name
 * @param {string} name Variable name
 * @returns {string|number} Default value
 */
function getDefaultValue(name) {
    const lowerName = name.toLowerCase();
    
    // Common type mapping
    if (lowerName.includes('name')) return 'Example Name';
    if (lowerName.includes('age') || lowerName.includes('idade')) return 30;
    if (lowerName.includes('phone') || lowerName.includes('telefone')) return '(555) 123-4567';
    if (lowerName.includes('address') || lowerName.includes('endereco')) return '123 Example St';
    if (lowerName.includes('email')) return 'example@email.com';
    if (lowerName.includes('title') || lowerName.includes('titulo')) return 'Example Title';
    if (lowerName.includes('crm')) return 'CRM/SP 12345';
    if (lowerName.includes('specialty') || lowerName.includes('especialidade')) return 'Example Specialty';
    
    return 'Example Value';
}

module.exports = {
    analyzeTemplate,
    getDefaultValue
}; 