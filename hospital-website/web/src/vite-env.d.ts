/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API?: string;
  readonly VITE_WS?: string;
  readonly VITE_PLATFORM_ADMIN_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
