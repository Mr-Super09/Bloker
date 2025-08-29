# Overview

Bloker is a real-time multiplayer web application that combines Blackjack and Poker mechanics into a unique card game. Players engage in 1v1 matches where they deal initial cards, place bets, and use strategic hitting/staying decisions to get closest to 21 without busting. The application features user authentication, game lobbies, challenges, and real-time chat functionality.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Components**: Shadcn/ui component library built on Radix UI primitives for consistent, accessible design
- **Styling**: Tailwind CSS with custom CSS variables for theming, featuring a dark gaming aesthetic with purple/pink gradients
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation for type-safe form handling

## Backend Architecture
- **Runtime**: Node.js with Express.js server framework
- **Language**: TypeScript with ES modules
- **Authentication**: Replit Auth integration with OpenID Connect for user sessions
- **Session Storage**: PostgreSQL-based session store using connect-pg-simple
- **API Design**: RESTful endpoints with consistent error handling and request/response logging

## Game Engine
- **Real-time Updates**: Polling-based approach with 2-5 second intervals for game state synchronization
- **Game Logic**: Centralized game engine handling deck creation, shuffling, card dealing, hand value calculations, and win/loss determination
- **State Management**: Game states tracked through PostgreSQL with enum-based state transitions (waiting_for_players, setting_up, betting, playing, finished)

## Data Storage
- **Database**: PostgreSQL with Neon serverless driver
- **ORM**: Drizzle ORM with type-safe schema definitions and migrations
- **Schema Design**: 
  - Users table with profile data, stats (wins/losses/winnings), and online status
  - Games table with JSON-stored game state including hands, deck, and betting information
  - Challenges table for player-to-player game invitations
  - Chat messages table for in-game communication
  - Sessions table for Replit Auth integration

## Authentication & Authorization
- **Provider**: Replit Auth with automatic user provisioning
- **Session Management**: Secure HTTP-only cookies with PostgreSQL session storage
- **User States**: Online/offline tracking with automatic cleanup
- **Authorization**: Route-level protection with middleware-based authentication checks

# External Dependencies

## Core Infrastructure
- **Database**: Neon PostgreSQL serverless database for data persistence
- **Authentication**: Replit Auth service for user identity management
- **Hosting**: Replit platform with integrated development and deployment

## UI & Styling
- **Component Library**: Radix UI primitives for accessible, unstyled components
- **Styling Framework**: Tailwind CSS for utility-first styling approach
- **Fonts**: Inter font family from Google Fonts for consistent typography
- **Icons**: Lucide React for consistent iconography

## Development Tools
- **Build System**: Vite with React plugin for fast development and optimized builds
- **Type Checking**: TypeScript for compile-time type safety
- **Validation**: Zod for runtime schema validation and type inference
- **Database Toolkit**: Drizzle Kit for migrations and database management

## Runtime Libraries
- **HTTP Client**: Fetch API with custom wrapper for consistent error handling
- **Date Handling**: date-fns for date formatting and manipulation
- **Utilities**: clsx and tailwind-merge for conditional styling
- **Development**: tsx for TypeScript execution and hot reloading