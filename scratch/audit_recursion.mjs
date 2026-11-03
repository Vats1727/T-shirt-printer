import fs from 'fs';
import path from 'path';

function findFiles(dir) {
  let res = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) res = res.concat(findFiles(full));
    else if (item.name.endsWith('.js') || item.name.endsWith('.mjs')) res.push(full);
  }
  return res;
}

const files = findFiles('server/src');
console.log(`Analyzing ${files.length} server files for recursion...`);

const recursiveFindings = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  // Match function names: function foo(...) or const foo = (...) => or const foo = async (...) =>
  const funcRegex = /(?:function\s+([a-zA-Z0-9_$]+)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*=>)/g;
  let match;
  while ((match = funcRegex.exec(content)) !== null) {
    const fnName = match[1] || match[2];
    if (!fnName || fnName === 'import' || fnName === 'export') continue;

    // Check if fnName is invoked inside its own body (basic check)
    // Find matching opening brace
    const startIdx = match.index + match[0].length;
    const bodyStart = content.indexOf('{', startIdx);
    if (bodyStart === -1 || bodyStart - startIdx > 100) continue;

    // Count braces to find body end
    let depth = 1;
    let endIdx = bodyStart + 1;
    while (depth > 0 && endIdx < content.length) {
      if (content[endIdx] === '{') depth++;
      else if (content[endIdx] === '}') depth--;
      endIdx++;
    }

    const body = content.substring(bodyStart, endIdx);
    // Check if fnName( is called inside body
    const callRegex = new RegExp(`\\b${fnName}\\s*\\(`, 'g');
    const calls = body.match(callRegex);
    if (calls && calls.length > 0) {
      recursiveFindings.push({
        file: path.relative('server', file),
        fnName,
        callsCount: calls.length,
        hasCondition: body.includes('if') || body.includes('?')
      });
    }
  }
}

console.log('Recursive function findings:');
console.table(recursiveFindings);

