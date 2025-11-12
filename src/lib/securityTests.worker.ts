/**
 * Web Worker for CPU-intensive security tests
 * Handles AES-GCM encryption/decryption and UTF-8 boundary tests
 * to avoid blocking the main thread
 */

import { encryptData, decryptData, DecryptionError, DecryptionErrorType } from './encryption';

// Worker message types
interface WorkerMessage {
  type: 'RUN_CRYPTO_TEST' | 'RUN_UTF8_TEST' | 'CANCEL';
  payload?: any;
}

interface WorkerResponse {
  type: 'PROGRESS' | 'RESULT' | 'ERROR';
  payload?: any;
}

// Helper function to send message to main thread
function postMessageToMain(response: WorkerResponse) {
  self.postMessage(response);
}

// Handle messages from main thread
self.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;

  try {
    switch (type) {
      case 'RUN_CRYPTO_TEST': {
        await runCryptoTestsInWorker(payload);
        break;
      }
      case 'RUN_UTF8_TEST': {
        await runUTF8TestsInWorker(payload);
        break;
      }
      case 'CANCEL': {
        // Worker cancellation (would need to implement cancellation logic)
        postMessageToMain({ type: 'RESULT', payload: { cancelled: true } });
        break;
      }
      default:
        postMessageToMain({
          type: 'ERROR',
          payload: { error: `Unknown message type: ${type}` },
        });
    }
  } catch (error) {
    postMessageToMain({
      type: 'ERROR',
      payload: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }
});

/**
 * Run crypto tests in worker
 */
async function runCryptoTestsInWorker(config: { password: string; iterations?: number }) {
  const { password, iterations = 100 } = config;
  const results: any[] = [];

  postMessageToMain({
    type: 'PROGRESS',
    payload: { message: 'Starting crypto tests...', progress: 0 },
  });

  for (let i = 0; i < iterations; i++) {
    try {
      const plaintext = `Test message ${i}`;
      const encrypted = await encryptData(plaintext, password);
      const decrypted = await decryptData(encrypted, password);

      if (decrypted !== plaintext) {
        results.push({
          iteration: i,
          passed: false,
          error: 'Decryption result mismatch',
        });
      } else {
        results.push({
          iteration: i,
          passed: true,
        });
      }

      // Report progress every 10 iterations
      if (i % 10 === 0) {
        postMessageToMain({
          type: 'PROGRESS',
          payload: {
            message: `Processed ${i + 1}/${iterations} iterations`,
            progress: ((i + 1) / iterations) * 100,
          },
        });
      }
    } catch (error) {
      results.push({
        iteration: i,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  postMessageToMain({
    type: 'RESULT',
    payload: {
      testType: 'CRYPTO',
      results,
      summary: {
        total: iterations,
        passed,
        failed,
        allPassed: failed === 0,
      },
    },
  });
}

/**
 * Run UTF-8 boundary tests in worker
 */
async function runUTF8TestsInWorker(config: { testCases: Array<{ name: string; text: string }>; password: string }) {
  const { testCases, password } = config;
  const results: any[] = [];

  postMessageToMain({
    type: 'PROGRESS',
    payload: { message: 'Starting UTF-8 tests...', progress: 0 },
  });

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    try {
      // Encrypt
      const encrypted = await encryptData(testCase.text, password);

      // Serialize and deserialize
      const serialized = JSON.stringify(encrypted);
      const deserialized = JSON.parse(serialized);

      // Decrypt
      const decrypted = await decryptData(deserialized, password);

      // Verify byte-level integrity
      const originalBytes = new TextEncoder().encode(testCase.text);
      const decryptedBytes = new TextEncoder().encode(decrypted);

      if (originalBytes.length !== decryptedBytes.length) {
        results.push({
          testCase: testCase.name,
          passed: false,
          error: 'Byte length mismatch',
          details: {
            originalLength: originalBytes.length,
            decryptedLength: decryptedBytes.length,
          },
        });
        continue;
      }

      // Byte-by-byte comparison
      let byteMismatch = false;
      for (let j = 0; j < originalBytes.length; j++) {
        if (originalBytes[j] !== decryptedBytes[j]) {
          byteMismatch = true;
          results.push({
            testCase: testCase.name,
            passed: false,
            error: `Byte mismatch at position ${j}`,
            details: {
              position: j,
              original: originalBytes[j],
              decrypted: decryptedBytes[j],
            },
          });
          break;
        }
      }

      if (!byteMismatch && testCase.text !== decrypted) {
        results.push({
          testCase: testCase.name,
          passed: false,
          error: 'String content mismatch',
        });
      } else if (!byteMismatch) {
        results.push({
          testCase: testCase.name,
          passed: true,
          byteLength: originalBytes.length,
        });
      }

      // Report progress
      postMessageToMain({
        type: 'PROGRESS',
        payload: {
          message: `Processed ${i + 1}/${testCases.length} test cases`,
          progress: ((i + 1) / testCases.length) * 100,
        },
      });
    } catch (error) {
      results.push({
        testCase: testCase.name,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  postMessageToMain({
    type: 'RESULT',
    payload: {
      testType: 'UTF8',
      results,
      summary: {
        total: testCases.length,
        passed,
        failed,
        allPassed: failed === 0,
      },
    },
  });
}

// Export for type checking (not used in worker context)
export type { WorkerMessage, WorkerResponse };

