insert into plans (code, name, account_type, monthly_price_cents, yearly_price_cents, max_members)
values
  ('free', 'Free', 'single', 0, 0, 1),
  ('premium_single', 'Premium Single', 'single', 600, 6000, 1),
  ('premium_couple', 'Premium Couple', 'couple', 1000, 9600, 2),
  ('premium_family', 'Premium Family', 'family', 1600, 15600, 8)
on conflict (code) do update set
  name = excluded.name,
  account_type = excluded.account_type,
  monthly_price_cents = excluded.monthly_price_cents,
  yearly_price_cents = excluded.yearly_price_cents,
  max_members = excluded.max_members,
  is_active = true;
