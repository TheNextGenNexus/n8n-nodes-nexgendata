const { src, dest } = require('gulp');

/**
 * Copy all node SVG icons from src/ to dist/ so that compiled .js files
 * sit next to the icon paths declared in INodeTypeDescription.
 */
function buildIcons() {
	const nodeSource = src('src/nodes/**/*.{png,svg}');
	const nodeDistination = nodeSource.pipe(dest('dist/nodes'));

	const credSource = src('src/credentials/**/*.{png,svg}');
	const credDistination = credSource.pipe(dest('dist/credentials'));

	return credSource && nodeDistination && credDistination;
}

exports['build:icons'] = buildIcons;
