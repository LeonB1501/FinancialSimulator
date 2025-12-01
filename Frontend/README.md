# QuantSim Frontend

A sophisticated Angular 17+ application for Monte Carlo investment strategy backtesting.

## Features

- **Multi-step Strategy Builder**: 6-step wizard for configuring simulations
- **5 Stochastic Models**: Heston, GBM, GARCH, Blocked Bootstrap, Regime-Switching
- **DSL Editor**: Domain-specific language for defining trading rules
- **Comprehensive Results**: Interactive charts, percentile analysis, risk metrics
- **Client-side WASM**: Simulations run in browser for privacy and scalability

## Tech Stack

- **Framework**: Angular 17+ with standalone components
- **State Management**: Angular Signals
- **UI Components**: Angular Material
- **Styling**: Tailwind CSS
- **Charts**: Chart.js with ng2-charts
- **Code Editor**: Monaco Editor (optional)

## Project Structure

```
src/
├── app/
│   ├── core/                    # Core functionality
│   │   ├── guards/              # Route guards
│   │   ├── interceptors/        # HTTP interceptors
│   │   ├── models/              # TypeScript interfaces/types
│   │   └── services/            # Singleton services
│   ├── shared/                  # Shared/reusable code
│   │   ├── components/          # Shared components
│   │   ├── directives/          # Custom directives
│   │   └── pipes/               # Custom pipes
│   └── features/                # Feature modules
│       ├── landing/             # Landing page
│       ├── auth/                # Authentication
│       ├── dashboard/           # User dashboard
│       ├── strategy-builder/    # Strategy creation wizard
│       │   └── steps/           # Wizard step components
│       ├── strategies/          # Strategy list
│       └── results/             # Simulation results
├── assets/                      # Static assets
├── environments/                # Environment configs
└── styles.scss                  # Global styles
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

### Development

```bash
# Start dev server with hot reload
ng serve

# Run tests
ng test

# Run linting
ng lint
```

## Design System

### Colors

- **Primary**: Deep Indigo/Navy (#1E3A5F, #2D5A87, #4A7FB5)
- **Accent**: Electric Teal (#00D4AA, #00F5C4, #00A080)
- **Surface**: Slate grays (#F8FAFC to #0F172A)
- **Semantic**: Success (#10B981), Warning (#F59E0B), Error (#EF4444)

### Typography

- **Primary**: Inter (UI text)
- **Monospace**: JetBrains Mono (code, tickers)

### Components

- Buttons: Primary, Secondary, Ghost variants
- Cards: Elevated with subtle shadows
- Forms: Material Design inputs with custom styling
- Charts: Clean minimal axes, custom color palette

## API Integration

The frontend expects a backend API at the URL configured in `environment.ts`:

```typescript
apiUrl: 'http://localhost:5000/api'
```

### Expected Endpoints

- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `GET /strategies` - List strategies
- `POST /strategies` - Create strategy
- `GET /strategies/:id` - Get strategy details
- `POST /strategies/:id/run` - Run simulation
- `GET /results/:id` - Get simulation results

## WASM Integration

The simulation engine can run client-side via WebAssembly:

```typescript
// WASM module is loaded from:
wasmUrl: '/assets/wasm/quantsim.wasm'
```

The WASM module should expose:
- `initialize()`: Initialize the engine
- `run(input, onProgress)`: Run simulation with progress callback
- `cancel()`: Cancel running simulation

## Environment Configuration

### Development (environment.ts)
```typescript
{
  production: false,
  apiUrl: 'http://localhost:5000/api',
  features: {
    enableWasm: true,
    enableMockData: true,
  }
}
```

### Production (environment.prod.ts)
```typescript
{
  production: true,
  apiUrl: 'https://api.quantsim.app/api',
  features: {
    enableWasm: true,
    enableMockData: false,
  }
}
```

## License

Proprietary - All rights reserved
