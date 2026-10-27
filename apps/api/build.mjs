import { build } from "esbuild";

// Bundles the API into one ESM file for production. Workspace packages (@hogar/*) ship TypeScript
// sources, so they are bundled; every other package stays external and is loaded from node_modules.
await build({
  entryPoints: ["src/server.ts"],
  outfile: "dist/server.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  sourcemap: true,
  plugins: [
    {
      name: "external-packages",
      setup(pluginBuild) {
        pluginBuild.onResolve({ filter: /^[^./]/ }, ({ path }) =>
          path.startsWith("@hogar/") ? undefined : { path, external: true },
        );
      },
    },
  ],
});
