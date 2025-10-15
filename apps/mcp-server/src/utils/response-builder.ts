/**
 * Response Builder - Formats MCP responses
 */

import { MCPResponse, MCPResult, MCPError, MCPErrorCode, MCPContent } from '@lighthouse-tooling/types';

export class ResponseBuilder {
  /**
   * Build a success response
   */
  static success(id: string | number, result: MCPResult): MCPResponse {
    return {
      jsonrpc: '2.0',
      id,
      result,
    };
  }

  /**
   * Build an error response
   */
  static error(id: string | number, code: MCPErrorCode, message: string, data?: Record<string, unknown>): MCPResponse {
    const error: MCPError = {
      code,
      message,
      data,
    };

    return {
      jsonrpc: '2.0',
      id,
      error,
    };
  }

  /**
   * Build a tool list response
   */
  static toolList(id: string | number, tools: any[]): MCPResponse {
    return this.success(id, {
      tools,
    });
  }

  /**
   * Build a tool call result response
   */
  static toolCallResult(id: string | number, content: string | MCPContent[], metadata?: Record<string, unknown>): MCPResponse {
    const contentArray: MCPContent[] = typeof content === 'string'
      ? [{ type: 'text', text: content }]
      : content;

    return this.success(id, {
      content: contentArray,
      metadata,
    });
  }

  /**
   * Build a resource list response
   */
  static resourceList(id: string | number, resources: any[]): MCPResponse {
    return this.success(id, {
      content: [
        {
          type: 'text',
          text: JSON.stringify(resources, null, 2),
        },
      ],
    });
  }

  /**
   * Convert error to MCP error code
   */
  static errorToMCPCode(error: Error): MCPErrorCode {
    const message = error.message.toLowerCase();

    if (message.includes('not found')) {
      return MCPErrorCode.RESOURCE_NOT_FOUND;
    }

    if (message.includes('invalid') || message.includes('validation')) {
      return MCPErrorCode.INVALID_PARAMS;
    }

    if (message.includes('auth') || message.includes('permission')) {
      return MCPErrorCode.AUTH_REQUIRED;
    }

    if (message.includes('timeout')) {
      return MCPErrorCode.SERVER_ERROR;
    }

    return MCPErrorCode.INTERNAL_ERROR;
  }

  /**
   * Build error response from exception
   */
  static fromError(id: string | number, error: Error): MCPResponse {
    const code = this.errorToMCPCode(error);
    return this.error(id, code, error.message, {
      stack: error.stack,
      name: error.name,
    });
  }

  /**
   * Format data as MCP content
   */
  static formatContent(data: unknown): MCPContent[] {
    if (typeof data === 'string') {
      return [{ type: 'text', text: data }];
    }

    // Convert objects to JSON
    return [
      {
        type: 'text',
        text: JSON.stringify(data, null, 2),
        mimeType: 'application/json',
      },
    ];
  }
}

