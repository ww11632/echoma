# Security Test Suite Guide

This security test suite covers the following five critical security test scenarios:

## 1. Cryptographic Vector Tests (AES-GCM)

Tests AES-GCM encryption security properties, ensuring the following attacks must fail.

**Cross-Validation**: Uses a subset of Google Wycheproof AES-GCM test cases for cross-validation (Apache-2.0 license). To avoid test jitter from upstream updates, the used cases have been fixed as snapshots and published with the repo.

### Test Items:
- **Tag Tampering Test**: After modifying authentication tag, decryption must fail, return `DATA_CORRUPTED` error
- **IV Reuse Test**: When reusing initialization vector, must be actively detected and rejected at encryption stage, return `IV_REUSE_BLOCKED` error
- **Header Tampering Test**: Changing any field in schema/kdf/iterations/salt/iv/key_id, decryption must return `AAD_MISMATCH` (or underlying `DATA_CORRUPTED`)
- **Header Field Addition Test**: Adding non-essential fields → should `AAD_MISMATCH` (prevent "gray field addition" from silently bypassing validation)
- **Header Field Removal Test**: Removing essential fields → should `PARAM_MISMATCH` or `AAD_MISMATCH`
- **Header Key Order Shuffle Test**: Shuffling Header key order (values unchanged), should still decrypt successfully (validates Canonical JSON serialization)
- **Canonical JSON Fingerprint Consistency Test**: Same input should produce completely identical Canonical JSON and SHA-256 fingerprint in different environments
- **Non-12 bytes IV Test**: Non-12 bytes IV → directly reject, return `PARAM_MISMATCH`
- **Base64URL Padding Consistency Test**: Ciphertext/IV/Salt uniformly use **Base64URL** (no padding, regex validation `^[A-Za-z0-9_-]*$`); if standard Base64 or mixed padding detected, return `PARAM_MISMATCH`; **prohibit using `atob/btoa` native API**
- **AAD Empty String Normalization Test**: If AAD is empty, explicitly pass `new Uint8Array(0)`, cannot pass `null/undefined`; empty AAD vs not passing AAD cannot be considered equivalent
- **PBKDF2 Iteration Count Too Low Test**: Iterations < 100,000 → return `PARAM_MISMATCH`
- **PBKDF2 Iteration Count Too High Test**: Iterations > 2,000,000 → return `PARAM_MISMATCH`
- **IV RNG Uniformity Test**: Sample 10k 96-bit IVs, check repetition rate ~ 0 (expected 2^-96 level, actual should be 0), and bit distribution (single bit deviation not significant)
- **Timing Side-Channel Check**: Use large number of wrong inputs to ensure return time distribution difference is not significant (coefficient of variation < 50%); compare INVALID_KEY vs DATA_CORRUPTED delay distribution (target AUC ~ 0.5, output `aucInvalidVsCorrupted`, `ks_p`, `ttest_p`)
- **Truncated Ciphertext Test**: After truncating ciphertext (including tag), decryption must fail, return `DATA_CORRUPTED` error

**Header as AAD (Additional Authenticated Data)**:
The versioned encryption header (all fields except ciphertext/tag) is verified together as AES-GCM's AAD. This prevents "swap header without swapping body" replacement attacks, ensuring integrity binding between encryption header and ciphertext.

**Canonical AAD Specification**:
AAD serialization must be provably "unique and stable". Implementation uses Option B: Use Canonical JSON (RFC8785 JCS) to serialize header, ensuring key order, whitespace, and number formatting consistency. This avoids "key order shuffle causing validation failure" issues.

### Expected Results:
All tampering attempts should cause decryption to fail and return appropriate error types (see "Error Code Reference Table" below).

### Encryption Header Example

Standard encryption header structure (Base64URL encoded):

```json
{
  "schema": 3,
  "kdf": "pbkdf2-sha256",
  "iterations": 300000,
  "salt_b64url": "2f3nR-7z...Q",
  "iv_b64url": "Q8r4y0...w",
  "key_id": "a1f0c9d2e74b8c10",
  "created_at": 1736764800
}
```

**Binary Encoding Specification**:
- Ciphertext, IV, Salt uniformly use **Base64URL** encoding (no padding)
- **Not allowed** standard Base64 or mixed padding
- **Prohibit using `atob/btoa` native API** (easily produces standard Base64)
- **Base64URL Strict Validation**: Regex `^[A-Za-z0-9_-]*$` (empty string allowed, length validated separately)
- Implementation-level validation: `if (!B64URL_REGEX.test(s) || s.includes("=")) throw PARAM_MISMATCH;`
- If padding (=) detected, directly reject at data layer parse (`PARAM_MISMATCH`), do not auto-correct
- CI grep check: Prohibit `atob/btoa` from appearing in code
- Recommendation: ESLint custom rule to prohibit `atob/btoa`
- If mixed encoding detected (e.g., frontend uses Base64, backend uses Base64URL), return `PARAM_MISMATCH`
- Tests will verify encoding consistency

**IV and Tag Length Specification**:
- `iv.length === 12` bytes (AES-GCM standard)
- `tagLength === 128` bits (AES-GCM standard, hard limit)
- Non-compliant → directly reject, return `PARAM_MISMATCH`

**PBKDF2 Boundary Specification**:
- `PBKDF2.iterations` must satisfy `100,000 ≤ n ≤ 2,000,000`
- Out of range → return `PARAM_MISMATCH`
- Prevents DoS/misuse

**Important Note - IV Reuse Detection Mechanism**:
This suite's IV reuse detection is active blocking (encryption layer maintains `keyId → IV` set), not relying on decryption errors. AES-GCM itself cannot automatically tell you "you reused IV", so we implemented session-level IV registry in `encryption.ts`. Test expectation: **Encryption step immediately reports `IV_REUSE_BLOCKED` error**, not discovering the problem at decryption stage.

**keyId Definition and Privacy Protection**:
To avoid keyId becoming a permanent fingerprint for "cross-record correlation", keyId calculation method:
```
keyId = first_128_bits(HKDF(KEK, info="echoma:keyid:v1:mode", salt=salt_keyid))
```
Where:
- `KEK` is the actual encryption key (derived from password)
- `salt_keyid` is application domain separation constant ("echoma:keyid:salt:v1")
- `mode` is scope (wallet/account/guest), avoids cross-identity mode correlation
- Uses HKDF instead of direct SHA-256(password), avoids offline dictionary attacks

**Scoping**:
- `wallet`: "echoma:keyid:v1:wallet"
- `account`: "echoma:keyid:v1:account"  
- `guest`: "echoma:keyid:v1:guest"
- Same KEK in different mode → keyId must be different (test: `keyid_cross_mode_diff`)

**Important Privacy Statement**:
- keyId is only used for encryption flow internal routing and IV reuse detection
- **Prohibited for cross-record/cross-user correlation analysis**
- If persistence needed, should use HKDF re-derived fingerprint for storage (e.g., do another HKDF), reducing correlation

**Note**: IV registry is session-level, cannot detect across sessions after multi-tab or refresh. This mechanism is mainly for preventing accidental reuse within the same session; cross-session IV reuse detection requires backend support.

## 2. Parameter Replay Tests

Tests encryption and decryption compatibility of same data under different device configurations.

### Test Scenarios:
- **Low-end Phone**: 100,000 PBKDF2 iterations
- **Mid-range Phone**: 300,000 PBKDF2 iterations
- **High-end Phone**: 500,000 PBKDF2 iterations
- **Desktop**: 1,000,000 PBKDF2 iterations

### Test Content:
1. Encrypt same data on different devices
2. Verify encryption parameters (iteration count) correctly saved
3. Cross-device decryption: Encrypt on device A, decrypt on device B

### Expected Results:
- All devices can successfully encrypt and decrypt
- Cross-device decryption should succeed (using same password and parameters)

## 3. Base64/UTF-8 Boundary Tests

Tests various Unicode boundary cases, ensuring serialization/deserialization does not break data integrity.

### Test Cases:
- **Emoji**: Large number of emoji characters
- **Ligatures**: Such as ﬁ, ﬂ, ﬀ, etc.
- **Long Text**: 10KB text
- **Mixed Unicode**: Multiple languages and character sets mixed
- **Zero-Width Characters**: Hidden control characters
- **Surrogate Pairs**: Characters requiring two 16-bit units
- **Combining Characters**: Characters with diacritics

### Verification Method:
1. Encrypt original text
2. JSON serialization and deserialization
3. Decrypt and verify (hierarchical comparison, record failure level):
   - **Level 1: Byte Length Comparison** - Byte length completely matches
   - **Level 2: Byte-by-Byte Comparison** - Byte-by-byte comparison completely identical
   - **Level 3: String Comparison** - String content completely equal
   - **Level 4: Unicode Normalization Verification** - `NFC(original) === NFC(decrypted_result)`, avoids false negatives from Unicode normalization differences

**Hierarchical Comparison Explanation**:
Compare bytes first → then compare strings → finally compare NFC. Mark which level failed in report for faster localization.

**Unicode Normalization Explanation**:
Some sources provide NFD (decomposed) strings, display identical but bytes different. In addition to byte-by-byte comparison, also verify NFC (standard composed form) equality, ensuring not misjudged as failure due to normalization differences.

### Expected Results:
All test cases should pass, ensuring data is completely lossless during encryption/decryption and serialization. Acceptance criteria: **bytes equal and NFC equal, 0 tolerance**.

## 4. Rate Limit Test (Browser Probe Version)

Simulates high concurrency requests, tests rate limiting mechanism effectiveness and recovery capability.

**⚠️ Important Limitations**:
This test is only a health probe, does not represent actual backend throughput. Real load testing should move to Node/CI environment, otherwise results are affected by browser concurrency limits and CORS, cannot reflect actual performance.

### Test Configuration:
- **Concurrency**: 20 requests (browser-side reduced version, real load testing should be in Node/CI environment)
- **Sending Method**: Send in 10 batches within 1 second (100ms interval per batch)
- **Target Endpoint**: AI emotion response endpoint (`/functions/v1/ai-emotion-response`)
- **Cancel Support**: Uses AbortController, can cancel test anytime

### Test Content:
1. Send 20 concurrent requests (browser-side limit)
2. Statistics:
   - Successful requests (200 status code)
   - Rate-limited requests (429 status code, returns `RATE_LIMITED` error)
   - Authentication errors (401 status code, returns `UNAUTHORIZED` error)
   - Other errors
3. Wait 2 seconds then test recovery capability (single request should return 200)

### Expected Results:
- **Valid Response Rate**: `(200 + 429) / valid responses ≥ 60%` (invalid responses not counted in denominator)
- **Invalid Response Limit**: `invalid responses / total requests < 20%` (network errors/timeouts/0/0 treated as invalid samples, separately counted)
- **Recovery Capability**: After waiting 2 seconds, single request should return 200
- **Acceptance Criteria**: `(200 + 429) / valid responses ≥ 0.6` and `invalid responses < 20%`, and recovery test passes

**Fault Tolerance Explanation**:
Change success determination to "(200 + 429) / valid responses ≥ 0.6"; treat 0/0, network errors as "invalid samples" separately counted, avoid false failures in offline environments.

## 5. JWT Session Refresh Smoothness Test

Tests smooth transition during JWT session refresh, ensuring no "cliff-like" success rate drop.

**Note**: API Key Rotation test has been moved to backend/CI environment, should not be exposed in frontend.

### Test Scenario:
- **Test Duration**: 5 seconds
- **Test Interval**: Test one request every 100ms
- **Target Endpoint**: AI emotion response endpoint (using current session's JWT)
- **Clock Skew Tolerance**: Mobile devices may have clock skew; result JSON records server Date, allows ±60s tolerance, reduces false positives

### Test Method:
1. Continuously send requests during test period
2. Test one request every 100ms (using current session's JWT)
3. Record success rate at each time point
4. Analyze success rate change curve

### Verification Criteria:
- **Should Not Have Cliff**: Five-point sliding window maximum difference ≤ 0.5 (avoid single-point noise triggering cliff)
- **Should Smoothly Transition**: Success rate should gradually change (standard deviation < 0.25)
- **Minimum Success Rate**: Minimum success rate during transition should ≥ 60%
- **Consecutive Failure Limit**: Within 1 second window (10 tests), consecutive failures ≤ 5

### Expected Results:
- `hasCliff = false`: No cliff-like drop detected (five-point sliding window detection)
- `isSmooth = true`: Transition is smooth
- `minSuccessRate ≥ 0.6`: Minimum success rate greater than or equal to 60%
- `stddev < 0.25`: Standard deviation less than 0.25
- `maxConsecutiveFails ≤ 5`: Within 1 second window, consecutive failures not exceeding 5

**Acceptance Criteria**: `minSuccessRate ≥ 0.6`, no cliff (five-point sliding window), standard deviation < 0.25, consecutive failures ≤ 5 (1 second window)

## Security Improvements (2025-01)

### Important Security Improvements

1. **Route Guard**: Security test page only available in development environment (`import.meta.env.DEV`) or when setting `VITE_ENABLE_SECURITY_TESTS=true`, avoiding exposing load testing entry in production environment.

2. **IV Reuse Detection**: Implemented session-level IV registry in `encryption.ts`, actively detects and rejects IV reuse, preventing security vulnerabilities.

3. **Rate Limit Test Limitations**:
   - Browser-side only sends 20 requests (small sample probe)
   - Real load testing should be in Node/CI environment
   - Added AbortController support, avoids hanging requests

4. **Authentication Model Separation**:
   - Frontend only tests JWT session refresh smoothness
   - API Key Rotation test moved to backend/CI environment
   - No longer exposes API Key rotation logic in frontend

5. **Web Worker Support**: Created `securityTests.worker.ts` for handling long-running/large CPU tests, avoids blocking main thread.

6. **UTF-8 Test Enhancement**: Added ZWJ emoji, Arabic ligatures, Thai diacritics, Tibetan, multi-layer combining characters and other boundary test cases.

## Usage

### 1. Access Test Page

**Important**: Security test page is only available under the following conditions:
- Development environment (`npm run dev`)
- Setting environment variable `VITE_ENABLE_SECURITY_TESTS=true`

Access in browser: `/security-tests`

### 2. Login (Optional, but Recommended)

**Important**: To run complete test suite (including Rate Limit and JWT session refresh tests), need to login to Supabase first:

1. Visit `/auth` page
2. Login with existing account, or register new account
3. After successful login, return to `/security-tests` page

**Note**:
- First three tests (cryptographic vectors, parameter replay, UTF-8 boundaries) **do not require login** to run
- Last two tests (Rate Limit, JWT session refresh) **require login** to run
- If not logged in, last two tests will return 401 authentication error (`UNAUTHORIZED`), this is expected behavior

### 3. Run Tests

Click "Run All Tests" button, system will execute all test suites sequentially.

### 4. View Results

After tests complete, page will display:
- **Test Summary**: Overall statistics
- **Individual Test Suite Results**: Detailed results for each test
- **Pass/Fail Status**: Pass status for each test item
- **Detailed Error Information**: Error details for failed tests

## Notes

1. **Rate Limit Test** requires valid Supabase authentication session. If not logged in, this test will return 401 authentication error (this is expected behavior).

2. **JWT Session Refresh Test** requires valid Supabase authentication session. If not logged in, this test will return 401 authentication error (this is expected behavior).

3. **API Key Rotation Test** has been moved to backend/CI environment, should not be performed in frontend. Backend tests will simulate dual-read period and cache TTL expiration, frontend only displays results, does not participate in key value transmission.

4. Some tests (such as Rate Limit) may cause load on server, recommend running in test environment.

5. Test results will be displayed on page, can copy JSON format detailed information for further analysis.

6. **Core Security Tests** (cryptographic vectors, parameter replay, UTF-8 boundaries) do not require login to run, these tests verify core security properties of encryption system.

## Technical Implementation

- **Encryption Library**: Uses Web Crypto API to implement AES-GCM
- **Test Framework**: Custom test framework, supports async tests and result aggregation
- **UI Components**: Uses shadcn/ui component library to build test interface
- **Web Worker**: Long-running or large CPU tests (such as batch AES-GCM) execute in Web Worker; main thread only responsible for rendering, avoids UI hanging

## File Structure

```
src/
├── lib/
│   ├── securityTests.ts           # Test implementation
│   ├── securityTests.worker.ts    # Web Worker (for CPU-intensive tests)
│   └── encryption.ts              # Encryption implementation (includes IV reuse detection)
└── pages/
    └── SecurityTests.tsx          # Test UI page
```

## Environment Variables

- `VITE_ENABLE_SECURITY_TESTS`: When set to `"true"`, enables security test page even in production environment

  **⚠️ Risk Warning**: This option is only for short-term debugging; leaving it on in production will expose load testing entry, may be abused causing traffic amplification. Recommend only using in development environment, or close immediately after setting.

- By default, only enabled in development environment (`import.meta.env.DEV`)

## Error Code Reference Table

This suite uses unified error codes for frontend-backend alignment:

| Error Code | Description | Common Scenarios |
|------------|-------------|------------------|
| `INVALID_KEY` | Password/derivation parameters mismatch | PBKDF2 iteration count different, wrong password, KDF parameters mismatch |
| `DATA_CORRUPTED` | Ciphertext/authentication tag tampered or truncated | Tag tampering, Base64 transmission truncation, ciphertext corruption |
| `IV_REUSE_BLOCKED` | Detected same keyId reusing IV, actively blocked | Retry replaying old IV, detected reuse at encryption stage |
| `UNAUTHORIZED` | Missing/expired JWT | Not logged in, session expired, JWT invalid |
| `RATE_LIMITED` | Triggered rate limit quota | High concurrency testing, exceeded rate limit |
| `PARAM_MISMATCH` | Header missing fields or illegal | Missing iv/salt/kdf/iterations, length mismatch |
| `AAD_MISMATCH` | AAD verification failed | Header tampered or inconsistent with ciphertext |

**Note**:
- `IV_REUSE_BLOCKED` is actively detected and rejected by IV registry at encryption stage, not discovered at decryption
- `AAD_MISMATCH` is detected at decryption stage by AES-GCM's AAD verification mechanism
- Other error codes usually returned at decryption or API call stage

## Test Acceptance Criteria (CI Automated Judgment)

The following criteria are used for CI automated acceptance, all tests must pass to be considered qualified:

### 1. Cryptographic Vector Tests
- **Acceptance Criteria**: 100% pass; any item failure = Fail
- Tag tampering test: Must return `DATA_CORRUPTED` (including unexpected success alert)
- IV reuse test: Must return `IV_REUSE_BLOCKED` (encryption stage, including unexpected success alert)
- Header tampering test: Must return `AAD_MISMATCH` or `DATA_CORRUPTED`
- Header field addition test: Must return `AAD_MISMATCH`
- Header field removal test: Must return `PARAM_MISMATCH` or `AAD_MISMATCH`
- Header key order shuffle test: Must pass (Canonical JSON serialization)
- Canonical JSON fingerprint consistency test: Same input must produce completely identical fingerprint
- Non-12 bytes IV test: Must return `PARAM_MISMATCH`
- Base64URL padding consistency test: Must pass (no padding, regex validation)
- AAD empty string normalization test: Must pass (explicitly pass `new Uint8Array(0)`)
- PBKDF2 iteration count too low test: Must return `PARAM_MISMATCH`
- PBKDF2 iteration count too high test: Must return `PARAM_MISMATCH`
- IV RNG uniformity test: Repetition rate = 0, bit distribution no significant deviation
- keyId cross-mode difference test: Must pass (different mode produces different keyId)
- Timing side-channel check: AUC ≤ 0.6, ks_p ≥ 0.05, coefficient of variation < 50%
- Truncated ciphertext test: Must return `DATA_CORRUPTED` (including unexpected success alert)

### 2. Parameter Replay Tests
- **Acceptance Criteria**: Four-tier iteration counts (100k/300k/500k/1M) cross-decryption 100% success
- All device configurations can successfully encrypt and decrypt
- Cross-device decryption must succeed

### 3. UTF-8 Boundary Tests
- **Acceptance Criteria**: bytes equal and NFC equal, 0 tolerance
- All test cases must pass
- Byte-level completely match
- Unicode normalization completely match

### 4. Rate Limit Test (Browser Probe Version)

**Rate Probe Degradation Redline (Acceptance Threshold)**:
- `p95 ≤ 1500ms` (example, adjust based on backend settings)
- `tailShare(>2000ms) ≤ 10%`
- `(200 + 429) / valid responses ≥ 60%`
- `invalid responses < 20%`
- `recovery200 = true`
- `headersOk = true` (429 must include Retry-After or vendor header)
- `replayDedupOk = true` (Idempotency-Key deduplication test passes)
- Failure directly considered degradation, avoid "200 but very slow" misjudged as OK

**429 Header Verification**:
- Verify 429 includes `Retry-After` (seconds or date format) or vendor header (such as `X-RateLimit-Remaining` / `Reset`)
- `rateProbe.headersOk = true` as part of acceptance

**Replay Protection Actual Test**:
- For 3 requests with same `Idempotency-Key`: Only allow one success, others should return 409/dedicated error
- `rateProbe.replayDedupOk = true`
- `dedupScope = "per-user-per-endpoint"` (deduplication scope)
- `dedupTtlMs = 120000` (deduplication window: 2 minutes)
- **Acceptance Criteria**: `(200 + 429) / valid responses ≥ 0.6`; invalid responses < 20%; after waiting 2s, single request 200 success
- Valid response rate ≥ 60% (invalid responses not counted in denominator)
- Invalid responses (network errors/timeouts/0/0) < 20%
- Recovery test must pass

### 5. JWT Session Refresh Smoothness Test

**JWT Smooth Threshold (Acceptance Criteria)**:
- `minSuccessRate ≥ 0.6`
- Five-point sliding window maximum difference ≤ 0.5
- `stddev < 0.25`
- 1 second window `maxConsecutiveFails ≤ 5`
- 4xx ratio within 1s window before/after refresh ≤ 10%
- Must output `skewMs` (server date write-back vs client difference: `serverNow - clientNow`, allows ±60s tolerance)
- Must output `preRefreshSuccess`, `postRefreshSuccess` (average success rate within 500ms window before/after refresh)
- Must output `peak4xxWindow` (4xx peak timestamp within 1s before/after refresh, convenient for aligning with server logs)
- Must output `retryAfterHeaders` (whether 429/503 includes Retry-After or RateLimit-Reset)
- **Acceptance Criteria**: `minSuccessRate ≥ 0.6`, no cliff (five-point sliding window), standard deviation < 0.25, consecutive failures ≤ 5 (1 second window)
- Minimum success rate ≥ 60%
- No cliff-like drop (five-point sliding window maximum difference ≤ 0.5)
- Standard deviation < 0.25
- Within 1 second window (10 tests), consecutive failures ≤ 5

## Future Extension Notes

### Argon2id Support
If switching to Argon2id in the future, need to:
1. Add `kdf=argon2id` scenario in "Parameter Replay Tests"
2. Add different KDF mixing scenarios in "Cryptographic Vector Tests" (old PBKDF2 → new Argon2id)
3. Ensure Header versioning can correctly route decryption

### IV Registry Limitations
- IV registry is session-level, cannot detect across sessions after multi-tab or refresh
- Cross-session IV reuse detection requires backend support (recommend implementing at Edge Function layer)

### Worker Lifetime Management
- Must `terminate()` worker and clean up IV registry when test ends/page leaves, prevent memory zombies
- Recommend handling in `useEffect` cleanup function:

```typescript
useEffect(() => {
  return () => {
    if (worker) {
      worker.terminate();
    }
    // Clean up IV registry (if needed)
  };
}, []);
```

### Replay Protection (Server-Side)
- For protected endpoints, use `Replay-Nonce` (one-time, short TTL) or `Idempotency-Key` (client sends) + server deduplication
- In probe, verify "replay → 409/PARAM_MISMATCH/dedicated error"
- Recommend adding replay detection in Rate Limit test

### Structured Audit Fields
Output JSON/server audit logs should all include:
- `request_id`: Request unique identifier
- `session_id`: Session identifier
- `key_id_hash`: keyId's secondary derivation (HKDF re-derived), reducing correlation
- `rate_bucket`: Rate limit bucket identifier
- Align troubleshooting process

### Time/Privacy Boundaries
- `created_at` may become side-channel (replay/user activity inference)
- Recommendation: Timestamp rounded to minute level or server time backfilled
- Document this design purpose: Reduce time granularity, reduce side-channel leakage

### Observability Alignment
- Add structured fields to 429/401/5xx paths (audit field recommendations)
- Must return `request_id` to frontend test JSON, PR review can 1:1 align with backend logs
- Output JSON should include: `request_id`, `session_id`, `key_id_hash` (secondary derivation), `rate_bucket`

### Timing Precision and Calibration
- Browser timers are often denoised
- Before running timing test, do self-calibration (idle N times to measure baseline delay)
- Record `baselineJitterMs` in report, otherwise AUC/KS may misjudge

### UTF-8 Maximum Length Protection
- Long text tested to 10KB is fine, but actually online should also limit "maximum payload per decryption" (e.g., 1MB)
- Mark maximum length in documentation, avoid OOM-type incidents

### Environment Flag Protection
- CI adds one protection, prohibit `VITE_ENABLE_SECURITY_TESTS=true` from appearing in Dockerfile or any prod build command
- Recommend adding grep check in CI

## Reproducibility Support (SEED)

All tests support SEED parameter, ensuring test results are reproducible:

- **Set SEED**: Before test starts, call `setTestSeed(seed)`, all random plaintext/IV/batch rhythm driven by seed
- **Record SEED**: Each test's SEED will be recorded in result JSON
- **Replay Failed Cases**: Using same SEED can one-click replay failed test cases

**Usage**:
```typescript
import { setTestSeed } from '@/lib/securityTests';

// Set fixed SEED (e.g., from failure report)
setTestSeed(1337);

// Run tests (results will be completely reproducible)
await runAllSecurityTests(...);
```

## Test Output Format (Standardized JSON)

Each frontend probe and CI load test outputs unified JSON format (e.g., `benchmarks/security-<date>.json`), for automated comparison and trend analysis:

```json
{
  "runId": "2025-11-13T03:21:45.123Z",
  "seed": 1337,
  "versions": { "app": "x.y.z", "kdf": "pbkdf2", "schema": 3 },
  "cryptoVectors": { "total": 24, "passed": 24, "failed": 0 },
  "utf8Edges": { 
    "cases": 12, 
    "bytesEqual": true, 
    "nfcEqual": true,
    "failureLevel": null
  },
  "paramReplay": { 
    "profiles": [100000, 300000, 500000, 1000000], 
    "crossDecryptOk": true 
  },
  "rateProbe": {
    "requested": 20, 
    "ok": 9, 
    "r429": 5, 
    "r401": 2, 
    "others": 0,
    "invalidResponses": 4,
    "netError": 2,
    "timeout": 2,
    "corsBlocked": 0,
    "p50": 180,
    "p95": 420,
    "tailShare": "0.050",
    "recovery200": true
  },
  "jwtSmooth": {
    "windowMs": 100, 
    "durationMs": 5000,
    "minSuccessRate": 0.78, 
    "stddev": 0.12,
    "hasCliff": false, 
    "maxConsecutiveFails": 2,
    "tokenRefreshObserved": true,
    "recoveryGapMs": 340,
    "preRefreshSuccess": 0.85,
    "postRefreshSuccess": 0.78
  }
}
```

This format can be used for:
- CI automated acceptance
- Trend analysis (put recent three trend charts in README)
- Dashboard displaying historical comparison

**JSON Schema Validation**:
Output JSON must conform to `benchmarks/schema/security.v1.json` Schema. CI uses `ajv` for validation, avoiding field drift.

**Unexpected Success Alert**:
In tests that should fail (such as tampering, wrong length), if getting 200/decryption success, must flag red and output "minimal reproduction sample": `header`, `iv`, `ciphertext`, `SEED`. This is extremely useful for quick regression.

## Security Recommendations

### Content Security Policy (CSP)

Recommend setting strict CSP for security test page:

```
Content-Security-Policy: 
  script-src 'self'; 
  object-src 'none'; 
  base-uri 'self'; 
  connect-src 'self' https://*.supabase.co https://*.supabase.io;
  frame-ancestors 'none';
```

**Important Reminder**: Supabase regional subdomains differ, need to synchronously update `connect-src`, avoid misjudging "network errors". For example:
- US region: `https://*.supabase.co`
- Europe region: `https://*.supabase.io`
- Other regions: Adjust based on actual Supabase project region used

**Web Worker and WASM Support**:
If using Web Worker or WASM, recommend adding:
```
worker-src 'self' blob:;
connect-src 'self' https://*.supabase.co https://*.supabase.io;
```
If WASM: `script-src 'self' 'wasm-unsafe-eval';` (only open when definitely needed)

**COOP/COEP Recommendations**:
Consider setting `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` (COOP/COEP) for more stable worker/shared memory performance.

**Important**: Only enable COOP/COEP on `/security-tests` route (or independent origin), avoid affecting main application third-party integrations.

**Trusted Types + CSP Enhancement**:
If page has any risk of string concatenation to DOM, recommend enabling `require-trusted-types-for 'script'` and using custom policy in test page; even for internal tool pages, this can avoid detail slippage.

This can prevent test page from being injected with strange scripts, ensuring test environment security.

### Risk Flag Scanning

CI has implemented automatic checks, prohibiting the following flags from persisting in production environment variables or `.env.example`:

- `VITE_ENABLE_SECURITY_TESTS=true`
- `VITE_FORCE_ENABLE_SECURITY_TESTS=true`
- `console.profile`
- `debug_test=true`

**CI Check Script**:
- Location: `scripts/ci/check-security-flags.sh`
- GitHub Actions: `.github/workflows/security-check.yml`
- Check Scope:
  - `.env.example`: Should not contain any `VITE_*SECURITY_TESTS*` environment variables
  - `Dockerfile` / `Dockerfile.*`: Should not contain security test-related environment variables
  - `docker-compose.yml`: Should not contain security test-related environment variables
  - `package.json` build scripts: Should not contain security test-related environment variables
  - All shell scripts: Should not set `VITE_*SECURITY_TESTS*=true`

**Run Check**:
```bash
# Run CI check locally
npm run ci:check-security-flags

# Or run script directly
bash scripts/ci/check-security-flags.sh
```

**Fix Recommendations**:
1. Remove all `VITE_*SECURITY_TESTS*` environment variables from `.env.example`
2. Remove security test-related environment variables from Dockerfile and docker-compose files
3. Remove security test-related environment variables from production build scripts
4. Security test page should only be used in development environment or special test scenarios

## Extending Tests

If you need to add new test scenarios, you can add new test functions in `securityTests.ts` and call them in `runAllSecurityTests`.
