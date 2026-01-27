use actix_web::body::BoxBody;
use actix_web::http::header::ContentType;
use actix_web::HttpRequest;
use actix_web::HttpResponse;
use actix_web::Responder;
use chrono::DateTime;
use chrono::Utc;
use serde::Deserialize;
use serde::Serialize;

#[derive(Serialize, Deserialize)]
pub struct PreferedAddress {
    pub id: i64,
    pub address_text: Option<String>,
    pub lat: Option<String>,
    pub lng: Option<String>,
    pub user_id: i64,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

impl Responder for PreferedAddress {
    type Body = BoxBody;

    fn respond_to(self, _req: &HttpRequest) -> HttpResponse<Self::Body> {
        let body = serde_json::to_string(&self).unwrap();

        // Create response and set content type
        HttpResponse::Ok()
            .content_type(ContentType::json())
            .body(body)
    }
}
