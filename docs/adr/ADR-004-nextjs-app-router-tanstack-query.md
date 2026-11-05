# ADR-004: Next.js App Router + Tailwind CSS + TanStack Query for Clinic Frontend

## Status
Accepted (2026-10-29)

## Context
FastRev initially prototyped its staff interface as a Vite + React 18 SPA with custom CSS and Redux Toolkit / RTK Query. As the platform grows to support multi-role clinic workflows (`admin`, `doctor`, and `patient` views), operational dashboards, and production container deployments without an external Nginx static wrapper, we need:
- File-system routing with nested role-aware layouts (`(auth)` vs. `(dashboard)` route groups).
- Rapid, consistent UI styling for dense clinical tables, badges, and forms via Tailwind CSS.
- Focused server-state caching, background refetching, and optimistic/invalidated mutations via TanStack Query v5.

## Decision
1. Migrate `/frontend` to **Next.js (App Router + TypeScript + Tailwind CSS)** configured with `output: 'standalone'` for lean Docker images.
2. Use **TanStack Query v5 (`@tanstack/react-query`)** for all API server state (`patients`, `doctors`, `appointments`, `risk-profile`) paired with a lightweight typed Auth context for JWT session and role (`admin | doctor | patient`) gating.
3. Standardize browser API configuration on `NEXT_PUBLIC_API_URL` (defaulting to `http://localhost:4000/api/v1`).

## Consequences
- **Positive**: Clean route-group layouts, built-in TypeScript/ESLint/Tailwind integration, automatic request deduplication and cache invalidation on status/prediction updates, and single-container Node standalone runtime in Docker.
- **Trade-off**: Client-authenticated dashboard views use `'use client'` boundaries for interactive filters and mutations while preserving App Router layouts and metadata at the route level.
