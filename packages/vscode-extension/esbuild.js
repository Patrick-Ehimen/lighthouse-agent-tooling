const esbuild = require("esbuild");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ["src/index.ts"],
    bundle: true,
    format: "cjs",
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: "node",
    outfile: "dist/index.js",
    external: ["vscode"],
    // Mark optional encryption dependencies that may not be installed
    alias: {
      "@lighthouse-web3/kavach": "@lighthouse-web3/kavach",
    },
    logLevel: "info",
    plugins: [stubMissingModules, esbuildProblemMatcherPlugin],
  });

  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

/**
 * Stub missing optional modules (encryption features not used by extension)
 * @type {import('esbuild').Plugin}
 */
const stubMissingModules = {
  name: "stub-missing-modules",
  setup(build) {
    build.onResolve({ filter: /^(joi|bls-eth-wasm|@lighthouse-web3\/kavach)/ }, (args) => {
      return { path: args.path, namespace: "stub" };
    });
    build.onLoad({ filter: /.*/, namespace: "stub" }, () => {
      return {
        contents: "module.exports = {}",
        loader: "js",
      };
    });
  },
};

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: "esbuild-problem-matcher",

  setup(build) {
    build.onStart(() => {
      console.log("[watch] build started");
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        console.error(`    ${location.file}:${location.line}:${location.column}:`);
      });
      console.log("[watch] build finished");
    });
  },
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
