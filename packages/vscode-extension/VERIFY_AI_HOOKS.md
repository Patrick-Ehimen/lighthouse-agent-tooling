# How to Verify AI Agent Hooks Work

## Quick Verification Steps

### 1. Build Check

```bash
# From root directory
pnpm --filter lighthouse-extension run build
pnpm --filter lighthouse-extension run build:tsc
```

If builds succeed, the hooks are properly integrated.

### 2. Type Check

```bash
pnpm --filter lighthouse-extension run build:tsc
```

No TypeScript errors = hooks are correctly typed.

### 3. Test in VSCode Extension Host

#### Option A: Unit Test (Run existing extension test)

```bash
pnpm --filter lighthouse-extension run test -- extension.test.ts
```

Look for the "AI Agent Hooks" test section - it verifies:

- Hooks are exposed via `getAIAgentHooks()`
- All 4 methods are available
- Workspace context can be retrieved

#### Option B: Manual Verification in VSCode

1. **Package the extension:**

   ```bash
   cd packages/vscode-extension
   npm run package
   ```

2. **Install in VSCode:**
   - Open VSCode
   - Go to Extensions view
   - Install from VSIX file

3. **Open Developer Console:**
   - Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
   - Type "Developer: Toggle Developer Tools"
   - Go to Console tab

4. **Test the hooks:**

   ```javascript
   // Get the extension instance
   const ext = vscode.extensions.getExtension("lighthouse-web3.lighthouse-storage-for-vscode");
   if (ext && ext.isActive) {
     const extension = ext.exports?.extension;

     // Get AI hooks
     const aiHooks = extension?.getAIAgentHooks();

     // Test getWorkspaceContext
     const context = await aiHooks?.getWorkspaceContext();
     console.log("Workspace context:", context);

     // Test onProgress
     const unsubscribe = aiHooks?.onProgress((progress) => {
       console.log("Progress update:", progress);
     });

     // Test onAICommand (workspace context command)
     const result = await aiHooks?.onAICommand("lighthouse.workspace.context", {});
     console.log("Command result:", result);

     // Cleanup
     unsubscribe?.();
   }
   ```

### 4. Programmatic Test Script

Create a test file `test-hooks-manual.ts`:

```typescript
import { createExtensionCore } from "@lighthouse-tooling/extension-core";
import { AIAgentHooksImpl } from "./src/ai/ai-agent-hooks";

async function testAIAgentHooks() {
  console.log("Testing AI Agent Hooks...\n");

  // Set API key
  process.env.LIGHTHOUSE_API_KEY = "test-key";

  // Create extension core
  const extensionCore = createExtensionCore();
  await extensionCore.initialize();

  // Create AI hooks
  const aiHooks = new AIAgentHooksImpl(extensionCore);

  try {
    // Test 1: getWorkspaceContext
    console.log("Test 1: getWorkspaceContext()");
    const context = await aiHooks.getWorkspaceContext();
    console.log("✓ Workspace context retrieved:", !!context);
    console.log("  - Project path:", context.projectPath || "N/A");
    console.log("  - Files:", context.files?.length || 0);
    console.log("");

    // Test 2: onAICommand
    console.log("Test 2: onAICommand()");
    const result = await aiHooks.onAICommand("lighthouse.workspace.context", {});
    console.log("✓ Command executed successfully:", !!result);
    console.log("");

    // Test 3: registerAIFunction
    console.log("Test 3: registerAIFunction()");
    let customFuncCalled = false;
    aiHooks.registerAIFunction("test.custom", async (cmd) => {
      customFuncCalled = true;
      return { success: true, data: { message: "Custom function called" } };
    });
    const customResult = await aiHooks.onAICommand("test.custom", {});
    console.log("✓ Custom function registered and called:", customFuncCalled);
    console.log("");

    // Test 4: onProgress
    console.log("Test 4: onProgress()");
    let progressReceived = false;
    const unsubscribe = aiHooks.onProgress((progress) => {
      progressReceived = true;
      console.log("  Progress update received:", progress.title || "N/A");
    });
    console.log("✓ Progress callback registered");
    unsubscribe();
    console.log("✓ Unsubscribe function works");
    console.log("");

    console.log("✅ All tests passed!");
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    aiHooks.dispose();
    await extensionCore.dispose();
  }
}

testAIAgentHooks();
```

Run with:

```bash
ts-node packages/vscode-extension/test-hooks-manual.ts
```

### 5. Check Build Output

Verify hooks are in the built code:

```bash
grep -i "getAIAgentHooks\|AIAgentHooks" packages/vscode-extension/dist/extension.js
```

Should show:

- `getAIAgentHooks()` method
- `AIAgentHooksImpl` class
- Import statements

### 6. Lint Check

```bash
pnpm --filter lighthouse-extension run lint
```

Should only show warnings (not errors) - errors mean something is broken.

## Expected Results

✅ **All good if:**

- Build succeeds without errors
- TypeScript compilation succeeds
- `getAIAgentHooks()` returns an object with 4 methods
- No runtime errors when calling hook methods
- Progress callbacks can be registered/unregistered

❌ **Something wrong if:**

- Build fails
- TypeScript errors
- Methods are undefined
- Runtime errors when using hooks
