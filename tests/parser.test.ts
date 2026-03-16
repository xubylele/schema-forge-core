import { describe, expect, it } from 'vitest';
import { parseSchema } from '../src/core/parser';

describe('parseSchema', () => {
  it('should parse a simple table with basic columns', () => {
    const source = `
      table users {
        id uuid
        email varchar
        name text
      }
    `;

    const result = parseSchema(source);

    expect(result.tables).toHaveProperty('users');
    expect(result.tables.users.name).toBe('users');
    expect(result.tables.users.columns).toHaveLength(3);
    expect(result.tables.users.columns[0]).toEqual({ name: 'id', type: 'uuid', nullable: true });
    expect(result.tables.users.columns[1]).toEqual({ name: 'email', type: 'varchar', nullable: true });
    expect(result.tables.users.columns[2]).toEqual({ name: 'name', type: 'text', nullable: true });
  });

  it('should parse primary key modifier', () => {
    const source = `
      table users {
        id uuid pk
      }
    `;

    const result = parseSchema(source);

    expect(result.tables.users.columns[0]).toEqual({
      name: 'id',
      type: 'uuid',
      primaryKey: true,
      nullable: true
    });
    expect(result.tables.users.primaryKey).toBe('id');
  });

  it('should parse unique modifier', () => {
    const source = `
      table users {
        email varchar unique
      }
    `;

    const result = parseSchema(source);

    expect(result.tables.users.columns[0]).toEqual({
      name: 'email',
      type: 'varchar',
      unique: true,
      nullable: true
    });
  });

  it('should parse nullable modifier', () => {
    const source = `
      table users {
        bio text nullable
      }
    `;

    const result = parseSchema(source);

    expect(result.tables.users.columns[0]).toEqual({
      name: 'bio',
      type: 'text',
      nullable: true
    });
  });

  it('should parse not null modifier', () => {
    const source = `
      table users {
        email text not null
      }
    `;

    const result = parseSchema(source);

    expect(result.tables.users.columns[0]).toEqual({
      name: 'email',
      type: 'text',
      nullable: false
    });
  });

  it('should parse default modifier with various values', () => {
    const source = `
      table posts {
        id uuid default uuid_generate_v4()
        title varchar default 'Untitled'
        views int default 0
        created_at timestamptz default now()
      }
    `;

    const result = parseSchema(source);

    expect(result.tables.posts.columns[0].default).toBe('uuid_generate_v4()');
    expect(result.tables.posts.columns[1].default).toBe("'Untitled'");
    expect(result.tables.posts.columns[2].default).toBe('0');
    expect(result.tables.posts.columns[3].default).toBe('now()');
  });

  it('should parse default expressions that contain spaces', () => {
    const source = `
      table sessions {
        expires_at timestamptz default timezone('utc', now())
        ttl text default interval '1 day'
      }
    `;

    const result = parseSchema(source);

    expect(result.tables.sessions.columns[0].default).toBe("timezone('utc', now())");
    expect(result.tables.sessions.columns[1].default).toBe("interval '1 day'");
  });

  it('should parse foreign key modifier', () => {
    const source = `
      table posts {
        user_id uuid fk users.id
      }
    `;

    const result = parseSchema(source);

    expect(result.tables.posts.columns[0]).toEqual({
      name: 'user_id',
      type: 'uuid',
      nullable: true,
      foreignKey: {
        table: 'users',
        column: 'id'
      }
    });
  });

  it('should parse multiple modifiers on same column', () => {
    const source = `
      table users {
        email varchar unique nullable default 'none@example.com'
      }
    `;

    const result = parseSchema(source);

    expect(result.tables.users.columns[0]).toEqual({
      name: 'email',
      type: 'varchar',
      unique: true,
      nullable: true,
      default: "'none@example.com'"
    });
  });

  it('should ignore # comments', () => {
    const source = `
      # This is a comment
      table users {
        # Another comment
        id uuid pk # inline comment
        email varchar
      }
    `;

    const result = parseSchema(source);

    expect(result.tables.users.columns).toHaveLength(2);
    expect(result.tables.users.columns[0].name).toBe('id');
    expect(result.tables.users.columns[1].name).toBe('email');
  });

  it('should ignore // comments', () => {
    const source = `
      // This is a comment
      table users {
        // Another comment
        id uuid pk // inline comment
        email varchar
      }
    `;

    const result = parseSchema(source);

    expect(result.tables.users.columns).toHaveLength(2);
  });

  it('should keep # inside default string values', () => {
    const source = `
      table users {
        note text default 'ticket#123'
      }
    `;

    const result = parseSchema(source);

    expect(result.tables.users.columns[0].default).toBe("'ticket#123'");
  });

  it('should keep // inside default string values', () => {
    const source = `
      table users {
        url text default 'https://example.com'
      }
    `;

    const result = parseSchema(source);

    expect(result.tables.users.columns[0].default).toBe("'https://example.com'");
  });

  it('should parse multiple tables', () => {
    const source = `
      table users {
        id uuid pk
        email varchar unique
      }
      
      table posts {
        id uuid pk
        user_id uuid fk users.id
        title varchar
      }
    `;

    const result = parseSchema(source);

    expect(Object.keys(result.tables)).toHaveLength(2);
    expect(result.tables).toHaveProperty('users');
    expect(result.tables).toHaveProperty('posts');
    expect(result.tables.users.columns).toHaveLength(2);
    expect(result.tables.posts.columns).toHaveLength(3);
    expect(result.tables.users.primaryKey).toBe('id');
    expect(result.tables.posts.primaryKey).toBe('id');
  });

  it('should preserve column order', () => {
    const source = `
      table users {
        id uuid
        created_at timestamptz
        updated_at timestamptz
        email varchar
        name text
        active boolean
      }
    `;

    const result = parseSchema(source);

    const columnNames = result.tables.users.columns.map(c => c.name);
    expect(columnNames).toEqual([
      'id',
      'created_at',
      'updated_at',
      'email',
      'name',
      'active'
    ]);
  });

  it('should support all valid column types', () => {
    const source = `
      table test {
        col1 uuid
        col2 varchar
        col3 text
        col4 int
        col5 bigint
        col6 boolean
        col7 timestamptz
        col8 date
        col9 varchar(255)
        col10 numeric(10,2)
      }
    `;

    const result = parseSchema(source);

    expect(result.tables.test.columns).toHaveLength(10);
    expect(result.tables.test.columns.map(c => c.type)).toEqual([
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
    ]);
  });

  it('should handle empty lines and whitespace', () => {
    const source = `
      
      
      table users {
        
        id uuid
        
        email varchar
        
      }
      
      
    `;

    const result = parseSchema(source);

    expect(result.tables.users.columns).toHaveLength(2);
  });

  it('should throw error on invalid column type', () => {
    const source = `
      table users {
        id invalid_type
      }
    `;

    expect(() => parseSchema(source)).toThrow(/Invalid column type 'invalid_type'/);
  });

  it('should throw error on varchar with non-positive length', () => {
    const source = `
      table users {
        name varchar(0)
      }
    `;

    expect(() => parseSchema(source)).toThrow(/Invalid column type 'varchar\(0\)'/);
  });

  it('should throw error on numeric where scale is larger than precision', () => {
    const source = `
      table prices {
        amount numeric(2,3)
      }
    `;

    expect(() => parseSchema(source)).toThrow(/Invalid column type 'numeric\(2,3\)'/);
  });

  it('should throw error on missing closing brace', () => {
    const source = `
      table users {
        id uuid
    `;

    expect(() => parseSchema(source)).toThrow(/not closed/);
  });

  it('should throw error when table opening brace is missing', () => {
    const source = `
      table users
        id uuid
      }
    `;

    expect(() => parseSchema(source)).toThrow(/Invalid table definition/);
  });

  it('should throw error on invalid foreign key format', () => {
    const source = `
      table posts {
        user_id uuid fk invalid_format
      }
    `;

    expect(() => parseSchema(source)).toThrow(/Invalid foreign key format/);
  });

  it('should throw error on default without value', () => {
    const source = `
      table users {
        name varchar default
      }
    `;

    expect(() => parseSchema(source)).toThrow(/'default' modifier requires a value/);
  });

  it('should throw error on fk without reference', () => {
    const source = `
      table posts {
        user_id uuid fk
      }
    `;

    expect(() => parseSchema(source)).toThrow(/'fk' modifier requires a table.column reference/);
  });

  it('should throw error on unknown modifier', () => {
    const source = `
      table users {
        id uuid unknown_modifier
      }
    `;

    expect(() => parseSchema(source)).toThrow(/Unknown modifier 'unknown_modifier'/);
  });

  it('should throw error on duplicate table names', () => {
    const source = `
      table users {
        id uuid
      }
      
      table users {
        email varchar
      }
    `;

    expect(() => parseSchema(source)).toThrow(/Duplicate table definition 'users'/);
  });

  it('should throw error on invalid column definition', () => {
    const source = `
      table users {
        id
      }
    `;

    expect(() => parseSchema(source)).toThrow(/Invalid column definition/);
  });

  it('should throw error on unexpected content outside table', () => {
    const source = `
      table users {
        id uuid
      }
      
      random content here
    `;

    expect(() => parseSchema(source)).toThrow(/Unexpected content/);
  });

  it('should handle complex real-world example', () => {
    const source = `
      # Database schema for blog application
      
      table users {
        id uuid pk
        email varchar unique
        username varchar unique
        password_hash varchar
        bio text nullable
        avatar_url varchar nullable
        created_at timestamptz default now()
        updated_at timestamptz default now()
      }
      
      // Posts table
      table posts {
        id uuid pk
        user_id uuid fk users.id
        title varchar
        slug varchar unique
        content text
        published boolean default false
        view_count int default 0
        created_at timestamptz default now()
        updated_at timestamptz default now()
      }
      
      # Comments on posts
      table comments {
        id uuid pk
        post_id uuid fk posts.id
        user_id uuid fk users.id
        content text
        created_at timestamptz default now()
      }
    `;

    const result = parseSchema(source);

    expect(Object.keys(result.tables)).toHaveLength(3);
    expect(result.tables.users.columns).toHaveLength(8);
    expect(result.tables.posts.columns).toHaveLength(9);
    expect(result.tables.comments.columns).toHaveLength(5);

    // Verify specific columns
    expect(result.tables.posts.columns.find(c => c.name === 'user_id')).toEqual({
      name: 'user_id',
      type: 'uuid',
      nullable: true,
      foreignKey: { table: 'users', column: 'id' }
    });

    expect(result.tables.posts.columns.find(c => c.name === 'published')).toEqual({
      name: 'published',
      type: 'boolean',
      nullable: true,
      default: 'false'
    });
  });

  it('should parse users table with pk + default + fk', () => {
    const source = `
      table users {
        id uuid pk default gen_random_uuid()
        email varchar unique
        name varchar
        profile_id uuid fk profiles.id
        created_at timestamptz default now()
      }
    `;

    const result = parseSchema(source);

    expect(result.tables.users.columns).toHaveLength(5);

    // id with pk and default
    expect(result.tables.users.columns[0]).toEqual({
      name: 'id',
      type: 'uuid',
      primaryKey: true,
      nullable: true,
      default: 'gen_random_uuid()'
    });

    // profile_id with fk
    const profileIdCol = result.tables.users.columns.find(c => c.name === 'profile_id');
    expect(profileIdCol).toEqual({
      name: 'profile_id',
      type: 'uuid',
      nullable: true,
      foreignKey: { table: 'profiles', column: 'id' }
    });

    // created_at with default
    const createdAtCol = result.tables.users.columns.find(c => c.name === 'created_at');
    expect(createdAtCol?.default).toBe('now()');
  });

  // Syntax error tests for default values
  it('should throw error on incomplete function call - missing closing parenthesis', () => {
    const source = `
      table users {
        id uuid
        updated_at timestamptz default now(
      }
    `;

    expect(() => parseSchema(source)).toThrow(/Function call is missing closing parenthesis/);
  });

  it('should throw error on mismatched parentheses in default value', () => {
    const source = `
      table users {
        id uuid
        value text default some_func((
      }
    `;

    expect(() => parseSchema(source)).toThrow(/Unmatched parentheses in function call/);
  });

  it('should throw error on extra closing parenthesis in default value', () => {
    const source = `
      table users {
        id uuid
        value text default func())
      }
    `;

    expect(() => parseSchema(source)).toThrow(/Unmatched parentheses in function call/);
  });

  it('should allow valid function calls with matching parentheses', () => {
    const source = `
      table users {
        id uuid default gen_random_uuid()
        created_at timestamptz default now()
      }
    `;

    const result = parseSchema(source);
    expect(result.tables.users.columns[0].default).toBe('gen_random_uuid()');
    expect(result.tables.users.columns[1].default).toBe('now()');
  });

  it('should allow simple literal default values', () => {
    const source = `
      table users {
        active boolean default true
        count int default 0
        name text default 'unknown'
      }
    `;

    const result = parseSchema(source);
    expect(result.tables.users.columns[0].default).toBe('true');
    expect(result.tables.users.columns[1].default).toBe('0');
    expect(result.tables.users.columns[2].default).toBe("'unknown'");
  });

  it('should throw error on nested mismatched parentheses', () => {
    const source = `
      table users {
        id uuid
        value text default func(nested(arg)
      }
    `;

    expect(() => parseSchema(source)).toThrow(/Function call is missing closing parenthesis/);
  });

  it('should handle multiple columns with one having invalid default', () => {
    const source = `
      table users {
        id uuid default gen_random_uuid()
        email varchar
        updated_at timestamptz default now(
      }
    `;

    expect(() => parseSchema(source)).toThrow(/Function call is missing closing parenthesis/);
  });

  describe('policy parsing', () => {
    it('should parse a single policy (example from ticket)', () => {
      const source = `
        table users {
          id uuid pk
          email varchar
        }
        policy "Users can read themselves" on users
        for select
        using auth.uid() = id
      `;

      const result = parseSchema(source);

      expect(result.tables.users.policies).toBeDefined();
      expect(result.tables.users.policies).toHaveLength(1);
      expect(result.tables.users.policies![0]).toEqual({
        name: 'Users can read themselves',
        table: 'users',
        command: 'select',
        using: 'auth.uid() = id',
      });
    });

    it('should parse policy with with check', () => {
      const source = `
        table posts {
          id uuid pk
          user_id uuid
        }
        policy "Users can update own posts" on posts
        for update
        using auth.uid() = user_id
        with check auth.uid() = user_id
      `;

      const result = parseSchema(source);

      expect(result.tables.posts.policies).toHaveLength(1);
      expect(result.tables.posts.policies![0].withCheck).toBe('auth.uid() = user_id');
      expect(result.tables.posts.policies![0].command).toBe('update');
    });

    it('should parse multiple policies on the same table', () => {
      const source = `
        table users {
          id uuid pk
        }
        policy "Select self" on users
        for select
        using auth.uid() = id

        policy "Update self" on users
        for update
        using auth.uid() = id
      `;

      const result = parseSchema(source);

      expect(result.tables.users.policies).toHaveLength(2);
      expect(result.tables.users.policies!.map((p) => p.name)).toEqual(['Select self', 'Update self']);
      expect(result.tables.users.policies!.map((p) => p.command)).toEqual(['select', 'update']);
    });

    it('should allow policy declared before table (order independence)', () => {
      const source = `
        policy "Users can read themselves" on users
        for select
        using auth.uid() = id

        table users {
          id uuid pk
          email varchar
        }
      `;

      const result = parseSchema(source);

      expect(result.tables.users.policies).toHaveLength(1);
      expect(result.tables.users.policies![0].name).toBe('Users can read themselves');
    });

    it('should ignore empty and comment lines between policy lines', () => {
      const source = `
        table users {
          id uuid pk
        }
        # comment
        policy "Read self" on users
        for select
        # inline ignored
        using auth.uid() = id
      `;

      const result = parseSchema(source);

      expect(result.tables.users.policies).toHaveLength(1);
      expect(result.tables.users.policies![0].using).toBe('auth.uid() = id');
    });

    it('should throw error when policy is missing for command', () => {
      const source = `
        table users {
          id uuid pk
        }
        policy "Bad" on users
        using auth.uid() = id
      `;

      expect(() => parseSchema(source)).toThrow(/Policy is missing 'for <command>'/);
    });

    it('should throw error on invalid for command', () => {
      const source = `
        table users {
          id uuid pk
        }
        policy "Bad" on users
        for invalid_command
      `;

      expect(() => parseSchema(source)).toThrow(/Invalid policy command 'invalid_command'/);
    });

    it('should throw error when policy references undefined table', () => {
      const source = `
        table users {
          id uuid pk
        }
        policy "Bad" on nonexistent
        for select
      `;

      expect(() => parseSchema(source)).toThrow(/references undefined table "nonexistent"/);
    });

    it('should throw error on malformed policy declaration (trailing garbage)', () => {
      const source = `
        table users {
          id uuid pk
        }
        policy "Bad" on users extra
        for select
      `;

      expect(() => parseSchema(source)).toThrow(/Invalid policy declaration/);
    });

    it('should throw error on duplicate for in policy', () => {
      const source = `
        table users {
          id uuid pk
        }
        policy "Bad" on users
        for select
        for insert
      `;

      expect(() => parseSchema(source)).toThrow(/Duplicate 'for' in policy/);
    });
  });
});
