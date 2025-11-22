# Functional Test Guide

## 🎯 Test Objectives

Verify the performance of 7 high-priority logic fixes in actual usage scenarios.

---

## 🚀 Start Test Environment

### 1. Start Development Server

```bash
# Terminal 1: Start frontend development server
npm run dev

# Terminal 2: Start backend API server (if needed)
npm run server
```

Frontend will start at `http://localhost:5173`.

---

## 📋 Test Checklist

### ✅ Test 1: Timestamp Format Consistency

**Objective**: Verify all records use ISO string format for timestamps

**Steps**:
1. Open browser developer tools (F12)
2. Go to Console tab
3. Create a new record (select emotion, enter description, save)
4. Execute in Console:
   ```javascript
   // Check records in local storage
   const localData = localStorage.getItem('echoma_encrypted_mvp_records') || 
                     localStorage.getItem('echoma_mvp_records');
   if (localData) {
     const records = JSON.parse(localData);
     console.log('Timestamp format:', records[0]?.timestamp);
     console.log('Is ISO string?', typeof records[0]?.timestamp === 'string' && 
                 records[0]?.timestamp.includes('T'));
   }
   ```

**Expected Results**:
- ✅ Timestamp format is ISO string (e.g., `2025-01-15T10:30:00.000Z`)
- ✅ Not a numeric timestamp

---

### ✅ Test 2: Component Unmount Safety (setTimeout Navigation)

**Objective**: Verify component does not attempt navigation after unmount, avoiding memory leaks

**Steps**:
1. Open browser developer tools (F12)
2. Go to Console tab
3. Create a new record
4. **After save succeeds, before navigation occurs (within ~1-1.5 seconds)**, quickly click browser back button or close tab
5. Check Console for React warnings

**Expected Results**:
- ✅ No React warnings (e.g., "Can't perform a React state update on an unmounted component")
- ✅ No memory leak warnings
- ✅ Navigation does not execute after component unmounts

**Verification Code**:
```javascript
// Check Console for warnings
console.log('Check complete: Should have no React warnings')
```

---

### ✅ Test 3: localStorage Concurrent Save (Lock Mechanism)

**Objective**: Verify no data loss when rapidly saving multiple records consecutively

**Steps**:
1. Open browser developer tools (F12)
2. Go to Console tab
3. Rapidly create 5-10 records consecutively (create next immediately after each save)
4. Wait for all saves to complete
5. Check Timeline page, verify all records exist

**Expected Results**:
- ✅ All records saved successfully
- ✅ No data loss
- ✅ Records sorted correctly by time
- ✅ No error messages in Console

**Verification Code**:
```javascript
// Check record count in Console
const localData = localStorage.getItem('echoma_encrypted_mvp_records') || 
                  localStorage.getItem('echoma_mvp_records');
if (localData) {
  const records = JSON.parse(localData);
  console.log('Saved record count:', records.length);
  console.log('All record IDs:', records.map(r => r.id));
}
```

---

### ✅ Test 4: Deduplication Logic (Prioritize id)

**Objective**: Verify Timeline correctly deduplicates, prioritizing `id` as primary key

**Steps**:
1. Create a record (note its ID)
2. Manually duplicate the record in local storage, modify `created_at` to earlier time
3. Refresh Timeline page
4. Check if only one record is displayed (the latest)

**Expected Results**:
- ✅ Only one record displayed (keeps the latest)
- ✅ Console shows deduplication logs (e.g., "Dedup: keeping..." or "Dedup: replacing...")

**Verification Code**:
```javascript
// Check deduplication logic in Console
// Should see logs like:
// "[Timeline] Dedup: keeping ... (same id, older or equal timestamp)"
// or
// "[Timeline] Dedup: replacing ... with ... (same id, newer timestamp)"
```

---

### ✅ Test 5: Intensity Value Save

**Objective**: Verify emotion intensity value is correctly saved and displayed

**Steps**:
1. Create a record, set intensity value to 80
2. Save record
3. Go to Timeline page
4. Check if record's intensity value displays as 80

**Expected Results**:
- ✅ Intensity value correctly saved (80)
- ✅ Timeline correctly displays intensity value
- ✅ Intensity value is not undefined or null

**Verification Code**:
```javascript
// Check intensity value in Console
const localData = localStorage.getItem('echoma_encrypted_mvp_records') || 
                  localStorage.getItem('echoma_mvp_records');
if (localData) {
  const records = JSON.parse(localData);
  const lastRecord = records[records.length - 1];
  console.log('Intensity value:', lastRecord?.intensity);
  console.log('Intensity value type:', typeof lastRecord?.intensity);
}
```

---

### ✅ Test 6: Encryption Key Selection Consistency

**Objective**: Verify public and private records use correct encryption keys

**Steps**:
1. Create a **public record** (isPublic = true)
2. Create a **private record** (isPublic = false)
3. Check key usage in local storage

**Expected Results**:
- ✅ Public records stored in `echoma_encrypted_public_records`
- ✅ Private records stored in `echoma_encrypted_mvp_records`
- ✅ Both use different encryption keys

**Verification Code**:
```javascript
// Check storage locations in Console
const publicData = localStorage.getItem('echoma_encrypted_public_records');
const privateData = localStorage.getItem('echoma_encrypted_mvp_records');

console.log('Public records exist?', !!publicData);
console.log('Private records exist?', !!privateData);
console.log('Storage separation correct?', publicData && privateData);
```

---

### ✅ Test 7: Wallet Connection Check

**Objective**: Verify error handling is correct when wallet disconnects during save

**Steps**:
1. Connect wallet
2. Start creating record (select emotion, enter description)
3. **After clicking save, before upload completes**, disconnect wallet
4. Check error message

**Expected Results**:
- ✅ Shows friendly error message (e.g., "Wallet disconnected during operation...")
- ✅ Does not cause app crash
- ✅ User can reconnect wallet and retry

**Note**: This test requires precise timing control, may need multiple attempts.

---

### ✅ Test 8: Storage Mode Initialization

**Objective**: Verify encryption storage correctly initializes when switching user accounts

**Steps**:
1. Create records using wallet A
2. Disconnect wallet A, connect wallet B
3. Try to create new record
4. Check if prompts to clear old data or correctly initializes new storage

**Expected Results**:
- ✅ If encrypted data detected but cannot decrypt, shows friendly error
- ✅ If no encrypted data, correctly initializes new storage
- ✅ Does not cause mixed data storage

---

### ✅ Test 9: Delete Operation State Consistency

**Objective**: Verify record remains visible when delete operation fails

**Steps**:
1. Create a record
2. Go to Timeline page
3. Try to delete record
4. **Simulate delete failure** (can temporarily disconnect network or modify code)
5. Check if record is still visible

**Expected Results**:
- ✅ If delete fails, record still displayed in Timeline
- ✅ Shows error message
- ✅ UI state consistent with backend state

---

### ✅ Test 10: Batch Delete Error Handling

**Objective**: Verify handling of partial failures during batch delete

**Steps**:
1. Create 5 records
2. Go to Timeline page
3. Select all records for batch delete
4. **Simulate partial delete failure** (can temporarily disconnect network)
5. Check handling of successful and failed records

**Expected Results**:
- ✅ Successfully deleted records removed from UI
- ✅ Failed delete records still visible
- ✅ Shows count of successful and failed
- ✅ Failed records remain selected (can retry)

---

## 🔍 Debugging Tips

### View Console Logs

All key operations output logs in Console, format as follows:
- `[Record]` - Record creation related
- `[Timeline]` - Timeline related
- `[LocalIndex]` - Local storage related
- `[StorageService]` - Storage service related

### Check Local Storage

```javascript
// Execute in Console
console.log('Public records:', localStorage.getItem('echoma_encrypted_public_records'));
console.log('Private records:', localStorage.getItem('echoma_encrypted_mvp_records'));
console.log('Plaintext records:', localStorage.getItem('echoma_mvp_records'));
```

### Clear Test Data

```javascript
// Execute in Console (use with caution)
localStorage.removeItem('echoma_encrypted_public_records');
localStorage.removeItem('echoma_encrypted_mvp_records');
localStorage.removeItem('echoma_mvp_records');
```

---

## 📊 Test Results Record

| Test Item | Status | Notes |
|-----------|--------|-------|
| Timestamp Format Consistency | ⬜ | |
| Component Unmount Safety | ⬜ | |
| localStorage Concurrent Save | ⬜ | |
| Deduplication Logic | ⬜ | |
| Intensity Value Save | ⬜ | |
| Encryption Key Selection | ⬜ | |
| Wallet Connection Check | ⬜ | |
| Storage Mode Initialization | ⬜ | |
| Delete Operation State Consistency | ⬜ | |
| Batch Delete Error Handling | ⬜ | |

---

## 🐛 Handling Discovered Issues

If any issues are discovered:

1. **Record Issue**:
   - Screenshot or screen recording
   - Copy Console error messages
   - Record reproduction steps

2. **Check Fix**:
   - Confirm if issue is within fix scope
   - Check related code files

3. **Report Issue**:
   - Add new issue to `Further Improvement Suggestions.md`
   - Mark priority and impact scope

---

## ✅ Test Completion Criteria

After all test items pass:
- ✅ No data loss
- ✅ No React warnings
- ✅ No console errors
- ✅ Smooth user experience
- ✅ Friendly error handling

---
