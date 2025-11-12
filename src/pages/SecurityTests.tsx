/**
 * 安全測試運行器頁面
 * 提供 UI 來運行和查看安全測試結果
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  runAllSecurityTests,
  type TestSuiteResult,
  type RotationScenario,
} from "@/lib/securityTests";
import { AlertCircle, CheckCircle2, XCircle, Loader2, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function SecurityTests() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<{
    suites: TestSuiteResult[];
    summary: {
      totalSuites: number;
      totalTests: number;
      totalPassed: number;
      totalFailed: number;
      allPassed: boolean;
    };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunTests = async () => {
    setIsRunning(true);
    setError(null);
    setResults(null);

    try {
      // 获取 Supabase URL 和认证信息
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      // 获取当前会话（用于 Rate Limit 测试）
      const { data: session } = await supabase.auth.getSession();
      
      // AI 端点（Supabase Edge Function）
      const rateLimitEndpoint = supabaseUrl 
        ? `${supabaseUrl}/functions/v1/ai-emotion-response`
        : undefined;
      
      // 准备认证头
      const rateLimitAuthHeaders: HeadersInit | undefined = session?.session
        ? {
            Authorization: `Bearer ${session.session.access_token}`,
            apikey: supabaseAnonKey || "",
          }
        : undefined;

      // Key Rotation 测试场景（示例）
      const keyRotationScenario: RotationScenario = {
        name: "API Key 轮换测试",
        oldKey: "old-key-example",
        newKey: "new-key-example",
        transitionDuration: 5000, // 5 秒
      };

      // Key Rotation 测试端点（示例 - 实际应该调用真实的 API）
      const keyRotationTestEndpoint = async (key: string) => {
        // 这里应该调用实际的 API 端点
        // 为了演示，我们模拟一个测试
        if (!rateLimitEndpoint) {
          return { success: false, status: 0 };
        }
        
        try {
          const response = await fetch(rateLimitEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${key}`,
              apikey: supabaseAnonKey || "",
            },
            body: JSON.stringify({
              emotion: "happy",
              intensity: 50,
              description: "Key rotation test",
              language: "zh-TW",
            }),
          });

          return {
            success: response.ok,
            status: response.status,
          };
        } catch (err) {
          return {
            success: false,
            status: 0,
          };
        }
      };

      const testResults = await runAllSecurityTests(
        rateLimitEndpoint,
        rateLimitAuthHeaders,
        keyRotationScenario,
        keyRotationTestEndpoint
      );

      setResults(testResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">安全測試套件</h1>
        <p className="text-muted-foreground">
          運行完整的安全測試，包括密碼學向量、參數回放、編碼邊界、限流和密鑰輪換測試
        </p>
      </div>

      <div className="mb-6">
        <Button
          onClick={handleRunTests}
          disabled={isRunning}
          size="lg"
          className="w-full sm:w-auto"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              運行測試中...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              運行所有測試
            </>
          )}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>錯誤</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {results && (
        <div className="space-y-6">
          {/* 匯總信息 */}
          <Card>
            <CardHeader>
              <CardTitle>測試匯總</CardTitle>
              <CardDescription>所有測試套件的總體結果</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-2xl font-bold">{results.summary.totalSuites}</div>
                  <div className="text-sm text-muted-foreground">測試套件</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{results.summary.totalTests}</div>
                  <div className="text-sm text-muted-foreground">總測試數</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {results.summary.totalPassed}
                  </div>
                  <div className="text-sm text-muted-foreground">通過</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">
                    {results.summary.totalFailed}
                  </div>
                  <div className="text-sm text-muted-foreground">失敗</div>
                </div>
              </div>
              <div className="mt-4">
                <Badge
                  variant={results.summary.allPassed ? "default" : "destructive"}
                  className="text-lg px-4 py-2"
                >
                  {results.summary.allPassed ? "所有測試通過" : "部分測試失敗"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* 各測試套件結果 */}
          {results.suites.map((suite, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{suite.suiteName}</CardTitle>
                  <Badge
                    variant={suite.failed === 0 ? "default" : "destructive"}
                  >
                    {suite.passed}/{suite.total} 通過
                  </Badge>
                </div>
                <CardDescription>
                  {suite.failed === 0
                    ? "所有測試通過"
                    : `${suite.failed} 個測試失敗`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {suite.results.map((test, testIndex) => (
                    <div
                      key={testIndex}
                      className="border rounded-lg p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {test.passed ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600" />
                          )}
                          <span className="font-medium">{test.name}</span>
                        </div>
                        <Badge
                          variant={test.passed ? "default" : "destructive"}
                        >
                          {test.passed ? "通過" : "失敗"}
                        </Badge>
                      </div>
                      {test.error && (
                        <Alert variant="destructive">
                          <AlertDescription>{test.error}</AlertDescription>
                        </Alert>
                      )}
                      {test.details && (
                        <div className="text-sm text-muted-foreground">
                          <pre className="bg-muted p-2 rounded overflow-auto">
                            {JSON.stringify(test.details, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!results && !isRunning && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            點擊「運行所有測試」按鈕開始測試
          </CardContent>
        </Card>
      )}
    </div>
  );
}

