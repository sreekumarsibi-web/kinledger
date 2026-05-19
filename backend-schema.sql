-- KinLedger Budget MVP PostgreSQL schema
-- Intended backend stack: Node.js/NestJS + PostgreSQL + Firebase Auth + FCM + Stripe/Razorpay + OpenAI API.

create extension if not exists pgcrypto;

create type account_type as enum ('single', 'couple', 'family');
create type member_role as enum ('owner', 'spouse', 'parent', 'child');
create type member_permission as enum ('shared_only', 'summary', 'full');
create type billing_cycle as enum ('monthly', 'yearly');
create type expense_scope as enum ('personal', 'shared', 'split');
create type task_status as enum ('pending', 'completed', 'missed');
create type priority_level as enum ('low', 'medium', 'high');
create type notification_type as enum ('expense_reminder', 'bill_reminder', 'subscription_renewal', 'goal_reminder', 'assigned_task', 'overspending_alert');
create type net_worth_type as enum ('asset', 'liability');

create table users (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null unique,
  display_name text not null,
  email text unique,
  phone text unique,
  avatar_url text,
  biometric_enabled boolean not null default false,
  pin_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  account_type account_type not null default 'single',
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create table household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role member_role not null,
  permission member_permission not null default 'shared_only',
  can_edit_shared boolean not null default true,
  can_view_private boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create table account_links (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  invited_by uuid not null references users(id),
  invited_contact text not null,
  relationship member_role not null,
  permission member_permission not null default 'shared_only',
  invite_token text not null unique,
  accepted_user_id uuid references users(id),
  accepted_at timestamptz,
  expires_at timestamptz not null
);

create table plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  account_type account_type not null,
  monthly_price_cents integer not null default 0,
  yearly_price_cents integer not null default 0,
  max_members integer not null default 1,
  is_active boolean not null default true
);

create table household_plan_subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  plan_id uuid not null references plans(id),
  billing_cycle billing_cycle not null,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  status text not null default 'active',
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  created_by uuid not null references users(id),
  category text not null,
  amount_cents integer not null check (amount_cents >= 0),
  currency char(3) not null default 'USD',
  spent_at date not null,
  note text,
  payment_method text,
  scope expense_scope not null default 'personal',
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table income_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  created_by uuid not null references users(id),
  source text not null,
  amount_cents integer not null check (amount_cents >= 0),
  currency char(3) not null default 'USD',
  received_at date not null,
  note text,
  is_recurring boolean not null default false,
  created_at timestamptz not null default now()
);

create table expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses(id) on delete cascade,
  user_id uuid not null references users(id),
  share_cents integer not null check (share_cents >= 0),
  settled_at timestamptz,
  unique (expense_id, user_id)
);

create table recurring_subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  created_by uuid not null references users(id),
  name text not null,
  cost_cents integer not null check (cost_cents >= 0),
  currency char(3) not null default 'USD',
  billing_cycle billing_cycle not null,
  renewal_date date,
  cancel_recommendation text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  created_by uuid not null references users(id),
  assignee_id uuid not null references users(id),
  title text not null,
  due_date date,
  priority priority_level not null default 'medium',
  notes text,
  status task_status not null default 'pending',
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  created_by uuid not null references users(id),
  name text not null,
  target_cents integer not null check (target_cents > 0),
  saved_cents integer not null default 0 check (saved_cents >= 0),
  target_month date,
  monthly_contribution_cents integer,
  created_at timestamptz not null default now()
);

create table net_worth_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  created_by uuid not null references users(id),
  name text not null,
  item_type net_worth_type not null,
  category text not null,
  value_cents integer not null check (value_cents >= 0),
  as_of_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table reminder_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  rule_type notification_type not null,
  enabled boolean not null default true,
  local_time time,
  likely_free_window jsonb,
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  type notification_type not null,
  title text not null,
  body text not null,
  deep_link text,
  scheduled_for timestamptz,
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider text not null check (provider in ('expo', 'fcm', 'apns')),
  token text not null unique,
  platform text,
  device_name text,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table ai_assistant_messages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references users(id),
  question text not null,
  answer text not null,
  context_snapshot jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  actor_user_id uuid references users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index expenses_household_spent_at_idx on expenses (household_id, spent_at desc);
create index expenses_household_scope_idx on expenses (household_id, scope);
create index income_entries_household_received_idx on income_entries (household_id, received_at desc);
create index tasks_assignee_status_idx on tasks (assignee_id, status, due_date);
create index notifications_user_schedule_idx on notifications (user_id, scheduled_for, sent_at);
create index device_tokens_user_idx on device_tokens (user_id, is_active);
create index net_worth_household_date_idx on net_worth_items (household_id, as_of_date desc);
