-- Notifications table for mentions/responsável/secretário changes
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.omnia_users(id) on delete cascade,
  type text not null check (type in ('assigned', 'secretary', 'mentioned')),
  ticket_id uuid references public.omnia_tickets(id) on delete cascade,
  comment_id uuid references public.omnia_comments(id) on delete cascade,
  created_by uuid references public.omnia_users(id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- Indexes for lookups and optional dedupe
create index if not exists notifications_user_read_idx on public.notifications (user_id, read_at);
create index if not exists notifications_type_user_ticket_comment_idx on public.notifications (type, user_id, ticket_id, comment_id);
create unique index if not exists notifications_dedupe_unread_idx
  on public.notifications (type, user_id, ticket_id, comment_id)
  where read_at is null;

-- Track active flag on users (nullable default true for backward compatibility)
alter table public.omnia_users
  add column if not exists active boolean default true;
