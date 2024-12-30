import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'; // ^18.2.0
import classnames from 'classnames'; // ^2.3.2
import { BaseComponentProps, ComponentSize } from '../../types/common.types';
import { theme } from '../../config/theme.config';
import Icon from './Icon';

// Dropdown option interface
interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

// Dropdown component props interface
interface DropdownProps extends BaseComponentProps {
  options: DropdownOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  placeholder?: string;
  size?: ComponentSize;
  disabled?: boolean;
  multiple?: boolean;
  searchable?: boolean;
  error?: boolean;
  helperText?: string;
  maxHeight?: string | number;
  loading?: boolean;
  virtualized?: boolean;
  renderOption?: (option: DropdownOption) => React.ReactNode;
}

// Custom hook for handling clicks outside the dropdown
const useOutsideClick = (ref: React.RefObject<HTMLElement>, callback: () => void) => {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [ref, callback]);
};

// Custom hook for keyboard navigation
const useKeyboardNavigation = (
  options: DropdownOption[],
  isOpen: boolean,
  selectedIndex: number,
  setSelectedIndex: (index: number) => void,
  handleSelect: (option: DropdownOption) => void,
  closeDropdown: () => void
) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isOpen) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex(Math.min(selectedIndex + 1, options.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex(Math.max(selectedIndex - 1, 0));
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (selectedIndex >= 0) {
          handleSelect(options[selectedIndex]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        closeDropdown();
        break;
      case 'Tab':
        closeDropdown();
        break;
    }
  }, [isOpen, selectedIndex, options, setSelectedIndex, handleSelect, closeDropdown]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};

export const Dropdown: React.FC<DropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  size = ComponentSize.MEDIUM,
  disabled = false,
  multiple = false,
  searchable = false,
  error = false,
  helperText,
  maxHeight = '300px',
  loading = false,
  virtualized = false,
  renderOption,
  className,
  ...rest
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useOutsideClick(dropdownRef, () => setIsOpen(false));

  // Filter options based on search
  const filteredOptions = useMemo(() => {
    if (!searchable || !searchValue) return options;
    return options.filter(option => 
      option.label.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [options, searchable, searchValue]);

  // Handle option selection
  const handleSelect = useCallback((option: DropdownOption) => {
    if (disabled || option.disabled) return;

    if (multiple) {
      const values = Array.isArray(value) ? value : [];
      const newValue = values.includes(option.value)
        ? values.filter(v => v !== option.value)
        : [...values, option.value];
      onChange(newValue);
    } else {
      onChange(option.value);
      setIsOpen(false);
    }
    setSearchValue('');
  }, [disabled, multiple, value, onChange]);

  // Setup keyboard navigation
  useKeyboardNavigation(
    filteredOptions,
    isOpen,
    selectedIndex,
    setSelectedIndex,
    handleSelect,
    () => setIsOpen(false)
  );

  // Get selected option label(s)
  const getDisplayValue = () => {
    if (multiple && Array.isArray(value)) {
      if (value.length === 0) return placeholder;
      return `${value.length} selected`;
    }
    const selectedOption = options.find(option => option.value === value);
    return selectedOption ? selectedOption.label : placeholder;
  };

  // Styles based on theme
  const styles = {
    wrapper: {
      position: 'relative' as const,
      width: '100%',
    },
    control: {
      display: 'flex',
      alignItems: 'center',
      padding: theme.spacing.get(2),
      borderRadius: '8px',
      border: `1px solid ${error ? theme.colors.error.main : theme.colors.grey[300]}`,
      backgroundColor: disabled ? theme.colors.grey[100] : theme.colors.background.default,
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: theme.transitions.medium,
    },
    menu: {
      position: 'absolute' as const,
      top: '100%',
      left: 0,
      right: 0,
      zIndex: 1000,
      marginTop: '4px',
      backgroundColor: theme.colors.background.default,
      borderRadius: '8px',
      boxShadow: theme.shadows[2],
      maxHeight,
      overflowY: 'auto' as const,
    },
    option: {
      padding: theme.spacing.get(2),
      cursor: 'pointer',
      transition: theme.transitions.short,
      '&:hover': {
        backgroundColor: theme.colors.grey[100],
      },
    },
  };

  return (
    <div
      ref={dropdownRef}
      className={classnames('dropdown', className, {
        'dropdown--error': error,
        'dropdown--disabled': disabled,
        [`dropdown--${size}`]: size,
      })}
      style={styles.wrapper}
      {...rest}
    >
      <div
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls="dropdown-list"
        aria-disabled={disabled}
        style={styles.control}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        {searchable && isOpen ? (
          <input
            ref={inputRef}
            type="text"
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            placeholder={placeholder}
            autoFocus
          />
        ) : (
          <span>{getDisplayValue()}</span>
        )}
        <Icon
          name={isOpen ? 'close' : 'menu'}
          size={ComponentSize.SMALL}
          color={disabled ? theme.colors.grey[400] : theme.colors.grey[600]}
        />
      </div>

      {isOpen && (
        <div
          id="dropdown-list"
          role="listbox"
          aria-multiselectable={multiple}
          style={styles.menu}
        >
          {loading ? (
            <div className="dropdown__loading">Loading...</div>
          ) : filteredOptions.length === 0 ? (
            <div className="dropdown__no-options">No options available</div>
          ) : (
            filteredOptions.map((option, index) => (
              <div
                key={option.value}
                role="option"
                aria-selected={multiple ? Array.isArray(value) && value.includes(option.value) : value === option.value}
                aria-disabled={option.disabled}
                className={classnames('dropdown__option', {
                  'dropdown__option--selected': multiple ? Array.isArray(value) && value.includes(option.value) : value === option.value,
                  'dropdown__option--disabled': option.disabled,
                  'dropdown__option--highlighted': index === selectedIndex,
                })}
                style={styles.option}
                onClick={() => handleSelect(option)}
              >
                {renderOption ? renderOption(option) : option.label}
              </div>
            ))
          )}
        </div>
      )}

      {helperText && (
        <div
          className={classnames('dropdown__helper-text', {
            'dropdown__helper-text--error': error,
          })}
        >
          {helperText}
        </div>
      )}
    </div>
  );
};

export default Dropdown;