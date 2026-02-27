import { describe, expect, it } from 'vitest';
import { validateSchema } from '../src/core/validator';
import type { DatabaseSchema } from '../src/types/schema';

describe('validateSchema', () => {
  it('should not throw error for valid schema', () => {
    const validSchema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [
            { name: 'id', type: 'uuid', primaryKey: true },
            { name: 'email', type: 'varchar', unique: true },
            { name: 'created_at', type: 'timestamptz' }
          ]
        }
      }
    };

    expect(() => validateSchema(validSchema)).not.toThrow();
  });

  it('should not throw error for valid schema with foreign keys', () => {
    const validSchema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [
            { name: 'id', type: 'uuid', primaryKey: true }
          ]
        },
        posts: {
          name: 'posts',
          columns: [
            { name: 'id', type: 'uuid', primaryKey: true },
            {
              name: 'user_id',
              type: 'uuid',
              foreignKey: { table: 'users', column: 'id' }
            }
          ]
        }
      }
    };

    expect(() => validateSchema(validSchema)).not.toThrow();
  });

  it('should throw error on duplicate column', () => {
    const schema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [
            { name: 'id', type: 'uuid', primaryKey: true },
            { name: 'email', type: 'varchar' },
            { name: 'email', type: 'text' }
          ]
        }
      }
    };

    expect(() => validateSchema(schema)).toThrow(
      "Table 'users': duplicate column 'email'"
    );
  });

  it('should throw error on multiple primary keys', () => {
    const schema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [
            { name: 'id', type: 'uuid', primaryKey: true },
            { name: 'email', type: 'varchar', primaryKey: true }
          ]
        }
      }
    };

    expect(() => validateSchema(schema)).toThrow(
      "Table 'users': can only have one primary key (found 2)"
    );
  });

  it('should throw error on invalid column type', () => {
    const schema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [
            { name: 'id', type: 'uuid', primaryKey: true },
            { name: 'name', type: 'invalid_type' as any }
          ]
        }
      }
    };

    expect(() => validateSchema(schema)).toThrow(
      /type 'invalid_type' is not valid/
    );
  });

  it('should throw error on foreign key to nonexistent table', () => {
    const schema: DatabaseSchema = {
      tables: {
        posts: {
          name: 'posts',
          columns: [
            { name: 'id', type: 'uuid', primaryKey: true },
            {
              name: 'user_id',
              type: 'uuid',
              foreignKey: { table: 'nonexistent_table', column: 'id' }
            }
          ]
        }
      }
    };

    expect(() => validateSchema(schema)).toThrow(
      "referenced table 'nonexistent_table' does not exist"
    );
  });

  it('should throw error on foreign key to nonexistent column', () => {
    const schema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [
            { name: 'id', type: 'uuid', primaryKey: true }
          ]
        },
        posts: {
          name: 'posts',
          columns: [
            { name: 'id', type: 'uuid', primaryKey: true },
            {
              name: 'user_id',
              type: 'uuid',
              foreignKey: { table: 'users', column: 'nonexistent_column' }
            }
          ]
        }
      }
    };

    expect(() => validateSchema(schema)).toThrow(
      "table 'users' does not have column 'nonexistent_column'"
    );
  });

  it('should validate all valid column types', () => {
    const validTypes = [
      'uuid',
      'varchar',
      'text',
      'int',
      'bigint',
      'boolean',
      'timestamptz',
      'date',
      'varchar(255)',
      'numeric(10,2)',
    ];

    const schema: DatabaseSchema = {
      tables: {
        test: {
          name: 'test',
          columns: validTypes.map((type, index) => ({
            name: `col${index}`,
            type: type as any,
            primaryKey: index === 0
          }))
        }
      }
    };

    expect(() => validateSchema(schema)).not.toThrow();
  });

  it('should handle multiple tables with valid references', () => {
    const schema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [
            { name: 'id', type: 'uuid', primaryKey: true },
            { name: 'email', type: 'varchar', unique: true }
          ]
        },
        posts: {
          name: 'posts',
          columns: [
            { name: 'id', type: 'uuid', primaryKey: true },
            {
              name: 'user_id',
              type: 'uuid',
              foreignKey: { table: 'users', column: 'id' }
            }
          ]
        },
        comments: {
          name: 'comments',
          columns: [
            { name: 'id', type: 'uuid', primaryKey: true },
            {
              name: 'post_id',
              type: 'uuid',
              foreignKey: { table: 'posts', column: 'id' }
            },
            {
              name: 'user_id',
              type: 'uuid',
              foreignKey: { table: 'users', column: 'id' }
            }
          ]
        }
      }
    };

    expect(() => validateSchema(schema)).not.toThrow();
  });

  it('should throw error on invalid type in complex schema', () => {
    const schema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [
            { name: 'id', type: 'uuid', primaryKey: true }
          ]
        },
        posts: {
          name: 'posts',
          columns: [
            { name: 'id', type: 'uuid', primaryKey: true },
            {
              name: 'user_id',
              type: 'uuid',
              foreignKey: { table: 'users', column: 'id' }
            },
            { name: 'views', type: 'bad_type' as any }
          ]
        }
      }
    };

    expect(() => validateSchema(schema)).toThrow(
      /type 'bad_type' is not valid/
    );
  });

  it('should handle columns with modifiers', () => {
    const schema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [
            { name: 'id', type: 'uuid', primaryKey: true },
            { name: 'email', type: 'varchar', unique: true, nullable: false },
            { name: 'bio', type: 'text', nullable: true }
          ]
        }
      }
    };

    expect(() => validateSchema(schema)).not.toThrow();
  });

  it('should validate schema when table.primaryKey is set', () => {
    const schema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [
            { name: 'id', type: 'uuid' },
            { name: 'email', type: 'varchar', unique: true },
          ],
          primaryKey: 'id',
        },
      },
    };

    expect(() => validateSchema(schema)).not.toThrow();
  });

  it('should throw when table.primaryKey references missing column', () => {
    const schema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [{ name: 'id', type: 'uuid' }],
          primaryKey: 'user_id',
        },
      },
    };

    expect(() => validateSchema(schema)).toThrow(
      "Table 'users': primary key column 'user_id' does not exist"
    );
  });
});
