-- Add 'cuts' (thecut.co barbershop booking app) to the booking_method enum.
-- Surfaced only for barbershop niches in the editor. Like Booksy, The Cut
-- can't be iframed — booking section renders the link variant.
alter table public.content
  drop constraint if exists content_booking_method_check;

alter table public.content
  add constraint content_booking_method_check
  check (booking_method in ('calendly', 'booksy', 'phone', 'cuts'));
