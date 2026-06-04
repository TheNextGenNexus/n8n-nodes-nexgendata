/**
 * NOTE: Run with the n8n-nodes-base plugin enabled to catch n8n-specific
 * convention issues before publishing to the community node registry.
 */
module.exports = {
	root: true,
	env: {
		browser: true,
		es6: true,
		node: true,
	},
	parser: '@typescript-eslint/parser',
	parserOptions: {
		project: ['./tsconfig.json'],
		sourceType: 'module',
		extraFileExtensions: ['.json'],
	},
	ignorePatterns: [
		'.eslintrc.js',
		'**/*.js',
		'**/node_modules/**',
		'**/dist/**',
	],
	overrides: [
		{
			files: ['package.json'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/community'],
			parserOptions: {
				// package.json isn't a TS file, so don't require it to be in tsconfig.
				project: null,
			},
			rules: {
				'n8n-nodes-base/community-package-json-name-still-default': 'off',
			},
		},
		{
			files: ['./src/credentials/**/*.ts'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/credentials'],
		},
		{
			files: ['./src/nodes/**/*.ts'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/nodes'],
		},
	],
};
