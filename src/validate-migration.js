#!/usr/bin/env node
require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { toContentfulEnv } = require('./utils/environment-mapper');

// Define strict promotion paths using Contentful environment names
const ALLOWED_PROMOTIONS = {
  'development': ['qa'],
  'qa': ['stage'],
  'stage': ['master']
};

function validateEnvironments(sourceEnv, targetEnv) {
  // Convert GitHub environment names to Contentful environment names
  const contentfulSourceEnv = toContentfulEnv(sourceEnv);
  const contentfulTargetEnv = toContentfulEnv(targetEnv);

  if (!ALLOWED_PROMOTIONS[contentfulSourceEnv] || !ALLOWED_PROMOTIONS[contentfulSourceEnv].includes(contentfulTargetEnv)) {
    console.error(`
❌ Error: Promotion not allowed
   Only the following promotions are allowed:
   - develop → qa
   - qa → staging
   - staging → main

   You attempted: ${sourceEnv} → ${targetEnv}
`);
    process.exit(1);
  }
}

function validateEnvironmentVariables() {
  const requiredVars = ['CONTENTFUL_SPACE_ID', 'CONTENTFUL_MANAGEMENT_TOKEN'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error(`
❌ Error: Missing environment variables:
   ${missingVars.join(', ')}

   In GitHub Actions, make sure to configure these secrets:
   - CONTENTFUL_SPACE_ID
   - CONTENTFUL_MANAGEMENT_TOKEN
`);
    process.exit(1);
  }
}

function validateContentfulAccess(sourceEnv, targetEnv) {
  try {
    // Convert GitHub environment names to Contentful environment names
    const contentfulSourceEnv = toContentfulEnv(sourceEnv);
    const contentfulTargetEnv = toContentfulEnv(targetEnv);

    // Verify access to specific environments
    [contentfulSourceEnv, contentfulTargetEnv].forEach(env => {
      try {
        execSync(`contentful space environment list --environment-id ${env}`, { stdio: 'ignore' });
      } catch (error) {
        throw new Error(`Could not access environment ${env}`);
      }
    });
  } catch (error) {
    console.error(`
❌ Error: ${error.message}
   Make sure that:
   1. The token has correct permissions for both environments
   2. The environments exist in Contentful
   3. Environment names are correct
`);
    process.exit(1);
  }
}

function validateMigrationFiles() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    console.error(`
❌ Error: Migrations directory not found
   Directory must exist: ${migrationsDir}
`);
    process.exit(1);
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.js'));

  if (files.length === 0) {
    console.warn(`
⚠️  Warning: No migration files found
   Directory ${migrationsDir} is empty
`);
    return;
  }

  // Validate that each file is a valid module and follows the correct format
  files.forEach(file => {
    try {
      // Validate filename format (timestamp-description.js)
      if (!file.match(/^\d{14}-[a-z0-9-]+\.js$/)) {
        throw new Error(`File name does not follow the correct format (YYYYMMDDHHMMSS-description.js)`);
      }

      const migration = require(path.join(migrationsDir, file));

      // Validate that the file exports a function
      if (typeof migration !== 'function') {
        throw new Error('File must export a function');
      }

    } catch (error) {
      console.error(`
❌ Error in migration file: ${file}
   ${error.message}
`);
      process.exit(1);
    }
  });

  // Check file order
  const outOfOrderFiles = files
    .map(file => file.split('-')[0])
    .sort()
    .find((timestamp, index, array) => 
      index > 0 && parseInt(timestamp) <= parseInt(array[index - 1])
    );

  if (outOfOrderFiles) {
    console.warn(`
⚠️  Warning: Migration files might be out of order
   Make sure timestamps are sequential
`);
  }
}

// Get environments from arguments
const [,, sourceEnv, targetEnv] = process.argv;

if (!sourceEnv || !targetEnv) {
  console.error(`
❌ Error: Source and target environments are required

Usage: 
  node validate-migration.js <source-env> <target-env>

Allowed promotions:
  - develop → qa
  - qa → staging
  - staging → main
`);
  process.exit(1);
}

console.log(`
🔍 Validating migration:
   ${sourceEnv} → ${targetEnv}
`);

try {
  validateEnvironments(sourceEnv, targetEnv);
  validateEnvironmentVariables();
  validateContentfulAccess(sourceEnv, targetEnv);
  validateMigrationFiles();

  console.log(`
✅ Validation successful:
   - Valid promotion: ${sourceEnv} → ${targetEnv}
   - Environment variables configured
   - Contentful access verified
   - Migration files validated
`);
} catch (error) {
  console.error(`
❌ Error during validation:
   ${error.message}
`);
  process.exit(1);
} 