import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig(({ command, mode }) => ({
  plugins: [
    react(),
    ...(command === "serve" && mode === "https" ? [basicSsl()] : []),
    {
      name: "linkmark-development-csp",
      transformIndexHtml(html) {
        // Vite injects styles for HMR. Keep the strict CSP in production, but
        // omit its meta tag only from the local development response.
        return command === "serve"
          ? html.replace(
              /\s*<meta\b(?=[^>]*\bhttp-equiv\s*=\s*["']Content-Security-Policy["'])[^>]*>/gi,
              "",
            )
          : html;
      },
    },
  ],
}));
