import type {ThemeMode} from './App';

export interface MarkdownFilePayload {
  filePath: string;
  content: string;
}

export interface SaveMarkdownPayload {
  filePath?: string | null;
  content: string;
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
  onMenuCommand: (callback: (message: MenuCommandMessage) => void) => () => void;
}

declare global {
  interface Window {
    alunReader?: AlunReaderApi;
  }
}

export {};
