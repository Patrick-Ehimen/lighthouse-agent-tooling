/**
 * MCP Tools Index - Exports all available MCP tools
 */

export { LighthouseUploadFileTool } from "./LighthouseUploadFileTool.js";
export { LighthouseFetchFileTool } from "./LighthouseFetchFileTool.js";
export { LighthouseCreateDatasetTool } from "./LighthouseCreateDatasetTool.js";
export { LighthouseGetDatasetTool } from "./LighthouseGetDatasetTool.js";
export { LighthouseListDatasetsTool } from "./LighthouseListDatasetsTool.js";
export { LighthouseUpdateDatasetTool } from "./LighthouseUpdateDatasetTool.js";
export { LighthouseDatasetVersionTool } from "./LighthouseDatasetVersionTool.js";
export * from "./types.js";

import { LighthouseUploadFileTool } from "./LighthouseUploadFileTool.js";
import { LighthouseFetchFileTool } from "./LighthouseFetchFileTool.js";
import { LighthouseCreateDatasetTool } from "./LighthouseCreateDatasetTool.js";
import { LighthouseGetDatasetTool } from "./LighthouseGetDatasetTool.js";
import { LighthouseListDatasetsTool } from "./LighthouseListDatasetsTool.js";
import { LighthouseUpdateDatasetTool } from "./LighthouseUpdateDatasetTool.js";
import { LighthouseDatasetVersionTool } from "./LighthouseDatasetVersionTool.js";
import { MCPToolDefinition } from "@lighthouse-tooling/types";

/**
 * Get all available tool definitions
 */
export function getAllToolDefinitions(): MCPToolDefinition[] {
  return [
    LighthouseUploadFileTool.getDefinition(),
    LighthouseFetchFileTool.getDefinition(),
    LighthouseCreateDatasetTool.getDefinition(),
    LighthouseGetDatasetTool.getDefinition(),
    LighthouseListDatasetsTool.getDefinition(),
    LighthouseUpdateDatasetTool.getDefinition(),
    LighthouseDatasetVersionTool.getDefinition(),
  ];
}

/**
 * Tool factory for creating tool instances
 */
export const ToolFactory = {
  LighthouseUploadFileTool,
  LighthouseFetchFileTool,
  LighthouseCreateDatasetTool,
  LighthouseGetDatasetTool,
  LighthouseListDatasetsTool,
  LighthouseUpdateDatasetTool,
  LighthouseDatasetVersionTool,
} as const;
