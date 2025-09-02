# Dashboard Components

A collection of glassmorphism-styled dashboard components for the LP Position Tracker application. These components provide comprehensive metrics display, data visualization, and filtering capabilities.

## Components

### MetricsCards
Displays key performance metrics in responsive card layout with glassmorphism styling.

**Features:**
- Total Value, Fees Earned, Average APR, Active Protocols
- Change indicators with color coding (positive/negative/neutral)
- Animated loading states
- Responsive grid layout (1-4 columns)
- Glassmorphism design with hover effects

**Usage:**
```tsx
import { MetricsCards } from './dashboard';

<MetricsCards 
  metrics={dashboardMetrics}
  loading={false}
/>
```

### ProtocolDistribution
Interactive pie chart showing value distribution across different protocols.

**Features:**
- Recharts PieChart integration
- Custom tooltips with detailed information
- Protocol-specific color theming
- Loading skeleton animation
- Empty state handling
- Summary statistics display

**Usage:**
```tsx
import { ProtocolDistribution } from './dashboard';

<ProtocolDistribution
  data={protocolData}
  loading={false}
  height={400}
  showLegend={true}
/>
```

### FilterPills
Protocol and chain filtering interface with pill-style buttons.

**Features:**
- Protocol filtering with visual indicators
- Optional chain filtering support
- Active/inactive states with hover effects
- Bulk select/deselect operations
- Loading states and disabled states
- Active filter summary

**Usage:**
```tsx
import { FilterPills } from './dashboard';

<FilterPills
  availableProtocols={protocols}
  selectedProtocols={selected}
  onProtocolToggle={handleToggle}
  onClearAll={handleClear}
  onSelectAll={handleSelectAll}
  loading={false}
  showChainFilter={true}
  availableChains={chains}
  selectedChains={selectedChains}
  onChainToggle={handleChainToggle}
/>
```

## Design System

### Glassmorphism Styling
All components use consistent glassmorphism design:
- `bg-white/10 backdrop-blur-md` - Semi-transparent background with blur effect
- `border border-white/20` - Subtle white borders
- `rounded-xl` - Rounded corners for modern look
- Gradient overlays and hover effects
- Smooth transitions and animations

### Color Scheme
- **Ethereum**: Pink/Blue gradients (#FF007A)
- **Solana**: Purple/Orange gradients (#9945FF, #FBA43A)
- **L2 Chains**: Chain-specific gradient variations
- **Success**: Green (#10B981)
- **Warning**: Yellow (#F59E0B) 
- **Error**: Red (#EF4444)
- **Neutral**: Gray tones

### Responsive Design
- Mobile-first approach
- Grid layouts that adapt to screen size
- Touch-friendly interactive elements
- Proper spacing and typography scaling

## TypeScript Integration

All components are fully typed with:
- Strict TypeScript mode compatibility
- Comprehensive prop interfaces
- Type-safe protocol and chain enums
- Generic data structures for flexibility

## Dependencies

- **React 18+** - Component framework
- **Recharts 3.1.2+** - Chart library
- **Lucide React** - Icon library
- **Tailwind CSS 3.3+** - Styling framework
- **TypeScript 5+** - Type safety

## Performance Considerations

- Memoized calculations where appropriate
- Efficient re-rendering with proper key props
- Lazy loading for chart components
- Optimized animations with CSS transforms
- Minimal bundle impact with tree-shaking

## Accessibility

- ARIA labels for interactive elements
- Keyboard navigation support
- High contrast color combinations
- Screen reader friendly structure
- Focus indicators for all interactive elements

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

All modern browsers with CSS backdrop-filter support for glassmorphism effects.