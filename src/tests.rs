#[cfg(test)]
mod tests_queries {
    // Note this useful idiom: importing names from outer (for mod tests) scope.

    use sqlx::PgPool;

    use std::env;

    //use tokio;

    async fn setup_db() -> PgPool {
        let database_url = env::var("DATABASE_URL")
            .unwrap_or("postgres://user:password@localhost:5432/mydb".to_string());
        PgPool::connect(&database_url)
            .await
            .expect("Failed to connect to DB")
    }

    //#[tokio::test]
    //async fn test_insert_otc() {
    //    assert_eq!(true, true);
    //}
}
