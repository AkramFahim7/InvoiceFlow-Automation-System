-- InvoiceFlow – Normalized MySQL/MariaDB Database Schema
-- Target Engine: InnoDB (supports ACID transactions and Foreign Key constraints)
-- Charset: utf8mb4 for full Unicode support

CREATE DATABASE IF NOT EXISTS invoiceflow_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE invoiceflow_db;

-- 1. Users: Authentication credentials and account ownership root
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- 2. Business Profiles: 1-to-1 branding, tax, and invoicing defaults per user account
CREATE TABLE IF NOT EXISTS business_profiles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  business_name VARCHAR(160) NOT NULL,
  business_email VARCHAR(255) NULL,
  phone VARCHAR(40) NULL,
  address TEXT NULL,
  tax_label VARCHAR(40) NOT NULL DEFAULT 'Tax',
  default_tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  currency_symbol VARCHAR(10) NOT NULL DEFAULT 'Rs.',
  invoice_prefix VARCHAR(20) NOT NULL DEFAULT 'INV-',
  next_invoice_number INT UNSIGNED NOT NULL DEFAULT 1,
  payment_instructions TEXT NULL,
  logo_url VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_business_user (user_id),
  CONSTRAINT fk_business_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. Customers: Clients belonging strictly to one business account (user_id)
CREATE TABLE IF NOT EXISTS customers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  name VARCHAR(140) NOT NULL,
  company_name VARCHAR(160) NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(40) NULL,
  billing_address TEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_customers_user (user_id),
  INDEX idx_customers_user_name (user_id, name),
  CONSTRAINT fk_customers_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. Invoices: Core financial document headers with exact DECIMAL monetary totals
CREATE TABLE IF NOT EXISTS invoices (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  customer_id INT UNSIGNED NOT NULL,
  invoice_number VARCHAR(50) NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status ENUM('Draft', 'Sent', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled') NOT NULL DEFAULT 'Draft',
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  grand_total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  amount_paid DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  remaining_balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  payment_instructions TEXT NULL,
  notes TEXT NULL,
  sent_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_invoice_number (user_id, invoice_number),
  INDEX idx_invoices_user_status (user_id, status),
  INDEX idx_invoices_customer (customer_id),
  INDEX idx_invoices_due_date (due_date),
  CONSTRAINT fk_invoices_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_invoices_customer
    FOREIGN KEY (customer_id) REFERENCES customers (id)
    ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 5. Invoice Items: Line items belonging to a single invoice
CREATE TABLE IF NOT EXISTS invoice_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT UNSIGNED NOT NULL,
  description VARCHAR(255) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  line_total DECIMAL(12, 2) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  INDEX idx_items_invoice (invoice_id),
  CONSTRAINT fk_items_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices (id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6. Payments: Manual payment ledger linked to invoices
CREATE TABLE IF NOT EXISTS payments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  invoice_id INT UNSIGNED NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method ENUM('Bank Transfer', 'Cash', 'Card', 'Cheque', 'Online', 'Other') NOT NULL DEFAULT 'Bank Transfer',
  reference_number VARCHAR(100) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_payments_invoice (invoice_id),
  INDEX idx_payments_user_date (user_id, payment_date),
  CONSTRAINT fk_payments_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_payments_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices (id)
    ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 7. Automation Workflows: Configurable workflow templates per business account
CREATE TABLE IF NOT EXISTS automation_workflows (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  workflow_key ENUM(
    'INVOICE_SENT_EMAIL',
    'PAYMENT_REMINDER',
    'OVERDUE_NOTIFICATION',
    'PAYMENT_CONFIRMATION'
  ) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(255) NULL,
  trigger_event VARCHAR(60) NOT NULL,
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  days_before_due INT NOT NULL DEFAULT 3,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_workflow_key (user_id, workflow_key),
  CONSTRAINT fk_workflows_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- 8. Automation Executions: Audit log of every workflow evaluation/action
CREATE TABLE IF NOT EXISTS automation_executions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  workflow_id INT UNSIGNED NOT NULL,
  invoice_id INT UNSIGNED NULL,
  payment_id INT UNSIGNED NULL,
  trigger_event VARCHAR(60) NOT NULL,
  status ENUM('SUCCESS', 'FAILED', 'SKIPPED') NOT NULL,
  message TEXT NULL,
  error_message TEXT NULL,
  executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_exec_user_time (user_id, executed_at),
  INDEX idx_exec_workflow (workflow_id),
  CONSTRAINT fk_exec_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_exec_workflow
    FOREIGN KEY (workflow_id) REFERENCES automation_workflows (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_exec_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_exec_payment
    FOREIGN KEY (payment_id) REFERENCES payments (id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

-- 9. Email Logs: Record of real SMTP deliveries and simulated dev emails
CREATE TABLE IF NOT EXISTS email_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  invoice_id INT UNSIGNED NULL,
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  template_name VARCHAR(60) NOT NULL,
  delivery_mode ENUM('SMTP', 'SIMULATED') NOT NULL DEFAULT 'SIMULATED',
  status ENUM('SENT', 'FAILED', 'SIMULATED') NOT NULL,
  error_message TEXT NULL,
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_user_time (user_id, sent_at),
  CONSTRAINT fk_email_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_email_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices (id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

-- 10. Reminder Records: Database-backed idempotency guard against duplicate reminders
CREATE TABLE IF NOT EXISTS reminder_records (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  invoice_id INT UNSIGNED NOT NULL,
  workflow_key VARCHAR(60) NOT NULL,
  reminder_stage VARCHAR(60) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_invoice_reminder_once (invoice_id, workflow_key, reminder_stage),
  INDEX idx_reminder_user (user_id),
  CONSTRAINT fk_reminder_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_reminder_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices (id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

