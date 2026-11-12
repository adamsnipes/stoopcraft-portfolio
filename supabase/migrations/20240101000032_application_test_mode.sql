-- ============================================================================
-- Per-client application-email test mode
--
-- The driver/employment application endpoint (/api/application) renders each
-- submission to a PDF and emails it to the client owner (notification_email, or
-- the owner's account email). Before a client goes live we want to verify that
-- flow end-to-end WITHOUT landing test submissions in the owner's inbox.
--
--   application_test_mode  -- when true, /api/application routes the PDF to the
--                             ops inbox (ADMIN_EMAIL) instead of the owner. The
--                             email is marked [TEST] and names the real recipient
--                             it would have gone to. Toggled per-client from the
--                             admin dashboard — no deploy needed. Scoped to the
--                             application endpoint only; lead emails (/api/contact)
--                             are unaffected. Defaults false (deliver to owner).
-- ============================================================================

alter table public.clients
  add column application_test_mode boolean not null default false;
