-- Booking destination is now an explicit method + URL pair, replacing the
-- single `cal_com_link` column. Methods: calendly (iframe embed), booksy
-- (external link only — Booksy blocks iframing), phone (tel: link).
alter table public.content
  rename column cal_com_link to booking_url;

alter table public.content
  add column if not exists booking_method text not null default 'calendly';

alter table public.content
  add constraint content_booking_method_check
  check (booking_method in ('calendly', 'booksy', 'phone'));
