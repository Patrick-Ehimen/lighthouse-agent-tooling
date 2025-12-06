/**
 * Queue Status Command
 * @fileoverview Display operation queue status to user
 */

import * as vscode from "vscode";
import { OfflineMCPClient } from "../mcp/mcp-client-with-offline.js";
import { OperationStatus, ConnectionState } from "@lighthouse-tooling/shared";

export function registerQueueStatusCommand(
  context: vscode.ExtensionContext,
  mcpClient: OfflineMCPClient,
): vscode.Disposable {
  return vscode.commands.registerCommand("lighthouse.vscode.showQueueStatus", async () => {
    const stats = mcpClient.getQueueStats();
    const connectionState = mcpClient.getConnectionState();
    const operations = mcpClient.getAllQueuedOperations();

    // Create webview panel
    const panel = vscode.window.createWebviewPanel(
      "lighthouseQueueStatus",
      "Lighthouse Queue Status",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
      },
    );

    panel.webview.html = getQueueStatusHTML(stats, connectionState, operations);

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "retry":
            await mcpClient.retryOperation(message.operationId);
            vscode.window.showInformationMessage(`Retrying operation ${message.operationId}`);
            // Refresh view
            panel.webview.html = getQueueStatusHTML(
              mcpClient.getQueueStats(),
              mcpClient.getConnectionState(),
              mcpClient.getAllQueuedOperations(),
            );
            break;

          case "cancel":
            await mcpClient.cancelOperation(message.operationId);
            vscode.window.showInformationMessage(`Cancelled operation ${message.operationId}`);
            // Refresh view
            panel.webview.html = getQueueStatusHTML(
              mcpClient.getQueueStats(),
              mcpClient.getConnectionState(),
              mcpClient.getAllQueuedOperations(),
            );
            break;

          case "clearCompleted":
            const cleared = await mcpClient.clearCompleted();
            vscode.window.showInformationMessage(`Cleared ${cleared} completed operations`);
            // Refresh view
            panel.webview.html = getQueueStatusHTML(
              mcpClient.getQueueStats(),
              mcpClient.getConnectionState(),
              mcpClient.getAllQueuedOperations(),
            );
            break;

          case "refresh":
            panel.webview.html = getQueueStatusHTML(
              mcpClient.getQueueStats(),
              mcpClient.getConnectionState(),
              mcpClient.getAllQueuedOperations(),
            );
            break;
        }
      },
      undefined,
      context.subscriptions,
    );
  });
}

function getQueueStatusHTML(
  stats: any,
  connectionState: ConnectionState,
  operations: any[],
): string {
  const connectionIcon =
    connectionState === ConnectionState.CONNECTED
      ? "✅"
      : connectionState === ConnectionState.CONNECTING ||
          connectionState === ConnectionState.RECONNECTING
        ? "🔄"
        : "❌";

  const connectionText =
    connectionState === ConnectionState.CONNECTED
      ? "Connected"
      : connectionState === ConnectionState.CONNECTING
        ? "Connecting..."
        : connectionState === ConnectionState.RECONNECTING
          ? "Reconnecting..."
          : "Disconnected";

  const operationsHTML = operations
    .map((op) => {
      const statusIcon =
        op.status === OperationStatus.COMPLETED
          ? "✅"
          : op.status === OperationStatus.FAILED
            ? "❌"
            : op.status === OperationStatus.PROCESSING
              ? "🔄"
              : op.status === OperationStatus.CANCELLED
                ? "🚫"
                : "⏳";

      const actions =
        op.status === OperationStatus.FAILED
          ? `<button onclick="retry('${op.id}')">Retry</button>`
          : op.status === OperationStatus.PENDING
            ? `<button onclick="cancel('${op.id}')">Cancel</button>`
            : "";

      return `
        <tr>
          <td>${statusIcon} ${op.status}</td>
          <td>${op.type}</td>
          <td>${new Date(op.createdAt).toLocaleString()}</td>
          <td>${op.retryCount}/${op.maxRetries}</td>
          <td>${op.error || "-"}</td>
          <td>${actions}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: var(--vscode-font-family);
          color: var(--vscode-foreground);
          background-color: var(--vscode-editor-background);
          padding: 20px;
        }
        h1, h2 {
          color: var(--vscode-foreground);
        }
        .status-section {
          margin-bottom: 30px;
          padding: 15px;
          background-color: var(--vscode-editor-inactiveSelectionBackground);
          border-radius: 5px;
        }
        .stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 15px;
          margin-top: 15px;
        }
        .stat-card {
          padding: 10px;
          background-color: var(--vscode-input-background);
          border-radius: 3px;
          text-align: center;
        }
        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: var(--vscode-textLink-foreground);
        }
        .stat-label {
          font-size: 12px;
          color: var(--vscode-descriptionForeground);
          margin-top: 5px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 15px;
        }
        th, td {
          padding: 10px;
          text-align: left;
          border-bottom: 1px solid var(--vscode-panel-border);
        }
        th {
          background-color: var(--vscode-editor-selectionBackground);
          font-weight: bold;
        }
        button {
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          padding: 5px 10px;
          border-radius: 3px;
          cursor: pointer;
          margin-right: 5px;
        }
        button:hover {
          background-color: var(--vscode-button-hoverBackground);
        }
        .connection {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 16px;
        }
        .actions {
          margin-top: 15px;
        }
      </style>
    </head>
    <body>
      <h1>Lighthouse Operation Queue</h1>

      <div class="status-section">
        <h2>Connection Status</h2>
        <div class="connection">
          <span>${connectionIcon}</span>
          <strong>${connectionText}</strong>
        </div>
      </div>

      <div class="status-section">
        <h2>Queue Statistics</h2>
        <div class="stats">
          <div class="stat-card">
            <div class="stat-value">${stats.total}</div>
            <div class="stat-label">Total</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.pending}</div>
            <div class="stat-label">Pending</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.processing}</div>
            <div class="stat-label">Processing</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.completed}</div>
            <div class="stat-label">Completed</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.failed}</div>
            <div class="stat-label">Failed</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.cancelled}</div>
            <div class="stat-label">Cancelled</div>
          </div>
        </div>

        <div class="actions">
          <button onclick="refresh()">🔄 Refresh</button>
          <button onclick="clearCompleted()">🗑️ Clear Completed</button>
        </div>
      </div>

      <div class="status-section">
        <h2>Operations</h2>
        ${
          operations.length > 0
            ? `
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Type</th>
                <th>Created</th>
                <th>Retries</th>
                <th>Error</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${operationsHTML}
            </tbody>
          </table>
        `
            : "<p>No operations in queue</p>"
        }
      </div>

      <script>
        const vscode = acquireVsCodeApi();

        function retry(operationId) {
          vscode.postMessage({ command: 'retry', operationId });
        }

        function cancel(operationId) {
          vscode.postMessage({ command: 'cancel', operationId });
        }

        function clearCompleted() {
          vscode.postMessage({ command: 'clearCompleted' });
        }

        function refresh() {
          vscode.postMessage({ command: 'refresh' });
        }
      </script>
    </body>
    </html>
  `;
}
