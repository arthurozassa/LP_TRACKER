# Demo/Production Mode Toggle Implementation

This document provides an overview of the demo/production mode toggle feature implementation for the LP Tracker application.

## Overview

The mode toggle feature allows users to seamlessly switch between:
- **Demo Mode**: Sample data and simulated features for exploration
- **Production Mode**: Live data from real protocols and APIs

## Architecture

### 1. React Context for Mode Management (`src/contexts/ModeContext.tsx`)

The `ModeContext` provides centralized state management for the application mode:

**Key Features:**
- Persistent mode selection using localStorage
- Smooth mode transitions with loading states
- Integration with production infrastructure
- Error handling for mode switches
- Environment detection and validation

**Usage:**
```typescript
import { useMode, useIsDemo, useIsProduction } from '../contexts/ModeContext';

function MyComponent() {
  const { mode, toggleMode, isTransitioning } = useMode();
  const isDemo = useIsDemo();
  const isProduction = useIsProduction();
  
  // Use mode-specific logic
}
```

### 2. Mode Toggle UI Component (`src/components/ui/ModeToggle.tsx`)

Professional toggle component with Token Terminal aesthetic:

**Features:**
- Visual toggle switch with animated transitions
- Mode status indicators (Demo/Production)
- Interactive tooltips explaining mode differences
- Multiple size variants (sm, md, lg)
- Configurable labels and help text
- Loading states during transitions
- Error display for failed mode switches

**Variants:**
- `ModeToggle`: Full-featured version
- `CompactModeToggle`: Minimal version for headers
- `FullModeToggle`: Large version for settings pages

### 3. Production Data Services (`src/services/productionScanner.ts`)

Production-grade scanning service that integrates with real APIs:

**Features:**
- Real-time wallet scanning
- Protocol-specific API integration
- Advanced caching with TTL
- Rate limiting and retry logic
- Health monitoring
- Service metrics collection
- Error handling with fallbacks

### 4. Updated Main Page Component (`src/app/page.tsx`)

Enhanced to support mode-aware functionality:

**Features:**
- Conditional data loading based on current mode
- Mode-specific UI elements and messaging
- Visual mode indicators in header
- Demo addresses (only shown in demo mode)
- Production mode guidance
- Smooth transitions between modes
- Error states for failed operations

### 5. Context Provider Integration (`src/app/layout.tsx`)

The `ModeProvider` is integrated at the app level to provide mode context throughout the application.

## Features

### Visual Indicators

1. **Header Mode Indicator**: Shows current mode with colored badge
2. **Toggle Component**: Interactive switch with icons and labels
3. **Loading States**: Smooth transitions with progress indicators
4. **Error States**: Clear error messages for failed operations

### Mode Differences

#### Demo Mode
- ✅ Sample wallet data from demo addresses
- ✅ Simulated analytics and metrics
- ✅ All UI components functional
- ✅ No API rate limits
- ✅ Instant loading (simulated delays)
- ✅ Safe for demonstrations and testing

#### Production Mode
- ⚡ Live position data from real protocols
- ⚡ Real-time price feeds and updates
- ⚡ Actual protocol integrations
- ⚡ Production-grade analytics
- ⚡ API rate limiting and caching
- ⚡ Longer loading times (real API calls)

### Persistent State

The mode selection is automatically saved to localStorage and restored on page reload:

```typescript
// Storage keys used
const MODE_STORAGE_KEY = 'LP_TRACKER_MODE_PREFERENCE';
const MODE_OVERRIDE_KEY = 'LP_TRACKER_MODE_OVERRIDE'; // For dev overrides
```

### Tooltips and Help

Interactive help system explains the differences between modes:

- **Demo Mode Tooltip**: Lists sample data features and capabilities
- **Production Mode Tooltip**: Explains live data and real integrations
- **Welcome State**: Mode-specific onboarding information
- **Feature Comparison**: Side-by-side comparison in welcome screen

## Integration Points

### 1. Data Loading
```typescript
if (isDemo) {
  // Load mock data from demo service
  const mockData = getMockDataByAddress(address);
  return mockData;
} else {
  // Load live data from production APIs
  const productionScanner = getProductionScanner();
  const response = await productionScanner.scanWallet(address, chain);
  return response.data;
}
```

### 2. UI Conditional Rendering
```typescript
{isDemo && (
  <div className="demo-only-content">
    <h3>Try Demo Addresses</h3>
    {/* Demo addresses */}
  </div>
)}

{isProduction && (
  <div className="production-only-content">
    <p>Live data from real protocols</p>
  </div>
)}
```

### 3. Configuration Management
The system integrates with existing production infrastructure:

- Environment detection (`src/production/utils/mode-detection.ts`)
- Feature flags (`src/production/config/environment.ts`)
- Service configuration (`src/production/services/base.ts`)

## Usage Examples

### Basic Mode Toggle
```jsx
import { ModeToggle } from '../components/ui';

function Header() {
  return (
    <div className="header">
      <ModeToggle size="md" showLabels={true} />
    </div>
  );
}
```

### Mode-Aware Component
```jsx
import { useMode } from '../contexts/ModeContext';

function DataDisplay() {
  const { isDemo, dataSource } = useMode();
  
  return (
    <div>
      <p>Data Source: {dataSource}</p>
      {isDemo && <DemoNotice />}
      <DataVisualization />
    </div>
  );
}
```

### Checking Mode in Logic
```typescript
import { useIsDemo, useIsProduction } from '../contexts/ModeContext';

function useDataFetching(address: string) {
  const isDemo = useIsDemo();
  const isProduction = useIsProduction();
  
  const fetchData = useCallback(async () => {
    if (isDemo) {
      return await fetchDemoData(address);
    } else {
      return await fetchProductionData(address);
    }
  }, [isDemo, address]);
  
  return { fetchData };
}
```

## Configuration

### Environment Variables
```bash
# Set default mode (overridden by user preference)
NEXT_PUBLIC_APP_MODE=demo  # or 'production'

# Production feature flags
ENABLE_REAL_TIME_UPDATES=true
ENABLE_ADVANCED_ANALYTICS=true
ENABLE_YIELD_OPTIMIZATION=false
```

### localStorage Keys
```typescript
// User's preferred mode
localStorage.getItem('LP_TRACKER_MODE_PREFERENCE');

// Development override (takes precedence)
localStorage.getItem('LP_TRACKER_MODE_OVERRIDE');
```

## Error Handling

The system includes comprehensive error handling:

1. **Mode Transition Errors**: Failed switches show error messages
2. **API Failures**: Production mode gracefully handles API errors
3. **Configuration Issues**: Invalid configurations are caught and logged
4. **Network Issues**: Retries and fallbacks for network failures

## Performance Considerations

1. **Lazy Loading**: Production services are only loaded when needed
2. **Caching**: Intelligent caching reduces API calls
3. **Rate Limiting**: Prevents API abuse in production mode
4. **Memory Management**: Cleanup of unused resources during mode switches

## Testing

The implementation includes example components for testing:

- `ModeToggle.example.tsx`: Visual component examples
- Development utilities for mode switching
- Integration with existing demo data infrastructure

## Security

1. **API Key Protection**: Production API keys secured with environment variables
2. **Rate Limiting**: Prevents abuse of external APIs
3. **Input Validation**: All user inputs validated before processing
4. **CORS Configuration**: Proper CORS setup for production endpoints

---

This implementation provides a seamless experience for users to explore the LP Tracker with sample data or use it with real, live protocol integrations.