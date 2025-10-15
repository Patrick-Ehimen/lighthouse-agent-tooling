/**
 * ListToolsHandler - Handles tools/list requests
 */

import { Logger } from '@lighthouse-tooling/shared';
import { MCPResponse } from '@lighthouse-tooling/types';
import { ToolRegistry } from '../registry/ToolRegistry.js';
import { ResponseBuilder } from '../utils/response-builder.js';

export class ListToolsHandler {
  private registry: ToolRegistry;
  private logger: Logger;

  constructor(registry: ToolRegistry, logger?: Logger) {
    this.registry = registry;
    this.logger = logger || Logger.getInstance({ level: 'info', component: 'ListToolsHandler' });
  }

  /**
   * Handle tools/list request
   */
  async handle(requestId: string | number): Promise<MCPResponse> {
    try {
      this.logger.info('Handling tools/list request', { requestId });

      const tools = this.registry.listTools();

      this.logger.info('Tools list returned', {
        requestId,
        toolCount: tools.length,
      });

      return ResponseBuilder.toolList(requestId, tools);
    } catch (error) {
      this.logger.error('Failed to list tools', error as Error, { requestId });
      return ResponseBuilder.fromError(requestId, error as Error);
    }
  }
}

