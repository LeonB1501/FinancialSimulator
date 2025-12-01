export const environment = {
  production: false,
  // 1. UPDATE PORT: 5000 -> 5069
  apiUrl: 'http://localhost:5069/api',
  wasmUrl: '/assets/wasm/quantsim.wasm',
  auth: {
    clientId: 'quantsim-dev',
    issuer: 'http://localhost:8080/realms/quantsim',
    redirectUri: 'http://localhost:4200/callback',
  },
  features: {
    enableWasm: true,
    // 2. DISABLE MOCKS: Ensure we hit the real C# API
    enableMockData: false,
    enableDevTools: true,
  },
  simulation: {
    defaultIterations: 10000,
    maxIterations: 100000,
    defaultGranularity: 'weekly',
  },
};