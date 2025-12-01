import { Component, inject, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'qs-landing',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <!-- Header -->
    <header class="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm shadow-soft">
        <div class="max-w-7xl mx-auto px-6 lg:px-12">
            <div class="flex items-center justify-between h-20">
                <!-- Logo -->
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 bg-gradient-to-br from-accent-500 to-accent-600 rounded-lg flex items-center justify-center">
                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                        </svg>
                    </div>
                    <span class="text-2xl font-bold text-primary-600">QuantSim</span>
                </div>
                
                <!-- Navigation -->
                <nav class="hidden md:flex items-center space-x-8">
                    <a href="#features" class="text-surface-600 hover:text-primary-600 transition-colors">Features</a>
                    <a href="#how-it-works" class="text-surface-600 hover:text-primary-600 transition-colors">How It Works</a>
                    <button (click)="scrollToAuth()" class="text-surface-600 hover:text-primary-600 transition-colors">Sign In</button>
                    <button (click)="scrollToAuth()" class="px-5 py-2.5 bg-accent-500 text-white font-medium rounded-lg hover:bg-accent-600 transition-colors shadow-soft hover:shadow-medium">
                        Get Started
                    </button>
                </nav>

                <!-- Mobile menu button -->
                <button class="md:hidden p-2 text-surface-600">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
                    </svg>
                </button>
            </div>
        </div>
    </header>

    <!-- Hero Section -->
    <section class="gradient-bg min-h-screen flex items-center pt-20 relative overflow-hidden">
        <!-- Background decoration -->
        <div class="absolute inset-0 opacity-10">
            <svg class="w-full h-full" viewBox="0 0 1200 800">
                <defs>
                    <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" style="stop-color:#00D4AA;stop-opacity:0.3" />
                        <stop offset="100%" style="stop-color:#00D4AA;stop-opacity:0" />
                    </linearGradient>
                </defs>
                <!-- Simulated Monte Carlo paths -->
                <path d="M0,400 Q200,350 400,380 T800,320 T1200,400" stroke="url(#lineGradient)" stroke-width="2" fill="none" class="path-animation" style="stroke-dasharray: 1000;"/>
                <path d="M0,420 Q250,380 500,450 T900,380 T1200,420" stroke="url(#lineGradient)" stroke-width="2" fill="none" class="path-animation" style="stroke-dasharray: 1000; animation-delay: 0.5s;"/>
                <path d="M0,380 Q300,320 600,400 T1000,350 T1200,380" stroke="url(#lineGradient)" stroke-width="2" fill="none" class="path-animation" style="stroke-dasharray: 1000; animation-delay: 1s;"/>
                <path d="M0,440 Q200,500 450,420 T850,480 T1200,440" stroke="url(#lineGradient)" stroke-width="2" fill="none" class="path-animation" style="stroke-dasharray: 1000; animation-delay: 1.5s;"/>
                <path d="M0,360 Q350,280 600,340 T950,300 T1200,360" stroke="url(#lineGradient)" stroke-width="2" fill="none" class="path-animation" style="stroke-dasharray: 1000; animation-delay: 2s;"/>
            </svg>
        </div>

        <div class="max-w-7xl mx-auto px-6 lg:px-12 py-20 relative z-10">
            <div class="text-center fade-in">
                <h1 class="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight max-w-4xl mx-auto">
                    Backtest Complex Investment Strategies with 
                    <span class="text-accent-400">Monte Carlo Precision</span>
                </h1>
                <p class="mt-6 text-lg md:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed">
                    Model multi-asset portfolios with options, leveraged ETFs, and custom strategies. 
                    Run thousands of simulations using Heston, GARCH, and regime-switching models. 
                    All in your browser.
                </p>
                <div class="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button (click)="scrollToAuth()" class="px-8 py-4 bg-accent-500 text-white font-semibold text-lg rounded-xl hover:bg-accent-400 transition-all shadow-large hover:shadow-glow transform hover:-translate-y-0.5">
                        Start Building Strategies
                    </button>
                    <a href="#features" class="px-8 py-4 bg-white/10 text-white font-medium text-lg rounded-xl hover:bg-white/20 transition-all border border-white/20">
                        See Example Strategies
                    </a>
                </div>
            </div>

            <!-- Hero visual -->
            <div class="mt-16 max-w-4xl mx-auto">
                <div class="glass rounded-2xl p-6 shadow-large">
                    <div class="bg-surface-900/50 rounded-xl p-4">
                        <div class="flex items-center space-x-2 mb-4">
                            <div class="w-3 h-3 rounded-full bg-red-400"></div>
                            <div class="w-3 h-3 rounded-full bg-yellow-400"></div>
                            <div class="w-3 h-3 rounded-full bg-green-400"></div>
                            <span class="ml-4 text-white/50 text-sm font-mono">strategy.dsl</span>
                        </div>
                        <pre class="text-sm font-mono text-white/80 overflow-x-auto"><code><span class="text-accent-400">define</span> long_leap <span class="text-accent-400">as:</span> <span class="text-blue-400">buy</span> 1 spy_540dte_70delta
<span class="text-accent-400">define</span> short_call <span class="text-accent-400">as:</span> <span class="text-blue-400">sell</span> 1 spy_30dte_20delta
<span class="text-accent-400">define</span> calendar_spread <span class="text-accent-400">as:</span> 1 long_leap <span class="text-purple-400">and</span> 1 short_call

<span class="text-accent-400">when</span> spy > spy_sma_200 <span class="text-purple-400">and</span> spy_vol < 0.25:
    <span class="text-blue-400">buy_max</span> calendar_spread
<span class="text-accent-400">else:</span>
    <span class="text-blue-400">sell_all</span> calendar_spread
    <span class="text-blue-400">buy_max</span> t_bills</code></pre>
                    </div>
                </div>
            </div>
        </div>

        <!-- Scroll indicator -->
        <div class="absolute bottom-8 left-1/2 transform -translate-x-1/2 scroll-indicator">
            <svg class="w-6 h-6 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
            </svg>
        </div>
    </section>

    <!-- Features Section -->
    <section id="features" class="py-24 bg-surface-50">
        <div class="max-w-7xl mx-auto px-6 lg:px-12">
            <div class="text-center mb-16">
                <span class="text-sm font-semibold text-accent-500 uppercase tracking-wider">Capabilities</span>
                <h2 class="mt-3 text-3xl md:text-4xl font-bold text-surface-900">
                    Everything You Need to Model Complex Strategies
                </h2>
            </div>

            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                <!-- Feature 1 -->
                <div class="bg-white p-8 rounded-2xl shadow-soft hover:shadow-medium transition-shadow">
                    <div class="w-14 h-14 bg-primary-100 rounded-xl flex items-center justify-center mb-6">
                        <svg class="w-7 h-7 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                        </svg>
                    </div>
                    <h3 class="text-xl font-semibold text-surface-900 mb-3">Monte Carlo Simulations</h3>
                    <p class="text-surface-500 leading-relaxed">
                        Run thousands of correlated path simulations in your browser using WebAssembly for near-native performance.
                    </p>
                </div>

                <!-- Feature 2 -->
                <div class="bg-white p-8 rounded-2xl shadow-soft hover:shadow-medium transition-shadow">
                    <div class="w-14 h-14 bg-accent-100 rounded-xl flex items-center justify-center mb-6">
                        <svg class="w-7 h-7 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/>
                        </svg>
                    </div>
                    <h3 class="text-xl font-semibold text-surface-900 mb-3">5 Stochastic Models</h3>
                    <p class="text-surface-500 leading-relaxed">
                        Heston, GARCH, Regime-Switching, Blocked Bootstrap, and Geometric Brownian Motion for any market scenario.
                    </p>
                </div>

                <!-- Feature 3 -->
                <div class="bg-white p-8 rounded-2xl shadow-soft hover:shadow-medium transition-shadow">
                    <div class="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center mb-6">
                        <svg class="w-7 h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
                        </svg>
                    </div>
                    <h3 class="text-xl font-semibold text-surface-900 mb-3">Options & Spreads</h3>
                    <p class="text-surface-500 leading-relaxed">
                        Model complex spreads: calendars, iron condors, diagonals with automated collateral checking.
                    </p>
                </div>

                <!-- Feature 4 -->
                <div class="bg-white p-8 rounded-2xl shadow-soft hover:shadow-medium transition-shadow">
                    <div class="w-14 h-14 bg-amber-100 rounded-xl flex items-center justify-center mb-6">
                        <svg class="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                        </svg>
                    </div>
                    <h3 class="text-xl font-semibold text-surface-900 mb-3">Custom Tickers</h3>
                    <p class="text-surface-500 leading-relaxed">
                        Add your own assets with custom model parameters for any asset class — crypto, commodities, or hypothetical instruments.
                    </p>
                </div>

                <!-- Feature 5 -->
                <div class="bg-white p-8 rounded-2xl shadow-soft hover:shadow-medium transition-shadow">
                    <div class="w-14 h-14 bg-rose-100 rounded-xl flex items-center justify-center mb-6">
                        <svg class="w-7 h-7 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
                        </svg>
                    </div>
                    <h3 class="text-xl font-semibold text-surface-900 mb-3">Domain-Specific Language</h3>
                    <p class="text-surface-500 leading-relaxed">
                        Write sophisticated strategies with conditional logic, technical indicators, and position management rules.
                    </p>
                </div>

                <!-- Feature 6 -->
                <div class="bg-white p-8 rounded-2xl shadow-soft hover:shadow-medium transition-shadow">
                    <div class="w-14 h-14 bg-teal-100 rounded-xl flex items-center justify-center mb-6">
                        <svg class="w-7 h-7 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                    </div>
                    <h3 class="text-xl font-semibold text-surface-900 mb-3">Comprehensive Metrics</h3>
                    <p class="text-surface-500 leading-relaxed">
                        Sharpe ratio, Sortino ratio, drawdowns, wealth distributions, time-to-goal analysis, and probability metrics.
                    </p>
                </div>
            </div>
        </div>
    </section>

    <!-- How It Works Section -->
    <section id="how-it-works" class="py-24 bg-white">
        <div class="max-w-5xl mx-auto px-6 lg:px-12">
            <div class="text-center mb-16">
                <h2 class="text-3xl md:text-4xl font-bold text-surface-900">
                    Simple Workflow, Powerful Results
                </h2>
            </div>

            <div class="space-y-12">
                <!-- Step 1 -->
                <div class="flex items-start space-x-6">
                    <div class="flex-shrink-0 w-12 h-12 bg-accent-500 text-white rounded-full flex items-center justify-center font-bold text-xl">
                        1
                    </div>
                    <div>
                        <h3 class="text-xl font-semibold text-surface-900 mb-2">Configure Your Models</h3>
                        <p class="text-surface-500 leading-relaxed">
                            Select indices, set model parameters (Heston, GARCH, etc.), and define correlations between assets.
                        </p>
                    </div>
                </div>

                <!-- Step 2 -->
                <div class="flex items-start space-x-6">
                    <div class="flex-shrink-0 w-12 h-12 bg-accent-500 text-white rounded-full flex items-center justify-center font-bold text-xl">
                        2
                    </div>
                    <div>
                        <h3 class="text-xl font-semibold text-surface-900 mb-2">Define Your Strategy</h3>
                        <p class="text-surface-500 leading-relaxed">
                            Use our DSL to code trading rules, position sizing, and risk management with full syntax highlighting.
                        </p>
                    </div>
                </div>

                <!-- Step 3 -->
                <div class="flex items-start space-x-6">
                    <div class="flex-shrink-0 w-12 h-12 bg-accent-500 text-white rounded-full flex items-center justify-center font-bold text-xl">
                        3
                    </div>
                    <div>
                        <h3 class="text-xl font-semibold text-surface-900 mb-2">Run Simulations</h3>
                        <p class="text-surface-500 leading-relaxed">
                            Execute thousands of Monte Carlo paths in seconds, all client-side using WebAssembly.
                        </p>
                    </div>
                </div>

                <!-- Step 4 -->
                <div class="flex items-start space-x-6">
                    <div class="flex-shrink-0 w-12 h-12 bg-accent-500 text-white rounded-full flex items-center justify-center font-bold text-xl">
                        4
                    </div>
                    <div>
                        <h3 class="text-xl font-semibold text-surface-900 mb-2">Analyze Results</h3>
                        <p class="text-surface-500 leading-relaxed">
                            Interactive charts, deciles, sample paths, and comprehensive risk metrics to understand your strategy.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Auth Section -->
    <section id="auth" #authSection class="py-24 bg-primary-600">
        <div class="max-w-6xl mx-auto px-6 lg:px-12">
            <div class="grid lg:grid-cols-2 gap-16 items-center">
                <!-- Left: Value prop -->
                <div class="text-white">
                    <h2 class="text-3xl md:text-4xl font-bold mb-8">Start Backtesting Today</h2>
                    <ul class="space-y-4">
                        <li class="flex items-center space-x-3">
                            <svg class="w-6 h-6 text-accent-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                            </svg>
                            <span class="text-lg">Free tier with 1,000 simulations/month</span>
                        </li>
                        <li class="flex items-center space-x-3">
                            <svg class="w-6 h-6 text-accent-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                            </svg>
                            <span class="text-lg">No credit card required</span>
                        </li>
                        <li class="flex items-center space-x-3">
                            <svg class="w-6 h-6 text-accent-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                            </svg>
                            <span class="text-lg">Export results to PDF/CSV</span>
                        </li>
                        <li class="flex items-center space-x-3">
                            <svg class="w-6 h-6 text-accent-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                            </svg>
                            <span class="text-lg">Save unlimited strategies</span>
                        </li>
                    </ul>
                    <div class="mt-8 flex items-center space-x-4 text-white/70">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                        </svg>
                        <span class="text-sm">Your data is private. Simulations run locally in your browser.</span>
                    </div>
                </div>

                <!-- Right: Auth form -->
                <div class="bg-white rounded-2xl shadow-large p-8 lg:p-10">
                    <!-- Tabs -->
                    <div class="flex border-b border-surface-200 mb-8">
                        <button 
                            class="flex-1 py-3 text-center font-medium border-b-2 transition-colors"
                            [class.text-primary-600]="authMode === 'signup'"
                            [class.border-primary-600]="authMode === 'signup'"
                            [class.text-surface-400]="authMode !== 'signup'"
                            [class.border-transparent]="authMode !== 'signup'"
                            (click)="authMode = 'signup'"
                        >
                            Sign Up
                        </button>
                        <button 
                            class="flex-1 py-3 text-center font-medium border-b-2 transition-colors"
                            [class.text-primary-600]="authMode === 'signin'"
                            [class.border-primary-600]="authMode === 'signin'"
                            [class.text-surface-400]="authMode !== 'signin'"
                            [class.border-transparent]="authMode !== 'signin'"
                            (click)="authMode = 'signin'"
                        >
                            Sign In
                        </button>
                    </div>

                    <!-- Sign Up Form -->
                    <div *ngIf="authMode === 'signup'">
                        <!-- SSO Buttons -->
                        <div class="space-y-3 mb-6">
                            <button (click)="authService.loginWithGoogle()" class="w-full flex items-center justify-center space-x-3 px-4 py-3 border border-surface-200 rounded-lg hover:bg-surface-50 transition-colors">
                                <svg class="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                </svg>
                                <span class="text-surface-700 font-medium">Continue with Google</span>
                            </button>
                            <button (click)="authService.loginWithGithub()" class="w-full flex items-center justify-center space-x-3 px-4 py-3 border border-surface-200 rounded-lg hover:bg-surface-50 transition-colors">
                                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                                </svg>
                                <span class="text-surface-700 font-medium">Continue with GitHub</span>
                            </button>
                        </div>

                        <div class="relative mb-6">
                            <div class="absolute inset-0 flex items-center">
                                <div class="w-full border-t border-surface-200"></div>
                            </div>
                            <div class="relative flex justify-center text-sm">
                                <span class="px-4 bg-white text-surface-400">OR</span>
                            </div>
                        </div>

                        <form [formGroup]="registerForm" (ngSubmit)="onRegister()" class="space-y-5">
                            <div>
                                <label class="block text-sm font-medium text-surface-700 mb-2">Full Name</label>
                                <input type="text" formControlName="name" placeholder="John Doe" class="w-full px-4 py-3 border border-surface-200 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none transition-all">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-surface-700 mb-2">Email</label>
                                <input type="email" formControlName="email" placeholder="you@example.com" class="w-full px-4 py-3 border border-surface-200 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none transition-all">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-surface-700 mb-2">Password</label>
                                <input type="password" formControlName="password" placeholder="At least 8 characters" class="w-full px-4 py-3 border border-surface-200 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none transition-all">
                            </div>
                            <div class="flex items-start space-x-3">
                                <input type="checkbox" id="terms" class="mt-1 w-5 h-5 text-accent-500 border-surface-300 rounded focus:ring-accent-500">
                                <label for="terms" class="text-sm text-surface-600">
                                    I agree to the <a href="#" class="text-primary-600 hover:underline">Terms of Service</a> and <a href="#" class="text-primary-600 hover:underline">Privacy Policy</a>
                                </label>
                            </div>
                            <button type="submit" class="w-full py-3.5 bg-accent-500 text-white font-semibold rounded-lg hover:bg-accent-600 transition-colors shadow-soft">
                                Create Account
                            </button>
                        </form>
                    </div>

                    <!-- Sign In Form -->
                    <div *ngIf="authMode === 'signin'">
                        <!-- SSO Buttons -->
                        <div class="space-y-3 mb-6">
                            <button (click)="authService.loginWithGoogle()" class="w-full flex items-center justify-center space-x-3 px-4 py-3 border border-surface-200 rounded-lg hover:bg-surface-50 transition-colors">
                                <svg class="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                </svg>
                                <span class="text-surface-700 font-medium">Continue with Google</span>
                            </button>
                            <button (click)="authService.loginWithGithub()" class="w-full flex items-center justify-center space-x-3 px-4 py-3 border border-surface-200 rounded-lg hover:bg-surface-50 transition-colors">
                                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                                </svg>
                                <span class="text-surface-700 font-medium">Continue with GitHub</span>
                            </button>
                        </div>

                        <!-- Divider -->
                        <div class="relative mb-6">
                            <div class="absolute inset-0 flex items-center">
                                <div class="w-full border-t border-surface-200"></div>
                            </div>
                            <div class="relative flex justify-center text-sm">
                                <span class="px-4 bg-white text-surface-400">OR</span>
                            </div>
                        </div>

                        <!-- Email form -->
                        <form [formGroup]="loginForm" (ngSubmit)="onLogin()" class="space-y-5">
                            <div>
                                <label class="block text-sm font-medium text-surface-700 mb-2">Email</label>
                                <input type="email" formControlName="email" placeholder="you@example.com" class="w-full px-4 py-3 border border-surface-200 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none transition-all">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-surface-700 mb-2">Password</label>
                                <input type="password" formControlName="password" placeholder="Your password" class="w-full px-4 py-3 border border-surface-200 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none transition-all">
                                <div class="mt-2 text-right">
                                    <a href="#" class="text-sm text-primary-600 hover:underline">Forgot password?</a>
                                </div>
                            </div>
                            <button type="submit" class="w-full py-3.5 bg-accent-500 text-white font-semibold rounded-lg hover:bg-accent-600 transition-colors shadow-soft">
                                Sign In
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Footer -->
    <footer class="bg-surface-900 text-white py-16">
        <div class="max-w-7xl mx-auto px-6 lg:px-12">
            <div class="grid md:grid-cols-3 gap-12">
                <!-- Brand -->
                <div>
                    <div class="flex items-center space-x-3 mb-4">
                        <div class="w-10 h-10 bg-gradient-to-br from-accent-500 to-accent-600 rounded-lg flex items-center justify-center">
                            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                            </svg>
                        </div>
                        <span class="text-2xl font-bold">QuantSim</span>
                    </div>
                    <p class="text-surface-400 text-sm">
                        Professional-grade Monte Carlo backtesting for sophisticated investment strategies.
                    </p>
                    <p class="mt-4 text-surface-500 text-sm">© 2024 QuantSim. All rights reserved.</p>
                </div>

                <!-- Product Links -->
                <div>
                    <h4 class="text-sm font-semibold uppercase tracking-wider text-surface-400 mb-4">Product</h4>
                    <ul class="space-y-3">
                        <li><a href="#features" class="text-surface-300 hover:text-white transition-colors">Features</a></li>
                        <li><a href="#how-it-works" class="text-surface-300 hover:text-white transition-colors">How it Works</a></li>
                        <li><a href="#" class="text-surface-300 hover:text-white transition-colors">Documentation</a></li>
                        <li><a href="#" class="text-surface-300 hover:text-white transition-colors">Pricing</a></li>
                    </ul>
                </div>

                <!-- Legal -->
                <div>
                    <h4 class="text-sm font-semibold uppercase tracking-wider text-surface-400 mb-4">Legal</h4>
                    <ul class="space-y-3">
                        <li><a href="#" class="text-surface-300 hover:text-white transition-colors">Terms of Service</a></li>
                        <li><a href="#" class="text-surface-300 hover:text-white transition-colors">Privacy Policy</a></li>
                    </ul>
                </div>
            </div>
        </div>
    </footer>
  `
})
export class LandingComponent implements AfterViewInit {
  authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  @ViewChild('authSection') authSection!: ElementRef;

  authMode: 'signup' | 'signin' = 'signup';

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  registerForm: FormGroup = this.fb.group({
    name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  ngAfterViewInit(): void {
    this.route.fragment.subscribe(fragment => {
      if (fragment === 'auth') {
        setTimeout(() => {
          this.authSection.nativeElement.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    });
  }

  scrollToAuth() {
    this.authSection.nativeElement.scrollIntoView({ behavior: 'smooth' });
  }

  onLogin(): void {
    if (this.loginForm.invalid) return;
    this.authService.login(this.loginForm.value).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: () => {},
    });
  }

  onRegister(): void {
    if (this.registerForm.invalid) return;
    this.authService.register(this.registerForm.value).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: () => {},
    });
  }
}