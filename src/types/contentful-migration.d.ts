declare module 'contentful-migration' {
  interface Field {
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
    fields: Field[];
    displayField?: string;
  }

  interface Migration {
    createContentType(id: string, options: {
      name: string;
      description?: string;
    }): ContentType;

    editContentType(id: string): ContentType;
  }

  interface MigrationOptions {
    spaceId: string;
    accessToken: string;
    environmentId: string;
    yes: boolean;
    filePath?: string;
  }

  export function runMigration(options: MigrationOptions): Promise<void>;
} 