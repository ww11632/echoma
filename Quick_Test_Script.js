/**
 * Quick Test Script - Run in Browser Console
 * 
 * Usage:
 * 1. Open application (http://localhost:5173)
 * 2. Open browser developer tools (F12)
 * 3. Go to Console tab
 * 4. Copy and paste this script
 * 5. Press Enter to execute
 */

console.log('🧪 Starting functional tests...\n');

// ============================================
// Test 1: Timestamp Format Check
// ============================================
function testTimestampFormat() {
  console.log('📅 Test 1: Timestamp Format Check');
  
  const keys = [
    'echoma_encrypted_mvp_records',
    'echoma_encrypted_public_records',
    'echoma_mvp_records'
  ];
  
  let foundRecords = false;
  
  for (const key of keys) {
    const data = localStorage.getItem(key);
    if (data) {
      try {
        let records;
        if (key.includes('encrypted')) {
          // Encrypted data needs decryption, only check structure here
          const parsed = JSON.parse(data);
          if (parsed.data && parsed.iv) {
            console.log(`  ✅ ${key}: Encrypted data exists`);
            foundRecords = true;
            continue;
          }
        }
        records = JSON.parse(data);
        if (Array.isArray(records) && records.length > 0) {
          const record = records[0];
          if (record.timestamp) {
            const isISOString = typeof record.timestamp === 'string' && 
                              record.timestamp.includes('T');
            console.log(`  ${isISOString ? '✅' : '❌'} ${key}: Timestamp format ${isISOString ? 'correct' : 'incorrect'}`);
            console.log(`     Example: ${record.timestamp}`);
            foundRecords = true;
          }
        }
      } catch (e) {
        console.log(`  ⚠️ ${key}: Parse failed`, e.message);
      }
    }
  }
  
  if (!foundRecords) {
    console.log('  ⚠️ No records found, please create some records first');
  }
  
  console.log('');
}

// ============================================
// Test 2: Storage Separation Check
// ============================================
function testStorageSeparation() {
  console.log('🔐 Test 2: Storage Separation Check');
  
  const publicData = localStorage.getItem('echoma_encrypted_public_records');
  const privateData = localStorage.getItem('echoma_encrypted_mvp_records');
  const plainData = localStorage.getItem('echoma_mvp_records');
  
  console.log(`  Public records storage: ${publicData ? '✅ Exists' : '❌ Does not exist'}`);
  console.log(`  Private records storage: ${privateData ? '✅ Exists' : '❌ Does not exist'}`);
  console.log(`  Plaintext records storage: ${plainData ? '⚠️ Exists (backward compatible)' : '✅ Does not exist (encrypted)'}`);
  
  if (publicData && privateData) {
    console.log('  ✅ Public and private records correctly separated in storage');
  } else if (publicData || privateData) {
    console.log('  ⚠️ Only one type of record exists');
  } else {
    console.log('  ⚠️ No encrypted records found');
  }
  
  console.log('');
}

// ============================================
// Test 3: Record Integrity Check
// ============================================
function testRecordIntegrity() {
  console.log('📋 Test 3: Record Integrity Check');
  
  const keys = [
    'echoma_encrypted_mvp_records',
    'echoma_encrypted_public_records',
    'echoma_mvp_records'
  ];
  
  let totalRecords = 0;
  let recordsWithIntensity = 0;
  let recordsWithTags = 0;
  
  for (const key of keys) {
    const data = localStorage.getItem(key);
    if (data) {
      try {
        let records;
        if (key.includes('encrypted')) {
          // Skip detailed check for encrypted data (needs decryption)
          continue;
        }
        records = JSON.parse(data);
        if (Array.isArray(records)) {
          totalRecords += records.length;
          records.forEach(record => {
            if (record.intensity !== undefined && record.intensity !== null) {
              recordsWithIntensity++;
            }
            if (record.tags && Array.isArray(record.tags)) {
              recordsWithTags++;
            }
          });
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }
  
  console.log(`  Total records: ${totalRecords}`);
  console.log(`  Records with intensity: ${recordsWithIntensity}/${totalRecords}`);
  console.log(`  Records with tags: ${recordsWithTags}/${totalRecords}`);
  
  if (totalRecords > 0) {
    const integrity = (recordsWithIntensity / totalRecords) * 100;
    console.log(`  ${integrity === 100 ? '✅' : '⚠️'} Integrity: ${integrity.toFixed(1)}%`);
  } else {
    console.log('  ⚠️ No records found');
  }
  
  console.log('');
}

// ============================================
// Test 4: localStorage Key Check
// ============================================
function testLocalStorageKeys() {
  console.log('🗝️ Test 4: localStorage Key Check');
  
  const expectedKeys = [
    'echoma_encrypted_mvp_records',
    'echoma_encrypted_public_records',
    'echoma_mvp_records'
  ];
  
  const allKeys = Object.keys(localStorage);
  const echomaKeys = allKeys.filter(key => key.startsWith('echoma'));
  
  console.log(`  Found echoma-related keys: ${echomaKeys.length}`);
  echomaKeys.forEach(key => {
    const size = (localStorage.getItem(key)?.length || 0) / 1024;
    console.log(`    - ${key}: ${size.toFixed(2)} KB`);
  });
  
  expectedKeys.forEach(key => {
    const exists = localStorage.getItem(key) !== null;
    console.log(`  ${exists ? '✅' : '❌'} ${key}`);
  });
  
  console.log('');
}

// ============================================
// Test 5: Duplicate ID Check
// ============================================
function testDuplicateIds() {
  console.log('🔄 Test 5: Duplicate ID Check');
  
  const keys = [
    'echoma_encrypted_mvp_records',
    'echoma_encrypted_public_records',
    'echoma_mvp_records'
  ];
  
  const allIds = [];
  
  for (const key of keys) {
    const data = localStorage.getItem(key);
    if (data) {
      try {
        let records;
        if (key.includes('encrypted')) {
          // Skip encrypted data
          continue;
        }
        records = JSON.parse(data);
        if (Array.isArray(records)) {
          records.forEach(record => {
            if (record.id) {
              allIds.push(record.id);
            }
          });
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }
  
  const uniqueIds = new Set(allIds);
  const duplicates = allIds.length - uniqueIds.size;
  
  console.log(`  Total records: ${allIds.length}`);
  console.log(`  Unique IDs: ${uniqueIds.size}`);
  console.log(`  ${duplicates === 0 ? '✅' : '❌'} Duplicate IDs: ${duplicates}`);
  
  if (duplicates > 0) {
    const idCounts = {};
    allIds.forEach(id => {
      idCounts[id] = (idCounts[id] || 0) + 1;
    });
    const dupIds = Object.entries(idCounts)
      .filter(([_, count]) => count > 1)
      .map(([id, _]) => id);
    console.log(`  Duplicate IDs: ${dupIds.slice(0, 5).join(', ')}${dupIds.length > 5 ? '...' : ''}`);
  }
  
  console.log('');
}

// ============================================
// Run All Tests
// ============================================
function runAllTests() {
  console.log('═══════════════════════════════════════');
  console.log('  Functional Fix Verification Tests');
  console.log('═══════════════════════════════════════\n');
  
  testTimestampFormat();
  testStorageSeparation();
  testRecordIntegrity();
  testLocalStorageKeys();
  testDuplicateIds();
  
  console.log('═══════════════════════════════════════');
  console.log('✅ Tests complete!');
  console.log('═══════════════════════════════════════');
  console.log('\n💡 Tips:');
  console.log('  - If you see ❌, an issue was found');
  console.log('  - If you see ⚠️, attention is needed');
  console.log('  - If you see ✅, test passed');
  console.log('\n📝 For detailed test steps, see: Functional_Test_Guide.md');
}

// Auto-run tests
runAllTests();

// Export functions for manual calling
window.testTimestampFormat = testTimestampFormat;
window.testStorageSeparation = testStorageSeparation;
window.testRecordIntegrity = testRecordIntegrity;
window.testLocalStorageKeys = testLocalStorageKeys;
window.testDuplicateIds = testDuplicateIds;
window.runAllTests = runAllTests;
