const { spawnSync } = require('child_process');
const path = require('path');
const { colors } = require('./helpers/reporter.cjs');

console.log('\n==================================================');
console.log('  PUREFILE SITE HEALTH & PRE-DEPLOYMENT AUDIT');
console.log('  (npm run qa)');
console.log('==================================================\n');

// 1. Run Smoke Suite
console.log(`${colors.bold}STEP 1/3: Running Smoke Tests (node qa/qa-smoke.cjs)...${colors.reset}`);
const smokeRes = spawnSync(process.execPath, [path.join(__dirname, 'qa-smoke.cjs')], {
  stdio: 'inherit',
  env: process.env,
});

if (smokeRes.status !== 0) {
  console.error(`\n${colors.red}${colors.bold}✖ QA HALTED: Smoke tests failed. Fix errors above before building.${colors.reset}\n`);
  process.exit(1);
}

// 2. Run Astro Check (TypeScript + Template validation)
console.log(`\n${colors.bold}STEP 2/3: Running Type & Template Diagnostics (astro check)...${colors.reset}`);
const isWindows = process.platform === 'win32';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

const checkRes = spawnSync(npxCmd, ['astro', 'check'], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

if (checkRes.status !== 0) {
  console.error(`\n${colors.red}${colors.bold}✖ QA HALTED: astro check failed with diagnostic errors.${colors.reset}\n`);
  process.exit(1);
}

// 3. Run Production Build
console.log(`\n${colors.bold}STEP 3/3: Running Static Production Build (npm run build)...${colors.reset}`);
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

const buildRes = spawnSync(npmCmd, ['run', 'build'], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

if (buildRes.status !== 0) {
  console.error(`\n${colors.red}${colors.bold}✖ QA HALTED: Production build failed.${colors.reset}\n`);
  process.exit(1);
}

console.log(`\n${colors.bgGreen} ✔ ALL PRE-DEPLOYMENT HEALTH CHECKS PASSED ${colors.reset}\n`);
console.log('The website and all 9 active tools are healthy and ready for deployment.\n');
process.exit(0);
