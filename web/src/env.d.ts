/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_EDITION?: 'glb' | 'irn';
  readonly PUBLIC_API_BASE_URL?: string;
  readonly PUBLIC_ALLOW_DEV_AUTH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
