-- The bootstrap table must never be readable or writable through the Data API.
-- An explicit deny policy documents that intent and keeps the RLS advisor clean.
create policy dataset_claims_deny_direct_access
  on public.dataset_claims
  for all
  to authenticated
  using (false)
  with check (false);

-- Cover foreign keys used during deletes and ownership-scoped queries.
create index asset_depreciation_entries_user_id_idx
  on public.asset_depreciation_entries(user_id);
create index assets_user_id_idx on public.assets(user_id);
create index assets_property_id_idx on public.assets(property_id);
create index assets_linked_transaction_id_idx on public.assets(linked_transaction_id);
create index dataset_claims_claimed_by_idx on public.dataset_claims(claimed_by);
create index recurring_rules_user_id_idx on public.recurring_rules(user_id);
create index recurring_rules_category_id_idx on public.recurring_rules(category_id);
create index recurring_rules_subcategory_id_idx on public.recurring_rules(subcategory_id);
create index rental_bookings_user_id_idx on public.rental_bookings(user_id);
create index rental_bookings_property_id_idx on public.rental_bookings(property_id);
create index rental_bookings_linked_transaction_id_idx on public.rental_bookings(linked_transaction_id);
create index subcategories_user_id_idx on public.subcategories(user_id);
create index transactions_account_id_idx on public.transactions(account_id);
create index transactions_category_id_idx on public.transactions(category_id);
create index transactions_subcategory_id_idx on public.transactions(subcategory_id);
create index transactions_trip_project_id_idx on public.transactions(trip_project_id);
create index transactions_recurring_rule_id_idx on public.transactions(recurring_rule_id);
create index transactions_import_batch_id_idx on public.transactions(import_batch_id);
