use crate::utils::misc::{Asset, Env};
use lettre::transport::smtp::authentication::Credentials;
use lettre::transport::smtp::response::Response;
use lettre::transport::smtp::Error;
use lettre::{message, transport::smtp::client::Tls, Message, SmtpTransport, Transport};

async fn send_mail(
    app_env: Env,
    html: &str,
    subject: &str,
    destination: &str,
) -> Result<<SmtpTransport as Transport>::Ok, <SmtpTransport as Transport>::Error> {
    let email = Message::builder()
        .from(app_env.mail_from.parse().unwrap())
        .to(destination.parse().unwrap())
        .subject(subject)
        .header(message::header::ContentType::TEXT_HTML)
        .body(html.to_string())
        .unwrap();

    //let email = Message::builder()
    //    .from(smtp_params.mail_from.parse().unwrap())
    //    .to(destination.parse().unwrap())
    //    .subject(subject)
    //    .multipart(
    //        MultiPart::mixed()
    //            .singlepart(
    //                SinglePart::builder()
    //                    .header(ContentType::TEXT_HTML)
    //                    .body(html),
    //            )
    //            .singlepart(mail_attachment),
    //    )
    //    .unwrap();

    // Open a remote connection to gmail
    let creds = Credentials::new(app_env.mail_from.to_string(), app_env.smtp_pass.to_string());
    let mailer = SmtpTransport::starttls_relay(&app_env.mail_host)
        .unwrap()
        .credentials(creds)
        .port(app_env.mail_port)
        .tls(Tls::None)
        .build();

    mailer.send(&email)
}

pub async fn send_one_time_code_mail(
    otc: &i32,
    email: &str,
    app_env: Env,
) -> Result<Response, Error> {
    let template_data = Asset::get("emails/one_time_code.html")
        .expect("emails/one_time_code.html not found")
        .to_owned();

    let tpl = std::str::from_utf8(template_data.data.as_ref())
        .expect("invalid template utf8 string")
        .to_string();

    let body = tpl.replace("{{one_time_code}}", otc.to_string().as_str());

    let html = scaffold_html(body);

    send_mail(app_env, html.as_str(), "Code de connexion", email).await
}

fn scaffold_html(body: String) -> String {
    format!(
        "<!DOCTYPE html>
        <html>
        <head>
            <meta charset=\"UTF-8\">
        </head>
            {}
        </html>",
        body
    )
}
