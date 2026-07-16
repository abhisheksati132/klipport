-- Create the clipboard_items table
create table if not exists clipboard_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('text', 'code', 'file', 'image')),
  title text,
  content text,
  file_url text,
  is_encrypted boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS (Row Level Security)
alter table clipboard_items enable row level security;

-- Create policies for RLS
create policy "Users can select their own clipboard items"
  on clipboard_items for select
  using (auth.uid() = user_id);

create policy "Users can insert their own clipboard items"
  on clipboard_items for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own clipboard items"
  on clipboard_items for update
  using (auth.uid() = user_id);

create policy "Users can delete their own clipboard items"
  on clipboard_items for delete
  using (auth.uid() = user_id);

-- Enable pgcrypto extension for hashing (should be enabled by default)
create extension if not exists pgcrypto;

-- Create shared_links table
create table if not exists shared_links (
  id uuid default gen_random_uuid() primary key,
  clipboard_id uuid references clipboard_items(id) on delete cascade not null,
  token text unique not null,
  password_hash text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Function to securely create a shared link with optional hashing & expiration
create or replace function create_shared_link(
  item_id uuid,
  token_val text,
  password_val text,
  expires_in_seconds int
) returns uuid security definer as $$
declare
  new_id uuid;
  pwd_hash text := null;
  exp_at timestamp with time zone := null;
begin
  -- Validate that the user owns the clipboard item
  if not exists (
    select 1 from clipboard_items 
    where id = item_id and user_id = auth.uid()
  ) then
    raise exception 'Unauthorized';
  end if;

  if password_val is not null and password_val != '' then
    pwd_hash := crypt(password_val, gen_salt('bf'));
  end if;

  if expires_in_seconds is not null and expires_in_seconds > 0 then
    exp_at := now() + (expires_in_seconds || ' seconds')::interval;
  end if;

  insert into shared_links (clipboard_id, token, password_hash, expires_at)
  values (item_id, token_val, pwd_hash, exp_at)
  returning id into new_id;
  
  return new_id;
end;
$$ language plpgsql;

-- Function to check password, expiration, and return shared clipboard item
create or replace function get_shared_item(token_val text, password_val text)
returns table (
  id uuid,
  type text,
  title text,
  content text,
  file_url text,
  created_at timestamp with time zone
) security definer as $$
declare
  link_rec record;
begin
  -- Find the shared link
  select * into link_rec from shared_links where token = token_val;
  if not found then
    raise exception 'Link not found or invalid';
  end if;
  
  -- Check expiration
  if link_rec.expires_at is not null and link_rec.expires_at < now() then
    raise exception 'Link has expired';
  end if;
  
  -- Check password if password_hash is set
  if link_rec.password_hash is not null then
    if password_val is null or link_rec.password_hash != crypt(password_val, link_rec.password_hash) then
      raise exception 'Invalid password';
    end if;
  end if;
  
  -- Return the clipboard item
  return query
  select c.id, c.type, c.title, c.content, c.file_url, c.created_at
  from clipboard_items c
  where c.id = link_rec.clipboard_id;
end;
$$ language plpgsql;

-- Alter existing table to add is_encrypted column if it doesn't exist
alter table clipboard_items add column if not exists is_encrypted boolean default false;
