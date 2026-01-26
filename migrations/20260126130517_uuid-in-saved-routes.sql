-- Add migration script here
ALTER TABLE saved_routes ADD COLUMN uuid varchar(40) not null default gen_random_uuid();
