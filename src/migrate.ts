import 'dotenv/config';
import { runMigration } from 'contentful-migration';
import path from 'path';

interface MigrationOptions {
  spaceId: string;
  accessToken: string;
  environmentId: string;
  yes: boolean;
  filePath?: string;
}

const options: Omit<MigrationOptions, 'environmentId'> = {
  spaceId: process.env.CONTENTFUL_SPACE_ID!,
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN!,
  yes: true
};

// Get the migration file and environment from command line arguments
const [,, migrationFile, environment = 'development'] = process.argv;

if (!migrationFile) {
  console.error('Please provide a migration file');
  process.exit(1);
}

// Validate we're working from development
if (environment !== 'development' && !process.env.FORCE_MIGRATION) {
  console.error(`
⚠️  WARNING: Migrations must be created and tested first in the 'development' environment.
    
    Recommended process:
    1. Create and test the migration in 'development'
    2. Once tested, apply to other environments (qa, stage, master)
    
    If you really need to run this migration in ${environment},
    you can force it by setting FORCE_MIGRATION=true in your .env
  `);
  process.exit(1);
}

// Use process.cwd() to get the path from the project root
const filePath = path.join(process.cwd(), 'migrations', migrationFile);

// Add the environment to the options
const migrationOptions: MigrationOptions = {
  ...options,
  environmentId: environment,
  filePath
};

console.log(`
🚀 Starting migration:
   - File: ${migrationFile}
   - Environment: ${environment}
   - Space ID: ${options.spaceId}
`);

runMigration(migrationOptions)
  .then(() => {
    console.log(`
✅ Migration completed successfully
   File: ${migrationFile}
   Environment: ${environment}
    `);
  })
  .catch((error: Error) => {
    console.error(`
❌ Migration error:
   ${error.message}
    `);
    process.exit(1);
  }); 