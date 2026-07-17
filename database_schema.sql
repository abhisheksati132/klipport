-- Enable pgcrypto extension for password hashing
create extension if not exists pgcrypto;

-- Create workspaces table
create table if not exists workspaces (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  owner_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create clipboard_items table (with workspace_id link)
create table if not exists clipboard_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('text', 'code', 'file', 'image')),
  title text,
  content text,
  file_url text,
  is_encrypted boolean default false,
  workspace_id uuid references workspaces(id) on delete cascade,
  self_destruct boolean default false,
  expires_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create workspace_members table
create table if not exists workspace_members (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references workspaces(id) on delete cascade not null,
  user_email text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS (Row Level Security) on tables
alter table clipboard_items enable row level security;
alter table workspaces enable row level security;
alter table workspace_members enable row level security;

-- Create policies for clipboard_items
create policy "Users can select their own clipboard items"
  on clipboard_items for select
  using (
    (auth.uid() = user_id or 
    (workspace_id is not null and exists (
      select 1 from workspaces w 
      where w.id = workspace_id and (w.owner_id = auth.uid() or w.id in (
        select m.workspace_id from workspace_members m where m.user_email = auth.email()
      ))
    )))
    and (expires_at is null or expires_at > now())
  );

create policy "Users can insert their own clipboard items"
  on clipboard_items for insert
  with check (
    auth.uid() = user_id or
    (workspace_id is not null and exists (
      select 1 from workspaces w 
      where w.id = workspace_id and (w.owner_id = auth.uid() or w.id in (
        select m.workspace_id from workspace_members m where m.user_email = auth.email()
      ))
    ))
  );

create policy "Users can update their own clipboard items"
  on clipboard_items for update
  using (auth.uid() = user_id);

create policy "Users can delete their own clipboard items"
  on clipboard_items for delete
  using (auth.uid() = user_id);

-- Create policies for workspaces
create policy "Users can view workspaces they own or belong to"
  on workspaces for select
  using (
    owner_id = auth.uid() or 
    exists (
      select 1 from workspace_members m 
      where m.workspace_id = id and m.user_email = auth.email()
    )
  );

create policy "Owners can insert workspaces"
  on workspaces for insert
  with check (owner_id = auth.uid());

create policy "Owners can delete workspaces"
  on workspaces for delete
  using (owner_id = auth.uid());

-- Create policies for workspace_members
-- 8. Configure workspace_members RLS policies
drop policy if exists "Members are viewable by other workspace members" on workspace_members;
drop policy if exists "Workspace owners can add members" on workspace_members;
drop policy if exists "Workspace owners can delete members" on workspace_members;

create policy "Members are viewable by authenticated users"
  on workspace_members for select
  using (auth.role() = 'authenticated');

create policy "Workspace owners can add members"
  on workspace_members for insert
  with check (
    exists (
      select 1 from workspaces w 
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
  );

create policy "Workspace owners can delete members"
  on workspace_members for delete
  using (
    exists (
      select 1 from workspaces w 
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
  );

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

-- Migration updates to apply additions to existing tables if needed
alter table clipboard_items add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table clipboard_items add column if not exists is_encrypted boolean default false;
alter table clipboard_items add column if not exists self_destruct boolean default false;
alter table clipboard_items add column if not exists expires_at timestamp with time zone;

-- Create cli_tokens table
create table if not exists cli_tokens (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  token_hash text unique not null,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table cli_tokens enable row level security;

create policy "Users can view their own tokens"
  on cli_tokens for select
  using (auth.uid() = user_id);

create policy "Users can insert their own tokens"
  on cli_tokens for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own tokens"
  on cli_tokens for delete
  using (auth.uid() = user_id);

-- RPC Function to push items via CLI using personal access tokens
create or replace function cli_push_item(token_val text, type_val text, title_val text, content_val text)
returns uuid security definer as $$
declare
  matched_user_id uuid;
  new_id uuid;
begin
  select t.user_id into matched_user_id from cli_tokens t where t.token_hash = encode(digest(token_val, 'sha256'), 'hex');
  if not found then
    raise exception 'Invalid CLI access token';
  end if;
  
  insert into clipboard_items (user_id, type, title, content)
  values (matched_user_id, type_val, title_val, content_val)
  returning id into new_id;
  
  return new_id;
end;
$$ language plpgsql;

-- RPC Function to retrieve latest clip via CLI using personal access tokens
create or replace function cli_get_item(token_val text)
returns table (id uuid, type text, title text, content text, created_at timestamp with time zone) security definer as $$
declare
  matched_user_id uuid;
begin
  select t.user_id into matched_user_id from cli_tokens t where t.token_hash = encode(digest(token_val, 'sha256'), 'hex');
  if not found then
    raise exception 'Invalid CLI access token';
  end if;
  
  return query
  select c.id, c.type, c.title, c.content, c.created_at
  from clipboard_items c
  where c.user_id = matched_user_id and c.workspace_id is null
  order by c.created_at desc
  limit 1;
end;
$$ language plpgsql;
alter table clipboard_items add column if not exists self_destruct boolean default false;
alter table clipboard_items add column if not exists expires_at timestamp with time zone;
alter table clipboard_items add column if not exists file_size integer;
