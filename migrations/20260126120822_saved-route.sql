-- Add migration script here

CREATE TABLE IF NOT EXISTS saved_routes (
  id bigserial PRIMARY KEY,
  user_id bigint not null references users(id),
  route json not null,
  created_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone not null default CURRENT_TIMESTAMP,
  deleted_at timestamp with time zone
);
