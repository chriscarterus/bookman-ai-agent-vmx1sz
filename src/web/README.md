# Bookman AI Frontend Application

## Overview

Bookman AI is a comprehensive cryptocurrency education and investment platform built with React 18.2+ and TypeScript 5.0+. This frontend application provides an intuitive interface for cryptocurrency learning, market analysis, and portfolio management with enterprise-grade security features.

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- IDE with TypeScript support (recommended: VSCode)

## Quick Start

1. **Install Dependencies**
```bash
npm install
```

2. **Set Environment Variables**
Create a `.env` file in the project root:
```env
VITE_API_URL=<backend_api_url>
VITE_WS_URL=<websocket_url>
VITE_AUTH_DOMAIN=<auth_domain>
VITE_AUTH_CLIENT_ID=<client_id>
VITE_ENVIRONMENT=development
```

3. **Start Development Server**
```bash
npm run dev
```
The application will be available at `http://localhost:3000`

## Project Structure

```
src/
├── assets/          # Static assets (images, fonts, etc.)
├── components/      # Reusable UI components
├── config/         # Configuration files
├── features/       # Feature-based modules
├── hooks/          # Custom React hooks
├── layouts/        # Page layouts
├── lib/            # Utility functions and helpers
├── pages/          # Route components
├── services/       # API and external service integrations
├── store/          # State management
├── styles/         # Global styles and themes
└── types/          # TypeScript type definitions
```

## Available Scripts

### Development
```bash
npm run dev         # Start development server
npm run build       # Build production application
npm run preview     # Preview production build
```

### Testing
```bash
npm run test              # Run test suite
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Generate coverage report
npm run test:e2e         # Run end-to-end tests
```

### Code Quality
```bash
npm run lint             # Run ESLint checks
npm run lint:fix         # Fix ESLint issues
npm run format          # Format code with Prettier
npm run typecheck       # Run TypeScript checks
```

## Core Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2.0 | UI Framework |
| TypeScript | 5.0.0 | Type Safety |
| Material UI | 5.11.0 | Component Library |
| Vite | 4.3.0 | Build Tool |
| Jest | 29.5.0 | Testing Framework |
| ESLint | 8.38.0 | Code Linting |
| Prettier | 2.8.7 | Code Formatting |

## Development Guidelines

### Code Style
- Follow TypeScript strict mode guidelines
- Use functional components with hooks
- Implement proper error boundaries
- Write meaningful component and function names
- Document complex logic with JSDoc comments

### Component Structure
```typescript
import React from 'react';
import { useStyles } from './styles';

interface ComponentProps {
  // Props definition
}

export const Component: React.FC<ComponentProps> = ({ prop }) => {
  // Implementation
};
```

### Testing Standards
- Unit tests for utility functions
- Component tests with React Testing Library
- Integration tests for feature workflows
- E2E tests for critical user journeys
- Maintain >80% test coverage

## Security Best Practices

1. **Environment Variables**
   - Never commit `.env` files
   - Use appropriate environment configs
   - Validate environment variables at startup

2. **API Security**
   - Implement proper CORS policies
   - Use secure HTTP headers
   - Handle authentication tokens securely
   - Implement request rate limiting

3. **Data Handling**
   - Sanitize user inputs
   - Implement proper XSS protection
   - Use secure storage methods
   - Clear sensitive data on logout

## Build and Deployment

### Production Build
```bash
npm run build
```
This creates an optimized production build in the `dist` directory.

### Build Configuration
- Tree-shaking enabled
- Code splitting implemented
- Asset optimization
- Source maps generation
- Bundle size analysis

## Contributing

1. **Branch Naming**
   - feature/feature-name
   - bugfix/issue-description
   - hotfix/urgent-fix
   - release/version-number

2. **Commit Messages**
   - feat: Add new feature
   - fix: Bug fix
   - docs: Documentation changes
   - style: Code style updates
   - refactor: Code refactoring
   - test: Test updates
   - chore: Maintenance tasks

3. **Pull Request Process**
   - Create feature branch
   - Implement changes
   - Add/update tests
   - Update documentation
   - Submit PR with description
   - Address review comments
   - Merge after approval

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Clear node_modules and package-lock.json
   - Reinstall dependencies
   - Check Node.js version
   - Verify environment variables

2. **Development Server Issues**
   - Check port availability
   - Verify environment configuration
   - Clear browser cache
   - Check for conflicting processes

3. **Testing Issues**
   - Update test snapshots
   - Clear Jest cache
   - Check test environment
   - Verify mock implementations

## Support

For technical issues:
1. Check documentation
2. Search existing issues
3. Create detailed bug report
4. Contact development team

## License

Copyright © 2023 Bookman AI. All rights reserved.