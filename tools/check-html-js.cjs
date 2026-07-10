const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1])
  .filter(code => code.trim());

let failed = false;
scripts.forEach((code, index) => {
  try {
    new vm.Script(code, { filename: `index.html<script ${index + 1}>` });
  } catch (error) {
    failed = true;
    console.error(`Script ${index + 1} syntax error:`);
    console.error(error.stack || error.message);
  }
});

if (failed) process.exit(1);
console.log(`Checked ${scripts.length} inline scripts: OK`);
