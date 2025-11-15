-- Add transaction_digest column to emotion_records table
-- This field stores the transaction digest for NFT minting transactions
-- It allows users to view the minting transaction on Sui Scan

ALTER TABLE public.emotion_records
ADD COLUMN IF NOT EXISTS transaction_digest TEXT;

-- Add comment to explain the field
COMMENT ON COLUMN public.emotion_records.transaction_digest IS 'Transaction digest for NFT minting transactions, used to link to Sui Scan';

