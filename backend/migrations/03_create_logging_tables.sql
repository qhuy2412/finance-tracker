CREATE TABLE IF NOT EXISTS `user_activity_logs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` VARCHAR(36) DEFAULT NULL,
  `action` VARCHAR(100) NOT NULL,
  `details` TEXT NOT NULL,
  `payload` JSON DEFAULT NULL,
  `ip` VARCHAR(45) DEFAULT NULL,
  `user_agent` TEXT DEFAULT NULL,
  `server_id` VARCHAR(64) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_activity_user_id` (`user_id`),
  CONSTRAINT `fk_activity_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `agent_activity_logs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` VARCHAR(36) DEFAULT NULL,
  `session_id` VARCHAR(36) DEFAULT NULL,
  `agent_type` ENUM('CHATBOT', 'WEEKLY_REPORT') NOT NULL,
  `user_message` TEXT DEFAULT NULL,
  `bot_response` TEXT NOT NULL,
  `steps` JSON DEFAULT NULL,
  `response_time_ms` INT UNSIGNED NOT NULL,
  `prompt_tokens` INT UNSIGNED DEFAULT NULL,
  `candidates_tokens` INT UNSIGNED DEFAULT NULL,
  `total_tokens` INT UNSIGNED DEFAULT NULL,
  `estimated_cost_usd` DECIMAL(15, 8) DEFAULT NULL,
  `server_id` VARCHAR(64) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_agent_user_id` (`user_id`),
  KEY `idx_agent_session_id` (`session_id`),
  CONSTRAINT `fk_agent_logs_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_agent_logs_sessions` FOREIGN KEY (`session_id`) REFERENCES `chat_sessions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
