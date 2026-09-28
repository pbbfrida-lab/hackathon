USE __DB_NAME__;

CREATE TABLE IF NOT EXISTS paypal_payments (
  order_id INT NOT NULL PRIMARY KEY,
  paypal_order_id VARCHAR(64) NOT NULL,
  capture_id VARCHAR(64) NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  amount DECIMAL(14,2) NOT NULL,
  status ENUM('pending','paid','cancelled') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_paypal_payments_order (paypal_order_id),
  CONSTRAINT fk_paypal_payments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;