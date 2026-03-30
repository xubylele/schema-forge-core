import { describe, expect, it } from 'vitest';
import { schemaToDsl } from '../../src/core/sql/schema-to-dsl';
import type { DatabaseSchema } from '../../src/types/schema';

describe('schemaToDsl', () => {
  it('emits policy with for all', () => {
    const schema: DatabaseSchema = {
      tables: {
        profiles: {
          name: 'profiles',
          columns: [{ name: 'id', type: 'uuid', primaryKey: true }],
          primaryKey: 'id',
          policies: [
            {
              name: 'Own rows',
              table: 'profiles',
              command: 'all',
              using: 'auth.uid() = id',
              withCheck: 'auth.uid() = id',
            },
          ],
        },
      },
    };

    const dsl = schemaToDsl(schema);

    expect(dsl).toContain('for all');
    expect(dsl).toContain('using auth.uid() = id');
    expect(dsl).toContain('with check auth.uid() = id');
  });

  it('emits policy with to roles', () => {
    const schema: DatabaseSchema = {
      tables: {
        posts: {
          name: 'posts',
          columns: [{ name: 'id', type: 'uuid', primaryKey: true }],
          primaryKey: 'id',
          policies: [
            {
              name: 'Auth write',
              table: 'posts',
              command: 'insert',
              to: ['authenticated'],
              withCheck: 'auth.uid() = user_id',
            },
          ],
        },
      },
    };

    const dsl = schemaToDsl(schema);

    expect(dsl).toContain('to authenticated');
    expect(dsl).toContain('for insert');
  });

  it('emits policy with multiple to roles', () => {
    const schema: DatabaseSchema = {
      tables: {
        items: {
          name: 'items',
          columns: [{ name: 'id', type: 'uuid', primaryKey: true }],
          primaryKey: 'id',
          policies: [
            {
              name: 'Public read',
              table: 'items',
              command: 'select',
              to: ['anon', 'authenticated'],
            },
          ],
        },
      },
    };

    const dsl = schemaToDsl(schema);

    expect(dsl).toContain('to anon authenticated');
  });

  it('emits indexes in canonical order and format', () => {
    const schema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [
            { name: 'id', type: 'uuid', primaryKey: true },
            { name: 'email', type: 'text' },
            { name: 'org_id', type: 'uuid' },
          ],
          indexes: [
            {
              name: 'idx_users_lower_email',
              table: 'users',
              columns: [],
              unique: false,
              expression: 'lower(email)',
            },
            {
              name: 'idx_users_org_email',
              table: 'users',
              columns: ['org_id', 'email'],
              unique: true,
              where: 'deleted_at is null',
            },
          ],
        },
      },
    };

    const dsl = schemaToDsl(schema);
    expect(dsl).toContain('index idx_users_lower_email on users\nexpression lower(email)');
    expect(dsl).toContain('index idx_users_org_email on users\ncolumns org_id, email\nunique\nwhere deleted_at is null');

    const firstPos = dsl.indexOf('index idx_users_lower_email on users');
    const secondPos = dsl.indexOf('index idx_users_org_email on users');
    expect(firstPos).toBeLessThan(secondPos);
  });
});
