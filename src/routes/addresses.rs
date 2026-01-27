use crate::{
    models::{auth::AppData, prefered_address::PreferedAddress},
    utils::queries::{get_prefered_addresses, get_user_from_api_token},
};
use actix_web::{web, HttpRequest, HttpResponse, Result};

pub async fn fetch_adresses(
    req: HttpRequest,
    data: web::Data<AppData>,
) -> Result<HttpResponse> {
    let maybe_cookie = req.cookie("auth");
    match maybe_cookie {
        Some(cook) => {
            let user = get_user_from_api_token(cook.value().to_string(), &data).await;
            match user {
                Ok(u) => {
                    let addr: Vec<PreferedAddress> =
                        get_prefered_addresses(u.id, &data).await.unwrap();
                    return Ok(HttpResponse::Ok().json(addr));
                }
                Err(_) => Ok(HttpResponse::NotFound().json(serde_json::json!({
                    "error": "User not found"
                }))),
            }
        }
        None => Ok(HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Not Authenticated"
        }))),
    }
}
