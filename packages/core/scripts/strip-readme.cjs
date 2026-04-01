/**
 * Removes injected README content from package.json after npm pack/publish.
 * Companion to inject-readme.cjs (prepack).
 */
const fs = require('node:fs');

const pkgPath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

delete pkg.readme;
delete pkg.readmeFilename;

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
