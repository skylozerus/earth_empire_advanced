import js from '@eslint/js';

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: 'module',
            globals: {
                // Node.js globals
                require: 'readonly',
                module: 'readonly',
                exports: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                process: 'readonly',
                console: 'readonly',
                Buffer: 'readonly',
                setTimeout: 'readonly',
                setInterval: 'readonly',
                clearTimeout: 'readonly',
                clearInterval: 'readonly',
                // Browser globals
                window: 'readonly',
                document: 'readonly',
                localStorage: 'readonly',
                location: 'readonly',
                MutationObserver: 'readonly',
                DOMParser: 'readonly',
                fetch: 'readonly',
                URLSearchParams: 'readonly',
                confirm: 'readonly',
                // Tampermonkey globals
                GM_addStyle: 'readonly',
                GM_setValue: 'readonly',
                GM_getValue: 'readonly',
                // Third-party libraries loaded via script tag
                Chart: 'readonly',
            },
        },
        rules: {
            // Enforce semicolons
            'semi': ['error', 'always'],
            'semi-spacing': ['error', { 'before': false, 'after': true }],

            // Code quality
            'no-unused-vars': ['warn', { 'argsIgnorePattern': '^_' }],
            'no-console': 'off',
            'no-var': 'warn',
            'prefer-const': 'warn',

            // Style
            'eqeqeq': ['error', 'always'],
            'curly': ['error', 'all'],
            'no-trailing-spaces': 'error',
            'indent': ['warn', 4],
            'quotes': ['warn', 'single', { 'avoidEscape': true }],
            'comma-dangle': ['warn', 'always-multiline'],
            'space-before-function-paren': ['warn', 'never'],
            'keyword-spacing': ['error', { 'before': true, 'after': true }],
            'space-infix-ops': 'error',
        },
        ignores: ['node_modules/**'],
    },
];
