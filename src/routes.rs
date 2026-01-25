use std::str::FromStr;

use actix_web::{
    http::{
        header::{HeaderName, HeaderValue},
        StatusCode,
    },
    web::{self, Redirect},
    HttpResponse, Responder, Result as ActixResult,
};
use actix_web::{HttpMessage, HttpRequest};
use base64::{
    alphabet,
    engine::{self, general_purpose},
    Engine,
};
use mime_guess::from_path;
use serde::Deserialize;
use serde_json::Value;
use sqlx::Error;

use crate::mail::send_one_time_code_mail;
use crate::misc::{generate_one_time_code, generate_random_string};
use crate::models::{ActualResponse, AppData, Response, User};
use crate::queries::{
    get_user_from_api_token, insert_one_time_code, insert_user, select_user_from_email,
    select_user_from_unused_one_time_code, update_one_time_code_to_used,
};
use anyhow::{anyhow, Error as AnyError};
use rust_embed::RustEmbed;

use actix_web::cookie::{Cookie, SameSite};

// /health
pub async fn health() -> impl Responder {
    "Alive"
}

pub async fn hello(data: web::Data<AppData>) -> ActixResult<impl Responder> {
    let users: Result<Vec<User>, Error> = sqlx::query_as::<_, User>("SELECT * FROM users")
        .fetch_all(&data.db)
        .await;

    match users {
        Ok(d) => Ok(web::Json(d)),
        Err(e) => Err(Response::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            Some(e.to_string()),
        ))?,
    }
}

#[derive(Deserialize)]
pub struct LoginPayload {
    one_time_code: i32,
}

#[derive(Deserialize)]
pub struct RegisterForm {
    name: String,
    email: String,
}

pub async fn register(
    data: web::Data<AppData>,
    form: web::Json<RegisterForm>,
) -> ActixResult<impl Responder> {
    let name = &form.name;
    let email = &form.email;

    let maybe_user = select_user_from_email(email, &data).await;

    if maybe_user.is_ok() {
        return Err(Response::new(
            StatusCode::FORBIDDEN,
            Some("A user exists with this email".to_string()),
        ))?;
    }

    let api_token = generate_random_string(255);

    let maybe_user = insert_user(name, email, &api_token, &data).await;

    if maybe_user.is_err() {
        return Err(Response::new(
            StatusCode::FORBIDDEN,
            Some(maybe_user.unwrap_err().to_string()),
        ))?;
    }

    let user = maybe_user.unwrap();

    let code = generate_one_time_code();

    let maybe_one_time_code = insert_one_time_code(&user, &code, &data).await;

    match maybe_one_time_code {
        Ok(one_time_code) => {
            // send email
            match send_one_time_code_mail(&one_time_code.code, &user.email, data.env.clone()).await
            {
                Ok(_) => Ok(HttpResponse::Ok().body("Register successful, check your emails")),
                Err(e) => {
                    println!("{:#?}", e);
                    return Err(Response::new(
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Some("cannot send otc".to_string()),
                    ))?;
                }
            }
        }
        Err(e) => Err(Response::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            Some(e.to_string()),
        ))?,
    }
}

#[derive(Deserialize)]
pub struct SendOneTimeCodeForm {
    email: String,
}

pub async fn send_one_time_code(
    json: web::Json<SendOneTimeCodeForm>,
    data: web::Data<AppData>,
) -> ActixResult<impl Responder> {
    let code = generate_one_time_code();

    let payload = json.into_inner();

    let email = payload.email;

    let maybe_user = select_user_from_email(&email, &data).await;

    if maybe_user.is_err() {
        return Err(Response::new(
            StatusCode::UNAUTHORIZED,
            Some("account with email not found".to_string()),
        ))?;
    } else {
        let user = maybe_user.unwrap();

        let maybe_one_time_code = insert_one_time_code(&user, &code, &data).await;

        match maybe_one_time_code {
            Ok(_) => {
                //send otc by email
                match send_one_time_code_mail(&code, &user.email, data.env.clone()).await {
                    Ok(_) => Ok(ActualResponse {
                        message: Some("Code send by email".to_string()),
                    }),
                    Err(e) => {
                        println!("{:#?}", e);
                        return Err(Response::new(
                            StatusCode::INTERNAL_SERVER_ERROR,
                            Some("cannot send otc".to_string()),
                        ))?;
                    }
                }
            }
            Err(e) => {
                println!("{:#?}", e);
                return Err(Response::new(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Some("cannot send otc".to_string()),
                ))?;
            }
        }
    }
}

pub async fn login(
    data: web::Data<AppData>,
    form: web::Json<LoginPayload>,
) -> ActixResult<impl Responder> {
    let payload = form.into_inner();
    let code = payload.one_time_code;

    let result = select_user_from_unused_one_time_code(&code, &data).await;

    let env = data.env.clone();

    match result {
        Ok(user) => {
            let _ = update_one_time_code_to_used(&user, &data, &code).await;
            match data.env.is_prod {
                true => Ok(HttpResponse::Ok()
                    .cookie(
                        Cookie::build("auth", user.api_token)
                            .domain(env.http_domain)
                            .path("/")
                            .secure(true)
                            .http_only(true)
                            .same_site(SameSite::None)
                            .finish(),
                    )
                    .body(
                        ActualResponse {
                            message: Some("set_cookie".to_string()),
                        }
                        .to_string(),
                    )),
                false => Ok(HttpResponse::Ok()
                    .cookie(
                        Cookie::build("auth", user.api_token)
                            .path("/")
                            .secure(false)
                            .http_only(true)
                            .same_site(SameSite::Lax)
                            .finish(),
                    )
                    .body(
                        ActualResponse {
                            message: Some("set_cookie".to_string()),
                        }
                        .to_string(),
                    )),
            }
        }
        Err(e) => Err(Response::new(
            StatusCode::FORBIDDEN,
            Some("Code expiré, utilisé ou non trouvé".to_string()),
        )
        .into()),
    }
}

#[derive(serde::Deserialize, Debug)]
pub struct GsiQuery {
    pub state: String,
    pub credential: String,
}

pub async fn gsi(
    form: web::Form<GsiQuery>,
    data: web::Data<AppData>,
) -> ActixResult<impl Responder> {
    let credential = &form.credential;
    let state = &form.state;
    let env = data.env.clone();

    let user_info_result = decode_gsi_credential(credential.to_string());
    if user_info_result.is_err() {
        return Err(Response::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            Some(user_info_result.unwrap_err().to_string()),
        )
        .into());
    }

    let user_info = user_info_result.unwrap();

    let email = user_info.email;
    let name = user_info.name;

    let maybe_user = select_user_from_email(&email, &data).await;
    let api_token = generate_random_string(255);

    let maybe_user = if let Err(e) = maybe_user {
        insert_user(&name, &email, &api_token, &data).await
    } else {
        maybe_user
    };

    if maybe_user.is_err() {
        return Err(Response::new(
            StatusCode::FORBIDDEN,
            Some(maybe_user.unwrap_err().to_string()),
        ))?;
    }

    let user = maybe_user.unwrap();

    let mut response = HttpResponse::Found().body("redirecting...");
    response.headers_mut().insert(
        HeaderName::from_str("Location").unwrap(),
        HeaderValue::from_str(state).unwrap(),
    );

    let cookie = if data.env.is_prod {
        Cookie::build("auth", user.api_token)
            .domain(env.http_domain)
            .path("/")
            .secure(true)
            .http_only(true)
            .same_site(SameSite::None)
            .finish()
    } else {
        Cookie::build("auth", user.api_token)
            .path("/")
            .secure(false)
            .http_only(true)
            .same_site(SameSite::Lax)
            .finish()
    };

    response.add_cookie(&cookie).unwrap();

    Ok(response)
}

#[derive(serde::Deserialize, Debug)]
pub struct UserInfo {
    email: String,
    name: String,
    picture: String,
}

impl From<Value> for UserInfo {
    fn from(value: Value) -> Self {
        UserInfo {
            email: value["email"].as_str().unwrap().to_string(),
            name: value["name"].as_str().unwrap().to_string(),
            picture: value["picture"].as_str().unwrap().to_string(),
        }
    }
}

fn decode_gsi_credential(token: String) -> Result<UserInfo, AnyError> {
    // Split the token into header, payload, and signature
    let parts: Vec<&str> = token.split(".").collect();

    // Decode the payload
    let payload_encoded = parts[1];
    let payload_decoded_result =
        engine::GeneralPurpose::new(&alphabet::STANDARD, general_purpose::NO_PAD)
            .decode(payload_encoded);

    if payload_decoded_result.is_err() {
        return Err(anyhow!(payload_decoded_result.unwrap_err()));
    } else {
        let payload = payload_decoded_result.unwrap();
        // Parse the payload as JSON
        let value_result: Result<Value, serde_json::Error> = serde_json::from_slice(&payload);

        if value_result.is_err() {
            return Err(anyhow!(value_result.unwrap_err()));
        } else {
            let value = value_result.unwrap();
            return Ok(value.into());
        }
    }
}

pub async fn me(req: HttpRequest, data: web::Data<AppData>) -> ActixResult<impl Responder> {
    let maybe_cookie = req.cookie("auth");

    match maybe_cookie {
        Some(cook) => {
            let user = get_user_from_api_token(cook.value().to_string(), &data).await;

            match user {
                Ok(u) => Ok(u),
                Err(e) => Err(Response::new(
                    StatusCode::NOT_FOUND,
                    Some("User not found".to_string()),
                ))?,
            }
        }
        None => Err(Response::new(
            StatusCode::UNAUTHORIZED,
            Some("Not Authenticated".to_string()),
        ))?,
    }
}

pub async fn logout(data: web::Data<AppData>) -> HttpResponse {
    let env = data.env.clone();
    match env.is_prod {
        true => HttpResponse::Ok()
            .cookie(
                Cookie::build("auth", "")
                    .path("/")
                    .domain(env.http_domain)
                    .secure(true)
                    .http_only(true)
                    .same_site(SameSite::None)
                    .finish(),
            )
            .body("ok"),
        false => HttpResponse::Ok()
            .cookie(
                Cookie::build("auth", "")
                    .path("/")
                    .secure(false)
                    .http_only(true)
                    .same_site(SameSite::Lax)
                    .finish(),
            )
            .body("ok"),
    }
}

/*
 * Frontend
 **/

#[derive(RustEmbed)]
#[folder = "./frontend/dist/"]
struct Client;

pub async fn index() -> impl Responder {
    serve_asset("index.html")
}

pub async fn serve(path: web::Path<String>) -> impl Responder {
    let file_path = path.into_inner();
    serve_asset(&file_path)
}

fn serve_asset(path: &str) -> HttpResponse {
    let asset_path = if path.is_empty() { "index.html" } else { path };

    match Client::get(asset_path) {
        Some(content) => {
            let body = content.data.into_owned();
            let mime = from_path(asset_path).first_or_octet_stream();
            HttpResponse::Ok().content_type(mime.as_ref()).body(body)
        }
        None => HttpResponse::NotFound().body("404 Not Found"),
    }
}
