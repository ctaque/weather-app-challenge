CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email varchar(255) not null,
    api_token varchar(255) not null
);
