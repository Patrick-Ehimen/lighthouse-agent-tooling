/**
 * VSCode API Mock
 * @fileoverview Mock implementation of VSCode API for testing
 */

export const window = {
  createStatusBarItem: jest.fn(() => ({
    text: "",
    show: jest.fn(),
    hide: jest.fn(),
    dispose: jest.fn(),
  })),
  showInformationMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  showInputBox: jest.fn(),
  showOpenDialog: jest.fn(),
  registerTreeDataProvider: jest.fn(),
  createTreeView: jest.fn(() => ({
    dispose: jest.fn(),
  })),
  withProgress: jest.fn((options, task) => {
    const progress = {
      report: jest.fn(),
    };
    const token = {
      onCancellationRequested: jest.fn(),
      isCancellationRequested: false,
    };
    return task(progress, token);
  }),
};

export const workspace = {
  getConfiguration: jest.fn(() => ({
    get: jest.fn(),
    update: jest.fn(),
  })),
  onDidChangeConfiguration: jest.fn(() => ({
    dispose: jest.fn(),
  })),
  workspaceFolders: [],
  name: "test-workspace",
  textDocuments: [],
  findFiles: jest.fn(() => Promise.resolve([])),
  openTextDocument: jest.fn(() =>
    Promise.resolve({
      uri: { fsPath: "/test/file.txt" },
    }),
  ),
};

export const commands = {
  registerCommand: jest.fn(() => ({
    dispose: jest.fn(),
  })),
  executeCommand: jest.fn(),
};

export const StatusBarAlignment = {
  Right: 2,
};

export const ConfigurationTarget = {
  Workspace: 2,
};

export const TreeItemCollapsibleState = {
  None: 0,
  Collapsed: 1,
  Expanded: 2,
};

export const ThemeIcon = jest.fn();

export const ProgressLocation = {
  Notification: 15,
};

export const ThemeColor = jest.fn();

export const Uri = {
  file: jest.fn((path: string) => ({ fsPath: path })),
};

export const env = {
  clipboard: {
    writeText: jest.fn(),
  },
};

export const extensions = {
  getExtension: jest.fn(() => ({
    packageJSON: { version: "1.0.0" },
  })),
};

export const version = "1.74.0";

export class TreeItem {
  constructor(
    public label: string,
    public collapsibleState?: number,
  ) {}

  contextValue?: string;
  tooltip?: string;
  iconPath?: any;
  command?: any;
}

export class EventEmitter<T> {
  private listeners: ((e: T) => void)[] = [];

  get event() {
    return (listener: (e: T) => void) => {
      this.listeners.push(listener);
      return {
        dispose: () => {
          const index = this.listeners.indexOf(listener);
          if (index >= 0) {
            this.listeners.splice(index, 1);
          }
        },
      };
    };
  }

  fire(data: T) {
    this.listeners.forEach((listener) => listener(data));
  }

  dispose() {
    this.listeners.length = 0;
  }
}
