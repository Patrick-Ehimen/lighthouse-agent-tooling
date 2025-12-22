#!/usr/bin/env node
/**
 * Test script for verifying MCP server operations
 * Tests:
 * 1. List Lighthouse datasets
 * 2. Upload README.md to Lighthouse
 * 3. Get details for dataset dataset_5
 */

import { LighthouseMCPServer } from "./dist/server.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const workspaceRoot = resolve(__dirname, "../..");

async function testOperations() {
  console.log("🧪 Testing MCP Server Operations\n");

  // Get API key from environment
  const apiKey = process.env.LIGHTHOUSE_API_KEY;
  if (!apiKey) {
    console.error("❌ Error: LIGHTHOUSE_API_KEY environment variable is required");
    process.exit(1);
  }

  console.log(
    `🔑 Using API key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}\n`,
  );

  // Initialize server
  let server;
  try {
    console.log("📦 Initializing MCP server...");
    server = new LighthouseMCPServer({
      lighthouseApiKey: apiKey,
      logLevel: "info",
    });

    await server.registerTools();
    console.log("✅ Server initialized\n");
  } catch (error) {
    console.error("❌ Failed to initialize server:", error.message);
    process.exit(1);
  }

  const registry = server.getRegistry();

  // Test 1: "List my Lighthouse datasets"
  console.log('📋 Command: "List my Lighthouse datasets"');
  try {
    const listResult = await registry.executeTool("lighthouse_list_datasets", {
      limit: 10,
      offset: 0,
    });

    if (listResult.success) {
      const data = listResult.data;
      console.log("✅ Successfully listed datasets");
      console.log(`   Found ${data.total || 0} dataset(s)`);
      if (data.datasets && data.datasets.length > 0) {
        console.log("   Datasets:");
        data.datasets.forEach((ds, idx) => {
          console.log(`   ${idx + 1}. ${ds.name} (ID: ${ds.id})`);
        });
      } else {
        console.log("   No datasets found");
      }
    } else {
      console.log(`❌ Failed: ${listResult.error}`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
  console.log();

  // Test 2: "Upload README.md to Lighthouse"
  console.log('📤 Command: "Upload README.md to Lighthouse"');
  try {
    const readmePath = join(workspaceRoot, "README.md");
    const readmeExists = readFileSync(readmePath, { encoding: "utf8" });

    const uploadResult = await registry.executeTool("lighthouse_upload_file", {
      filePath: readmePath,
      encrypt: false,
    });

    if (uploadResult.success) {
      const data = uploadResult.data;
      console.log("✅ Successfully uploaded README.md");
      console.log(`   CID: ${data.cid}`);
      console.log(`   Size: ${data.size} bytes`);
      console.log(`   Encrypted: ${data.encrypted}`);
    } else {
      console.log(`❌ Failed: ${uploadResult.error}`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
  console.log();

  // Test 3: "Get details for dataset dataset_5"
  console.log('🔍 Command: "Get details for dataset dataset_5"');
  try {
    const getResult = await registry.executeTool("lighthouse_get_dataset", {
      datasetId: "dataset_5",
    });

    if (getResult.success) {
      const data = getResult.data;
      console.log("✅ Successfully retrieved dataset details");
      console.log(`   ID: ${data.dataset.id}`);
      console.log(`   Name: ${data.dataset.name}`);
      console.log(`   Description: ${data.dataset.description || "N/A"}`);
      console.log(`   Files: ${data.dataset.files?.length || 0}`);
      console.log(`   Version: ${data.dataset.version}`);
    } else {
      console.log(`❌ Failed: ${getResult.error}`);
      if (getResult.error.includes("not found")) {
        console.log("   (This is expected if dataset_5 doesn't exist)");
      }
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
  console.log();

  // Cleanup
  try {
    await server.stop();
    console.log("✅ Server stopped");
  } catch (error) {
    console.log(`⚠️  Warning: Error stopping server: ${error.message}`);
  }

  console.log("\n✨ Testing complete!");
}

// Run tests
testOperations().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
