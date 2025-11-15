/**
 * 快速测试脚本 - 在浏览器 Console 中运行
 * 
 * 使用方法：
 * 1. 打开应用（http://localhost:5173）
 * 2. 打开浏览器开发者工具（F12）
 * 3. 进入 Console 标签
 * 4. 复制并粘贴此脚本
 * 5. 按 Enter 执行
 */

console.log('🧪 开始功能测试...\n');

// ============================================
// 测试 1: 时间戳格式检查
// ============================================
function testTimestampFormat() {
  console.log('📅 测试 1: 时间戳格式检查');
  
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
          // 加密数据需要解密，这里只检查结构
          const parsed = JSON.parse(data);
          if (parsed.data && parsed.iv) {
            console.log(`  ✅ ${key}: 加密数据存在`);
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
            console.log(`  ${isISOString ? '✅' : '❌'} ${key}: 时间戳格式 ${isISOString ? '正确' : '错误'}`);
            console.log(`     示例: ${record.timestamp}`);
            foundRecords = true;
          }
        }
      } catch (e) {
        console.log(`  ⚠️ ${key}: 解析失败`, e.message);
      }
    }
  }
  
  if (!foundRecords) {
    console.log('  ⚠️ 未找到记录，请先创建一些记录');
  }
  
  console.log('');
}

// ============================================
// 测试 2: 存储分离检查
// ============================================
function testStorageSeparation() {
  console.log('🔐 测试 2: 存储分离检查');
  
  const publicData = localStorage.getItem('echoma_encrypted_public_records');
  const privateData = localStorage.getItem('echoma_encrypted_mvp_records');
  const plainData = localStorage.getItem('echoma_mvp_records');
  
  console.log(`  公开记录存储: ${publicData ? '✅ 存在' : '❌ 不存在'}`);
  console.log(`  私密记录存储: ${privateData ? '✅ 存在' : '❌ 不存在'}`);
  console.log(`  明文记录存储: ${plainData ? '⚠️ 存在（向后兼容）' : '✅ 不存在（已加密）'}`);
  
  if (publicData && privateData) {
    console.log('  ✅ 公开和私密记录正确分离存储');
  } else if (publicData || privateData) {
    console.log('  ⚠️ 只有一种类型的记录');
  } else {
    console.log('  ⚠️ 未找到加密记录');
  }
  
  console.log('');
}

// ============================================
// 测试 3: 记录完整性检查
// ============================================
function testRecordIntegrity() {
  console.log('📋 测试 3: 记录完整性检查');
  
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
          // 跳过加密数据的详细检查（需要解密）
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
        // 忽略解析错误
      }
    }
  }
  
  console.log(`  总记录数: ${totalRecords}`);
  console.log(`  有强度值的记录: ${recordsWithIntensity}/${totalRecords}`);
  console.log(`  有标签的记录: ${recordsWithTags}/${totalRecords}`);
  
  if (totalRecords > 0) {
    const integrity = (recordsWithIntensity / totalRecords) * 100;
    console.log(`  ${integrity === 100 ? '✅' : '⚠️'} 完整性: ${integrity.toFixed(1)}%`);
  } else {
    console.log('  ⚠️ 未找到记录');
  }
  
  console.log('');
}

// ============================================
// 测试 4: localStorage 键检查
// ============================================
function testLocalStorageKeys() {
  console.log('🗝️ 测试 4: localStorage 键检查');
  
  const expectedKeys = [
    'echoma_encrypted_mvp_records',
    'echoma_encrypted_public_records',
    'echoma_mvp_records'
  ];
  
  const allKeys = Object.keys(localStorage);
  const echomaKeys = allKeys.filter(key => key.startsWith('echoma'));
  
  console.log(`  找到的 echoma 相关键: ${echomaKeys.length}`);
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
// 测试 5: 重复 ID 检查
// ============================================
function testDuplicateIds() {
  console.log('🔄 测试 5: 重复 ID 检查');
  
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
          // 跳过加密数据
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
        // 忽略解析错误
      }
    }
  }
  
  const uniqueIds = new Set(allIds);
  const duplicates = allIds.length - uniqueIds.size;
  
  console.log(`  总记录数: ${allIds.length}`);
  console.log(`  唯一 ID 数: ${uniqueIds.size}`);
  console.log(`  ${duplicates === 0 ? '✅' : '❌'} 重复 ID: ${duplicates}`);
  
  if (duplicates > 0) {
    const idCounts = {};
    allIds.forEach(id => {
      idCounts[id] = (idCounts[id] || 0) + 1;
    });
    const dupIds = Object.entries(idCounts)
      .filter(([_, count]) => count > 1)
      .map(([id, _]) => id);
    console.log(`  重复的 ID: ${dupIds.slice(0, 5).join(', ')}${dupIds.length > 5 ? '...' : ''}`);
  }
  
  console.log('');
}

// ============================================
// 运行所有测试
// ============================================
function runAllTests() {
  console.log('═══════════════════════════════════════');
  console.log('  功能修复验证测试');
  console.log('═══════════════════════════════════════\n');
  
  testTimestampFormat();
  testStorageSeparation();
  testRecordIntegrity();
  testLocalStorageKeys();
  testDuplicateIds();
  
  console.log('═══════════════════════════════════════');
  console.log('✅ 测试完成！');
  console.log('═══════════════════════════════════════');
  console.log('\n💡 提示:');
  console.log('  - 如果看到 ❌，表示发现问题');
  console.log('  - 如果看到 ⚠️，表示需要注意');
  console.log('  - 如果看到 ✅，表示测试通过');
  console.log('\n📝 详细测试步骤请查看: 功能测试指南.md');
}

// 自动运行测试
runAllTests();

// 导出函数供手动调用
window.testTimestampFormat = testTimestampFormat;
window.testStorageSeparation = testStorageSeparation;
window.testRecordIntegrity = testRecordIntegrity;
window.testLocalStorageKeys = testLocalStorageKeys;
window.testDuplicateIds = testDuplicateIds;
window.runAllTests = runAllTests;


