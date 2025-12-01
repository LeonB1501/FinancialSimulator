export const environment = {
  production: true,
  apiUrl: 'https://api.quantsim.app/api',
  wasmUrl: '/assets/wasm/quantsim.wasm',
  auth: {
    clientId: 'quantsim-prod',
    issuer: 'https://auth.quantsim.app/realms/quantsim',
    redirectUri: 'https://app.quantsim.app/callback',
  },
  features: {
    enableWasm: true,
    enableMockData: false,
    enableDevTools: false,
  },
  simulation: {
    defaultIterations: 10000,
    maxIterations: 100000,
    defaultGranularity: 'weekly',
  },
};
