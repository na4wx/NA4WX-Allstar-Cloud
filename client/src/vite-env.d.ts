/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Absolute origin the API lives on, e.g. "https://api-allstar.example.com"
  // -- empty/unset means same-origin (see api/client.ts's apiUrl).
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
