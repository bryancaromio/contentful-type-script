#!/usr/bin/env node
import 'dotenv/config';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { toContentfulEnv, getTargetGithubEnv, GithubEnv } from './utils/environment-mapper';

type Command = 'sync' | 'check';

interface ProgramOptions {
  command: Command;
  sourceEnv: string;
  targetEnv?: string;
  dryRun: boolean;
}

function parseArguments(args: string[]): ProgramOptions {
  const dryRun = args.includes('--dry-run');
  
  // Remove flags from arguments
  const environments = args.filter(arg => !arg.startsWith('--'));
  const command = environments[0] as Command;
  const sourceEnv = environments[1];
  const targetEnv = environments[2];

  if (!command || !sourceEnv) {
    throw new Error('Command and source environment are required');
  }

  if (command !== 'sync' && command !== 'check') {
    throw new Error('Invalid command. Use "sync" or "check"');
  }

  return {
    command,
    sourceEnv,
    targetEnv,
    dryRun
  };
}

function showUsage(): void {
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
}

async function main(): Promise<void> {
  try {
    const options = parseArguments(process.argv.slice(2));
    
    // If target environment is not specified, determine it automatically
    const targetEnv = options.targetEnv || getTargetGithubEnv(options.sourceEnv);

    // Convert GitHub environment names to Contentful environment names
    const contentfulSourceEnv = toContentfulEnv(options.sourceEnv);
    const contentfulTargetEnv = toContentfulEnv(targetEnv);

    console.log(`
🔄 ${options.dryRun ? 'Generating migration' : 'Synchronizing environments'}:
   ${options.sourceEnv} → ${targetEnv}
   ${options.dryRun ? '(simulation mode - no changes will be applied)' : ''}
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

    if (options.command === 'check' || options.dryRun) {
      console.log(`
✅ Check completed:
   - Generated script: ${latestMigration}
   - Source: ${options.sourceEnv}
   - Target: ${targetEnv}

💡 To apply this migration, run:
   node sync-environments.js sync ${options.sourceEnv}
`);
    } else {
      // 3. Execute migration
      console.log(`\n🚀 Applying migration: ${latestMigration}`);
      
      // Force migration if target environment is not development
      const forceFlag = contentfulTargetEnv !== 'development' ? 'FORCE_MIGRATION=true' : '';
      
      execSync(`${forceFlag} node ${path.join(__dirname, 'migrate.js')} ${latestMigration} ${contentfulTargetEnv}`, { 
        stdio: 'inherit',
        shell: '/bin/bash'
      });

      console.log(`
✅ Synchronization completed successfully:
   - Applied script: ${latestMigration}
   - Source: ${options.sourceEnv}
   - Target: ${targetEnv}
`);
    }

  } catch (error) {
    console.error(`
❌ Error during ${process.env.DRY_RUN ? 'generation' : 'synchronization'}:
   ${error instanceof Error ? error.message : 'Unknown error occurred'}

💡 Make sure to:
   1. Have the correct permissions in both environments
   2. Have correct credentials in .env
   3. Be authenticated with Contentful CLI
`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
} 