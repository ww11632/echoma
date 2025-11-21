-- Create access_labels table to store access control labels for NFT addresses
-- This allows users to label authorized addresses (e.g., "Partner", "Family", etc.)
-- and sync these labels across devices

CREATE TABLE IF NOT EXISTS access_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nft_id TEXT NOT NULL, -- The Entry NFT object ID
  address TEXT NOT NULL, -- The authorized wallet address
  label TEXT NOT NULL, -- The label (e.g., "Partner", "Family", "Therapist")
  network TEXT NOT NULL CHECK (network IN ('testnet', 'mainnet')), -- The Sui network
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique combination of user, NFT, address, and network
  UNIQUE(user_id, nft_id, address, network)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_access_labels_user_id ON access_labels(user_id);
CREATE INDEX IF NOT EXISTS idx_access_labels_nft_id ON access_labels(nft_id);
CREATE INDEX IF NOT EXISTS idx_access_labels_user_nft ON access_labels(user_id, nft_id);

-- Enable Row Level Security
ALTER TABLE access_labels ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Users can only read their own labels
CREATE POLICY "Users can read own labels"
  ON access_labels
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own labels
CREATE POLICY "Users can insert own labels"
  ON access_labels
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own labels
CREATE POLICY "Users can update own labels"
  ON access_labels
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own labels
CREATE POLICY "Users can delete own labels"
  ON access_labels
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_access_labels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the function
CREATE TRIGGER update_access_labels_updated_at_trigger
  BEFORE UPDATE ON access_labels
  FOR EACH ROW
  EXECUTE FUNCTION update_access_labels_updated_at();

