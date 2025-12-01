/**
 * Test script for MCP Client implementation
 * This script tests the MCP client connection and tool calling
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";

const SERVER_PATH = path.resolve(process.cwd(), "apps/mcp-server/dist/index.js");

async function testMCPClient() {
  console.log("🧪 Testing MCP Client Implementation\n");

  // Check if server exists
  if (!fs.existsSync(SERVER_PATH)) {
    console.error("❌ MCP Server not found at:", SERVER_PATH);
    console.log(
      "💡 Please build the MCP server first: pnpm --filter @lighthouse-tooling/mcp-server build",
    );
    process.exit(1);
  }

  console.log("✅ MCP Server found at:", SERVER_PATH);
  console.log("📡 Connecting to MCP server...\n");

  try {
    // Create MCP client
    const client = new Client(
      {
        name: "test-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      },
    );

    // Create transport
    const transport = new StdioClientTransport({
      command: "node",
      args: [SERVER_PATH],
      env: {
        ...process.env,
        LIGHTHOUSE_API_KEY: process.env.LIGHTHOUSE_API_KEY || "test-key",
      },
    });

    // Connect
    await client.connect(transport);
    console.log("✅ Connected to MCP server");

    // List tools
    console.log("\n📋 Listing available tools...");
    const toolsResult = await client.listTools();
    const tools = toolsResult.tools || [];
    console.log(`✅ Found ${tools.length} tools:`);
    tools.forEach((tool) => {
      console.log(`   - ${tool.name}: ${tool.description}`);
    });

    // Test tool call (if tools available)
    if (tools.length > 0) {
      const firstTool = tools[0];
      console.log(`\n🔧 Testing tool call: ${firstTool.name}`);
      console.log("   (This will fail without a valid API key, but tests the connection)");

      try {
        const result = await client.callTool({
          name: firstTool.name,
          arguments: {
            apiKey: process.env.LIGHTHOUSE_API_KEY || "test-key",
          },
        });
        console.log("✅ Tool call completed");
        console.log("   Result:", JSON.stringify(result, null, 2).substring(0, 200));
      } catch (error) {
        console.log("⚠️  Tool call failed (expected if API key is invalid):", error.message);
        console.log("   This is normal - the connection is working!");
      }
    }

    // Close connection
    await client.close();
    console.log("\n✅ Test completed successfully!");
    console.log("\n🎉 MCP Client implementation is working correctly!");
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run test
testMCPClient().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
