/**
 * MCP Tools Index - Exports all available MCP tools
 */

export { LighthouseUploadFileTool } from "./LighthouseUploadFileTool.js";
export { LighthouseFetchFileTool } from "./LighthouseFetchFileTool.js";
export { LighthouseGenerateKeyTool } from "./LighthouseGenerateKeyTool.js";
export { LighthouseSetupAccessControlTool } from "./LighthouseSetupAccessControlTool.js";
export * from "./types.js";

import { LighthouseUploadFileTool } from "./LighthouseUploadFileTool.js";
import { LighthouseFetchFileTool } from "./LighthouseFetchFileTool.js";
import { MCPToolDefinition } from "@lighthouse-tooling/types";

/**
 * Get all available tool definitions
 */
export function getAllToolDefinitions(): MCPToolDefinition[] {
  return [LighthouseUploadFileTool.getDefinition(), LighthouseFetchFileTool.getDefinition()];
}

/**
 * Tool factory for creating tool instances
 */
export const ToolFactory = {
  LighthouseUploadFileTool,
  LighthouseFetchFileTool,
} as const;
