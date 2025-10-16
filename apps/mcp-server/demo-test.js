import { LighthouseMCPServer } from "./dist/server.js";
import fs from "fs";

async function demo() {
  const testFile = "./demo-test.txt";
  fs.writeFileSync(testFile, "Hello from MCP Server!");

  console.log("\n=== MCP Server Demo ===\n");

  const server = new LighthouseMCPServer({
    logLevel: "error",
    enableMetrics: false,
  });

  // Register tools
  await server.registerTools();

  const registry = server.getRegistry();
  console.log("Server initialized with", registry.listTools().length, "tools\n");

  // Test 1: Upload
  console.log("1️⃣  Testing lighthouse_upload_file...");
  const uploadResult = await registry.executeTool("lighthouse_upload_file", {
    filePath: testFile,
    encrypt: true,
    tags: ["demo", "test"],
  });

  console.log("   Success:", uploadResult.success);
  console.log("   Execution time:", uploadResult.executionTime + "ms");
  if (uploadResult.data) {
    console.log("   CID:", uploadResult.data.cid?.substring(0, 20) + "...");
    console.log("   Size:", uploadResult.data.size, "bytes");
    console.log("   Encrypted:", uploadResult.data.encrypted);
  }

  // Test 2: Dataset
  console.log("\n2️⃣  Testing lighthouse_create_dataset...");
  const datasetResult = await registry.executeTool("lighthouse_create_dataset", {
    name: "Demo Dataset",
    description: "Test dataset",
    files: [testFile],
  });

  console.log("   Success:", datasetResult.success);
  console.log("   Execution time:", datasetResult.executionTime + "ms");
  if (datasetResult.data) {
    console.log("   Dataset ID:", datasetResult.data.id?.substring(0, 20) + "...");
    console.log("   Files count:", datasetResult.data.files?.length);
  }

  // Stats
  console.log("\n📊 Server Statistics:");
  const stats = server.getStats();
  console.log("   Tools available:", stats.registry.totalTools);
  console.log("   Total operations:", stats.registry.totalCalls);
  console.log("   Files stored:", stats.storage.fileCount);
  console.log("   Datasets created:", stats.datasets.totalDatasets);

  fs.unlinkSync(testFile);
  console.log("\n✅ All operations completed successfully!\n");
}

demo().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
