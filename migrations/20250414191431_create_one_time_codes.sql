-- Add migration script here
CREATE TABLE one_time_codes (
    id BIGSERIAL PRIMARY KEY,
    code int not null,
    used boolean not null default false,
    user_id bigint not null references users(id),
    created_at timestamp not null default CURRENT_TIMESTAMP
);
