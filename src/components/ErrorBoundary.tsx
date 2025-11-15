import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallback error={this.state.error} errorInfo={this.state.errorInfo} />;
    }

    return this.props.children;
  }
}

const ErrorFallback = ({ error, errorInfo }: { error: Error | null; errorInfo: ErrorInfo | null }) => {
  const navigate = useNavigate();

  const handleReset = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background via-background to-muted/20">
      <Card className="max-w-2xl w-full p-8 space-y-6">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold">出現了一個錯誤</h1>
          <p className="text-muted-foreground">
            應用遇到了意外錯誤。我們已經記錄了這個問題，請嘗試重新整理頁面。
          </p>
        </div>

        {error && (
          <Card className="p-4 bg-muted/50 border-destructive/20">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-destructive">錯誤資訊：</p>
              <p className="text-sm font-mono text-muted-foreground break-all">
                {error.message || "未知錯誤"}
              </p>
              {errorInfo && errorInfo.componentStack && (
                <details className="mt-4">
                  <summary className="text-sm font-semibold cursor-pointer text-muted-foreground">
                    查看技術詳情
                  </summary>
                  <pre className="mt-2 text-xs font-mono text-muted-foreground overflow-auto max-h-40 p-2 bg-muted rounded">
                    {errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>
          </Card>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={handleReset} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            重新整理頁面
          </Button>
          <Button onClick={() => navigate("/")} variant="outline" className="gap-2">
            <Home className="h-4 w-4" />
            返回首頁
          </Button>
        </div>
      </Card>
    </div>
  );
};

// 匯出為函數組件包裝器
export const ErrorBoundary: React.FC<Props> = (props) => {
  return <ErrorBoundaryClass {...props} />;
};

export default ErrorBoundary;

