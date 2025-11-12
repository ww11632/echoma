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
  },
  // Configure build options for WebAssembly
  build: {
    target: "esnext",
    rollupOptions: {
      output: {
        // Ensure .wasm files are handled correctly
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith(".wasm")) {
            return "assets/[name][extname]";
          }
          return "assets/[name]-[hash][extname]";
        },
      },
    },
  },
  // Worker configuration for WebAssembly
  worker: {
    format: "es",
  },
}));
