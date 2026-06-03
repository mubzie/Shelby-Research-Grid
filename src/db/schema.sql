CREATE TABLE IF NOT EXISTS users (
  aptos_addr VARCHAR(66) PRIMARY KEY,
  researcher_name VARCHAR(255),
  institution VARCHAR(255),
  verification_status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_addr VARCHAR(66) NOT NULL,
  shelby_blob_id VARCHAR(255) UNIQUE NOT NULL,
  merkle_root VARCHAR(128) NOT NULL,
  title VARCHAR(255),
  description TEXT,
  virus_types TEXT[],
  file_size_bytes BIGINT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  total_reads INT DEFAULT 0,
  total_revenue_earned_millAPT BIGINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE,
  grantee_addr VARCHAR(66) NOT NULL,
  granted_by_addr VARCHAR(66) NOT NULL,
  granted_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  read_limit INT,
  read_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS read_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID REFERENCES datasets(id),
  reader_addr VARCHAR(66) NOT NULL,
  grant_id UUID REFERENCES access_grants(id),
  read_at TIMESTAMP DEFAULT NOW(),
  duration_ms INT,
  bytes_downloaded BIGINT,
  on_chain_tx_hash VARCHAR(128)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_datasets_uploader ON datasets(uploader_addr);
CREATE INDEX IF NOT EXISTS idx_read_logs_reader ON read_logs(reader_addr);
