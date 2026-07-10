// Simple axe-core run against a basic static HTML snapshot of the app root
// Note: This is a smoke test using a static HTML snapshot. For full audit run Lighthouse in Chrome.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const axe = require('axe-core');

const indexHtml = path.join(__dirname, '..', 'index.html');
if (!fs.existsSync(indexHtml)) {
  console.error('index.html not found at project root. Run this after building or add a local snapshot.');
  process.exit(1);
}

const html = fs.readFileSync(indexHtml, 'utf8');
const dom = new JSDOM(html);

const { window } = dom;
const { document } = window;

const results = axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] });

results.then((res) => {
  console.log('Axe results:');
  console.log(JSON.stringify(res, null, 2));
}).catch((err) => {
  console.error('Axe error:', err);
});
