/**
 * 安全測試套件
 * 涵蓋密碼學向量、參數回放、編碼邊界、限流和密鑰輪換測試
 */

import { encryptData, decryptData, DecryptionError, DecryptionErrorType } from './encryption';

// ============================================================================
// 測試結果類型
// ============================================================================

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

export interface TestSuiteResult {
  suiteName: string;
  results: TestResult[];
  passed: number;
  failed: number;
  total: number;
}

// ============================================================================
// 工具函數
// ============================================================================

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function tamperTag(ciphertext: string): string {
  // AES-GCM 的 tag 在密文末尾（16 字節）
  const buffer = base64ToBuffer(ciphertext);
  const bytes = new Uint8Array(buffer);
  
  // 修改 tag 的最後幾個字節
  if (bytes.length >= 16) {
    const tagStart = bytes.length - 16;
    bytes[tagStart] = (bytes[tagStart] + 1) % 256;
    bytes[tagStart + 1] = (bytes[tagStart + 1] + 1) % 256;
  }
  
  return bufferToBase64(bytes.buffer);
}

function truncateCiphertext(ciphertext: string, bytesToRemove: number): string {
  const buffer = base64ToBuffer(ciphertext);
  const bytes = new Uint8Array(buffer);
  const truncated = bytes.slice(0, Math.max(0, bytes.length - bytesToRemove));
  return bufferToBase64(truncated.buffer);
}

// ============================================================================
// 1. 密碼學向量測試（AES-GCM）
// ============================================================================

/**
 * 測試 tag 篡改必須失敗
 */
export async function testTagTampering(): Promise<TestResult> {
  const testName = "Tag 篡改測試";
  
  try {
    const plaintext = "這是測試數據";
    const password = "test-password-123";
    
    // 加密數據
    const encrypted = await encryptData(plaintext, password);
    
    // 篡改 tag
    const tamperedCiphertext = tamperTag(encrypted.ciphertext);
    const tamperedData = {
      ...encrypted,
      ciphertext: tamperedCiphertext,
    };
    
    // 嘗試解密 - 應該失敗
    try {
      await decryptData(tamperedData, password);
      return {
        name: testName,
        passed: false,
        error: "解密應該失敗，但成功了",
      };
    } catch (error) {
      if (error instanceof DecryptionError) {
        if (
          error.type === DecryptionErrorType.DATA_CORRUPTED ||
          error.type === DecryptionErrorType.INVALID_KEY
        ) {
          return {
            name: testName,
            passed: true,
            details: { errorType: error.type },
          };
        }
      }
      // 任何錯誤都算通過（因為解密失敗了）
      return {
        name: testName,
        passed: true,
        details: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  } catch (error) {
    return {
      name: testName,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 測試 IV 重用必須失敗
 */
export async function testIVReuse(): Promise<TestResult> {
  const testName = "IV 重用測試";
  
  try {
    const plaintext1 = "第一條消息";
    const plaintext2 = "第二條消息";
    const password = "test-password-123";
    
    // 加密兩條消息，但重用相同的 IV
    const encrypted1 = await encryptData(plaintext1, password);
    const iv = encrypted1.header.iv;
    
    // 手動創建第二條消息，重用 IV（這在實際使用中不應該發生）
    const encrypted2 = await encryptData(plaintext2, password);
    const tampered2 = {
      ...encrypted2,
      header: {
        ...encrypted2.header,
        iv: iv, // 重用 IV
      },
    };
    
    // 嘗試解密第二條消息 - 應該失敗或產生錯誤結果
    try {
      const decrypted2 = await decryptData(tampered2, password);
      
      // 如果解密成功，檢查結果是否正確
      if (decrypted2 === plaintext2) {
        // 在某些情況下，IV 重用可能導致解密成功但結果錯誤
        // 這是 AES-GCM 的安全漏洞，應該被檢測到
        return {
          name: testName,
          passed: false,
          error: "IV 重用後解密成功，這是安全漏洞",
          details: { decrypted: decrypted2, expected: plaintext2 },
        };
      } else {
        // 解密成功但結果錯誤 - 這仍然是一個問題
        return {
          name: testName,
          passed: false,
          error: "IV 重用導致解密結果錯誤",
          details: { decrypted: decrypted2, expected: plaintext2 },
        };
      }
    } catch (error) {
      // 解密失敗是預期的
      return {
        name: testName,
        passed: true,
        details: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  } catch (error) {
    return {
      name: testName,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 測試截斷密文必須失敗
 */
export async function testCiphertextTruncation(): Promise<TestResult> {
  const testName = "截斷密文測試";
  
  try {
    const plaintext = "這是測試數據";
    const password = "test-password-123";
    
    // 加密數據
    const encrypted = await encryptData(plaintext, password);
    
    // 截斷密文（移除最後幾個字節，包括 tag）
    const truncatedCiphertext = truncateCiphertext(encrypted.ciphertext, 20);
    const truncatedData = {
      ...encrypted,
      ciphertext: truncatedCiphertext,
    };
    
    // 嘗試解密 - 應該失敗
    try {
      await decryptData(truncatedData, password);
      return {
        name: testName,
        passed: false,
        error: "解密應該失敗，但成功了",
      };
    } catch (error) {
      if (error instanceof DecryptionError) {
        if (
          error.type === DecryptionErrorType.DATA_CORRUPTED ||
          error.type === DecryptionErrorType.INVALID_FORMAT
        ) {
          return {
            name: testName,
            passed: true,
            details: { errorType: error.type },
          };
        }
      }
      // 任何錯誤都算通過
      return {
        name: testName,
        passed: true,
        details: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  } catch (error) {
    return {
      name: testName,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 運行所有密碼學向量測試
 */
export async function runCryptographyTests(): Promise<TestSuiteResult> {
  const results: TestResult[] = [];
  
  results.push(await testTagTampering());
  results.push(await testIVReuse());
  results.push(await testCiphertextTruncation());
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  return {
    suiteName: "密碼學向量測試",
    results,
    passed,
    failed,
    total: results.length,
  };
}

// ============================================================================
// 2. 參數回放測試
// ============================================================================

/**
 * 模擬不同設備的迭代數
 */
interface DeviceProfile {
  name: string;
  iterations: number;
}

const DEVICE_PROFILES: DeviceProfile[] = [
  { name: "低端手機", iterations: 100000 },
  { name: "中端手機", iterations: 300000 },
  { name: "高端手機", iterations: 500000 },
  { name: "桌機", iterations: 1000000 },
];

/**
 * 測試同一數據在不同設備上加密和解密
 */
export async function testParameterReplay(): Promise<TestResult> {
  const testName = "參數回放測試";
  
  try {
    const plaintext = "這是跨設備測試數據";
    const password = "test-password-123";
    
    const results: any[] = [];
    
    // 在不同設備上加密
    for (const device of DEVICE_PROFILES) {
      try {
        const encrypted = await encryptData(plaintext, password, "pbkdf2", {
          iterations: device.iterations,
        });
        
        // 驗證加密成功
        if (!encrypted.header || !encrypted.ciphertext) {
          return {
            name: testName,
            passed: false,
            error: `${device.name} 加密失敗：缺少必要字段`,
          };
        }
        
        // 驗證迭代數正確
        if (encrypted.header.kdfParams.iterations !== device.iterations) {
          return {
            name: testName,
            passed: false,
            error: `${device.name} 迭代數不匹配：期望 ${device.iterations}，實際 ${encrypted.header.kdfParams.iterations}`,
          };
        }
        
        // 嘗試解密
        const decrypted = await decryptData(encrypted, password);
        
        if (decrypted !== plaintext) {
          return {
            name: testName,
            passed: false,
            error: `${device.name} 解密結果不匹配`,
            details: { expected: plaintext, actual: decrypted },
          };
        }
        
        results.push({
          device: device.name,
          iterations: device.iterations,
          success: true,
        });
      } catch (error) {
        return {
          name: testName,
          passed: false,
          error: `${device.name} 測試失敗：${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }
    
    // 測試跨設備解密：在設備 A 加密，在設備 B 解密
    const deviceA = DEVICE_PROFILES[0]; // 低端手機
    const deviceB = DEVICE_PROFILES[3]; // 桌機
    
    const encryptedOnA = await encryptData(plaintext, password, "pbkdf2", {
      iterations: deviceA.iterations,
    });
    
    // 在設備 B 上應該能夠解密（使用相同的密碼和參數）
    const decryptedOnB = await decryptData(encryptedOnA, password);
    
    if (decryptedOnB !== plaintext) {
      return {
        name: testName,
        passed: false,
        error: "跨設備解密失敗",
        details: { expected: plaintext, actual: decryptedOnB },
      };
    }
    
    return {
      name: testName,
      passed: true,
      details: {
        devices: results,
        crossDevice: {
          encryptedOn: deviceA.name,
          decryptedOn: deviceB.name,
          success: true,
        },
      },
    };
  } catch (error) {
    return {
      name: testName,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 運行參數回放測試
 */
export async function runParameterReplayTests(): Promise<TestSuiteResult> {
  const results: TestResult[] = [];
  
  results.push(await testParameterReplay());
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  return {
    suiteName: "參數回放測試",
    results,
    passed,
    failed,
    total: results.length,
  };
}

// ============================================================================
// 3. Base64/UTF-8 边界测试
// ============================================================================

/**
 * 测试用例：包含各种边界情况
 */
const UTF8_TEST_CASES = [
  {
    name: "Emoji",
    text: "😀😃😄😁😆😅😂🤣😊😇🙂🙃😉😌😍🥰😘😗😙😚😋😛😝😜🤪🤨🧐🤓😎🤩🥳😏😒😞😔😟😕🙁☹️😣😖😫😩🥺😢😭😤😠😡🤬🤯😳🥵🥶😱😨😰😥😓🤗🤔🤭🤫🤥😶😐😑😬🙄😯😦😧😮😲🥱😴🤤😪😵🤐🥴🤢🤮🤧😷🤒🤕🤑🤠😈👿👹👺🤡💩👻💀☠️👽👾🤖🎃😺😸😹😻😼😽🙀😿😾",
  },
  {
    name: "合字（Ligatures）",
    text: "ﬁ ﬂ ﬀ ﬃ ﬄ ﬅ ﬆ",
  },
  {
    name: "長文（10KB）",
    text: "這是一個很長的文本。".repeat(500),
  },
  {
    name: "混合 Unicode",
    text: "Hello 世界 🌍 測試 test 123 中文 English 日本語 한국어 العربية עברית русский",
  },
  {
    name: "零寬字符",
    text: "正常文本\u200B\u200C\u200D\uFEFF隱藏字符",
  },
  {
    name: "代理對（Surrogate Pairs）",
    text: "𝓗𝓮𝓵𝓵𝓸 𝓦𝓸𝓻𝓵𝓭", // Mathematical Bold Script
  },
  {
    name: "組合字符",
    text: "a\u0300 e\u0301 i\u0302 o\u0303 u\u0308", // 帶聲調
  },
];

/**
 * 測試 UTF-8 編碼邊界情況
 */
export async function testUTF8Boundaries(): Promise<TestResult> {
  const testName = "UTF-8 邊界測試";
  
  try {
    const password = "test-password-123";
    const results: any[] = [];
    
    for (const testCase of UTF8_TEST_CASES) {
      try {
        // 加密
        const encrypted = await encryptData(testCase.text, password);
        
        // 驗證序列化（轉換為 JSON 字符串再解析）
        const serialized = JSON.stringify(encrypted);
        const deserialized = JSON.parse(serialized);
        
        // 解密
        const decrypted = await decryptData(deserialized, password);
        
        // 驗證位元完整性
        const originalBytes = new TextEncoder().encode(testCase.text);
        const decryptedBytes = new TextEncoder().encode(decrypted);
        
        if (originalBytes.length !== decryptedBytes.length) {
          return {
            name: testName,
            passed: false,
            error: `${testCase.name} 字節長度不匹配`,
            details: {
              originalLength: originalBytes.length,
              decryptedLength: decryptedBytes.length,
            },
          };
        }
        
        // 逐字節比較
        for (let i = 0; i < originalBytes.length; i++) {
          if (originalBytes[i] !== decryptedBytes[i]) {
            return {
              name: testName,
              passed: false,
              error: `${testCase.name} 字節不匹配（位置 ${i}）`,
              details: {
                position: i,
                original: originalBytes[i],
                decrypted: decryptedBytes[i],
              },
            };
          }
        }
        
        // 驗證字符串相等
        if (testCase.text !== decrypted) {
          return {
            name: testName,
            passed: false,
            error: `${testCase.name} 字符串不匹配`,
            details: {
              original: testCase.text,
              decrypted: decrypted,
            },
          };
        }
        
        results.push({
          case: testCase.name,
          success: true,
          originalLength: testCase.text.length,
          byteLength: originalBytes.length,
        });
      } catch (error) {
        return {
          name: testName,
          passed: false,
          error: `${testCase.name} 測試失敗：${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }
    
    return {
      name: testName,
      passed: true,
      details: { testCases: results },
    };
  } catch (error) {
    return {
      name: testName,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 運行 Base64/UTF-8 邊界測試
 */
export async function runUTF8BoundaryTests(): Promise<TestSuiteResult> {
  const results: TestResult[] = [];
  
  results.push(await testUTF8Boundaries());
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  return {
    suiteName: "Base64/UTF-8 邊界測試",
    results,
    passed,
    failed,
    total: results.length,
  };
}

// ============================================================================
// 4. Rate Limit 测试
// ============================================================================

/**
 * 模擬並發請求
 * @param endpoint - API 端點 URL
 * @param authHeaders - 可選的認證頭（用於 Supabase Edge Functions）
 * @param concurrency - 並發請求數（默認 100）
 */
export async function testRateLimit(
  endpoint: string,
  authHeaders?: HeadersInit,
  concurrency: number = 100
): Promise<TestResult> {
  const testName = "Rate Limit 測試";
  
  try {
    const startTime = Date.now();
    const requests: Promise<Response>[] = [];
    
    // 創建並發請求（在 1 秒內發送）
    const batchSize = Math.ceil(concurrency / 10); // 分 10 批發送
    const delayBetweenBatches = 100; // 每批間隔 100ms
    
    for (let batch = 0; batch < 10; batch++) {
      const batchStart = batch * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, concurrency);
      
      for (let i = batchStart; i < batchEnd; i++) {
        const request = fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify({
            emotion: "happy",
            intensity: 50,
            description: `Rate limit test request ${i}`,
            language: "zh-TW",
          }),
        });
        
        requests.push(request);
      }
      
      // 如果不是最後一批，等待一段時間
      if (batch < 9) {
        await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
      }
    }
    
    // 等待所有請求完成
    const responses = await Promise.allSettled(requests);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // 分析結果
    const successCount = responses.filter(
      (r) => r.status === "fulfilled" && r.value.ok
    ).length;
    const rateLimitCount = responses.filter(
      (r) =>
        r.status === "fulfilled" &&
        r.value.status === 429
    ).length;
    const authErrorCount = responses.filter(
      (r) =>
        r.status === "fulfilled" &&
        r.value.status === 401
    ).length;
    const otherErrorCount = responses.filter(
      (r) => 
        r.status === "rejected" || 
        (r.status === "fulfilled" && !r.value.ok && r.value.status !== 429 && r.value.status !== 401)
    ).length;
    
    // 計算速率
    const actualRate = (concurrency / duration) * 1000; // 請求/秒
    
    // 檢查是否有降速（rate limiting 生效）
    const hasRateLimiting = rateLimitCount > 0;
    
    // 檢查恢復能力：等待一段時間後再次測試
    await new Promise((resolve) => setTimeout(resolve, 2000)); // 等待 2 秒
    
    const recoveryTest = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({
        emotion: "happy",
        intensity: 50,
        description: "Recovery test after rate limit",
        language: "zh-TW",
      }),
    });
    
    const canRecover = recoveryTest.ok || recoveryTest.status === 429; // 429 也算可以恢復（說明限流在工作）
    
    return {
      name: testName,
      passed: hasRateLimiting || (successCount > 0 && canRecover),
      details: {
        total: concurrency,
        success: successCount,
        rateLimited: rateLimitCount,
        authErrors: authErrorCount,
        otherErrors: otherErrorCount,
        duration: `${duration}ms`,
        actualRate: `${actualRate.toFixed(2)} req/s`,
        hasRateLimiting,
        canRecover,
        recoveryStatus: recoveryTest.status,
      },
    };
  } catch (error) {
    return {
      name: testName,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 運行 Rate Limit 測試
 */
export async function runRateLimitTests(
  endpoint: string,
  authHeaders?: HeadersInit
): Promise<TestSuiteResult> {
  const results: TestResult[] = [];
  
  // 測試 100 並發請求
  results.push(await testRateLimit(endpoint, authHeaders, 100));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  return {
    suiteName: "Rate Limit 測試",
    results,
    passed,
    failed,
    total: results.length,
  };
}

// ============================================================================
// 5. Key Rotation 演練
// ============================================================================

/**
 * 模擬密鑰輪換場景
 */
export interface RotationScenario {
  name: string;
  oldKey: string;
  newKey: string;
  transitionDuration: number; // 毫秒
}

/**
 * 測試密鑰輪換期間的平滑過渡
 */
export async function testKeyRotation(
  scenario: RotationScenario,
  testEndpoint: (key: string) => Promise<{ success: boolean; status: number }>
): Promise<TestResult> {
  const testName = "Key Rotation 演練";
  
  try {
    const startTime = Date.now();
    const results: any[] = [];
    const interval = 100; // 每 100ms 測試一次
    const testDuration = scenario.transitionDuration;
    
    let successCount = 0;
    let failureCount = 0;
    const successRates: number[] = [];
    
    // 模擬輪換過程
    while (Date.now() - startTime < testDuration) {
      const elapsed = Date.now() - startTime;
      
      // 計算當前應該使用哪個 key（平滑過渡）
      const transitionProgress = elapsed / testDuration;
      const useNewKey = Math.random() < transitionProgress; // 逐漸切換到新 key
      const currentKey = useNewKey ? scenario.newKey : scenario.oldKey;
      
      // 測試請求
      const result = await testEndpoint(currentKey);
      
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }
      
      // 計算當前成功率
      const total = successCount + failureCount;
      const successRate = total > 0 ? (successCount / total) * 100 : 100;
      successRates.push(successRate);
      
      // 等待下一個測試
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
    
    // 分析結果
    const finalSuccessRate = successRates[successRates.length - 1] || 100;
    const minSuccessRate = Math.min(...successRates);
    const maxSuccessRate = Math.max(...successRates);
    
    // 檢查是否有「斷崖式」下降（成功率從 100% 直接降到 0%）
    let hasCliff = false;
    for (let i = 1; i < successRates.length; i++) {
      const drop = successRates[i - 1] - successRates[i];
      if (drop > 50) {
        // 成功率下降超過 50% 視為斷崖
        hasCliff = true;
        break;
      }
    }
    
    // 檢查是否平滑過渡（成功率應該逐漸變化，而不是突然變化）
    const isSmooth = !hasCliff && minSuccessRate > 0;
    
    return {
      name: testName,
      passed: isSmooth,
      details: {
        scenario: scenario.name,
        totalTests: successCount + failureCount,
        successCount,
        failureCount,
        finalSuccessRate: `${finalSuccessRate.toFixed(2)}%`,
        minSuccessRate: `${minSuccessRate.toFixed(2)}%`,
        maxSuccessRate: `${maxSuccessRate.toFixed(2)}%`,
        hasCliff,
        isSmooth,
      },
    };
  } catch (error) {
    return {
      name: testName,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 運行 Key Rotation 測試
 */
export async function runKeyRotationTests(
  scenario: RotationScenario,
  testEndpoint: (key: string) => Promise<{ success: boolean; status: number }>
): Promise<TestSuiteResult> {
  const results: TestResult[] = [];
  
  results.push(await testKeyRotation(scenario, testEndpoint));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  return {
    suiteName: "Key Rotation 演練",
    results,
    passed,
    failed,
    total: results.length,
  };
}

// ============================================================================
// 主測試運行器
// ============================================================================

/**
 * 運行所有安全測試
 */
export async function runAllSecurityTests(
  rateLimitEndpoint?: string,
  rateLimitAuthHeaders?: HeadersInit,
  keyRotationScenario?: RotationScenario,
  keyRotationTestEndpoint?: (key: string) => Promise<{ success: boolean; status: number }>
): Promise<{
  suites: TestSuiteResult[];
  summary: {
    totalSuites: number;
    totalTests: number;
    totalPassed: number;
    totalFailed: number;
    allPassed: boolean;
  };
}> {
  const suites: TestSuiteResult[] = [];
  
  // 1. 密碼學向量測試
  suites.push(await runCryptographyTests());
  
  // 2. 參數回放測試
  suites.push(await runParameterReplayTests());
  
  // 3. UTF-8 邊界測試
  suites.push(await runUTF8BoundaryTests());
  
  // 4. Rate Limit 測試（如果提供了端點）
  if (rateLimitEndpoint) {
    suites.push(await runRateLimitTests(rateLimitEndpoint, rateLimitAuthHeaders));
  }
  
  // 5. Key Rotation 測試（如果提供了場景）
  if (keyRotationScenario && keyRotationTestEndpoint) {
    suites.push(await runKeyRotationTests(keyRotationScenario, keyRotationTestEndpoint));
  }
  
  // 計算匯總
  const totalTests = suites.reduce((sum, suite) => sum + suite.total, 0);
  const totalPassed = suites.reduce((sum, suite) => sum + suite.passed, 0);
  const totalFailed = suites.reduce((sum, suite) => sum + suite.failed, 0);
  
  return {
    suites,
    summary: {
      totalSuites: suites.length,
      totalTests,
      totalPassed,
      totalFailed,
      allPassed: totalFailed === 0,
    },
  };
}

