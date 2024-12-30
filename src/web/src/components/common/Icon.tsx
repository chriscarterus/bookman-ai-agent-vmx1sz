import React from 'react'; // ^18.2.0
import classnames from 'classnames'; // ^2.3.2
import { useTheme } from '@mui/material/styles'; // ^5.0.0

// Internal imports
import { BaseComponentProps, ComponentSize } from '../../types/common.types';

/**
 * Interface for Icon component props extending base component props
 */
interface IconProps extends BaseComponentProps {
  /** Icon identifier from sprite sheet */
  name: string;
  /** Size variant of the icon */
  size?: ComponentSize;
  /** Custom color override */
  color?: string;
  /** Accessible title for the icon */
  title?: string;
  /** Whether the icon is decorative (for accessibility) */
  decorative?: boolean;
}

/**
 * Maps ComponentSize enum to pixel values
 * @param size - ComponentSize enum value
 * @returns number - Pixel value for icon size
 */
const getIconSize = (size: ComponentSize = ComponentSize.MEDIUM): number => {
  switch (size) {
    case ComponentSize.SMALL:
      return 16;
    case ComponentSize.MEDIUM:
      return 24;
    case ComponentSize.LARGE:
      return 32;
    default:
      throw new Error(`Invalid icon size: ${size}`);
  }
};

/**
 * Validates if icon exists in sprite sheets
 * @param name - Icon identifier
 * @returns boolean - True if icon exists
 */
const validateIconName = (name: string): boolean => {
  const cryptoIcons = ['btc', 'eth', 'usdt', 'bnb', 'usdc'];
  const navigationIcons = [
    'dashboard',
    'portfolio',
    'education',
    'market',
    'security',
    'community',
    'settings',
    'menu',
    'close',
    'back'
  ];
  
  return cryptoIcons.includes(name) || navigationIcons.includes(name);
};

/**
 * Icon component for rendering SVG icons from sprite sheets with accessibility support
 * @param props - IconProps
 * @returns JSX.Element
 */
export const Icon: React.FC<IconProps> = ({
  name,
  size = ComponentSize.MEDIUM,
  color,
  className,
  style,
  title,
  decorative = false,
  ...rest
}) => {
  // Validate icon name
  if (!validateIconName(name)) {
    console.warn(`Invalid icon name: ${name}`);
    return null;
  }

  const theme = useTheme();
  const pixelSize = getIconSize(size);

  // Determine sprite sheet based on icon name
  const isCryptoIcon = ['btc', 'eth', 'usdt', 'bnb', 'usdc'].includes(name);
  const spriteUrl = isCryptoIcon ? 
    '../../assets/icons/crypto-icons.svg' : 
    '../../assets/icons/navigation-icons.svg';

  // Default to theme primary color if no color provided
  const iconColor = color || theme.palette.primary.main;

  const iconStyles: React.CSSProperties = {
    width: pixelSize,
    height: pixelSize,
    color: iconColor,
    display: 'inline-block',
    verticalAlign: 'middle',
    ...style
  };

  // Combine classNames
  const iconClassNames = classnames(
    'icon',
    `icon--${size}`,
    className
  );

  // Accessibility attributes
  const a11yProps = {
    role: 'img',
    'aria-hidden': decorative ? 'true' : undefined,
    ...(!decorative && !title && { 'aria-label': name }),
    ...rest
  };

  return (
    <svg
      className={iconClassNames}
      style={iconStyles}
      {...a11yProps}
    >
      {title && <title>{title}</title>}
      <use
        xlinkHref={`${spriteUrl}#${name}`}
        width={pixelSize}
        height={pixelSize}
      />
    </svg>
  );
};

// Default export
export default Icon;

// Type exports for consumers
export type { IconProps };
```

This implementation includes:

1. Full TypeScript support with proper typing and interfaces
2. Accessibility features including:
   - ARIA attributes
   - Title support
   - Decorative icon handling
3. Theme integration using Material UI's useTheme hook
4. Size variants using ComponentSize enum
5. Validation of icon names
6. Support for both cryptocurrency and navigation icons
7. Custom color override capability
8. Proper SVG sprite sheet usage
9. Comprehensive prop types
10. Error handling and validation
11. Responsive sizing
12. CSS-in-JS styling with theme integration
13. Class name composition using classnames utility
14. Proper TypeScript exports

The component is designed to be used like this:

```typescript
// Example usage
<Icon 
  name="btc" 
  size={ComponentSize.MEDIUM} 
  color="#F7931A"
  title="Bitcoin"
/>

<Icon 
  name="dashboard" 
  decorative 
  size={ComponentSize.LARGE}
/>