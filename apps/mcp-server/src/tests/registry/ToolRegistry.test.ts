/**
 * ToolRegistry unit tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ToolRegistry } from '../../registry/ToolRegistry.js';
import { MCPToolDefinition, ExecutionTimeCategory } from '@lighthouse-tooling/types';
import { ToolExecutor } from '../../registry/types.js';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  const testTool: MCPToolDefinition = {
    name: 'test_tool',
    description: 'A test tool',
    inputSchema: {
      type: 'object',
      properties: {
        param1: {
          type: 'string',
          description: 'First parameter',
        },
      },
      required: ['param1'],
    },
    requiresAuth: false,
    supportsBatch: false,
    executionTime: ExecutionTimeCategory.FAST,
  };

  const testExecutor: ToolExecutor = async (args) => ({
    success: true,
    data: { result: `Processed: ${args.param1}` },
    executionTime: 0,
  });

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('register', () => {
    it('should register a tool successfully', () => {
      registry.register(testTool, testExecutor);
      expect(registry.hasTool('test_tool')).toBe(true);
    });

    it('should reject registration of duplicate tool', () => {
      registry.register(testTool, testExecutor);
      expect(() => registry.register(testTool, testExecutor)).toThrow();
    });

    it('should allow override of existing tool', () => {
      registry.register(testTool, testExecutor);
      registry.register(testTool, testExecutor, { override: true });
      expect(registry.hasTool('test_tool')).toBe(true);
    });

    it('should complete registration within 100ms', () => {
      const startTime = Date.now();
      registry.register(testTool, testExecutor);
      const registrationTime = Date.now() - startTime;
      expect(registrationTime).toBeLessThan(100);
    });

    it('should reject invalid tool definition', () => {
      const invalidTool = { ...testTool, name: '' };
      expect(() => registry.register(invalidTool as any, testExecutor)).toThrow();
    });
  });

  describe('getTool', () => {
    it('should retrieve registered tool', () => {
      registry.register(testTool, testExecutor);
      const tool = registry.getTool('test_tool');
      expect(tool).toBeDefined();
      expect(tool?.definition.name).toBe('test_tool');
    });

    it('should return undefined for non-existent tool', () => {
      const tool = registry.getTool('nonexistent');
      expect(tool).toBeUndefined();
    });
  });

  describe('listTools', () => {
    it('should list all registered tools', () => {
      registry.register(testTool, testExecutor);
      const tools = registry.listTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('test_tool');
    });

    it('should return empty array when no tools registered', () => {
      const tools = registry.listTools();
      expect(tools).toHaveLength(0);
    });
  });

  describe('discoverTools', () => {
    beforeEach(() => {
      registry.register(testTool, testExecutor);
      registry.register(
        {
          ...testTool,
          name: 'auth_tool',
          requiresAuth: true,
        },
        testExecutor
      );
    });

    it('should discover tools by requiresAuth', () => {
      const tools = registry.discoverTools({ requiresAuth: true });
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('auth_tool');
    });

    it('should discover tools by name pattern', () => {
      const tools = registry.discoverTools({ namePattern: 'test' });
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('test_tool');
    });

    it('should return all tools when no filter provided', () => {
      const tools = registry.discoverTools();
      expect(tools).toHaveLength(2);
    });
  });

  describe('executeTool', () => {
    beforeEach(() => {
      registry.register(testTool, testExecutor);
    });

    it('should execute tool successfully', async () => {
      const result = await registry.executeTool('test_tool', { param1: 'test' });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ result: 'Processed: test' });
    });

    it('should return error for non-existent tool', async () => {
      const result = await registry.executeTool('nonexistent', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should update tool metrics after execution', async () => {
      await registry.executeTool('test_tool', { param1: 'test' });
      const stats = registry.getToolStats('test_tool');
      expect(stats?.callCount).toBe(1);
      expect(stats?.lastCalled).toBeDefined();
    });

    it('should handle executor errors gracefully', async () => {
      const errorExecutor: ToolExecutor = async () => {
        throw new Error('Execution failed');
      };

      registry.register({ ...testTool, name: 'error_tool' }, errorExecutor);
      const result = await registry.executeTool('error_tool', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution failed');
    });
  });

  describe('getMetrics', () => {
    it('should return registry metrics', () => {
      registry.register(testTool, testExecutor);
      const metrics = registry.getMetrics();

      expect(metrics.totalTools).toBe(1);
      expect(metrics.toolsRegistered).toContain('test_tool');
      expect(metrics.registrationTimestamp).toBeInstanceOf(Date);
    });

    it('should track total calls', async () => {
      registry.register(testTool, testExecutor);
      await registry.executeTool('test_tool', { param1: 'test1' });
      await registry.executeTool('test_tool', { param1: 'test2' });

      const metrics = registry.getMetrics();
      expect(metrics.totalCalls).toBe(2);
    });
  });

  describe('unregister', () => {
    it('should unregister a tool', () => {
      registry.register(testTool, testExecutor);
      const result = registry.unregister('test_tool');
      expect(result).toBe(true);
      expect(registry.hasTool('test_tool')).toBe(false);
    });

    it('should return false when unregistering non-existent tool', () => {
      const result = registry.unregister('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all registered tools', () => {
      registry.register(testTool, testExecutor);
      registry.clear();
      expect(registry.listTools()).toHaveLength(0);
    });
  });
});

