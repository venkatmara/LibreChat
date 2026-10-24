-- LCMIG-2: users and user_identities (ADR-0010). Forward-only.
-- UUIDv7 generated DB-side: 48-bit unix ms timestamp over random bits, version 7, RFC variant.
CREATE OR REPLACE FUNCTION uuid_generate_v7() RETURNS uuid
LANGUAGE sql VOLATILE AS $$
  SELECT encode(
    set_bit(
      set_bit(
        overlay(
          uuid_send(gen_random_uuid())
          PLACING substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3)
          FROM 1 FOR 6
        ),
        52, 1
      ),
      53, 1
    ),
    'hex'
  )::uuid
$$;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  legacy_id text UNIQUE, -- Mongo _id as string (ADR-0005)
  email text NOT NULL, -- PII; stored trimmed and lower-case
  username text, -- PII; NULL when empty
  name text, -- PII
  provider text NOT NULL DEFAULT 'local',
  role text NOT NULL DEFAULT 'USER',
  email_verified boolean NOT NULL DEFAULT false,
  password_hash text, -- secret; copied unchanged, never logged
  avatar text,
  tenant_id text,
  tenant_key text GENERATED ALWAYS AS (coalesce(tenant_id, '')) STORED,
  expires_at timestamptz,
  preferences jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_tenant_uq UNIQUE (email, tenant_key)
);

-- Username unique per tenant; NULL usernames are unconstrained.
CREATE UNIQUE INDEX users_username_uq ON users (tenant_key, username) WHERE username IS NOT NULL;

CREATE TABLE user_identities (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  provider text NOT NULL, -- google|facebook|openid|saml|ldap|github|discord|apple
  issuer text NOT NULL DEFAULT '', -- openidIssuer, else ''
  provider_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_identities_uq UNIQUE (provider, issuer, provider_user_id, user_id)
);

-- Serves the FK (user_id) and the provider lookup used at login.
CREATE INDEX user_identities_user_id_idx ON user_identities (user_id);
CREATE INDEX user_identities_lookup ON user_identities (provider, issuer, provider_user_id);
