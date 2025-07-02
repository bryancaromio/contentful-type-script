#!/usr/bin/env node
import 'dotenv/config';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface ContentTypeField {
  id: string;
  name: string;
  type: string;
  localized: boolean;
  required: boolean;
  validations?: any[];
}

interface ContentType {
  sys: {
    id: string;
  };
  name: string;
  description?: string;
  fields: ContentTypeField[];
  displayField?: string;
}

interface ContentfulExport {
  contentTypes?: ContentType[];
}

// Validate environment variables
if (!process.env.CONTENTFUL_SPACE_ID || !process.env.CONTENTFUL_MANAGEMENT_TOKEN) {
  console.error('❌ Error: CONTENTFUL_SPACE_ID and CONTENTFUL_MANAGEMENT_TOKEN are required in the .env file');
  process.exit(1);
}

// Get command line arguments
const [,, sourceEnv = 'development', targetEnv = 'qa'] = process.argv;

// Create migration filename with timestamp
const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
const migrationFileName = `migrations/${timestamp}-diff-${sourceEnv}-${targetEnv}.js`;

console.log(`
🔍 Generating migration:
   - Source environment: ${sourceEnv}
   - Target environment: ${targetEnv}
   - File: ${migrationFileName}
`);

try {
  // Ensure required directories exist
  ['migrations', 'temp'].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
  });

  const sourceFile = path.join('temp', `${sourceEnv}-export.json`);
  const targetFile = path.join('temp', `${targetEnv}-export.json`);

  // Export content from both environments
  console.log(`📤 Exporting content from ${sourceEnv}...`);
  execSync(`contentful space export \
--space-id ${process.env.CONTENTFUL_SPACE_ID} \
--environment-id ${sourceEnv} \
--management-token ${process.env.CONTENTFUL_MANAGEMENT_TOKEN} \
--content-file "${sourceFile}" \
--skip-content \
--skip-roles \
--skip-webhooks`, { stdio: 'inherit' });

  console.log(`📤 Exporting content from ${targetEnv}...`);
  execSync(`contentful space export \
--space-id ${process.env.CONTENTFUL_SPACE_ID} \
--environment-id ${targetEnv} \
--management-token ${process.env.CONTENTFUL_MANAGEMENT_TOKEN} \
--content-file "${targetFile}" \
--skip-content \
--skip-roles \
--skip-webhooks`, { stdio: 'inherit' });

  // Read and parse JSON files
  const sourceContent: ContentfulExport = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  const targetContent: ContentfulExport = JSON.parse(fs.readFileSync(targetFile, 'utf8'));

  console.log(`📊 Content types found:
   - Source (${sourceEnv}): ${sourceContent.contentTypes?.length || 0} types
   - Target (${targetEnv}): ${targetContent.contentTypes?.length || 0} types
  `);

  // Generate migration script
  let migrationScript = `/**
 * Automatically generated migration
 * Date: ${new Date().toISOString()}
 * Source: ${sourceEnv}
 * Target: ${targetEnv}
 * 
 * This script contains the content model differences between environments
 * ${sourceEnv} and ${targetEnv}.
 */

module.exports = function(migration) {
`;

  // Get content types
  const sourceContentTypes = sourceContent.contentTypes || [];
  const targetContentTypes = targetContent.contentTypes || [];

  let hasChanges = false;

  if (sourceContentTypes.length === 0) {
    console.log(`⚠️ No content types found in ${sourceEnv} environment`);
    migrationScript += `
  // No content types found in ${sourceEnv} environment
  console.log('No changes to apply');
  return;
`;
  } else {
    // Generate code for new content types and fields
    sourceContentTypes.forEach(sourceType => {
      const targetType = targetContentTypes.find(t => t.sys.id === sourceType.sys.id);
      
      if (!targetType) {
        hasChanges = true;
        console.log(`✨ Found new content type: ${sourceType.name} (${sourceType.sys.id})`);
        // New content type
        migrationScript += `
  // Create new content type: ${sourceType.name}
  const ${sourceType.sys.id} = migration.createContentType('${sourceType.sys.id}', {
    name: '${sourceType.name}',
    description: ${sourceType.description ? `'${sourceType.description}'` : 'undefined'}
  });\n`;

        // Add fields
        sourceType.fields.forEach(field => {
          const validations = field.validations ? JSON.stringify(field.validations, null, 2) : '[]';
          migrationScript += `
  ${sourceType.sys.id}.createField('${field.id}')
    .name('${field.name}')
    .type('${field.type}')
    .localized(${field.localized})
    .required(${field.required})
    .validations(${validations});\n`;
        });

        if (sourceType.displayField) {
          migrationScript += `
  ${sourceType.sys.id}.displayField('${sourceType.displayField}');\n`;
        }
      } else {
        // Compare fields for existing content types
        let hasChanges = false;
        sourceType.fields.forEach(sourceField => {
          const targetField = targetType.fields.find(f => f.id === sourceField.id);
          if (!targetField) {
            console.log(`✨ Found new field: ${sourceField.name} (${sourceField.id}) in content type ${sourceType.name}`);
            hasChanges = true;
            const validations = sourceField.validations ? JSON.stringify(sourceField.validations, null, 2) : '[]';
            migrationScript += `
  // Add new field to ${sourceType.name}
  migration.editContentType('${sourceType.sys.id}')
    .createField('${sourceField.id}')
    .name('${sourceField.name}')
    .type('${sourceField.type}')
    .localized(${sourceField.localized})
    .required(${sourceField.required})
    .validations(${validations});\n`;
          }
        });
        if (!hasChanges) {
          console.log(`ℹ️ No changes detected for content type: ${sourceType.name}`);
        }
      }
    });
  }

  if (!hasChanges) {
    migrationScript += `
  /**
   * No differences found between environments:
   * - Source: ${sourceEnv}
   * - Target: ${targetEnv}
   * 
   * This script is generated but contains no changes.
   */
  console.log('No changes to apply');
`;
  }

  migrationScript += `
  // End of migration
};`;

  // Save the file
  fs.writeFileSync(migrationFileName, migrationScript);

  // Clean up temporary files
  fs.rmSync('temp', { recursive: true, force: true });

  console.log(`
✅ Migration generated successfully:
   ${migrationFileName}

📝 Recommended process:
   1. Review the generated file content
   2. Test the migration in development:
      node migrate.js ${path.basename(migrationFileName)} development
   3. If everything is correct, apply to other environments
`);

} catch (error) {
  console.error(`
❌ Error generating migration:
   ${error instanceof Error ? error.message : 'Unknown error occurred'}

💡 Make sure to:
   1. Have contentful-cli installed globally (npm install -g contentful-cli)
   2. Be authenticated (contentful login)
   3. Have the correct permissions in both environments
`);

  // Clean up temporary files in case of error
  if (fs.existsSync('temp')) {
    fs.rmSync('temp', { recursive: true, force: true });
  }
  process.exit(1);
} 