const fs = require('fs');
const path = require('path');

const controllersDir = path.resolve('server/src/controllers');
const files = fs.readdirSync(controllersDir).filter(f => f.endsWith('.js'));

console.log('Auditing controllers for async route error safety...');

let uncovered = 0;
for (const file of files) {
  const content = fs.readFileSync(path.join(controllersDir, file), 'utf8');
  // Match exported async functions: export async function name(req, res...
  const regex = /export\s+async\s+function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*\{([\s\S]*?)(?=\nexport|\n\/\/|\Z)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const fnName = match[1];
    const params = match[2];
    const body = match[3];

    // Check if it's an express handler (has req, res)
    if (params.includes('res') || params.includes('req')) {
      const hasTryCatch = body.includes('try {') || body.includes('try{');
      if (!hasTryCatch) {
        console.warn(`[WARN] Controller ${file} -> ${fnName} lacks top-level try/catch!`);
        uncovered++;
      }
    }
  }
}

if (uncovered === 0) {
  console.log('✓ All exported async controller functions have try/catch error handling!');
} else {
  console.log(`Found ${uncovered} functions without top-level try/catch.`);
}

