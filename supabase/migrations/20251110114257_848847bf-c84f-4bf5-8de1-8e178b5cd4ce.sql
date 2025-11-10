-- Fix function search path security warning with CASCADE
drop function if exists public.handle_updated_at() cascade;

create or replace function public.handle_updated_at()
returns trigger 
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Recreate the trigger
create trigger set_updated_at
  before update on public.emotion_records
  for each row
  execute function public.handle_updated_at();