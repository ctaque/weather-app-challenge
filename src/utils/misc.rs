use rand::{distr::Alphanumeric, prelude::*};
use rust_embed::Embed;
use std::{env, process};

fn get_http_port() -> u16 {
    let port_str = env::var("HTTP_PORT").unwrap_or("8080".to_string());

    port_str.parse::<u16>().unwrap_or_else(|_| {
        eprintln!("Invalid port number: {}", port_str);
        process::exit(1);
    })
}

fn get_mail_port() -> u16 {
    let port_str = env::var("MAIL_PORT").unwrap_or("26".to_string());

    port_str.parse::<u16>().unwrap_or_else(|_| {
        eprintln!("Invalid port number: {}", port_str);
        process::exit(1);
    })
}

fn get_otc_exp_minutes() -> i64 {
    let minutes = env::var("OTC_EXP_MINUTES").unwrap_or("15".to_string());

    minutes.parse::<i64>().unwrap_or_else(|_| {
        eprintln!("Invalid port number: {}", minutes);
        process::exit(1);
    })
}

pub fn generate_one_time_code() -> i32 {
    rand::rng().random_range(100000..=999999)
}

pub fn generate_random_string(len: usize) -> String {
    let s: String = rand::rng()
        .sample_iter(&Alphanumeric)
        .take(len)
        .map(char::from)
        .collect();
    s
}

#[derive(Clone, Debug)]
pub struct Env {
    pub is_prod: bool,
    pub database_url: String,
    pub http_host: String,
    pub http_port: u16,
    pub mail_from: String,
    pub mail_host: String,
    pub mail_port: u16,
    pub smtp_pass: String,
    pub otc_exp_minutes: i64,
    pub http_domain: String,
}

pub fn get_env() -> Env {
    let env: Env = Env {
        is_prod: env::var("ENVIRONMENT").unwrap_or("development".to_string())
            == "production".to_string(),
        database_url: env::var("DATABASE_URL")
            .expect("DATABASE_URL must be set in .env or environment"),

        http_host: env::var("HOST").unwrap_or("127.0.0.1".to_string()),
        http_port: get_http_port(),
        otc_exp_minutes: get_otc_exp_minutes(),
        http_domain: env::var("HTTP_DOMAIN").unwrap_or("127.0.0.1".to_string()),
        mail_from: env::var("MAIL_FROM").expect("missing MAIL_FROM env var"),
        smtp_pass: env::var("SMTP_PASSWORD").expect("missing SMTP_PASSWORD env var"),
        mail_host: env::var("SMTP_HOST").expect("missing SMTP_HOST env var"),
        mail_port: get_mail_port(),
    };

    println!("{:#?}", env);
    env
}

#[derive(Embed)]
#[folder = "./embedded"]
pub struct Asset;
