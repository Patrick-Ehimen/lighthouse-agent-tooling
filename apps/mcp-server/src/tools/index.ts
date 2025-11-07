/**
 * MCP Tools Index - Exports all available MCP tools
 */

export { LighthouseUploadFileTool } from "./LighthouseUploadFileTool.js";
export { LighthouseFetchFileTool } from "./LighthouseFetchFileTool.js";
export { LighthouseCreateDatasetTool } from "./LighthouseCreateDatasetTool.js";
export { LighthouseListDatasetsTool } from "./LighthouseListDatasetsTool.js";
export { LighthouseGetDatasetTool } from "./LighthouseGetDatasetTool.js";
export { LighthouseUpdateDatasetTool } from "./LighthouseUpdateDatasetTool.js";
export { LighthouseGenerateKeyTool } from "./LighthouseGenerateKeyTool.js";
export { LighthouseSetupAccessControlTool } from "./LighthouseSetupAccessControlTool.js";
export * from "./types.js";

import { LighthouseUploadFileTool } from "./LighthouseUploadFileTool.js";
import { LighthouseFetchFileTool } from "./LighthouseFetchFileTool.js";
import { LighthouseCreateDatasetTool } from "./LighthouseCreateDatasetTool.js";
import { LighthouseListDatasetsTool } from "./LighthouseListDatasetsTool.js";
import { LighthouseGetDatasetTool } from "./LighthouseGetDatasetTool.js";
import { LighthouseUpdateDatasetTool } from "./LighthouseUpdateDatasetTool.js";
import { LighthouseGenerateKeyTool } from "./LighthouseGenerateKeyTool.js";
import { LighthouseSetupAccessControlTool } from "./LighthouseSetupAccessControlTool.js";
import { MCPToolDefinition } from "@lighthouse-tooling/types";

/**
 * Get all available tool definitions
 */
export function getAllToolDefinitions(): MCPToolDefinition[] {
  return [
    LighthouseUploadFileTool.getDefinition(),
    LighthouseFetchFileTool.getDefinition(),
    LighthouseCreateDatasetTool.getDefinition(),
    LighthouseListDatasetsTool.getDefinition(),
    LighthouseGetDatasetTool.getDefinition(),
    LighthouseUpdateDatasetTool.getDefinition(),
    LighthouseGenerateKeyTool.getDefinition(),
    LighthouseSetupAccessControlTool.getDefinition(),
  ];
}

/**
 * Tool factory for creating tool instances
 */
export const ToolFactory = {
  LighthouseUploadFileTool,
  LighthouseFetchFileTool,
  LighthouseCreateDatasetTool,
  LighthouseListDatasetsTool,
  LighthouseGetDatasetTool,
  LighthouseUpdateDatasetTool,
  LighthouseGenerateKeyTool,
  LighthouseSetupAccessControlTool,
} as const;
