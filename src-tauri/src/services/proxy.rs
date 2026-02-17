use crate::commands::debug::log_debug;
use crate::db::SqliteDatabase;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

pub struct ProxyService {
    pub is_running: Arc<AtomicBool>,
    pub port: u16,
}

impl ProxyService {
    pub fn new() -> Self {
        Self {
            is_running: Arc::new(AtomicBool::new(false)),
            port: 8080,
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
                // Use a timeout or select to check is_running between accepts
                let result = tokio::select! {
                    res = listener.accept() => res,
                    _ = async { while is_running.load(Ordering::SeqCst) { tokio::time::sleep(tokio::time::Duration::from_millis(500)).await; } } => {
                        break;
                    }
                };

                if let Ok((stream, _)) = result {
                    let db = db_clone.clone();
                    let handle = handle_clone.clone();
                    tokio::spawn(async move {
                        if let Err(e) = handle_proxy_connection(stream, db, handle).await {
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
}

async fn handle_proxy_connection(
    mut stream: TcpStream,
    db: Arc<SqliteDatabase>,
    app_handle: AppHandle,
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

    // Minimal HTTP Request Parsing
    // Line 0: METHOD URL VERSION
    let parts: Vec<&str> = lines[0].split_whitespace().collect();
    if parts.len() < 2 {
        return Ok(());
    }

    let method = parts[0];
    let mut url = parts[1].to_string();

    // If it's a relative URL in a proxy request, it might have the full URL if CONNECT or absolute URI
    // For a simple non-MITM proxy just capturing, it usually gets absolute URI
    if !url.starts_with("http") && !url.starts_with("/") {
        url = format!("http://{}", url);
    }

    // Capture and add to DB if it's a valid URL
    if url.starts_with("http") {
        let _ = log_debug(
            app_handle.clone(),
            "Info".to_string(),
            "Proxy".to_string(),
            format!("Intercepted {} {}", method, url),
            None,
        );
        let _ = db.add_asset(&url, "Proxy", Some(method), false);
        let _ = app_handle.emit("assets-updated", ());
    }

    // Dummy response for now (Proxy only captures, it doesn't relay perfectly without more complex logic)
    // REAL proxy would relay to target.
    // For "Interception" feature in Phase 3, we'll want relaying.

    // Simplest possible relay:
    // 1. Parse host from headers
    let mut host = "";
    for line in &lines {
        if line.to_lowercase().starts_with("host: ") {
            host = &line[6..];
            break;
        }
    }

    if !host.is_empty() {
        // Relay logic would go here
        // stream_relay(stream, host, request).await?;
    }

    // Send a mock "Captured" response to the client for now to acknowledge
    let response = "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nRequest Captured by Apex Proxy Agent\n";
    stream.write_all(response.as_bytes()).await?;

    Ok(())
}
