-- Make description field optional to support encryption-at-rest
-- Description should only be stored for public records or not at all
-- Private records should decrypt description from encryptedData in Walrus

-- Make description nullable
ALTER TABLE public.emotion_records 
  ALTER COLUMN description DROP NOT NULL;

-- Add comment explaining the security model
COMMENT ON COLUMN public.emotion_records.description IS 
  'Optional plaintext description. For private records, description should be null and decrypted from encryptedData in Walrus. For public records, description may be stored for convenience but encryptedData is the source of truth.';

