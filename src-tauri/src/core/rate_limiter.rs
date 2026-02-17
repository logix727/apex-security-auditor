use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration, Instant};

#[derive(Debug)]
pub struct RateLimiter {
    last_request_time: Mutex<Instant>,
    min_interval: Duration,
}

impl RateLimiter {
    pub fn new(rate_limit_ms: u64) -> Self {
        Self {
            last_request_time: Mutex::new(Instant::now() - Duration::from_millis(rate_limit_ms)),
            min_interval: Duration::from_millis(rate_limit_ms),
        }
    }

    pub fn update_rate_limit(&mut self, rate_limit_ms: u64) {
        self.min_interval = Duration::from_millis(rate_limit_ms);
    }

    /// Waiting for the rate limit to pass before proceeding
    pub async fn wait(&self) {
        let mut last_time = self.last_request_time.lock().await;
        let now = Instant::now();
        let elapsed = now.duration_since(*last_time);

        if elapsed < self.min_interval {
            let wait_duration = self.min_interval - elapsed;
            sleep(wait_duration).await;
            *last_time = Instant::now();
        } else {
            *last_time = now;
        }
    }
}

pub type SharedRateLimiter = Arc<RateLimiter>;
