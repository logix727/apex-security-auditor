use crate::commands::debug::log_debug;
use crate::db::SqliteDatabase;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{oneshot, Mutex as TokioMutex};

pub enum InterceptAction {
    Forward {
        headers: Vec<(String, String)>,
        body: Vec<u8>,
    },
    Drop,
}

pub struct ProxyService {
    pub is_running: Arc<AtomicBool>,
    pub intercept_enabled: Arc<AtomicBool>,
    pub port: u16,
    pub pending_requests: Arc<TokioMutex<HashMap<String, oneshot::Sender<InterceptAction>>>>,
}

impl ProxyService {
    pub fn new() -> Self {
        Self {
            is_running: Arc::new(AtomicBool::new(false)),
            intercept_enabled: Arc::new(AtomicBool::new(false)),
            port: 8080,
            pending_requests: Arc::new(TokioMutex::new(HashMap::new())),
        }
    }

    pub async fn start(
        &self,
        app_handle: AppHandle,
        db: Arc<SqliteDatabase>,
    ) -> Result<(), String> {
        if self.is_running.load(Ordering::SeqCst) {
            return Err("Proxy is already running".to_string());
        }

        self.is_running.store(true, Ordering::SeqCst);
        let is_running = self.is_running.clone();
        let intercept_enabled = self.intercept_enabled.clone();
        let pending_requests = self.pending_requests.clone();
        let port = self.port;
        let db_clone = db.clone();
        let handle_clone = app_handle.clone();

        tokio::spawn(async move {
            let addr = format!("127.0.0.1:{}", port);
            let listener = match TcpListener::bind(&addr).await {
                Ok(l) => l,
                Err(e) => {
                    let _ = log_debug(
                        handle_clone,
                        "Error".to_string(),
                        "Proxy".to_string(),
                        format!("Failed to bind to {}: {}", addr, e),
                        None,
                    );
                    is_running.store(false, Ordering::SeqCst);
                    return;
                }
            };

            let _ = log_debug(
                handle_clone.clone(),
                "Success".to_string(),
                "Proxy".to_string(),
                format!("Proxy Service started on {}", addr),
                None,
            );
            let _ = handle_clone.emit("proxy-status", true);

            while is_running.load(Ordering::SeqCst) {
                let result = tokio::select! {
                    res = listener.accept() => res,
                    _ = async {
                        while is_running.load(Ordering::SeqCst) {
                            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                        }
                    } => {
                        break;
                    }
                };

                if let Ok((stream, _)) = result {
                    let db = db_clone.clone();
                    let handle = handle_clone.clone();
                    let intercept = intercept_enabled.clone();
                    let pending = pending_requests.clone();
                    tokio::spawn(async move {
                        if let Err(e) =
                            handle_proxy_connection(stream, db, handle, intercept, pending).await
                        {
                            eprintln!("Proxy connection error: {}", e);
                        }
                    });
                }
            }

            let _ = handle_clone.emit("proxy-status", false);
            let _ = log_debug(
                handle_clone,
                "Info".to_string(),
                "Proxy".to_string(),
                "Proxy Service stopped".to_string(),
                None,
            );
        });

        Ok(())
    }

    pub fn stop(&self) {
        self.is_running.store(false, Ordering::SeqCst);
    }

    pub fn set_intercept(&self, enabled: bool) {
        self.intercept_enabled.store(enabled, Ordering::SeqCst);
    }
}

async fn handle_proxy_connection(
    mut stream: TcpStream,
    db: Arc<SqliteDatabase>,
    app_handle: AppHandle,
    intercept_enabled: Arc<AtomicBool>,
    pending_requests: Arc<TokioMutex<HashMap<String, oneshot::Sender<InterceptAction>>>>,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut buffer = [0; 8192];
    let n = stream.read(&mut buffer).await?;
    if n == 0 {
        return Ok(());
    }

    let request = String::from_utf8_lossy(&buffer[..n]);
    let lines: Vec<&str> = request.lines().collect();
    if lines.is_empty() {
        return Ok(());
    }

    let parts: Vec<&str> = lines[0].split_whitespace().collect();
    if parts.len() < 2 {
        return Ok(());
    }

    let method = parts[0];
    let mut url = parts[1].to_string();

    if method == "CONNECT" {
        // Handle HTTPS CONNECT Tunnel
        stream
            .write_all(b"HTTP/1.1 200 Connection Established\r\n\r\n")
            .await?;

        // Connect to upstream
        let upstream_host = if url.contains(":") {
            url.clone()
        } else {
            format!("{}:443", url)
        };
        match TcpStream::connect(&upstream_host).await {
            Ok(mut upstream) => {
                // Bidirectional copy
                let (mut client_read, mut client_write) = stream.split();
                let (mut server_read, mut server_write) = upstream.split();

                let client_to_server = tokio::io::copy(&mut client_read, &mut server_write);
                let server_to_client = tokio::io::copy(&mut server_read, &mut client_write);

                let _ = tokio::join!(client_to_server, server_to_client);
                return Ok(());
            }
            Err(e) => {
                eprintln!("Failed to connect to upstream {}: {}", upstream_host, e);
                return Ok(());
            }
        }
    }

    if !url.starts_with("http") && !url.starts_with("/") {
        url = format!("http://{}", url);
    }

    if url.starts_with("http") {
        let _ = db.add_asset(&url, "Proxy", Some(method), false, false, 0);
        let _ = app_handle.emit("assets-updated", ());
    }

    let mut final_headers = Vec::new();
    for line in lines.iter().skip(1) {
        if line.is_empty() {
            break;
        }
        if let Some((key, val)) = line.split_once(':') {
            final_headers.push((key.trim().to_string(), val.trim().to_string()));
        }
    }

    let mut content_length = 0;
    for line in &lines {
        if line.to_lowercase().starts_with("content-length:") {
            if let Some((_, val)) = line.split_once(':') {
                content_length = val.trim().parse().unwrap_or(0);
            }
        }
    }

    let mut final_body = Vec::new();

    // Check if we already have body in buffer (after \r\n\r\n)
    // Find double CRLF
    let mut body_start_idx = 0;
    for i in 0..n.saturating_sub(3) {
        if &buffer[i..i + 4] == b"\r\n\r\n" {
            body_start_idx = i + 4;
            break;
        }
    }

    if body_start_idx > 0 && body_start_idx < n {
        final_body.extend_from_slice(&buffer[body_start_idx..n]);
    }

    // Read remaining body if needed
    if content_length > final_body.len() {
        let remaining = content_length - final_body.len();
        let mut body_buf = vec![0u8; remaining];
        if let Ok(read_n) = stream.read_exact(&mut body_buf).await {
            final_body.extend_from_slice(&body_buf[..read_n]);
        }
    }

    if intercept_enabled.load(Ordering::SeqCst) {
        let (tx, rx) = oneshot::channel();
        let request_id = uuid::Uuid::new_v4().to_string();

        {
            let mut pending = pending_requests.lock().await;
            pending.insert(request_id.clone(), tx);
        }

        let _ = app_handle.emit(
            "proxy-intercept-request",
            serde_json::json!({
                "id": request_id,
                "method": method,
                "url": url,
                "headers": final_headers,
                "body": String::from_utf8_lossy(&final_body),
            }),
        );

        match rx.await {
            Ok(InterceptAction::Forward { headers, body }) => {
                final_headers = headers;
                let _ = body; // Reserved for future use
            }
            Ok(InterceptAction::Drop) | Err(_) => {
                let response =
                    "HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\nRequest Dropped by User\n";
                let _ = stream.write_all(response.as_bytes()).await;
                return Ok(());
            }
        }
    }

    let client = &db.client;
    let method_type = match method.to_uppercase().as_str() {
        "POST" => reqwest::Method::POST,
        "PUT" => reqwest::Method::PUT,
        "DELETE" => reqwest::Method::DELETE,
        "PATCH" => reqwest::Method::PATCH,
        "HEAD" => reqwest::Method::HEAD,
        _ => reqwest::Method::GET,
    };

    let mut rb = client.request(method_type, &url);

    for (key, val) in &final_headers {
        if !key.to_lowercase().contains("host") && !key.to_lowercase().contains("proxy") {
            rb = rb.header(key, val);
        }
    }

    let resp = rb.send().await;

    match resp {
        Ok(res) => {
            let status = res.status();
            let headers = res.headers().clone();
            let body_bytes = res.bytes().await.unwrap_or_default();

            let mut response_bytes = format!(
                "HTTP/1.1 {} {}\r\n",
                status.as_u16(),
                status.canonical_reason().unwrap_or("OK")
            )
            .into_bytes();

            for (key, val) in headers.iter() {
                response_bytes.extend_from_slice(key.as_str().as_bytes());
                response_bytes.extend_from_slice(b": ");
                response_bytes.extend_from_slice(val.as_bytes());
                response_bytes.extend_from_slice(b"\r\n");
            }
            response_bytes.extend_from_slice(b"\r\n");
            response_bytes.extend_from_slice(&body_bytes);

            stream.write_all(&response_bytes).await?;
        }
        Err(e) => {
            let error_msg = format!("HTTP/1.1 502 Bad Gateway\r\n\r\nProxy Relay Error: {}", e);
            stream.write_all(error_msg.as_bytes()).await?;
        }
    }

    Ok(())
}
