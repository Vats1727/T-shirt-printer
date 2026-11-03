const fs = require('fs');
const path = require('path');

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(fullPath));
    } else if (file.endsWith('.js')) {
      results.push(fullPath);
    }
  });
  return results;
}

const allFiles = getFiles('server/src');
console.log(`Auditing ${allFiles.length} files in server/src for while/do loops...`);

let loopsFound = 0;
for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (
      trimmed.startsWith('while') ||
      trimmed.startsWith('do {') ||
      trimmed.startsWith('do{') ||
      /for\s*\(\s*;\s*;\s*\)/.test(trimmed)
    ) {
      console.log(`${file}:${idx + 1} -> ${trimmed}`);
      loopsFound++;
    }
  });
}

console.log(`Total while/do loops found: ${loopsFound}`);

