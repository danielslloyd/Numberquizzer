// Expression Parser for Math Visualizer

// Validate and parse an expression string
function parseExpression(input) {
    // Normalize input: trim, replace x with *, replace × with *
    let normalized = input.trim()
        .replace(/\s+/g, ' ')
        .replace(/x/gi, '*')
        .replace(/×/g, '*');

    // Validate characters
    if (!/^[\d\s+*]+$/.test(normalized)) {
        return { valid: false, error: 'Only digits, +, and × allowed' };
    }

    // Parse tokens
    const tokens = normalized.split(/\s+/).filter(t => t);
    if (tokens.length === 0) {
        return { valid: false, error: 'Empty expression' };
    }

    // Tokenize: separate numbers and operators
    const lexemes = [];
    for (const token of tokens) {
        let i = 0;
        while (i < token.length) {
            if (/\d/.test(token[i])) {
                let num = '';
                while (i < token.length && /\d/.test(token[i])) {
                    num += token[i];
                    i++;
                }
                lexemes.push({ type: 'number', value: parseInt(num, 10) });
            } else if (token[i] === '+' || token[i] === '*') {
                lexemes.push({ type: 'operator', value: token[i] });
                i++;
            } else {
                i++;
            }
        }
    }

    // Validate structure: number op number op ... number
    if (lexemes.length === 0) {
        return { valid: false, error: 'Empty expression' };
    }
    if (lexemes[0].type !== 'number') {
        return { valid: false, error: 'Expression must start with a number' };
    }
    for (let i = 1; i < lexemes.length; i++) {
        const expected = i % 2 === 1 ? 'operator' : 'number';
        if (lexemes[i].type !== expected) {
            return { valid: false, error: 'Invalid expression format' };
        }
    }
    if (lexemes.length % 2 === 0) {
        return { valid: false, error: 'Expression must end with a number' };
    }

    // Validate number ranges
    for (const lex of lexemes) {
        if (lex.type === 'number' && lex.value > 20) {
            return { valid: false, error: 'Numbers must be ≤ 20' };
        }
    }

    // Parse with operator precedence: * before +
    const ast = buildAST(lexemes);
    if (!ast.valid) return ast;

    // Compute result
    const result = evaluateAST(ast.tree);
    if (result > 8000) {
        return { valid: false, error: 'That\'s too many blocks! Try smaller numbers.' };
    }

    return {
        valid: true,
        ast: ast.tree,
        result: result,
        expression: formatExpression(ast.tree)
    };
}

function buildAST(lexemes) {
    // Parse * first (higher precedence)
    let terms = [];
    let currentTerm = null;

    for (let i = 0; i < lexemes.length; i++) {
        if (lexemes[i].type === 'number') {
            if (currentTerm === null) {
                currentTerm = lexemes[i].value;
            } else {
                currentTerm = { op: '*', left: currentTerm, right: lexemes[i].value };
            }
        } else if (lexemes[i].value === '*') {
            // Already handled by building currentTerm
        } else if (lexemes[i].value === '+') {
            if (currentTerm !== null) {
                terms.push(currentTerm);
                currentTerm = null;
            }
        }
    }
    if (currentTerm !== null) {
        terms.push(currentTerm);
    }

    // Now handle + (lower precedence)
    if (terms.length === 0) {
        return { valid: false, error: 'Parse error' };
    }

    let ast = terms[0];
    for (let i = 1; i < terms.length; i++) {
        ast = { op: '+', left: ast, right: terms[i] };
    }

    return { valid: true, tree: ast };
}

function evaluateAST(node) {
    if (typeof node === 'number') return node;
    if (node.op === '+') {
        return evaluateAST(node.left) + evaluateAST(node.right);
    } else if (node.op === '*') {
        return evaluateAST(node.left) * evaluateAST(node.right);
    }
    return 0;
}

function formatExpression(node) {
    if (typeof node === 'number') return node.toString();
    const left = formatExpression(node.left);
    const right = formatExpression(node.right);
    const op = node.op === '*' ? ' × ' : ' + ';
    return `${left}${op}${right}`;
}

// Get visual structure from AST for animator
function getVisualStructure(ast) {
    if (typeof ast === 'number') {
        return { type: 'number', value: ast };
    }

    if (ast.op === '*') {
        const left = getVisualStructure(ast.left);
        const right = getVisualStructure(ast.right);

        if (left.type === 'number' && right.type === 'number') {
            return { type: 'multiply', a: left.value, b: right.value };
        } else if (left.type === 'multiply' && right.type === 'number') {
            return { type: 'multiply', a: left.a, b: left.b, c: right.value };
        }
        return { type: 'multiply', a: left.value || 1, b: right.value || 1 };
    } else if (ast.op === '+') {
        const left = getVisualStructure(ast.left);
        const right = getVisualStructure(ast.right);

        // Flatten nested addition groups
        const groups = [];
        if (left.type === 'add') {
            groups.push(...left.groups);
        } else {
            groups.push(left);
        }
        if (right.type === 'add') {
            groups.push(...right.groups);
        } else {
            groups.push(right);
        }

        return { type: 'add', groups };
    }

    return { type: 'number', value: 1 };
}
