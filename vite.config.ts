import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Determine base path for GitHub Pages deployment
  // Priority: VITE_BASE_PATH > GITHUB_REPOSITORY > fallback
  let base = '/';
  if (process.env.GITHUB_PAGES === 'true') {
    if (process.env.VITE_BASE_PATH) {
      // Custom base path provided explicitly
      base = process.env.VITE_BASE_PATH;
    } else if (process.env.GITHUB_REPOSITORY) {
      // Extract repo name from GITHUB_REPOSITORY (format: owner/repo)
      const repoName = process.env.GITHUB_REPOSITORY.split('/')[1];
      base = `/${repoName}/`;
    } else {
      // Fallback for local builds - update if repository is renamed
      base = '/heal/';
    }
  }
  
  return {
    base,
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
