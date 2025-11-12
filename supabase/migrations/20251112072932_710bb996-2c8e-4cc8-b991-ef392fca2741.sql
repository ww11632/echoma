-- Make columns nullable to support database fallback when Walrus is unavailable
-- These columns will be NULL when encrypted_data is stored in database instead of Walrus

-- Make description nullable (already intended for encrypted records)
ALTER TABLE emotion_records 
ALTER COLUMN description DROP NOT NULL;

-- Make blob_id nullable (will be NULL when using database fallback)
ALTER TABLE emotion_records 
ALTER COLUMN blob_id DROP NOT NULL;

-- Make walrus_url nullable (will be NULL when using database fallback)
ALTER TABLE emotion_records 
ALTER COLUMN walrus_url DROP NOT NULL;

-- Make payload_hash nullable (optional field)
ALTER TABLE emotion_records 
ALTER COLUMN payload_hash DROP NOT NULL;

-- Add check constraint to ensure either Walrus storage OR database fallback is used
-- (Either blob_id is set OR encrypted_data is set, but not neither)
ALTER TABLE emotion_records 
ADD CONSTRAINT check_storage_method 
CHECK (
  (blob_id IS NOT NULL AND walrus_url IS NOT NULL) OR 
  (encrypted_data IS NOT NULL)
);