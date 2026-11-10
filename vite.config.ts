import vinext from "vinext";
import { defineConfig } from "vite";
import { configureToolEnvironment } from "./scripts/tool-environment.mjs";

const LOCAL_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const sharedLocalDataPath = process.env.SENARI_GUILD_DATA_DIR;

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: [
    {
      binding: "DB",
      database_name: "site-creator-d1",
      database_id: LOCAL_DATABASE_ID,
    },
  ],
};

export default defineConfig(async () => {
  configureToolEnvironment(process.cwd());

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      host: "127.0.0.1",
    },
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        ...(sharedLocalDataPath
          ? { persistState: { path: sharedLocalDataPath } }
          : {}),
        config: {
          ...localBindingConfig,
        },
      }),
    ],
  };
});
