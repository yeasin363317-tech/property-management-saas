-- 008: let a signed-in user see invitations addressed to their own (confirmed) email,
-- so an existing account can join as tenant/team member without pasting a code.
create or replace function public.my_pending_invitations()
returns table (token uuid, role text, organization_name text, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select i.token, i.role::text, o.name, i.expires_at
  from public.invitations i
  join public.organizations o on o.id = i.organization_id
  join auth.users u on u.id = auth.uid()
  where i.status = 'pending'
    and i.expires_at > now()
    and u.email_confirmed_at is not null
    and lower(u.email) = lower(i.email)
  order by i.created_at desc;
$$;
revoke all on function public.my_pending_invitations() from public, anon;
grant execute on function public.my_pending_invitations() to authenticated;
