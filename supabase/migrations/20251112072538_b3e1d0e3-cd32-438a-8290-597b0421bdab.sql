-- Add encrypted_data column as fallback when Walrus is unavailable
ALTER TABLE emotion_records 
ADD COLUMN IF NOT EXISTS encrypted_data TEXT;