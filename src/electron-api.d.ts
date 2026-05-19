import type {ThemeMode} from './App';

export interface MarkdownFilePayload {
  filePath: string;
  content: string;
}

export interface SaveMarkdownPayload {
  filePath?: string | null;
  content: string;
}

export interface UpdateAssetPayload {
  name: string;
  browser_download_url: string;
}

export interface UpdateDownloadResult {
  filePath: string;
  opened: boolean;
  openError?: string;
}

export interface MenuCommandMessage {
  command: 'new' | 'open' | 'open-recent' | 'load-document' | 'save' | 'save-as' | 'set-theme' | 'toggle-editor' | 'toggle-zen';
  payload?: {
    filePath?: string;
    content?: string;
    theme?: ThemeMode;
  };
}

export interface AlunReaderApi {
  openMarkdown: () => Promise<MarkdownFilePayload | null>;
  openRecent: (filePath: string) => Promise<MarkdownFilePayload>;
  saveMarkdown: (payload: SaveMarkdownPayload) => Promise<{filePath: string} | null>;
  newWindow: () => Promise<void>;
  downloadUpdate: (asset: UpdateAssetPayload) => Promise<UpdateDownloadResult>;
  onMenuCommand: (callback: (message: MenuCommandMessage) => void) => () => void;
}

declare global {
  interface Window {
    alunReader?: AlunReaderApi;
  }
}

export {};
