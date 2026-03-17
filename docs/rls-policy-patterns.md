# RLS policy patterns (PostgreSQL / Supabase)

Schema Forge supports common Row Level Security (RLS) patterns via policy `for all`, optional `to` roles, and expression syntax. This guide shows three typical patterns with example `.sf` snippets.

---

## Pattern 1: User-owned rows

Each row belongs to one user. Typical for profiles or user-scoped tables.

**Idea:** One policy covering all commands with `for all`, and the same expression for both row visibility and inserts/updates (e.g. `auth.uid() = user_id` or `auth.uid() = id` for profile-style tables).

**Example (table with `user_id`):**

```sf
table posts {
  id uuid pk
  user_id uuid
  title varchar
  body text
}

policy "Users manage own posts" on posts
for all
using auth.uid() = user_id
with check auth.uid() = user_id
```

**Example (profile table, row keyed by `id`):**

```sf
table profiles {
  id uuid pk
  display_name varchar
  avatar_url text
}

policy "Users manage own profile" on profiles
for all
using auth.uid() = id
with check auth.uid() = id
```

---

## Pattern 2: Public read, authenticated write

Anyone can read; only authenticated users can insert/update/delete.

**Idea:** Use `to` to target roles: e.g. SELECT for `anon` (and optionally `authenticated`), and INSERT/UPDATE/DELETE for `authenticated` only.

**Example:**

```sf
table items {
  id uuid pk
  name varchar
  description text
}

policy "Anyone can read" on items
for select
to anon authenticated
using true

policy "Authenticated users can insert" on items
for insert
to authenticated
with check auth.role() = 'authenticated'

policy "Authenticated users can update" on items
for update
to authenticated
using auth.role() = 'authenticated'
with check auth.role() = 'authenticated'

policy "Authenticated users can delete" on items
for delete
to authenticated
using auth.role() = 'authenticated'
```

On Supabase you can often use `auth.uid() is not null` instead of `auth.role() = 'authenticated'` for write policies if you only care about “logged in” vs anonymous.

---

## Pattern 3: Multi-tenant

Rows are scoped by tenant (e.g. `tenant_id` or `org_id`). Users see rows only for tenants they belong to.

**Idea:** No new DSL syntax; use a subquery in `using` and `with check` that restricts by membership (e.g. `tenant_id in (select tenant_id from org_members where user_id = auth.uid())`).

**Example:**

```sf
table org_members {
  id uuid pk
  tenant_id uuid
  user_id uuid
  role varchar
}

table documents {
  id uuid pk
  tenant_id uuid
  title varchar
  body text
}

policy "Members see tenant documents" on documents
for all
using tenant_id in (select tenant_id from org_members where user_id = auth.uid())
with check tenant_id in (select tenant_id from org_members where user_id = auth.uid())
```

Ensure `org_members` (or your membership table) has RLS and policies so users cannot escalate by changing the subquery result.

---

## DSL reference

* **`for all`** – policy applies to SELECT, INSERT, UPDATE, and DELETE (same `using` / `with check` for all).
* **`for select | insert | update | delete`** – policy applies to a single command.
* **`to role1 [role2 ...]`** – optional; restricts the policy to the given roles (e.g. `anon`, `authenticated`). Omitted means the policy applies to PUBLIC.

Expressions in `using` and `with check` are passed through to the generated SQL; use valid PostgreSQL (and Supabase `auth.*`) expressions.
