// ANSI color codes for clean Windows terminal output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgGreen: '\x1b[42m\x1b[30m',
  bgRed: '\x1b[41m\x1b[37m',
};

class QAReporter {
  constructor(title = 'PureFile Site QA') {
    this.title = title;
    this.results = [];
    this.failures = [];
    this.startTime = Date.now();
  }

  addResult(name, status, details = {}) {
    const isPass = status === 'PASS';
    this.results.push({ name, status, details });

    const symbol = isPass ? `${colors.green}✔ PASS${colors.reset}` : `${colors.red}✖ FAIL${colors.reset}`;
    console.log(`  ${symbol}  ${colors.bold}${name}${colors.reset}${details.info ? ` ${colors.dim}(${details.info})${colors.reset}` : ''}`);

    if (!isPass) {
      this.failures.push({
        tool: details.tool || name,
        test: details.test || name,
        expected: details.expected || 'Successful execution',
        actual: details.actual || 'Error encountered',
        suggestedFile: details.suggestedFile || 'Check component implementation',
        error: details.error || null,
      });
    }
  }

  printSummary() {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
    const totalPassed = this.results.filter((r) => r.status === 'PASS').length;
    const totalFailed = this.failures.length;
    const total = this.results.length;

    console.log('\n' + '='.repeat(60));
    console.log(`${colors.bold}${colors.cyan}${this.title} Summary${colors.reset}`);
    console.log('='.repeat(60));

    const maxNameLen = Math.max(...this.results.map((r) => r.name.length), 20);

    for (const r of this.results) {
      const paddedName = r.name.padEnd(maxNameLen + 4, ' ');
      const statusBadge = r.status === 'PASS' ? `${colors.green}${colors.bold}PASS${colors.reset}` : `${colors.red}${colors.bold}FAIL${colors.reset}`;
      console.log(`${paddedName} ${statusBadge}`);
    }

    console.log('-'.repeat(60));

    if (totalFailed > 0) {
      console.log(`\n${colors.bgRed} ${totalFailed} TEST(S) FAILED ${colors.reset}\n`);
      console.log(`${colors.bold}${colors.red}FAILURE DIAGNOSTICS:${colors.reset}`);

      this.failures.forEach((f, idx) => {
        console.log(`\n[#${idx + 1}] ${colors.bold}${f.tool}${colors.reset}`);
        console.log(`  Test:         ${f.test}`);
        console.log(`  Expected:     ${colors.green}${f.expected}${colors.reset}`);
        console.log(`  Actual:       ${colors.red}${f.actual}${colors.reset}`);
        console.log(`  Inspect File: ${colors.yellow}${f.suggestedFile}${colors.reset}`);
        if (f.error) {
          console.log(`  Details:      ${colors.dim}${f.error.message || f.error}${colors.reset}`);
        }
      });
    } else {
      console.log(`\n${colors.bgGreen} ALL TESTS PASSED ${colors.reset} ${colors.dim}(${duration}s)${colors.reset}`);
    }

    console.log(`\nTOTAL:`);
    console.log(`  ${colors.green}✔ ${totalPassed} passed${colors.reset}`);
    console.log(`  ${totalFailed > 0 ? colors.red : colors.dim}✖ ${totalFailed} failed${colors.reset}`);
    console.log(`  ${colors.dim}Total assertions: ${total}${colors.reset}\n`);

    return totalFailed === 0;
  }
}

module.exports = {
  QAReporter,
  colors,
};
