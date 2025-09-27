/**
 * Custom Jest matchers for Lighthouse-specific testing
 */

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidCID(): R;
      toBeValidUploadResult(): R;
      toBeValidDataset(): R;
      toHaveValidTimestamp(): R;
      toMatchProgressUpdate(): R;
    }
  }
}

/**
 * Check if a string is a valid IPFS CID
 */
export const toBeValidCID = (received: string) => {
  const cidRegex = /^Qm[1-9A-HJ-NP-Za-km-z]{44,46}$/;
  const pass = typeof received === "string" && cidRegex.test(received);

  if (pass) {
    return {
      message: () => `expected ${received} not to be a valid CID`,
      pass: true,
    };
  } else {
    return {
      message: () => `expected ${received} to be a valid CID`,
      pass: false,
    };
  }
};

/**
 * Check if an object is a valid UploadResult
 */
export const toBeValidUploadResult = (received: any) => {
  const requiredFields = ["cid", "size", "encrypted", "uploadTime"];
  const hasRequiredFields = requiredFields.every((field) => field in received);

  const validTypes =
    typeof received.cid === "string" &&
    typeof received.size === "number" &&
    typeof received.encrypted === "boolean" &&
    typeof received.uploadTime === "string";

  const pass = hasRequiredFields && validTypes;

  if (pass) {
    return {
      message: () => `expected object not to be a valid UploadResult`,
      pass: true,
    };
  } else {
    return {
      message: () =>
        `expected object to be a valid UploadResult with fields: ${requiredFields.join(", ")}`,
      pass: false,
    };
  }
};

/**
 * Check if an object is a valid Dataset
 */
export const toBeValidDataset = (received: any) => {
  const requiredFields = [
    "id",
    "name",
    "description",
    "files",
    "metadata",
    "version",
    "created",
    "updated",
  ];
  const hasRequiredFields = requiredFields.every((field) => field in received);

  const validTypes =
    typeof received.id === "string" &&
    typeof received.name === "string" &&
    typeof received.description === "string" &&
    Array.isArray(received.files) &&
    typeof received.metadata === "object" &&
    typeof received.version === "string" &&
    typeof received.created === "string" &&
    typeof received.updated === "string";

  const pass = hasRequiredFields && validTypes;

  if (pass) {
    return {
      message: () => `expected object not to be a valid Dataset`,
      pass: true,
    };
  } else {
    return {
      message: () =>
        `expected object to be a valid Dataset with fields: ${requiredFields.join(", ")}`,
      pass: false,
    };
  }
};

/**
 * Check if a string is a valid ISO timestamp
 */
export const toHaveValidTimestamp = (received: any) => {
  const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
  const pass = typeof received === "string" && timestampRegex.test(received);

  if (pass) {
    return {
      message: () => `expected ${received} not to be a valid ISO timestamp`,
      pass: true,
    };
  } else {
    return {
      message: () => `expected ${received} to be a valid ISO timestamp`,
      pass: false,
    };
  }
};

/**
 * Check if an object matches ProgressUpdate structure
 */
export const toMatchProgressUpdate = (received: any) => {
  const requiredFields = ["operation", "progress", "stage", "timestamp"];
  const hasRequiredFields = requiredFields.every((field) => field in received);

  const validTypes =
    typeof received.operation === "string" &&
    typeof received.progress === "number" &&
    typeof received.stage === "string" &&
    typeof received.timestamp === "string";

  const validProgress = received.progress >= 0 && received.progress <= 100;

  const pass = hasRequiredFields && validTypes && validProgress;

  if (pass) {
    return {
      message: () => `expected object not to match ProgressUpdate structure`,
      pass: true,
    };
  } else {
    return {
      message: () =>
        `expected object to match ProgressUpdate structure with valid progress (0-100)`,
      pass: false,
    };
  }
};

// Register custom matchers
expect.extend({
  toBeValidCID,
  toBeValidUploadResult,
  toBeValidDataset,
  toHaveValidTimestamp,
  toMatchProgressUpdate,
});
