const fs = require('fs');
const path = require('path');

const controllersDir = path.resolve('server/src/controllers');
const files = fs.readdirSync(controllersDir).filter(f => f.includes('.controller.js'));

console.log('Auditing modular active controllers (*.controller.js)...');

let uncovered = 0;
for (const file of files) {
  const content = fs.readFileSync(path.join(controllersDir, file), 'utf8');
  const regex = /export\s+async\s+function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*\{([\s\S]*?)(?=\nexport|\n\/\/|\Z)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const fnName = match[1];
    const params = match[2];
    const body = match[3];

    if (params.includes('res') || params.includes('req')) {
      const hasTryCatch = body.includes('try {') || body.includes('try{');
      if (!hasTryCatch) {
        console.warn(`[WARN] Active Modular Controller ${file} -> ${fnName} lacks try/catch!`);
        uncovered++;
      }
    }
  }
}

if (uncovered === 0) {
  console.log('✓ All active modular controller functions have try/catch error handling!');
} else {
  console.log(`Found ${uncovered} active functions without top-level try/catch.`);
}

