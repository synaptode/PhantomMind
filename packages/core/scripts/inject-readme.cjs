/**
 * Injects README.md content into package.json before npm pack/publish.
 * Workaround for npm 11 workspace bug where README is not embedded
 * in version-specific metadata on the npm registry.
 */
const fs = require('node:fs');

const pkgPath = 'package.json';
const readmePath = 'README.md';

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

if (fs.existsSync(readmePath)) {
  pkg.readme = fs.readFileSync(readmePath, 'utf8');
  pkg.readmeFilename = 'README.md';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}
