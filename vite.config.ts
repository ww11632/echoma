import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import wasm from "vite-plugin-wasm";

// Plugin to handle WebAssembly files with correct MIME type
const wasmPlugin = () => ({
  name: "wasm-mime-type",
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      if (req.url?.endsWith(".wasm")) {
        res.setHeader("Content-Type", "application/wasm");
      }
      next();
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // Configure headers for WebAssembly files (required by Walrus SDK)
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
    // Ensure .wasm files are served with correct MIME type
    fs: {
      strict: false,
    },
  },
  plugins: [
    react(),
    wasm(), // Add WebAssembly support plugin
    wasmPlugin(), // Add WebAssembly MIME type plugin
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Optimize dependencies for WebAssembly
  optimizeDeps: {
    exclude: ["@mysten/walrus-wasm"],
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@tanstack/react-query",
      "@mysten/dapp-kit",
      "i18next",
      "react-i18next",
    ],
  },
  // Configure build options for WebAssembly
  build: {
    target: "esnext",
    minify: "esbuild", // 使用 esbuild 进行更快的压缩
    cssMinify: true,
    rollupOptions: {
      output: {
        // 优化代码分割
        manualChunks: (id) => {
          // 将 node_modules 中的大型库分离
          if (id.includes("node_modules")) {
            if (id.includes("@mysten")) {
              return "vendor-sui";
            }
            if (id.includes("recharts")) {
              return "vendor-charts";
            }
            if (id.includes("@radix-ui")) {
              return "vendor-ui";
            }
            if (id.includes("react") || id.includes("react-dom")) {
              return "vendor-react";
            }
            // 其他第三方库
            return "vendor";
          }
        },
        // Ensure .wasm files are handled correctly
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith(".wasm")) {
            return "assets/[name][extname]";
          }
          return "assets/[name]-[hash][extname]";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
      },
    },
    // 增加 chunk 大小警告限制
    chunkSizeWarningLimit: 1000,
  },
  // Worker configuration for WebAssembly
  worker: {
    format: "es",
  },
}));
