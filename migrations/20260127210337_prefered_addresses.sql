-- Add migration script here

CREATE TABLE IF NOT EXISTS prefered_addresses (
   id bigserial primary key,
   address_text text,
   lat varchar(255),
   lng varchar(255),
   user_id bigint not null references users(id),
   name varchar(255) not null,
   created_at timestamp with time zone not null default CURRENT_TIMESTAMP,
   updated_at timestamp with time zone not null default CURRENT_TIMESTAMP,
   deleted_at timestamp with time zone
);
