-- Create enum for emotion types
create type public.emotion_type as enum ('joy', 'sadness', 'anger', 'anxiety', 'confusion', 'peace');

-- Create enum for proof status
create type public.proof_status as enum ('pending', 'confirmed', 'failed');

-- Create emotion_records table
create table public.emotion_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  emotion emotion_type not null,
  intensity int not null check (intensity >= 0 and intensity <= 100),
  description text not null,
  blob_id text not null,
  walrus_url text not null,
  payload_hash text not null,
  is_public boolean not null default false,
  proof_status proof_status not null default 'pending',
  sui_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.emotion_records enable row level security;

-- RLS Policies
create policy "Users can view their own records"
  on public.emotion_records
  for select
  using (auth.uid() = user_id);

create policy "Users can view public records"
  on public.emotion_records
  for select
  using (is_public = true);

create policy "Users can insert their own records"
  on public.emotion_records
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own records"
  on public.emotion_records
  for update
  using (auth.uid() = user_id);

create policy "Users can delete their own records"
  on public.emotion_records
  for delete
  using (auth.uid() = user_id);

-- Create trigger for updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at
  before update on public.emotion_records
  for each row
  execute function public.handle_updated_at();