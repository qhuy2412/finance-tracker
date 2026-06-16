-- Database Schema for FinTra (Finance Tracker)
-- Packaged inside backend for automatic app-driven migrations

CREATE DATABASE IF NOT EXISTS fintra_db;
USE fintra_db;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS `users` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `user_name` varchar(100) NOT NULL,
  `email` varchar(255) NOT NULL,
  `is_verified` tinyint(1) DEFAULT '0',
  `hash_password` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 2. Wallets Table
CREATE TABLE IF NOT EXISTS `wallets` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `user_id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `type` enum('CASH','BANK','E_WALLET') DEFAULT 'CASH',
  `balance` decimal(15,2) DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_wallets_users` (`user_id`),
  CONSTRAINT `fk_wallets_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 3. Categories Table
CREATE TABLE IF NOT EXISTS `categories` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `user_id` varchar(36) DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `type` enum('INCOME','EXPENSE') NOT NULL,
  `color` varchar(20) DEFAULT NULL,
  `icon` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_categories_users` (`user_id`),
  CONSTRAINT `fk_categories_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 4. Debts Table
CREATE TABLE IF NOT EXISTS `debts` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `user_id` varchar(36) NOT NULL,
  `wallet_id` varchar(36) NOT NULL,
  `person_name` varchar(100) NOT NULL,
  `type` enum('BORROW','LEND') NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `paid_amount` decimal(15,2) DEFAULT '0.00',
  `status` enum('UNPAID','PAID') DEFAULT 'UNPAID',
  `due_date` date DEFAULT NULL,
  `note` text,
  `created_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_debts_users` (`user_id`),
  KEY `fk_debts_wallets` (`wallet_id`),
  CONSTRAINT `fk_debts_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_debts_wallets` FOREIGN KEY (`wallet_id`) REFERENCES `wallets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 5. Refresh Tokens Table
CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `user_id` varchar(36) NOT NULL,
  `token` varchar(255) NOT NULL,
  `expired_at` timestamp NOT NULL,
  `is_revoked` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `fk_tokens_users` (`user_id`),
  CONSTRAINT `fk_tokens_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 6. Budgets Table
CREATE TABLE IF NOT EXISTS `budgets` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `user_id` varchar(36) NOT NULL,
  `category_id` varchar(36) NOT NULL,
  `period` date NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `created_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_budget_period` (`user_id`,`category_id`,`period`),
  KEY `fk_budgets_categories` (`category_id`),
  CONSTRAINT `fk_budgets_categories` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_budgets_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 7. Saving Goals Table
CREATE TABLE IF NOT EXISTS `saving_goals` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `user_id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `target_amount` decimal(15,2) NOT NULL,
  `current_amount` decimal(15,2) DEFAULT '0.00',
  `deadline` date DEFAULT NULL,
  `status` enum('IN_PROGRESS','COMPLETED') DEFAULT 'IN_PROGRESS',
  `created_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_savings_users` (`user_id`),
  CONSTRAINT `fk_savings_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 8. Saving Transactions Table
CREATE TABLE IF NOT EXISTS `saving_transactions` (
  `id` varchar(36) NOT NULL,
  `saving_id` varchar(36) NOT NULL,
  `wallet_id` varchar(36) NOT NULL,
  `type` enum('DEPOSIT','WITHDRAW') NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `note` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `saving_id` (`saving_id`),
  CONSTRAINT `saving_transactions_ibfk_1` FOREIGN KEY (`saving_id`) REFERENCES `saving_goals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 9. Transfers Table
CREATE TABLE IF NOT EXISTS `transfers` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `user_id` varchar(36) NOT NULL,
  `from_wallet_id` varchar(36) NOT NULL,
  `to_wallet_id` varchar(36) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `transfer_date` date NOT NULL,
  `created_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_transfers_users` (`user_id`),
  KEY `fk_transfers_from` (`from_wallet_id`),
  KEY `fk_transfers_to` (`to_wallet_id`),
  CONSTRAINT `fk_transfers_from` FOREIGN KEY (`from_wallet_id`) REFERENCES `wallets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_transfers_to` FOREIGN KEY (`to_wallet_id`) REFERENCES `wallets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_transfers_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 10. Transactions Table (Central Ledger)
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `user_id` varchar(36) NOT NULL,
  `wallet_id` varchar(36) NOT NULL,
  `saving_id` varchar(36) DEFAULT NULL,
  `transfer_id` varchar(36) DEFAULT NULL,
  `debt_id` varchar(36) DEFAULT NULL,
  `category_id` varchar(36) DEFAULT NULL,
  `type` enum('INCOME','EXPENSE','DEBT_IN','DEBT_OUT','TRANSFER_IN','TRANSFER_OUT','SAVING_IN','SAVING_OUT') NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `note` text,
  `transaction_date` date NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_trans_users` (`user_id`),
  KEY `fk_trans_wallets` (`wallet_id`),
  CONSTRAINT `fk_trans_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_trans_wallets` FOREIGN KEY (`wallet_id`) REFERENCES `wallets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 11. Chat Sessions Table
CREATE TABLE IF NOT EXISTS `chat_sessions` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `title` varchar(255) DEFAULT 'Cuộc trò chuyện mới',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_chat_sessions_user` (`user_id`),
  KEY `idx_chat_sessions_updated` (`updated_at` DESC),
  CONSTRAINT `chat_sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 12. Chat Messages Table
CREATE TABLE IF NOT EXISTS `chat_messages` (
  `id` varchar(36) NOT NULL,
  `session_id` varchar(36) NOT NULL,
  `role` enum('user','assistant') NOT NULL,
  `content` text NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_chat_messages_session` (`session_id`),
  KEY `idx_chat_messages_created` (`created_at`),
  CONSTRAINT `chat_messages_ibfk_1` FOREIGN KEY (`session_id`) REFERENCES `chat_sessions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 13. Telegram Accounts Table (Required for Telegram link integration)
CREATE TABLE IF NOT EXISTS `telegram_accounts` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `user_id` varchar(36) NOT NULL,
  `telegram_chat_id` varchar(100) UNIQUE NOT NULL,
  `linked_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_telegram_users` (`user_id`),
  CONSTRAINT `fk_telegram_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 14. Email Verifications Table (Used by auth flow)
CREATE TABLE IF NOT EXISTS `email_verifications` (
  `id` varchar(36) PRIMARY KEY,
  `email` varchar(255) UNIQUE NOT NULL,
  `user_name` varchar(255) NOT NULL,
  `hash_password` text NOT NULL,
  `code` varchar(6) NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 15. Notifications Table
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `type` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `body` text NOT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_notifications_users` (`user_id`),
  CONSTRAINT `fk_notifications_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 16. Weekly Reports Table
CREATE TABLE IF NOT EXISTS `weekly_reports` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `week_start` date NOT NULL,
  `data` json NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_weekly_report` (`user_id`, `week_start`),
  CONSTRAINT `fk_weekly_reports_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 17. Cron Run Log Table
-- Ensures each background cron job runs on exactly one server instance per day.
-- Uses UNIQUE(job_name, run_date) + INSERT IGNORE as an atomic DB-level lock,
-- which works correctly across multi-instance / ProxySQL deployments
-- unlike MySQL advisory locks (GET_LOCK) which are session-scoped.
CREATE TABLE IF NOT EXISTS `cron_run_log` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `job_name` varchar(64) NOT NULL,
  `run_date` date NOT NULL,
  `started_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_job_run_date` (`job_name`, `run_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `scheduler_settings` (
  `job_name`        VARCHAR(50)  NOT NULL,
  `cron_expression` VARCHAR(50)  NOT NULL,
  `updated_at`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`job_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed default schedules (safe to re-run — ON DUPLICATE KEY keeps existing values intact)
INSERT INTO `scheduler_settings` (`job_name`, `cron_expression`) VALUES
  ('daily_alert',   '0 21 * * *'),   -- 21:00 every day (VN time)
  ('weekly_report', '0 20 * * 0'),   -- Sunday 20:00 (VN time)
  ('db_backup',     '0 3  * * *')    -- 03:00 every day (VN time)
ON DUPLICATE KEY UPDATE `job_name` = `job_name`;  -- no-op: preserves admin-configured values

-- ── SEED INITIAL SYSTEM CATEGORIES ──────────────────────────────────────────
-- Insert default income/expense categories that are common for all users (user_id = NULL)
-- Uses INSERT IGNORE to prevent duplicate primary key errors on subsequent startup
INSERT IGNORE INTO `categories` (`id`, `user_id`, `name`, `type`, `color`, `icon`) VALUES 
('sys-cat-salary', NULL, 'Lương bổng', 'INCOME', '#10B981', 'Briefcase'),
('sys-cat-freelance', NULL, 'Freelance', 'INCOME', '#3B82F6', 'Laptop'),
('sys-cat-investment', NULL, 'Đầu tư', 'INCOME', '#F59E0B', 'TrendingUp'),
('sys-cat-food', NULL, 'Ăn uống', 'EXPENSE', '#EF4444', 'Utensils'),
('sys-cat-rent', NULL, 'Tiền nhà', 'EXPENSE', '#8B5CF6', 'Home'),
('sys-cat-shopping', NULL, 'Mua sắm', 'EXPENSE', '#EC4899', 'ShoppingBag'),
('sys-cat-transport', NULL, 'Đi lại', 'EXPENSE', '#6B7280', 'Car'),
('sys-cat-entertainment', NULL, 'Giải trí', 'EXPENSE', '#F43F5E', 'Tv'),
('sys-cat-medical', NULL, 'Y tế & Sức khỏe', 'EXPENSE', '#06B6D4', 'HeartPulse');
