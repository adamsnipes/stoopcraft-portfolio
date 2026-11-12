alter table clients
  add column if not exists short_code text unique;

create unique index if not exists clients_short_code_idx on clients (short_code);
