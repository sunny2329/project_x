-- Authentication module schema.
-- Primary keys use uuidv7() (built into PostgreSQL 18): time-ordered, so B-tree inserts stay
-- append-mostly at high volume while remaining globally unique.

CREATE TABLE users (
    id                  uuid PRIMARY KEY DEFAULT uuidv7(),
    full_name           varchar(100) NOT NULL,
    email               varchar(254),
    phone               varchar(16),
    password_hash       text,
    email_verified_at   timestamptz,
    phone_verified_at   timestamptz,
    password_changed_at timestamptz,
    status              varchar(20)  NOT NULL DEFAULT 'active',
    last_login_at       timestamptz,
    created_at          timestamptz  NOT NULL DEFAULT now(),
    updated_at          timestamptz  NOT NULL DEFAULT now(),

    CONSTRAINT users_email_key UNIQUE (email),
    CONSTRAINT users_phone_key UNIQUE (phone),
    CONSTRAINT users_email_lowercase CHECK (email = lower(email)),
    CONSTRAINT users_phone_e164 CHECK (phone ~ '^\+[1-9][0-9]{7,14}$'),
    CONSTRAINT users_has_contact CHECK (email IS NOT NULL OR phone IS NOT NULL),
    CONSTRAINT users_status_check CHECK (status IN ('active', 'suspended', 'deleted'))
);

-- Links a user to an external identity provider (Google, Apple).
CREATE TABLE user_identities (
    id               uuid PRIMARY KEY DEFAULT uuidv7(),
    user_id          uuid         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    provider         varchar(20)  NOT NULL,
    provider_user_id varchar(255) NOT NULL,
    email            varchar(254),
    created_at       timestamptz  NOT NULL DEFAULT now(),

    CONSTRAINT user_identities_provider_check CHECK (provider IN ('google', 'apple')),
    CONSTRAINT user_identities_provider_subject_key UNIQUE (provider, provider_user_id),
    CONSTRAINT user_identities_user_provider_key UNIQUE (user_id, provider)
);

-- One row per signed-in device. The refresh token is "<session id>.<secret>"; only the
-- SHA-256 of the secret is stored. Presenting an already-rotated secret revokes the session.
CREATE TABLE auth_sessions (
    id                 uuid PRIMARY KEY DEFAULT uuidv7(),
    user_id            uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    refresh_token_hash bytea       NOT NULL,
    user_agent         varchar(255),
    ip_address         inet,
    created_at         timestamptz NOT NULL DEFAULT now(),
    last_used_at       timestamptz NOT NULL DEFAULT now(),
    expires_at         timestamptz NOT NULL,
    revoked_at         timestamptz,
    revoked_reason     varchar(30),

    CONSTRAINT auth_sessions_revoked_reason_check
        CHECK (revoked_reason IN ('logout', 'rotation_reuse', 'password_reset'))
);

-- "Revoke all sessions for a user" only needs the live ones.
CREATE INDEX auth_sessions_user_active_idx ON auth_sessions (user_id) WHERE revoked_at IS NULL;
-- Supports a future cleanup job that deletes expired sessions in batches.
CREATE INDEX auth_sessions_expires_at_idx ON auth_sessions (expires_at);
