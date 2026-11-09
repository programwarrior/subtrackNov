-- MariaDB 10.6+ / PHP 8.2+. Apply manually after a verified recoverable backup.
-- Do not use DROP, TRUNCATE or REPLACE as a migration strategy.
CREATE TABLE IF NOT EXISTS st_users (
 id CHAR(36) PRIMARY KEY,
 email VARCHAR(254) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS st_sessions (
 token_hash CHAR(64) PRIMARY KEY,
 user_id CHAR(36) NOT NULL,
 expires_at DATETIME NOT NULL,
 FOREIGN KEY (user_id) REFERENCES st_users(id) ON DELETE CASCADE,
 INDEX(user_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS st_records (
 user_id CHAR(36) NOT NULL,
 id VARCHAR(80) NOT NULL,
 kind VARCHAR(20) NOT NULL,
 version BIGINT UNSIGNED NOT NULL,
 payload JSON NOT NULL,
 sequence_id BIGINT UNSIGNED NOT NULL,
 PRIMARY KEY(user_id,id),
 INDEX(user_id,sequence_id),
 FOREIGN KEY(user_id) REFERENCES st_users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS st_changes (
 sequence_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 user_id CHAR(36) NOT NULL,
 record_id VARCHAR(80) NOT NULL,
 payload JSON NOT NULL,
 INDEX(user_id,sequence_id),
 FOREIGN KEY(user_id) REFERENCES st_users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS st_batches (
 user_id CHAR(36) NOT NULL,
 batch_id VARCHAR(80) NOT NULL,
 response JSON NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id,batch_id),
 FOREIGN KEY(user_id) REFERENCES st_users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS st_recovery (
 token_hash CHAR(64) PRIMARY KEY,
 user_id CHAR(36) NOT NULL,
 expires_at DATETIME NOT NULL,
 FOREIGN KEY(user_id) REFERENCES st_users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS st_rate_limits (
 bucket CHAR(64) PRIMARY KEY,
 hits INT NOT NULL,
 expires_at DATETIME NOT NULL
) ENGINE=InnoDB;
