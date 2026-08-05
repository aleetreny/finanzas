set statement_timeout = '30s';

-- Booking applies 21% VAT to its 15% commission: 15% * 1.21 = 18.15%.
-- Recalculate stored automatic amounts while preserving any real-world overrides.
with platform_values as (
  select
    booking.id,
    (0.15 * 1.21)::numeric as platform_rate,
    coalesce(
      booking.platform_commission_override_amount,
      round(booking.gross_before_discount * (0.15 * 1.21)::numeric, 2)
    ) as platform_amount
  from public.rental_bookings booking
  where booking.platform = 'booking'
    and booking.commission_model = 'booking_standard'
), manager_values as (
  select
    booking.id,
    platform.platform_rate,
    platform.platform_amount,
    round(
      greatest(
        booking.gross_before_discount - platform.platform_amount - booking.cleaning_fee,
        0
      ) * booking.manager_rate,
      2
    ) as manager_commission
  from public.rental_bookings booking
  join platform_values platform on platform.id = booking.id
), final_values as (
  select
    booking.id,
    manager.platform_rate,
    manager.platform_amount,
    manager.manager_commission,
    coalesce(
      booking.manager_payment_override_amount,
      round(booking.cleaning_fee + manager.manager_commission, 2)
    ) as manager_payment
  from public.rental_bookings booking
  join manager_values manager on manager.id = booking.id
)
update public.rental_bookings booking
set
  platform_commission_rate = values.platform_rate,
  platform_commission_amount = values.platform_amount,
  payout_received = round(booking.gross_before_discount - values.platform_amount, 2),
  manager_commission_amount = values.manager_commission,
  amount_payable_to_manager = values.manager_payment,
  owner_net_after_manager = round(
    booking.gross_before_discount - values.platform_amount - values.manager_payment,
    2
  )
from final_values values
where booking.id = values.id;
