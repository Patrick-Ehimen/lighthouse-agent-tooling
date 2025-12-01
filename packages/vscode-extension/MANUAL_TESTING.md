# VSCode Extension Manual Testing Guide

This guide provides step-by-step instructions for manually testing the Lighthouse VSCode extension.

## Prerequisites

Before testing, ensure you have:

- VSCode version 1.74.0 or higher
- Node.js 20.x or higher
- A valid Lighthouse API key ([Get one here](https://lighthouse.storage))
- The extension built and ready to test

## Setup for Testing

### 1. Build the Extension

```bash
cd packages/vscode-extension
pnpm install
pnpm run build
```

### 2. Install the Extension Locally

**Option A: Run in Extension Development Host**

1. Open the `packages/vscode-extension` folder in VSCode
2. Press `F5` or go to Run > Start Debugging
3. A new VSCode window will open with the extension loaded

**Option B: Package and Install**

```bash
# Package the extension
pnpm run package

# This creates a .vsix file
# Install it via: Extensions > ... > Install from VSIX
```

### 3. Configure API Key

1. Open VSCode Settings (`Cmd+,` on Mac, `Ctrl+,` on Windows/Linux)
2. Search for "Lighthouse"
3. Set your API key in `Lighthouse: Api Key`
4. Optionally configure `Lighthouse: Mcp Server Url` (default: `http://localhost:3000`)

## Test Cases

### Test 1: Extension Activation

**Objective:** Verify the extension activates correctly

**Steps:**

1. Open a workspace folder in VSCode
2. Check the Activity Bar for the Explorer icon
3. Look for "Lighthouse Storage" in the Explorer sidebar

**Expected Results:**

- ✅ Extension activates without errors
- ✅ "Lighthouse Storage" panel appears in Explorer
- ✅ Status bar shows Lighthouse icon (if configured)

**Common Issues:**

- If panel doesn't appear, check Output > Lighthouse for errors
- Verify workspace folder is open (extension requires `workspaceFolderCount > 0`)

---

### Test 2: API Key Configuration

**Objective:** Verify API key validation and configuration

**Steps:**

1. Open Settings and clear the API key
2. Try to run any Lighthouse command
3. Set a valid API key
4. Run the command again

**Expected Results:**

- ✅ Without API key: Warning message appears with "Set API Key" button
- ✅ Clicking "Set API Key" opens settings to the correct field
- ✅ With valid API key: Commands execute successfully

---

### Test 3: Test Connection

**Objective:** Verify connection to Lighthouse servers

**Steps:**

1. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Type "Lighthouse: Test Connection"
3. Execute the command

**Expected Results:**

- ✅ Progress indicator shows "Testing Lighthouse connection"
- ✅ Success message shows number of files in account
- ✅ Status bar updates with success indicator

**Error Scenarios to Test:**

- Invalid API key → Should show authentication error
- No internet connection → Should show network error with troubleshooting tips
- Timeout → Should show timeout error with diagnostic information

---

### Test 4: Upload File

**Objective:** Test file upload functionality

**Steps:**

1. Click the upload icon in Lighthouse Storage panel, OR
2. Use Command Palette: "Lighthouse: Upload File to Lighthouse"
3. Select a test file (try different sizes: small <1MB, medium 1-10MB)
4. Wait for upload to complete

**Expected Results:**

- ✅ File picker dialog opens
- ✅ Progress bar shows upload percentage
- ✅ Success message displays with file hash
- ✅ "Copy Hash" button copies hash to clipboard
- ✅ Lighthouse Storage panel refreshes automatically
- ✅ Status bar shows success message

**Files to Test:**

- Small text file (< 1KB)
- Medium file (1-5MB)
- Large file (10MB+) - should handle or show appropriate error
- Different file types: .txt, .json, .md, .js, .py, .csv

**Error Scenarios:**

- Cancel file selection → Should exit gracefully
- Upload timeout → Should show helpful error message
- Network interruption → Should handle gracefully

---

### Test 5: Create Dataset

**Objective:** Test AI dataset creation

**Steps:**

1. Click the database icon in Lighthouse Storage panel, OR
2. Use Command Palette: "Lighthouse: Create AI Dataset"
3. Enter dataset name (test valid and invalid names)
4. Enter optional description
5. Confirm creation

**Expected Results:**

- ✅ Input box validates dataset name format
- ✅ Only allows alphanumeric, hyphens, and underscores
- ✅ Rejects empty names
- ✅ Progress indicator shows "Creating dataset"
- ✅ Success message with "View Dataset" option
- ✅ Panel refreshes to show new dataset

**Test Cases:**

- Valid name: `my-ai-dataset-123`
- Invalid names to reject:
  - Empty string
  - Special characters: `my@dataset`, `dataset!`
  - Spaces: `my dataset`

---

### Test 6: Refresh Tree View

**Objective:** Verify tree view refresh functionality

**Steps:**

1. Upload a file or create a dataset
2. Click the refresh icon in Lighthouse Storage panel, OR
3. Use Command Palette: "Lighthouse: Refresh"

**Expected Results:**

- ✅ Tree view updates with latest data
- ✅ New files/datasets appear
- ✅ Status bar shows "Lighthouse files refreshed"
- ✅ No duplicate entries

---

### Test 7: Open File

**Objective:** Test file download and viewing

**Steps:**

1. Ensure you have uploaded files in your Lighthouse account
2. Refresh the tree view
3. Click on a file in the Lighthouse Storage panel
4. Wait for download

**Expected Results:**

- ✅ Progress indicator shows download percentage
- ✅ File opens in new editor tab
- ✅ Content displays correctly
- ✅ Syntax highlighting applied based on file extension
- ✅ Status bar shows "File downloaded"

**File Types to Test:**

- Text files (.txt, .md)
- Code files (.js, .ts, .py)
- JSON files (.json)
- Configuration files (.yml, .yaml)

---

### Test 8: Open Dataset

**Objective:** Test dataset viewing functionality

**Steps:**

1. Create a dataset (or use existing one)
2. Click on the dataset in the tree view
3. View dataset information

**Expected Results:**

- ✅ Dataset information displays
- ✅ "View Files" and "Copy ID" options appear
- ✅ Clicking "Copy ID" copies dataset ID to clipboard
- ✅ Status bar shows "Dataset loaded"

---

### Test 9: Connect to MCP Server

**Objective:** Test MCP server connection

**Steps:**

1. Start the MCP server locally (if available):
   ```bash
   cd apps/mcp-server
   pnpm run dev
   ```
2. Use Command Palette: "Lighthouse: Connect to MCP Server"
3. Enter MCP server URL (default: `http://localhost:3000`)
4. Confirm connection

**Expected Results:**

- ✅ URL validation works (rejects invalid URLs)
- ✅ Progress indicator shows "Connecting to MCP Server"
- ✅ Success message with "Test Tools" option
- ✅ Configuration saved to workspace settings

**Error Scenarios:**

- Invalid URL format → Should show validation error
- Server not running → Should show connection error
- Wrong port → Should show connection error

---

### Test 10: Configuration Changes

**Objective:** Test dynamic configuration updates

**Steps:**

1. Open Settings
2. Change API key
3. Observe extension behavior
4. Change MCP Server URL
5. Test connection with new settings

**Expected Results:**

- ✅ Extension detects configuration changes
- ✅ SDK reinitializes with new API key
- ✅ Status bar shows "Configuration updated"
- ✅ No need to reload VSCode

---

### Test 11: Command Palette Integration

**Objective:** Verify all commands are accessible

**Steps:**

1. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Type "Lighthouse"
3. Verify all commands appear

**Expected Commands:**

- ✅ Lighthouse: Upload File to Lighthouse
- ✅ Lighthouse: Create AI Dataset
- ✅ Lighthouse: Connect to MCP Server
- ✅ Lighthouse: Refresh
- ✅ Lighthouse: Test Connection

---

### Test 12: Tree View Icons and Actions

**Objective:** Test tree view UI elements

**Steps:**

1. Locate the Lighthouse Storage panel
2. Verify all toolbar icons are present
3. Click each icon to test functionality

**Expected Icons:**

- ✅ Refresh icon (circular arrow)
- ✅ Upload icon (cloud with up arrow)
- ✅ Create Dataset icon (database)
- ✅ Test Connection icon (plug/disconnect)

---

### Test 13: Error Handling

**Objective:** Verify graceful error handling

**Test Scenarios:**

**A. Network Timeout**

1. Disconnect internet
2. Try to upload a file
3. Verify error message is helpful

**B. Invalid API Key**

1. Set invalid API key in settings
2. Try any operation
3. Verify clear error message

**C. Large File Upload**

1. Try uploading a very large file (>100MB)
2. Verify timeout handling or progress indication

**Expected Results:**

- ✅ All errors show user-friendly messages
- ✅ Timeout errors include troubleshooting tips
- ✅ Network errors suggest checking connection
- ✅ API key errors direct to settings

---

### Test 14: Progress Tracking

**Objective:** Verify progress indicators work correctly

**Steps:**

1. Upload a medium-sized file (5-10MB)
2. Observe progress indicator
3. Download a file
4. Observe progress indicator

**Expected Results:**

- ✅ Progress bar appears during operations
- ✅ Percentage updates in real-time
- ✅ Progress messages are clear
- ✅ Progress completes or fails appropriately

---

### Test 15: Multi-Workspace Support

**Objective:** Test extension in multi-root workspace

**Steps:**

1. Create a multi-root workspace
2. Open multiple folders
3. Test extension functionality

**Expected Results:**

- ✅ Extension activates in multi-root workspace
- ✅ Settings can be workspace-specific
- ✅ All commands work correctly

---

## Performance Testing

### Load Testing

1. **Large File List**
   - Upload 50+ files
   - Refresh tree view
   - Verify performance is acceptable

2. **Rapid Operations**
   - Upload multiple files in quick succession
   - Verify queue handling

3. **Memory Usage**
   - Monitor VSCode memory during operations
   - Check for memory leaks after extended use

---

## Regression Testing Checklist

After any code changes, verify:

- [ ] Extension activates without errors
- [ ] All commands appear in Command Palette
- [ ] Tree view renders correctly
- [ ] File upload works
- [ ] File download works
- [ ] Dataset creation works
- [ ] Configuration changes apply
- [ ] Error messages are helpful
- [ ] Progress indicators work
- [ ] Status bar updates correctly

---

## Testing on Different Platforms

Test the extension on:

- [ ] macOS (Intel)
- [ ] macOS (Apple Silicon)
- [ ] Windows 10/11
- [ ] Linux (Ubuntu/Debian)

---

## Reporting Issues

When reporting bugs, include:

1. **Environment:**
   - VSCode version
   - Extension version
   - Operating system
   - Node.js version

2. **Steps to Reproduce:**
   - Detailed step-by-step instructions
   - Sample files if applicable

3. **Expected vs Actual Behavior:**
   - What should happen
   - What actually happened

4. **Logs:**
   - Check Output > Lighthouse
   - Check Developer Tools Console (Help > Toggle Developer Tools)
   - Include relevant error messages

5. **Screenshots/Videos:**
   - Visual evidence of the issue

---

## Automated Testing

While this guide focuses on manual testing, consider:

- Running unit tests: `pnpm test`
- Running with coverage: `pnpm test:coverage`
- Checking types: `pnpm run build:tsc`
- Linting: `pnpm run lint`

---

## Tips for Effective Testing

1. **Test in Clean Environment:** Use a fresh VSCode profile to avoid conflicts
2. **Test Edge Cases:** Empty inputs, special characters, large files
3. **Test Error Paths:** Intentionally cause errors to verify handling
4. **Test User Workflows:** Complete end-to-end scenarios
5. **Document Findings:** Keep notes on what works and what doesn't
6. **Test Incrementally:** After each code change, run relevant tests

---

## Quick Test Script

For rapid smoke testing, run through this checklist:

```
[ ] Extension loads
[ ] API key configured
[ ] Test connection succeeds
[ ] Upload small file
[ ] View uploaded file
[ ] Create dataset
[ ] Refresh tree view
[ ] All commands accessible
```

Time estimate: 5-10 minutes

---

## Support

For questions or issues:

- Check the [main README](../../README.md)
- Review [SDK integration guide](../../apps/docs/guides/sdk-integration.md)
- Open an issue on GitHub
