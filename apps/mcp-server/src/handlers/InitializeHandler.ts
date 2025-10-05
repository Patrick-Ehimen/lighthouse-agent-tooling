/**
 * InitializeHandler - Handles initialize requests
 */

import { Logger } from '@lighthouse-tooling/shared';
import { MCPResponse } from '@lighthouse-tooling/types';
import { ResponseBuilder } from '../utils/response-builder.js';

export class InitializeHandler {
  private logger: Logger;
  private serverInfo: {
    name: string;
    version: string;
  };

  constructor(serverInfo: { name: string; version: string }, logger?: Logger) {
    this.serverInfo = serverInfo;
    this.logger = logger || Logger.getInstance({ level: 'info', component: 'InitializeHandler' });
  }

  /**
   * Handle initialize request
   */
  async handle(requestId: string | number, clientCapabilities?: any): Promise<MCPResponse> {
    try {
      this.logger.info('Handling initialize request', {
        requestId,
        clientCapabilities,
      });

      this.logger.info('Server initialized', {
        requestId,
        serverName: this.serverInfo.name,
        serverVersion: this.serverInfo.version,
      });

      return ResponseBuilder.success(requestId, {
        text: JSON.stringify({
          capabilities: {
            tools: { listChanged: false },
            resources: { subscribe: false, listChanged: false },
            prompts: { listChanged: false },
            logging: {},
          },
          serverInfo: {
            name: this.serverInfo.name,
            version: this.serverInfo.version,
          },
          protocolVersion: '2024-11-05',
        }, null, 2),
      });
    } catch (error) {
      this.logger.error('Failed to initialize', error as Error, { requestId });
      return ResponseBuilder.fromError(requestId, error as Error);
    }
  }
}

