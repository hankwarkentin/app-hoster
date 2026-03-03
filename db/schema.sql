-- Enable pgcrypto extension for crypt/gen_salt
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- customers table for API key management
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  api_key_hash VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used TIMESTAMP
);

-- apps table for uploaded files
CREATE TABLE IF NOT EXISTS apps (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  customer_id INTEGER REFERENCES customers(id),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
