const analyzeTemplate = templateContent => {
    const allVariables = extractVariables(templateContent);
    return buildMockStructure(allVariables);
};

const extractVariables = templateContent => {
    const variables = [];
    const handlebarsExprRegex = /\{\{([^{}]*)\}\}/g;
    let match;

    while ((match = handlebarsExprRegex.exec(templateContent)) !== null) {
        const expr = match[1].trim();

        if (expr.startsWith('#') || expr.startsWith('/') || expr.startsWith('else')) {
            continue;
        }

        if (expr.startsWith('if ') || expr.startsWith('each ') || 
            expr.startsWith('unless ') || expr.startsWith('with ')) {
            continue;
        }

        if (expr.includes(' ')) {
            const parts = expr.split(' ');
            const helperName = parts[0];

            if (parts.length === 1 || parts[1].startsWith('"') || parts[1].startsWith("'") || 
                parts[1].startsWith('(') || helperName === 'now') {
                continue;
            }

            for (let i = 1; i < parts.length; i++) {
                let param = parts[i].trim();

                if (param.startsWith('"') || param.startsWith("'") || !isNaN(parseFloat(param))) {
                    continue;
                }

                if (param.startsWith('(') && param.endsWith(')')) {
                    param = param.substring(1, param.length - 1).trim();
                }

                if (!param.includes('(') && !param.includes(')') && param !== 'this') {
                    variables.push(param);
                }
            }
        } else {
            variables.push(expr);
        }
    }

    return variables;
};

const buildMockStructure = variables => {
    const mockData = {};

    variables.forEach(variable => {
        if (variable.includes('.')) {
            const parts = variable.split('.');

            let current = mockData;
            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                if (!current[part]) {
                    current[part] = {};
                }
                current = current[part];
            }

            const lastPart = parts[parts.length - 1];
            current[lastPart] = getDefaultValue();
        } else {
            mockData[variable] = getDefaultValue();
        }
    });

    return mockData;
};

const getDefaultValue = () => "Example Value";

module.exports = {
    analyzeTemplate,
    extractVariables,
    buildMockStructure,
    getDefaultValue
};
