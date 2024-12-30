import React, { useCallback, useEffect, useState } from 'react';
import { useMediaQuery, Collapse, Box, List, ListItem, ListItemIcon, ListItemText, Divider, Typography, IconButton } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Icon } from '../common/Icon';
import { BaseComponentProps, ComponentSize, TABLET_BREAKPOINT, DEFAULT_TRANSITION_DURATION } from '../../types/common.types';

// Navigation items configuration
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'portfolio', label: 'Portfolio', icon: 'portfolio' },
  { id: 'education', label: 'Learning Center', icon: 'education' },
  { id: 'market', label: 'Market Analysis', icon: 'market' },
  { id: 'security', label: 'Security', icon: 'security' },
  { id: 'community', label: 'Community', icon: 'community' }
];

// Portfolio data interface
interface PortfolioSummary {
  totalValue: number;
  dailyChange: number;
  topAssets: Array<{
    symbol: string;
    value: number;
    change: number;
  }>;
}

// Sidebar component props interface
interface SidebarProps extends BaseComponentProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

/**
 * Custom hook for managing real-time portfolio data
 * @returns Current portfolio metrics and performance data
 */
const usePortfolioData = () => {
  const [portfolioData, setPortfolioData] = useState<PortfolioSummary | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let ws: WebSocket;

    const connectWebSocket = () => {
      ws = new WebSocket(process.env.REACT_APP_WS_ENDPOINT || 'ws://localhost:8080');

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setPortfolioData(data);
        } catch (err) {
          setError(err instanceof Error ? err : new Error('Failed to parse portfolio data'));
        }
      };

      ws.onerror = (event) => {
        setError(new Error('WebSocket connection error'));
      };
    };

    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  return { portfolioData, error };
};

/**
 * Sidebar component providing navigation and portfolio insights
 * @param props SidebarProps
 * @returns JSX.Element
 */
export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed = false,
  onToggle,
  className,
  ...rest
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(`(max-width:${TABLET_BREAKPOINT}px)`);
  const [activeItem, setActiveItem] = useState<string>('dashboard');
  const { portfolioData, error } = usePortfolioData();

  // Handle responsive collapse behavior
  const handleToggle = useCallback(() => {
    if (onToggle) {
      onToggle();
    }
  }, [onToggle]);

  // Styles
  const sidebarStyles = {
    width: isCollapsed ? theme.spacing(7) : '240px',
    transition: `width ${DEFAULT_TRANSITION_DURATION}ms ${theme.transitions.easing.sharp}`,
    backgroundColor: theme.palette.background.paper,
    borderRight: `1px solid ${theme.palette.divider}`,
    height: '100vh',
    position: 'fixed' as const,
    overflowX: 'hidden',
    zIndex: theme.zIndex.drawer,
    display: 'flex',
    flexDirection: 'column' as const,
  };

  return (
    <Box
      component="nav"
      sx={sidebarStyles}
      className={className}
      {...rest}
    >
      {/* Header with toggle button */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          padding: theme.spacing(2),
          justifyContent: isCollapsed ? 'center' : 'space-between',
        }}
      >
        {!isCollapsed && (
          <Typography variant="h6" noWrap>
            Bookman AI
          </Typography>
        )}
        <IconButton
          onClick={handleToggle}
          size="small"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Icon
            name={isCollapsed ? 'menu' : 'close'}
            size={ComponentSize.SMALL}
          />
        </IconButton>
      </Box>

      <Divider />

      {/* Navigation Items */}
      <List component="nav">
        {NAV_ITEMS.map(({ id, label, icon }) => (
          <ListItem
            button
            key={id}
            selected={activeItem === id}
            onClick={() => setActiveItem(id)}
            sx={{
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              py: 1.5,
            }}
          >
            <ListItemIcon sx={{ minWidth: isCollapsed ? 0 : 40 }}>
              <Icon
                name={icon}
                size={ComponentSize.SMALL}
                color={activeItem === id ? theme.palette.primary.main : undefined}
              />
            </ListItemIcon>
            <Collapse in={!isCollapsed} orientation="horizontal">
              <ListItemText primary={label} />
            </Collapse>
          </ListItem>
        ))}
      </List>

      <Divider />

      {/* Portfolio Summary */}
      <Collapse in={!isCollapsed && !!portfolioData}>
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle2" color="textSecondary">
            Portfolio Summary
          </Typography>
          {portfolioData && (
            <>
              <Typography variant="h6">
                ${portfolioData.totalValue.toLocaleString()}
              </Typography>
              <Typography
                variant="body2"
                color={portfolioData.dailyChange >= 0 ? 'success.main' : 'error.main'}
              >
                {portfolioData.dailyChange >= 0 ? '+' : ''}
                {portfolioData.dailyChange}%
              </Typography>
              <Box sx={{ mt: 1 }}>
                {portfolioData.topAssets.map(({ symbol, value, change }) => (
                  <Box
                    key={symbol}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      my: 0.5,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Icon name={symbol.toLowerCase()} size={ComponentSize.SMALL} />
                      <Typography variant="body2" sx={{ ml: 1 }}>
                        {symbol}
                      </Typography>
                    </Box>
                    <Typography
                      variant="body2"
                      color={change >= 0 ? 'success.main' : 'error.main'}
                    >
                      {change >= 0 ? '+' : ''}{change}%
                    </Typography>
                  </Box>
                ))}
              </Box>
            </>
          )}
          {error && (
            <Typography color="error" variant="body2">
              Failed to load portfolio data
            </Typography>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};

export default Sidebar;