# Security Features Implementation Guide

## TL;DR – Threat Model in 5 Lines

- **Data type**: Highly sensitive emotional journal data
- **Adversaries**: Cloud providers, governments, future attackers, and even future self (accidental data deletion)
- **Core guarantees**: Client-side AES-256-GCM, deterministic key derivation, Walrus blobs, Sui NFTs
- **Non-goals**: We do not attempt to hide on-chain existence, only the content
- **Why Walrus**: Long-term, low-cost, verifiable encrypted storage, not plain DB/IPFS

---

This document describes the implemented security features for preventing Prompt Injection, unauthorized data leakage, and providing audit logging and API key rotation support.

## I. Preventing Prompt Injection / Unauthorized Data Leakage

### 1. Minimized Context Concatenation

**Implementation location**: `supabase/functions/_shared/security.ts`

- **Function**: Clean and minimize user input to avoid exposing decrypted sensitive fields to the model
- **Methods**: 
  - `cleanDescription()`: Clean user descriptions, remove common prompt injection patterns
  - `sanitizeUserInput()`: Extract only necessary emotion information (emotion type, intensity), excluding full descriptions

**Cleaning rules**:
- Remove system instruction attempts (e.g., "ignore previous instructions")
- Remove special markers (e.g., `<|...|>`, `[INST]...[/INST]`)
- Limit length (max 2000 characters)
- Remove role markers (system:, assistant:, user:)

### 2. Model Output Classification and Security Detection

**Implementation location**: `supabase/functions/_shared/security.ts`

**Output classification**:
- `supportive`: Supportive text (default)
- `suggestion`: Suggestive content
- `crisis`: Crisis alert (detected self-harm/harm-to-others keywords)
- `unknown`: Unknown classification

**Security keyword detection**:
- Supports Chinese and English keyword detection
- Self-harm keywords: suicide, self-harm, self-injury, ending life, etc.
- Harm-to-others keywords: murder, harm, revenge, attack, etc.
- When high-risk keywords are detected, trigger security controls

### 3. Client-Side Security Controls

**Implementation location**: `supabase/functions/ai-emotion-response/index.ts`

**Workflow**:
1. **Input detection**: Check user input before sending to model
   - If high-risk content is detected, directly block the request
   - Log audit event (even if blocked)
   - Return friendly error message

2. **Output detection**: Check AI response
   - If high-risk content is detected, do not return original response
   - Return generic safety response (provide mental health resources)
   - Log audit event

**Safety response examples**:
- Chinese: "我理解你正在經歷困難。請記住，你並不孤單。如果你正在考慮傷害自己或他人，請立即聯繫專業心理健康服務或緊急服務。"
- English: "I understand you are going through a difficult time. Please remember you are not alone. If you are considering harming yourself or others, please contact professional mental health services or emergency services immediately."

## II. Audit Logging

### 1. Database Table Structure

**Table name**: `ai_audit_logs`

**Fields**:
- `id`: UUID primary key
- `user_id`: User ID (foreign key)
- `api_endpoint`: API endpoint
- `model_name`: Model name
- `request_timestamp`: Request timestamp
- `prompt_tokens`: Number of prompt tokens
- `completion_tokens`: Number of completion tokens
- `total_tokens`: Total number of tokens
- `response_length`: Response length
- `was_truncated`: Whether truncated
- `truncation_reason`: Truncation reason
- `response_category`: Response category
- `risk_level`: Risk level (low/medium/high)
- `security_check_passed`: Whether security check passed
- `detected_keywords`: Array of detected keywords
- `input_summary`: Input summary (only stores emotion type and intensity, not full description)
- `input_length`: Input length
- `language`: Language
- `error_message`: Error message (if any)
- `created_at`: Creation timestamp

### 2. Audit Log Recording

**Implementation location**: `supabase/functions/_shared/auditLogger.ts`

**Functions**:
- `logAuditEvent()`: Record audit log
- `extractTokenUsage()`: Extract token usage information from AI response
- `checkTruncation()`: Check if response was truncated

**Recording timing**:
- Record after each AI API call
- Record even if request was blocked by security check
- Record all error cases

### 3. Data Privacy Protection

- **Do not store full user descriptions**: Only store summary (emotion type and intensity)
- **RLS policies**: Users can only view their own audit logs
- **Sensitive information filtering**: Detected keywords are logged, but full sensitive content is not stored

## III. API Key Rotation

### 1. Database Table Structure

**Table name**: `api_keys`

**Fields**:
- `id`: UUID primary key
- `key_name`: Key name (unique)
- `key_value_encrypted`: Encrypted API key storage
- `is_active`: Whether active
- `rotation_schedule_days`: Rotation schedule (days, default 90 days)
- `last_rotated_at`: Last rotation timestamp
- `next_rotation_at`: Next rotation timestamp
- `created_at`: Creation timestamp
- `updated_at`: Update timestamp

### 2. API Key Management

**Implementation location**: `supabase/functions/_shared/apiKeyRotation.ts`

**Functions**:
- `getActiveApiKey()`: Get current active API key
  - Priority: Get from database (supports rotation)
  - Fallback: If database fetch fails, fall back to environment variable
- `checkAndRotateApiKey()`: Check and trigger API key rotation
  - Check if rotation time has arrived
  - Update rotation time (actual rotation requires manual admin execution)
- `initializeApiKey()`: Initialize API key

### 3. Usage

**Current implementation**:
- Supports getting from environment variable (backward compatible)
- Supports getting from database (requires `SUPABASE_SERVICE_ROLE_KEY` configuration)

**Rotation process**:
1. System automatically checks rotation time
2. If rotation time has arrived, mark as needing rotation
3. Admin manually creates new key and updates configuration
4. System switches to new key
5. Disable old key

**Note**: 
- Encrypted API key storage requires server-side key decryption
- In actual production environments, it is recommended to use key management services (e.g., AWS KMS, Azure Key Vault)

## IV. Usage Examples

### 1. Run Database Migrations

```bash
# Apply audit logs table migration
supabase migration up 20250116000000_create_audit_logs

# Apply API keys table migration
supabase migration up 20250116000001_create_api_keys_table
```

### 2. Configure Environment Variables

```bash
# Supabase Edge Function environment variables
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # For API key rotation
LOVABLE_API_KEY=your_lovable_api_key  # Backward compatible, if not configured in database
```

### 3. Initialize API Key (Optional)

If you need to use database-stored API keys, you can initialize via Edge Function or admin script:

```typescript
import { initializeApiKey } from './_shared/apiKeyRotation.ts';

// Note: key_value_encrypted needs to be encrypted first
await initializeApiKey(
  supabase,
  'lovable_api_key',
  encryptedKey,  // Needs to be encrypted first
  90  // Rotate every 90 days
);
```

### 4. View Audit Logs

```sql
-- View user's audit logs
SELECT * FROM ai_audit_logs 
WHERE user_id = 'user-uuid' 
ORDER BY created_at DESC;

-- View high-risk requests
SELECT * FROM ai_audit_logs 
WHERE risk_level = 'high' 
ORDER BY created_at DESC;

-- View blocked requests
SELECT * FROM ai_audit_logs 
WHERE security_check_passed = false 
ORDER BY created_at DESC;
```

## V. Security Best Practices

1. **Regularly review audit logs**: Check high-risk requests and abnormal patterns
2. **Regularly rotate API keys**: Recommended every 90 days
3. **Monitor keyword detection**: Pay attention to detected keyword trends
4. **Protect server-side keys**: Use secure key management services
5. **Limit audit log access**: Only authorized administrators can access full logs
6. **Regularly update keyword lists**: Update crisis keywords based on actual usage

## VI. Notes

1. **Keyword detection**: Current keyword list is a basic version and may need expansion based on actual usage
2. **API Key encryption**: In current implementation, API key encryption/decryption requires additional implementation (recommended to use key management services)
3. **Performance impact**: Security checks and audit log recording add minimal delay, but impact is small
4. **False positive handling**: If false positives occur, analyze via audit logs and adjust keyword lists

## VII. Future Improvements

1. **Machine learning classification**: Use ML models for more accurate response classification
2. **Dynamic keyword updates**: Support dynamically loading keywords from configuration
3. **Real-time monitoring alerts**: Send alerts when high-risk content is detected
4. **User feedback mechanism**: Allow users to report false positives for improving detection algorithms
