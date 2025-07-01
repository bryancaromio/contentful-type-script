#!/usr/bin/env node
require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { toContentfulEnv, getTargetGithubEnv } = require('./utils/environment-mapper');

// Process arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// Remove flags from arguments
const environments = args.filter(arg => !arg.startsWith('--'));
const command = environments[0]; // 'sync' or 'check'
const sourceEnv = environments[1];
let targetEnv = environments[2];

if (!command || !sourceEnv) {
  console.error(`
❌ Error: Command and source environment are required

Usage: 
  node sync-environments.js <command> <source-env> [target-env] [options]

Commands:
  sync     Synchronize changes between environments
  check    Check differences without applying changes

Options:
  --dry-run    Only generate migration script without applying it

Examples:
  node sync-environments.js sync develop     # Will automatically promote to qa
  node sync-environments.js sync qa          # Will automatically promote to staging
  node sync-environments.js sync staging     # Will automatically promote to main
  node sync-environments.js sync develop qa  # Explicitly specify target (optional)
  node sync-environments.js check develop    # Check differences with qa
  node sync-environments.js sync develop --dry-run
`);
  process.exit(1);
}

try {
  // If target environment is not specified, determine it automatically
  if (!targetEnv) {
    targetEnv = getTargetGithubEnv(sourceEnv);
  }

  // Convert GitHub environment names to Contentful environment names
  const contentfulSourceEnv = toContentfulEnv(sourceEnv);
  const contentfulTargetEnv = toContentfulEnv(targetEnv);

  console.log(`
🔄 ${dryRun ? 'Generating migration' : 'Synchronizing environments'}:
   ${sourceEnv} → ${targetEnv}
   ${dryRun ? '(simulation mode - no changes will be applied)' : ''}
`);

  // 1. Generate migration
  console.log('📝 Generating migration script...');
  execSync(`node ${path.join(__dirname, 'generate-migration.js')} ${contentfulSourceEnv} ${contentfulTargetEnv}`, { stdio: 'inherit' });

  // 2. Get the name of the last generated migration file
  const migrationsDir = path.join(process.cwd(), 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.js'))
    .sort((a, b) => b.localeCompare(a)); // Sort by name descending

  if (files.length === 0) {
    console.log('✨ No differences to migrate between environments.');
    process.exit(0);
  }

  const latestMigration = files[0];

  // Show the generated script content
  console.log(`\n📄 Generated migration script: ${latestMigration}`);
  console.log('\n=== Script Content ===\n');
  const scriptContent = fs.readFileSync(path.join(migrationsDir, latestMigration), 'utf8');
  console.log(scriptContent);
  console.log('\n=== End of Script ===\n');

  if (command === 'check' || dryRun) {
    console.log(`
✅ Check completed:
   - Generated script: ${latestMigration}
   - Source: ${sourceEnv}
   - Target: ${targetEnv}

💡 To apply this migration, run:
   node sync-environments.js sync ${sourceEnv}
`);
  } else {
    // 3. Execute migration
    console.log(`\n🚀 Applying migration: ${latestMigration}`);
    
    // Force migration if target environment is not development
    const forceFlag = contentfulTargetEnv !== 'development' ? 'FORCE_MIGRATION=true' : '';
    
    execSync(`${forceFlag} node ${path.join(__dirname, 'migrate.js')} ${latestMigration} ${contentfulTargetEnv}`, { 
      stdio: 'inherit',
      shell: true
    });

    console.log(`
✅ Synchronization completed successfully:
   - Applied script: ${latestMigration}
   - Source: ${sourceEnv}
   - Target: ${targetEnv}
`);
  }

} catch (error) {
  console.error(`
❌ Error during ${dryRun ? 'generation' : 'synchronization'}:
   ${error.message}

💡 Make sure to:
   1. Have the correct permissions in both environments
   2. Have correct credentials in .env
   3. Be authenticated with Contentful CLI
`);
  process.exit(1);
} 