export const environment = {
  production: false,
  apiUrl: 'http://localhost:5069/api',
  wasmUrl: '/assets/wasm/quantsim.wasm',
  auth: {
    clientId: 'quantsim-dev',
    issuer: 'http://localhost:8080/realms/quantsim',
    redirectUri: 'http://localhost:4200/callback',
  },
  features: {
    enableWasm: true,
    enableMockData: false,
    enableDevTools: true,
  },
  simulation: {
    defaultIterations: 10000,
    maxIterations: 100000,
    defaultGranularity: 'weekly',
  },
};