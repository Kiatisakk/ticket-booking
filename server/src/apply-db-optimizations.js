const { execFileSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

const applyFiles = [
  'performance_indexes.sql',
  'event_list_materialized_view.sql',
  'seat_availability_view_optimization.sql',
  'report_materialized_views.sql',
  'report_summary_materialized_views.sql'
];

const refreshFiles = [
  'refresh_event_list_materialized_view.sql',
  'refresh_report_materialized_views.sql',
  'refresh_report_summary_materialized_views.sql'
];

function runSql(file) {
  const prismaCli = path.join(rootDir, 'node_modules', 'prisma', 'build', 'index.js');

  const filePath = path.join(rootDir, 'prisma', 'migrations', file);
  console.log(`Applying ${file}...`);
  execFileSync(process.execPath, [
    prismaCli,
    'db',
    'execute',
    '--schema',
    path.join(rootDir, 'prisma', 'schema.prisma'),
    '--file',
    filePath
  ], {
    cwd: rootDir,
    stdio: 'inherit'
  });
}

function main() {
  const mode = process.argv.includes('--refresh') ? 'refresh' : 'apply';
  const files = mode === 'refresh' ? refreshFiles : applyFiles;

  console.log(mode === 'refresh'
    ? 'Refreshing optimized DB views...'
    : 'Applying DB optimizations...');

  for (const file of files) {
    runSql(file);
  }

  console.log(mode === 'refresh'
    ? 'Optimized DB views refreshed.'
    : 'DB optimizations applied.');
}

main();
