use core::fmt;

use actix_web::body::BoxBody;
use actix_web::http::header::ContentType;
use actix_web::http::StatusCode;
use actix_web::HttpRequest;
use actix_web::HttpResponse;
use actix_web::Responder;
use actix_web::ResponseError;
use chrono::NaiveDateTime;
use chrono::Utc;
use serde;
use sqlx::FromRow;
use sqlx::PgPool;

use crate::misc::Env;

pub struct AppData {
    pub db: PgPool,
    pub env: Env,
}

#[derive(Debug, Clone, FromRow, serde::Serialize, serde::Deserialize)]
pub struct User {
    pub id: i64,
    pub name: String,
    pub email: String,
    pub api_token: String,
}

impl Responder for User {
    type Body = BoxBody;

    fn respond_to(self, _req: &HttpRequest) -> HttpResponse<Self::Body> {
        let body = serde_json::to_string(&self).unwrap();

        // Create response and set content type
        HttpResponse::Ok()
            .content_type(ContentType::json())
            .body(body)
    }
}

#[derive(Debug, FromRow, serde::Serialize, serde::Deserialize)]
pub struct OneTimeCode {
    pub id: i64,
    pub code: i32,
    pub user_id: i64,
    pub used: bool,
    pub created_at: NaiveDateTime,
}

#[derive(Debug)]
pub struct Response {
    pub message: Option<String>,
    pub waiting_time: Option<String>,
    pub error_type: StatusCode,
}

impl fmt::Display for Response {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "")
    }
}

impl Response {
    pub fn new(code: StatusCode, message: Option<String>) -> Response {
        Response {
            message,
            waiting_time: Some(Utc::now().to_string()),
            error_type: code,
        }
    }
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ActualResponse {
    pub message: Option<String>,
}

impl ActualResponse {
    pub fn to_string(self) -> String {
        let body = serde_json::to_string(&self).unwrap();
        body
    }
}

impl ResponseError for Response {
    fn status_code(&self) -> StatusCode {
        self.error_type
    }
    fn error_response(&self) -> HttpResponse {
        let res = ActualResponse {
            message: self.message.clone(),
        };
        HttpResponse::build(self.status_code()).json(res)
    }
}

impl Responder for ActualResponse {
    type Body = BoxBody;

    fn respond_to(self, _req: &HttpRequest) -> HttpResponse<Self::Body> {
        let body = serde_json::to_string(&self).unwrap();

        // Create response and set content type
        HttpResponse::Ok()
            .content_type(ContentType::json())
            .body(body)
    }
}
