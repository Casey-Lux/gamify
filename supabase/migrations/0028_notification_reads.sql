create table public.notification_reads (
  user_id          uuid not null references public.profiles (id) on delete cascade,
  notification_key text not null,
  read_at          timestamptz not null default now(),
  primary key (user_id, notification_key),
  constraint notification_reads_key_length check (length(notification_key) between 1 and 200)
);

alter table public.notification_reads enable row level security;

revoke all on public.notification_reads from authenticated, anon;
grant select, insert on public.notification_reads to authenticated;

create policy notification_reads_select_self on public.notification_reads
  for select to authenticated using (user_id = auth.uid());

create policy notification_reads_insert_self on public.notification_reads
  for insert to authenticated with check (user_id = auth.uid());
