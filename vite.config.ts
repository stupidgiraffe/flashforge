import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, PluginOption } from "vite";
import { resolve } from 'path'

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname

// https://vite.dev/config/
export default defineConfig(async () => {
  const plugins: PluginOption[] = [react(), tailwindcss()];

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
    resolve: {
      alias: {
        '@': resolve(projectRoot, 'src')
      }
    },
  };
});
