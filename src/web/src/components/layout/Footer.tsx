import React, { useCallback } from 'react'; // ^18.2.0
import classnames from 'classnames'; // ^2.3.2
import { useTheme } from '@mui/material/styles'; // ^5.0.0

// Internal imports
import { Icon } from '../common/Icon';
import { ComponentSize, BASE_SPACING_UNIT } from '../../types/common.types';

// Interfaces
interface FooterProps {
  className?: string;
  style?: React.CSSProperties;
}

interface SocialLink {
  name: string;
  icon: string;
  url: string;
  ariaLabel: string;
}

interface PlatformLink {
  name: string;
  url: string;
  ariaLabel: string;
}

// Constants
const SOCIAL_LINKS: SocialLink[] = [
  {
    name: 'Twitter',
    icon: 'twitter',
    url: 'https://twitter.com/bookmanai',
    ariaLabel: 'Follow us on Twitter'
  },
  {
    name: 'Discord',
    icon: 'discord',
    url: 'https://discord.gg/bookmanai',
    ariaLabel: 'Join our Discord community'
  },
  {
    name: 'GitHub',
    icon: 'github',
    url: 'https://github.com/bookmanai',
    ariaLabel: 'View our GitHub repository'
  }
];

const PLATFORM_LINKS: PlatformLink[] = [
  {
    name: 'About Us',
    url: '/about',
    ariaLabel: 'Learn more about Bookman AI'
  },
  {
    name: 'Terms of Service',
    url: '/terms',
    ariaLabel: 'Read our Terms of Service'
  },
  {
    name: 'Privacy Policy',
    url: '/privacy',
    ariaLabel: 'View our Privacy Policy'
  },
  {
    name: 'Contact',
    url: '/contact',
    ariaLabel: 'Contact Bookman AI support'
  }
];

/**
 * Returns the current year for copyright notice
 */
const getCurrentYear = (): number => new Date().getFullYear();

/**
 * Footer component for the Bookman AI platform
 * Implements responsive design and accessibility features
 */
export const Footer: React.FC<FooterProps> = React.memo(({ className, style }) => {
  const theme = useTheme();

  // Memoized link click handler
  const handleLinkClick = useCallback((url: string) => {
    window.location.href = url;
  }, []);

  return (
    <footer
      className={classnames('footer', className)}
      style={{
        padding: `${BASE_SPACING_UNIT * 4}px ${BASE_SPACING_UNIT * 3}px`,
        backgroundColor: theme.palette.background.paper,
        color: theme.palette.text.primary,
        borderTop: `1px solid ${theme.palette.divider}`,
        ...style
      }}
    >
      <div className="footer__container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Copyright Section */}
        <div 
          className="footer__copyright"
          style={{ 
            marginBottom: BASE_SPACING_UNIT * 3,
            textAlign: 'center'
          }}
        >
          <p>
            © {getCurrentYear()} Bookman AI. All rights reserved.
          </p>
        </div>

        {/* Social Links */}
        <div 
          className="footer__social"
          style={{ 
            display: 'flex',
            justifyContent: 'center',
            gap: BASE_SPACING_UNIT * 2,
            marginBottom: BASE_SPACING_UNIT * 4
          }}
        >
          {SOCIAL_LINKS.map((link) => (
            <a
              key={link.name}
              href={link.url}
              aria-label={link.ariaLabel}
              target="_blank"
              rel="noopener noreferrer"
              className="footer__social-link"
              style={{
                color: theme.palette.text.secondary,
                transition: 'color 0.2s ease',
                ':hover': {
                  color: theme.palette.primary.main
                }
              }}
            >
              <Icon 
                name={link.icon}
                size={ComponentSize.MEDIUM}
                title={link.name}
              />
            </a>
          ))}
        </div>

        {/* Platform Links */}
        <nav
          className="footer__links"
          aria-label="Footer navigation"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: `${BASE_SPACING_UNIT * 2}px ${BASE_SPACING_UNIT * 4}px`
          }}
        >
          {PLATFORM_LINKS.map((link) => (
            <a
              key={link.name}
              href={link.url}
              aria-label={link.ariaLabel}
              className="footer__platform-link"
              onClick={(e) => {
                e.preventDefault();
                handleLinkClick(link.url);
              }}
              style={{
                color: theme.palette.text.secondary,
                textDecoration: 'none',
                fontSize: '0.875rem',
                transition: 'color 0.2s ease',
                ':hover': {
                  color: theme.palette.primary.main,
                  textDecoration: 'underline'
                },
                ':focus': {
                  outline: `2px solid ${theme.palette.primary.main}`,
                  outlineOffset: '2px'
                }
              }}
            >
              {link.name}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
});

Footer.displayName = 'Footer';

export default Footer;