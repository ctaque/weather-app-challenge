use actix_web::body::BoxBody;
use actix_web::http::header::ContentType;
use actix_web::HttpRequest;
use actix_web::HttpResponse;
use actix_web::Responder;
use chrono::DateTime;
use chrono::Utc;
use serde;
use serde_json::Value;
use sqlx::FromRow;

#[derive(Debug, Clone, FromRow, serde::Serialize, serde::Deserialize)]
pub struct SavedRoute {
    pub id: i64,
    pub user_id: i64,
    pub name: String,
    pub route: Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub uuid: String,
}

impl Responder for SavedRoute {
    type Body = BoxBody;

    fn respond_to(self, _req: &HttpRequest) -> HttpResponse<Self::Body> {
        let body = serde_json::to_string(&self).unwrap();

        // Create response and set content type
        HttpResponse::Ok()
            .content_type(ContentType::json())
            .body(body)
    }
}
