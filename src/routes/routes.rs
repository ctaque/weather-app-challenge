use actix_web::{web, HttpRequest, HttpResponse, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{
    models::{auth::AppData, SavedRoute},
    utils::queries::get_user_from_api_token,
};
use chrono::Utc;

#[derive(Deserialize)]
pub struct PostRouteRequest {
    route: Value,
    name: Option<String>,
}

pub async fn post_routing(
    req: HttpRequest,
    json: web::Json<PostRouteRequest>,
    data: web::Data<AppData>,
) -> Result<HttpResponse> {
    let maybe_cookie = req.cookie("auth");

    match maybe_cookie {
        Some(cook) => {
            let user = get_user_from_api_token(cook.value().to_string(), &data).await;

            match user {
                Ok(u) => {
                    let route_name = json
                        .name
                        .clone()
                        .unwrap_or_else(|| "Untitled Route".to_string());
                    let now = Utc::now().into();

                    let saved_route = sqlx::query_as!(
                        SavedRoute,
                        "INSERT INTO saved_routes (user_id, name, route, created_at, updated_at) values ($1, $2, $3, $4, $5) returning *",
                        u.id,
                        route_name,
                        json.route,
                        now,
                        now
                    )
                    .fetch_one(&data.db)
                    .await;

                    match saved_route {
                        Ok(route) => Ok(HttpResponse::Ok().json(route)),
                        Err(e) => Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                            "error": format!("Failed to save route: {}", e)
                        }))),
                    }
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

#[derive(Deserialize)]
pub struct RoutingPath {
    uuid: String,
}

pub async fn get_routing(
    req: HttpRequest,
    data: web::Data<AppData>,
    path: web::Path<RoutingPath>,
) -> Result<HttpResponse> {
    let maybe_cookie = req.cookie("auth");

    match maybe_cookie {
        Some(cook) => {
            let user = get_user_from_api_token(cook.value().to_string(), &data).await;

            match user {
                Ok(u) => {
                    let saved_route = sqlx::query_as!(
                        SavedRoute,
                        "SELECT * FROM saved_routes WHERE uuid = $1 AND user_id = $2 AND deleted_at IS NULL",
                        path.uuid,
                        u.id
                    )
                    .fetch_one(&data.db)
                    .await;

                    match saved_route {
                        Ok(route) => Ok(HttpResponse::Ok().json(route)),
                        Err(e) => Ok(HttpResponse::NotFound().json(serde_json::json!({
                            "error": format!("Route not found: {}", e)
                        }))),
                    }
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

pub async fn put_routing(
    req: HttpRequest,
    json: web::Json<PostRouteRequest>,
    data: web::Data<AppData>,
    path: web::Path<RoutingPath>,
) -> Result<HttpResponse> {
    let maybe_cookie = req.cookie("auth");

    match maybe_cookie {
        Some(cook) => {
            let user = get_user_from_api_token(cook.value().to_string(), &data).await;

            match user {
                Ok(u) => {
                    let route_name = json
                        .name
                        .clone()
                        .unwrap_or_else(|| "Untitled Route".to_string());
                    let now = Utc::now().into();

                    let saved_route = sqlx::query_as!(
                        SavedRoute,
                        "UPDATE saved_routes SET name = $1, route = $2, updated_at = $3 WHERE uuid = $4 and user_id = $5 RETURNING *",
                        route_name,
                        json.route,
                        now,
                        path.uuid,
                        u.id
                    )
                    .fetch_one(&data.db)
                    .await;

                    match saved_route {
                        Ok(route) => Ok(HttpResponse::Ok().json(route)),
                        Err(e) => Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                            "error": format!("Failed to save route: {}", e)
                        }))),
                    }
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

#[derive(Deserialize)]
pub struct PaginationQuery {
    #[serde(default = "default_page")]
    page: i64,
    #[serde(default = "default_limit")]
    limit: i64,
}

fn default_page() -> i64 {
    1
}

fn default_limit() -> i64 {
    10
}

#[derive(Serialize)]
pub struct PaginatedRoutesResponse {
    routes: Vec<SavedRoute>,
    total: i64,
    page: i64,
    limit: i64,
    total_pages: i64,
}

pub async fn get_routes_paginated(
    req: HttpRequest,
    data: web::Data<AppData>,
    query: web::Query<PaginationQuery>,
) -> Result<HttpResponse> {
    let maybe_cookie = req.cookie("auth");

    match maybe_cookie {
        Some(cook) => {
            let user = get_user_from_api_token(cook.value().to_string(), &data).await;

            match user {
                Ok(u) => {
                    let page = query.page.max(1);
                    let limit = query.limit.clamp(1, 100);
                    let offset = (page - 1) * limit;

                    // Get total count
                    let total_result = sqlx::query_scalar!(
                        "SELECT COUNT(*) FROM saved_routes WHERE user_id = $1 AND deleted_at IS NULL",
                        u.id
                    )
                    .fetch_one(&data.db)
                    .await;

                    let total = match total_result {
                        Ok(Some(count)) => count,
                        Ok(None) => 0,
                        Err(e) => {
                            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                                "error": format!("Failed to count routes: {}", e)
                            })))
                        }
                    };

                    // Get paginated routes
                    let routes_result = sqlx::query_as!(
                        SavedRoute,
                        "SELECT * FROM saved_routes WHERE user_id = $1 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT $2 OFFSET $3",
                        u.id,
                        limit,
                        offset
                    )
                    .fetch_all(&data.db)
                    .await;

                    match routes_result {
                        Ok(routes) => {
                            let total_pages = (total as f64 / limit as f64).ceil() as i64;
                            let response = PaginatedRoutesResponse {
                                routes,
                                total,
                                page,
                                limit,
                                total_pages,
                            };
                            Ok(HttpResponse::Ok().json(response))
                        }
                        Err(e) => Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                            "error": format!("Failed to fetch routes: {}", e)
                        }))),
                    }
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
