const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const scripts = [
  'run_benchmark.js',
  'run_benchmark_heavy.js',
  'run_benchmark_ultra.js'
];

async function runAll() {
  console.log('🚀 Starting Combined Benchmark Suite Run...\n');

  for (const script of scripts) {
    console.log(`\n======================================================`);
    console.log(`▶️ RUNNING: ${script}`);
    console.log(`======================================================\n`);
    try {
      // Execute the script synchronously and pipe output to stdout
      execSync(`node ${path.join(__dirname, script)}`, { stdio: 'inherit' });
    } catch (err) {
      console.error(`❌ Benchmark ${script} failed to execute.`);
    }
  }

  console.log('\n✅ All benchmarks completed!');
  
  // Aggregate results by reading the generated markdown reports
  const reports = [
    'benchmark_report.md',
    'benchmark_report_heavy.md',
    'benchmark_report_ultra.md'
  ];

  let totalAudited = 0;
  let falsePositives = 0;
  let falseNegatives = 0;

  for (const report of reports) {
    const reportPath = path.join(__dirname, report);
    if (fs.existsSync(reportPath)) {
      const content = fs.readFileSync(reportPath, 'utf8');
      
      const auditedMatch = content.match(/Total Audited Test Cases:\*\* (\d+)/);
      if (auditedMatch) totalAudited += parseInt(auditedMatch[1]);

      const fpMatch = content.match(/System False Positive Rate:\*\* (\d+)/);
      if (fpMatch) falsePositives += parseInt(fpMatch[1]);

      const fnMatch = content.match(/System False Negative Rate:\*\* (\d+)/);
      if (fnMatch) falseNegatives += parseInt(fnMatch[1]);
    }
  }

  console.log('\n📊 --- COMBINED BENCHMARK RESULTS ---');
  console.log(`Total Test Cases Analyzed: ${totalAudited}`);
  console.log(`Cumulative False Positives: ${falsePositives}`);
  console.log(`Cumulative False Negatives: ${falseNegatives}`);
  console.log('-------------------------------------\n');
}

runAll();
