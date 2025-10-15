/**
 * Request Validator - Validates MCP requests and tool parameters
 */

import { MCPToolDefinition, MCPToolInputSchema } from "@lighthouse-tooling/types";
import { Validator } from "@lighthouse-tooling/shared";

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export class RequestValidator {
  /**
   * Validate tool arguments against schema
   */
  static validateToolArguments(
    toolDefinition: MCPToolDefinition,
    args: Record<string, unknown>,
  ): { valid: boolean; errors: ValidationError[] } {
    const errors: ValidationError[] = [];
    const schema = toolDefinition.inputSchema;

    // Check required fields
    if (schema.required) {
      for (const requiredField of schema.required) {
        if (
          !(requiredField in args) ||
          args[requiredField] === undefined ||
          args[requiredField] === null
        ) {
          errors.push({
            field: requiredField,
            message: `Required field '${requiredField}' is missing`,
          });
        }
      }
    }

    // Validate each argument
    for (const [key, value] of Object.entries(args)) {
      const propertySchema = schema.properties[key];

      if (!propertySchema) {
        // Allow additional properties unless explicitly disallowed
        if (schema.additionalProperties === false) {
          errors.push({
            field: key,
            message: `Unknown field '${key}'`,
            value,
          });
        }
        continue;
      }

      // Validate type
      const typeErrors = this.validateType(key, value, propertySchema);
      errors.push(...typeErrors);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate value type
   */
  private static validateType(fieldName: string, value: unknown, schema: any): ValidationError[] {
    const errors: ValidationError[] = [];

    if (value === undefined || value === null) {
      return errors; // Already checked in required fields
    }

    switch (schema.type) {
      case "string":
        if (typeof value !== "string") {
          errors.push({
            field: fieldName,
            message: `Field '${fieldName}' must be a string`,
            value,
          });
        } else {
          // Validate string constraints
          if (schema.minLength && value.length < schema.minLength) {
            errors.push({
              field: fieldName,
              message: `Field '${fieldName}' must be at least ${schema.minLength} characters`,
              value,
            });
          }
          if (schema.maxLength && value.length > schema.maxLength) {
            errors.push({
              field: fieldName,
              message: `Field '${fieldName}' must be at most ${schema.maxLength} characters`,
              value,
            });
          }
          if (schema.enum && !schema.enum.includes(value)) {
            errors.push({
              field: fieldName,
              message: `Field '${fieldName}' must be one of: ${schema.enum.join(", ")}`,
              value,
            });
          }
        }
        break;

      case "number":
        if (typeof value !== "number") {
          errors.push({
            field: fieldName,
            message: `Field '${fieldName}' must be a number`,
            value,
          });
        } else {
          if (schema.minimum !== undefined && value < schema.minimum) {
            errors.push({
              field: fieldName,
              message: `Field '${fieldName}' must be at least ${schema.minimum}`,
              value,
            });
          }
          if (schema.maximum !== undefined && value > schema.maximum) {
            errors.push({
              field: fieldName,
              message: `Field '${fieldName}' must be at most ${schema.maximum}`,
              value,
            });
          }
        }
        break;

      case "boolean":
        if (typeof value !== "boolean") {
          errors.push({
            field: fieldName,
            message: `Field '${fieldName}' must be a boolean`,
            value,
          });
        }
        break;

      case "array":
        if (!Array.isArray(value)) {
          errors.push({
            field: fieldName,
            message: `Field '${fieldName}' must be an array`,
            value,
          });
        } else if (schema.items) {
          // Validate array items
          value.forEach((item, index) => {
            const itemErrors = this.validateType(`${fieldName}[${index}]`, item, schema.items);
            errors.push(...itemErrors);
          });
        }
        break;

      case "object":
        if (typeof value !== "object" || Array.isArray(value)) {
          errors.push({
            field: fieldName,
            message: `Field '${fieldName}' must be an object`,
            value,
          });
        } else if (schema.properties) {
          // Validate object properties
          const objValue = value as Record<string, unknown>;
          for (const [propKey, propValue] of Object.entries(objValue)) {
            const propSchema = schema.properties[propKey];
            if (propSchema) {
              const propErrors = this.validateType(
                `${fieldName}.${propKey}`,
                propValue,
                propSchema,
              );
              errors.push(...propErrors);
            }
          }
        }
        break;
    }

    return errors;
  }

  /**
   * Validate file path parameter
   */
  static validateFilePath(filePath: unknown): { valid: boolean; error?: string } {
    if (typeof filePath !== "string") {
      return { valid: false, error: "File path must be a string" };
    }

    const result = Validator.validateFilePath(filePath);
    return {
      valid: result.isValid,
      error: result.error,
    };
  }

  /**
   * Validate CID parameter
   */
  static validateCID(cid: unknown): { valid: boolean; error?: string } {
    if (typeof cid !== "string") {
      return { valid: false, error: "CID must be a string" };
    }

    const result = Validator.validateCID(cid);
    return {
      valid: result.isValid,
      error: result.error,
    };
  }

  /**
   * Sanitize input data
   */
  static sanitize(data: unknown): unknown {
    return Validator.sanitizeInput(data);
  }
}
