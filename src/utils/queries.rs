use crate::models::auth::{AppData, OneTimeCode, User};
use crate::models::prefered_address::{NewPreferedAddress, PreferedAddress};
use actix_web::web;
use sqlx::{self, migrate::Migrator, postgres::types::PgInterval, PgPool};

static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

pub async fn migrate_db(pool: &PgPool) -> () {
    match MIGRATOR.run(pool).await {
        Ok(_) => {
            println!("Ran migration successfully");
        }
        Err(_) => {
            println!("Migration failure");
        }
    };
}

pub async fn insert_user(
    name: &str,
    email: &str,
    api_token: &str,
    data: &AppData,
) -> Result<User, sqlx::Error> {
    sqlx::query_as!(
        User,
        "INSERT INTO users (name, email, api_token) values ($1, $2, $3) returning *",
        name,
        email,
        api_token
    )
    .fetch_one(&data.db)
    .await
}

pub async fn insert_one_time_code(
    user: &User,
    code: &i32,
    data: &AppData,
) -> Result<OneTimeCode, sqlx::Error> {
    sqlx::query_as!(
        OneTimeCode,
        "INSERT INTO one_time_codes (user_id, code) values ($1, $2) returning * ",
        user.id,
        code,
    )
    .fetch_one(&data.db)
    .await
}

pub async fn update_one_time_code_to_used(
    user: &User,
    data: &AppData,
    code: &i32,
) -> Result<OneTimeCode, sqlx::Error> {
    sqlx::query_as!(OneTimeCode,
                "UPDATE one_time_codes SET used = true WHERE user_id = $1 AND code = $2 AND used = false returning *",
                user.id,
                code
            )
            .fetch_one(&data.db)
            .await
}

pub async fn select_user_from_email(email: &str, data: &AppData) -> Result<User, sqlx::Error> {
    sqlx::query_as!(User, "SELECT * FROM users where email = $1", &email)
        .fetch_one(&data.db)
        .await
}

pub async fn select_user_from_unused_one_time_code(
    code: &i32,
    data: &AppData,
) -> Result<User, sqlx::Error> {
    let microseconds: i64 = data.env.otc_exp_minutes * 60 * 1_000_000;
    sqlx::query_as!(
        User,
        "SELECT users.* FROM users 
        JOIN one_time_codes ON users.id = one_time_codes.user_id 
        WHERE one_time_codes.code = $1 
        AND one_time_codes.used = false AND one_time_codes.created_at + $2::interval > NOW()",
        code,
        PgInterval {
            days: 0,
            months: 0,
            microseconds: microseconds.into()
        },
    )
    .fetch_one(&data.db)
    .await
}

pub async fn get_user_from_api_token(
    api_token: String,
    data: &AppData,
) -> Result<User, sqlx::Error> {
    sqlx::query_as!(User, "SELECT * from users where api_token = $1", api_token)
        .fetch_one(&data.db)
        .await
}

pub async fn get_prefered_addresses(
    user_id: i64,
    data: &AppData,
) -> Result<Vec<PreferedAddress>, sqlx::Error> {
    sqlx::query_as!(
        PreferedAddress,
        "SELECT * from prefered_addresses where user_id = $1 and deleted_at is null",
        user_id
    )
    .fetch_all(&data.db)
    .await
}

pub async fn do_save_address(
    addr: NewPreferedAddress,
    user_id: i64,
    data: web::Data<AppData>,
) -> Result<PreferedAddress, sqlx::Error> {
    sqlx::query_as!(
        PreferedAddress,
        "INSERT INTO prefered_addresses (
            address_text,
            lat,
            lng,
            user_id,
            name,
            created_at,
            updated_at
    ) values (
            $1,
            $2,
            $3,
            $4,
            $5,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        ) returning *;",
        addr.address_text,
        addr.lat,
        addr.lng,
        user_id,
        addr.name
    )
    .fetch_one(&data.db)
    .await
}

pub async fn do_delete_prefered_address(
    user_id: i64,
    id: i64,
    data: web::Data<AppData>,
) -> Result<Option<PreferedAddress>, sqlx::Error> {
    sqlx::query_as!(
        PreferedAddress,
        "DELETE from prefered_addresses WHERE user_id = $1 AND id = $2 RETURNING *",
        user_id,
        id,
    )
    .fetch_optional(&data.db)
    .await
}
