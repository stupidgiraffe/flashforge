import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, PluginOption } from "vite";
import { resolve } from 'path'
import { pathToFileURL } from 'url'

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname

// https://vite.dev/config/
export default defineConfig(async () => {
  const plugins: PluginOption[] = [react(), tailwindcss()];

  plugins.push({
    name: 'flashforge-local-api',
    apply: 'serve',
    configureServer(server) {
      const routes = new Map([
        ['/api/flashcard-agent', './api/flashcard-agent.js'],
        ['/api/ai-models', './api/ai-models.js'],
        ['/api/image-search', './api/image-search.js'],
        ['/api/image-agent', './api/image-agent.js'],
        ['/api/search-config', './api/search-config.js'],
      ])

      // Vercel serves api/*.js in production; plain Vite does not, so mirror API routes locally.
      for (const [route, modulePath] of routes) {
        server.middlewares.use(route, async (req, res) => {
          const handlerUrl = pathToFileURL(resolve(projectRoot, modulePath)).href
          const { default: handler } = await import(handlerUrl)
          await handler(req, res)
        })
      }
    },
  })

  // Conditionally load Spark-specific plugins (only available in Spark/GitHub Copilot environment)
  try {
    const [sparkMod, proxyMod] = await Promise.all([
      import("@github/spark/spark-vite-plugin"),
      import("@github/spark/vitePhosphorIconProxyPlugin"),
    ]);
    plugins.push(proxyMod.default() as PluginOption);
    plugins.push(sparkMod.default() as PluginOption);
  } catch {
    // Spark plugins not available (standard Vercel / local deployment)
  }

  return {
    plugins,
    server: {
      watch: {
        // Pop!_OS dev sessions can exhaust native inotify watchers; polling avoids ENOSPC crashes.
        usePolling: true,
        interval: 1000,
        ignored: ['**/src/__tests__/**', '**/api/__tests__/**'],
      },
    },
    resolve: {
      alias: {
        '@': resolve(projectRoot, 'src')
      }
    },
  };
});
