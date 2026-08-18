#!/usr/bin/env node

/**
 * Tailwind CSS Installation Verification Script
 * ตรวจสอบว่า Tailwind CSS ติดตั้งและ config ถูกต้อง
 */

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Verifying Tailwind CSS Installation...\n');

let allPassed = true;

// Helper function
const checkFile = (filePath, description) => {
  const exists = existsSync(join(__dirname, filePath));
  console.log(`${exists ? '✅' : '❌'} ${description}: ${filePath}`);
  if (!exists) allPassed = false;
  return exists;
};

const checkFileContent = (filePath, searchString, description) => {
  try {
    const content = readFileSync(join(__dirname, filePath), 'utf-8');
    const found = content.includes(searchString);
    console.log(`${found ? '✅' : '❌'} ${description}`);
    if (!found) allPassed = false;
    return found;
  } catch {
    console.log(`❌ ${description} (file read error)`);
    allPassed = false;
    return false;
  }
};

console.log('📦 Configuration Files:');
checkFile('tailwind.config.js', 'Tailwind config');
checkFile('postcss.config.js', 'PostCSS config');

console.log('\n📄 Core Files:');
checkFile('src/index.css', 'Main CSS file');
checkFile('src/App.tsx', 'App component');

console.log('\n🧪 Test Files:');
checkFile('src/components/TailwindTestCard.tsx', 'Test card component');
checkFile('src/pages/TailwindTestPage.tsx', 'Test page');

console.log('\n📚 Documentation:');
checkFile('docs/TAILWIND_MIGRATION_GUIDE.md', 'Migration guide');
checkFile('docs/TAILWIND_QUICK_START.md', 'Quick start guide');
checkFile('TAILWIND_INSTALLATION_SUMMARY.md', 'Installation summary');

console.log('\n🎨 Example Components:');
checkFile('src/components/examples/TailwindButtonExamples.tsx', 'Button examples');
checkFile('src/components/examples/TailwindCardExamples.tsx', 'Card examples');

console.log('\n🔧 Content Checks:');
checkFileContent(
  'src/index.css',
  '@tailwind base',
  'Tailwind directives in index.css'
);
checkFileContent(
  'tailwind.config.js',
  'content:',
  'Content paths in config'
);
checkFileContent(
  'tailwind.config.js',
  'preflight: false',
  'Preflight disabled (safe mode)'
);
checkFileContent(
  'postcss.config.js',
  'tailwindcss',
  'Tailwind in PostCSS config'
);
checkFileContent(
  'src/App.tsx',
  'TailwindTestPage',
  'Test route in App.tsx'
);

console.log('\n📊 Package Dependencies:');
try {
  const packageJson = JSON.parse(
    readFileSync(join(__dirname, 'package.json'), 'utf-8')
  );
  const devDeps = packageJson.devDependencies || {};
  
  const checkDep = (name, desc) => {
    const installed = !!devDeps[name];
    console.log(`${installed ? '✅' : '❌'} ${desc}: ${name}${installed ? ` (${devDeps[name]})` : ''}`);
    if (!installed) allPassed = false;
  };

  checkDep('tailwindcss', 'Tailwind CSS');
  checkDep('postcss', 'PostCSS');
  checkDep('autoprefixer', 'Autoprefixer');
} catch {
  console.log('❌ Could not read package.json');
  allPassed = false;
}

console.log('\n' + '='.repeat(60));
if (allPassed) {
  console.log('✅ All checks passed! Tailwind CSS is ready to use.');
  console.log('\n🚀 Next Steps:');
  console.log('   1. Run: npm run dev');
  console.log('   2. Visit: http://localhost:5173/test-tailwind');
  console.log('   3. Read: docs/TAILWIND_QUICK_START.md');
} else {
  console.log('❌ Some checks failed. Please review the installation.');
  process.exit(1);
}
console.log('='.repeat(60) + '\n');
