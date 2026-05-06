# AI_RULES.md - Cinépolis Inventory Management System

## Tech Stack

- **Frontend**: React 19 with TypeScript, TanStack Router for routing, TanStack Start for full-stack capabilities
- **UI Framework**: shadcn/ui components with Radix UI primitives and Tailwind CSS for styling
- **State Management**: TanStack Query for server state and React hooks for local state
- **Form Handling**: React Hook Form with Zod validation
- **Icons**: Lucide React for consistent iconography
- **Barcode Scanning**: html5-qrcode for mobile camera-based barcode scanning
- **Notifications**: Sonner for toast notifications
- **Backend**: Node.js with Express, MySQL2 for database, JWT for authentication
- **Database**: MySQL with connection pooling and transaction support
- **Authentication**: JWT tokens with bcrypt password hashing

## Component Architecture Rules

### 1. Component Organization
- **Pages**: Go in `src/pages/` and are route components
- **Components**: Go in `src/components/` and are reusable UI components
- **Services**: Go in `src/services/` and contain API communication logic
- **Types**: Go in `src/types/` and contain TypeScript interfaces
- **Hooks**: Go in `src/hooks/` and contain custom React hooks
- **Layouts**: Go in `src/components/layout/` and contain page layout components

### 2. Component Creation Rules
- **Never add new components to existing files** - create a new file for every component
- **Keep components under 100 lines** - refactor large components
- **Use shadcn/ui components** when available - don't reinvent the wheel
- **Create focused, single-purpose components** - avoid monolithic components
- **Use TypeScript interfaces** for all component props

### 3. Styling Rules
- **Always use Tailwind CSS classes** - no custom CSS files
- **Use the design system colors** from the CSS variables (primary, success, warning, destructive)
- **Make all designs responsive** - use responsive Tailwind classes
- **Use consistent spacing** - follow the spacing scale (p-4, p-6, etc.)
- **Use the PageHeader component** for all page titles and actions

### 4. API Integration Rules
- **Use the services/api.ts file** for all API calls
- **Always handle loading and error states** in components
- **Use TanStack Query** for server state management (when implemented)
- **Follow the backend API response format** - success, message, data, error
- **Use proper HTTP status codes** and error handling

### 5. Barcode Scanning Rules
- **Use the BarcodeScanner component** for all barcode scanning functionality
- **Use the BarcodeInput component** for manual barcode input with scanner option
- **Only show scanner button on mobile/tablet** - use useIsMobileOrTablet hook
- **Handle camera permissions gracefully** - show clear error messages
- **Use the html5-qrcode library** - don't implement custom scanning

### 6. Authentication Rules
- **Use the auth functions from services/api.ts** - getToken, getStoredUser, clearSession
- **Protect admin routes** with authentication middleware (when backend is connected)
- **Handle session expiration** - redirect to login when token is invalid
- **Store auth state in localStorage** - don't use React state for auth persistence

### 7. Form Handling Rules
- **Use React Hook Form** for all forms
- **Use Zod schemas** for form validation
- **Use shadcn/ui form components** - Input, Select, Switch, etc.
- **Show loading states** during form submission
- **Display toast notifications** for success/error feedback

### 8. Data Management Rules
- **Use TypeScript interfaces** for all data structures
- **Map backend data to frontend types** in services/api.ts
- **Handle empty states** with EmptyState components
- **Use proper error boundaries** for component errors
- **Implement proper loading states** for async operations

### 9. Navigation Rules
- **Use TanStack Router** for all navigation
- **Create route files** in `src/routes/` following the naming convention
- **Use Link components** for navigation - don't use window.location
- **Handle route transitions** properly - show loading states
- **Use proper route guards** for protected routes

### 10. Performance Rules
- **Use React.memo** for expensive components that don't change often
- **Use useCallback** for functions passed to child components
- **Implement proper cleanup** in useEffect hooks
- **Use lazy loading** for large components if needed
- **Optimize bundle size** - avoid unnecessary dependencies

### 11. Testing Rules
- **Write unit tests** for utility functions and hooks
- **Test critical user flows** - login, barcode scanning, form submission
- **Use React Testing Library** for component tests
- **Mock API calls** in tests - don't hit real endpoints
- **Test error scenarios** - network failures, invalid input

### 12. Code Quality Rules
- **Use ESLint and Prettier** - maintain consistent code style
- **Follow TypeScript best practices** - no any types, proper typing
- **Write meaningful commit messages** - follow conventional commits
- **Document complex functions** - add JSDoc comments
- **Refactor regularly** - keep code clean and maintainable

### 13. Security Rules
- **Never store sensitive data** in localStorage except auth tokens
- **Use HTTPS** for all API calls
- **Validate all user input** on both frontend and backend
- **Use proper CORS configuration** for API endpoints
- **Implement proper error handling** - don't expose sensitive error details

### 14. Accessibility Rules
- **Use semantic HTML** elements where appropriate
- **Provide proper ARIA labels** for interactive elements
- **Ensure keyboard navigation** works for all components
- **Use proper color contrast** - follow WCAG guidelines
- **Test with screen readers** - ensure accessibility compliance

### 15. Mobile Rules
- **Use responsive design** - test on various screen sizes
- **Implement touch-friendly** UI elements
- **Use proper viewport meta tags**
- **Test on actual mobile devices** - not just responsive viewports
- **Handle mobile-specific features** - camera permissions, vibration feedback