import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      proxy: {
        '/api/criar-pix': {
          target: 'https://api.freepaybrasil.com/v1/payment-transaction/create',
          changeOrigin: true,
          rewrite: () => '',
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              const pKey = env.FREEPAY_PUBLIC_KEY || '';
              const sKey = env.FREEPAY_SECRET_KEY || '';
              proxyReq.setHeader('Authorization', 'Basic ' + Buffer.from(pKey + ':' + sKey).toString('base64'));
            });
          }
        },
        '/api/status-pix': {
          target: 'https://api.freepaybrasil.com/v1/payment-transaction/info',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/status-pix\/?/, '/'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              const pKey = env.FREEPAY_PUBLIC_KEY || '';
              const sKey = env.FREEPAY_SECRET_KEY || '';
              proxyReq.setHeader('Authorization', 'Basic ' + Buffer.from(pKey + ':' + sKey).toString('base64'));
            });
          }
        },
        '/api/search-cpf': {
          target: 'https://searchapi.dnnl.live',
          changeOrigin: true,
          rewrite: (path) => {
            const params = path.split('?')[1] || '';
            const search = params ? `&${params}` : '';
            return `/consulta?token_api=${env.SEARCH_API_TOKEN || ''}${search}`;
          }
        }
      }
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
