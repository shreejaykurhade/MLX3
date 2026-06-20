-- MLX3 Supabase / Postgres schema.
-- Run this in the Supabase SQL editor (or psql) when using the Supabase store.
-- The backend also works with zero setup via its in-memory store; this is for persistence.

create table if not exists sessions (
    id                  uuid primary key default gen_random_uuid(),
    wallet_address      text,
    task_prompt         text not null,
    task_type           text not null default 'prompt',
    github_url          text,
    status              text not null default 'created',
    provider_address    text,
    plan                jsonb,
    merkle_root         text,
    attestation_tx      text,
    session_id_bytes32  text,
    leaf_count          integer not null default 0,
    simulated           boolean,
    error               text,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create table if not exists actions (
    id           uuid primary key default gen_random_uuid(),
    session_id   uuid not null references sessions(id) on delete cascade,
    seq          integer not null,
    type         text not null,
    title        text not null,
    data         jsonb,
    is_leaf      boolean not null default false,
    leaf_index   integer,
    canonical    text,
    leaf_hash    text,
    committed    boolean not null default false,
    created_at   timestamptz not null default now(),
    unique (session_id, seq)
);

-- Optional mirror of the on-chain ProviderRegistry, for display/analytics.
create table if not exists providers (
    address         text primary key,
    metadata        jsonb,
    rate            text,
    stake           text,
    jobs_completed  integer not null default 0,
    active          boolean not null default true,
    synced_at       timestamptz not null default now()
);

create index if not exists idx_actions_session on actions(session_id, seq);
create index if not exists idx_sessions_wallet on sessions(wallet_address);
create index if not exists idx_sessions_created on sessions(created_at desc);
