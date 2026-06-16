CREATE TABLE IF NOT EXISTS `job_queue` (
  `id`              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `job_type`        VARCHAR(50)   NOT NULL,
  `payload`         JSON,
  `status`          ENUM('PENDING','RUNNING','COMPLETED','FAILED') NOT NULL DEFAULT 'PENDING',
  `error_message`   TEXT,
  `run_at`          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `started_at`      DATETIME,
  `completed_at`    DATETIME,
  `notified`        TINYINT(1)    NOT NULL DEFAULT 0,  -- 1 = Telegram alert sent
  `created_at`      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  -- Prevent duplicate backup jobs on the same calendar day
  UNIQUE KEY `uq_job_type_date` (`job_type`, (DATE(`run_at`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
