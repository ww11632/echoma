import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n/config";

// 预加载关键资源
const root = document.getElementById("root");
if (root) {
  // 使用 requestIdleCallback 在空闲时预加载可能需要的资源
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      // 预加载首页可能需要的资源
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = '/';
      document.head.appendChild(link);
    });
  }
  
  createRoot(root).render(<App />);
}
