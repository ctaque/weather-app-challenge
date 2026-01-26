-- Add migration script here
ALTER TABLE saved_routes ADD COLUMN name varchar(255) not null;
