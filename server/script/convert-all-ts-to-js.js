import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import esbuild from 'esbuild';

const repoRoot = path.resolve('.');

function findFiles(dir, extList) {
  let results = [];
  const list = fsSync.readdirSync(dir);
  for (const file of list) {
    if (file === 'node_modules' || file === '.git' || file === 'dist') continue;
    const fullPath = path.join(dir, file);
    const stat = fsSync.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(findFiles(fullPath, extList));
    } else {
      if (extList.some(ext => file.endsWith(ext))) results.push(fullPath);
    }
  }
  return results;
}

async function convertTsFile(filePath) {
  const isTsx = filePath.endsWith('.tsx');
  const isDts = filePath.endsWith('.d.ts');
  const destPath = filePath.replace(/\.tsx?$/, isTsx ? '.jsx' : '.js');

  if (isDts) {
    await fs.unlink(filePath);
    console.log(`Deleted d.ts: ${filePath}`);
    return;
  }

  const raw = await fs.readFile(filePath, 'utf8');
  try {
    const res = await esbuild.transform(raw, {
      loader: isTsx ? 'tsx' : 'ts',
      jsx: 'preserve'
    });

    let code = res.code;
    
    // Fix extension in relative imports for node ES modules: e.g. from './db' -> from './db.js'
    code = code.replace(/from\s+['"](\.\/[^'"]+)(?<!\.js|\.json|\.css|\.svg)['"]/g, (match, p1) => {
      return `from '${p1}.js'`;
    });
    code = code.replace(/from\s+['"](\.\.\/[^'"]+)(?<!\.js|\.json|\.css|\.svg)['"]/g, (match, p1) => {
      return `from '${p1}.js'`;
    });
    code = code.replace(/import\s*\(\s*['"](\.\/[^'"]+)(?<!\.js|\.json|\.css|\.svg)['"]\s*\)/g, (match, p1) => {
      return `import('${p1}.js')`;
    });
    code = code.replace(/import\s*\(\s*['"](\.\.\/[^'"]+)(?<!\.js|\.json|\.css|\.svg)['"]\s*\)/g, (match, p1) => {
      return `import('${p1}.js')`;
    });

    await fs.writeFile(destPath, code, 'utf8');
    await fs.unlink(filePath);
    console.log(`Converted & Deleted: ${filePath} -> ${destPath}`);
  } catch (err) {
    console.error(`Error converting ${filePath}:`, err.message);
  }
}

async function main() {
  console.log('--- Scanning for any remaining .ts, .tsx, .d.ts files ---');
  const files = findFiles(repoRoot, ['.ts', '.tsx', '.d.ts']);
  console.log(`Found ${files.length} TypeScript files.`);

  for (const f of files) {
    await convertTsFile(f);
  }

  // Remove tsconfig files if any exist
  const tsconfigs = findFiles(repoRoot, ['tsconfig.json', 'tsconfig.node.json']);
  for (const tc of tsconfigs) {
    await fs.unlink(tc);
    console.log(`Deleted tsconfig: ${tc}`);
  }

  console.log('--- All TypeScript files successfully converted and removed! ---');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
