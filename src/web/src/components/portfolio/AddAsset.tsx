/**
 * AddAsset Component
 * @version 1.0.0
 * @description A form component for adding new cryptocurrency assets to a user's portfolio
 * with real-time validation, market data integration, and enhanced security features
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form'; // ^7.45.0
import { useDebounce } from 'use-debounce'; // ^9.0.0
import * as yup from 'yup'; // ^1.2.0
import { Asset, AssetType, ASSET_TYPES } from '../../types/portfolio.types';
import { portfolioApi } from '../../api/portfolio';
import { MarketData } from '../../types/market.types';
import { LoadingState, ErrorSeverity } from '../../types/api.types';
import analytics from '@bookman/analytics'; // ^1.0.0

// Validation schema for the add asset form
const addAssetSchema = yup.object().shape({
  symbol: yup.string()
    .required('Cryptocurrency symbol is required')
    .matches(/^[A-Z0-9]+$/, 'Symbol must contain only uppercase letters and numbers')
    .min(2, 'Symbol must be at least 2 characters')
    .max(10, 'Symbol must not exceed 10 characters'),
  type: yup.string()
    .required('Asset type is required')
    .oneOf(ASSET_TYPES, 'Invalid asset type'),
  quantity: yup.number()
    .required('Quantity is required')
    .positive('Quantity must be positive')
    .typeError('Quantity must be a number'),
  purchasePrice: yup.number()
    .required('Purchase price is required')
    .positive('Purchase price must be positive')
    .typeError('Purchase price must be a number'),
  purchaseDate: yup.date()
    .required('Purchase date is required')
    .max(new Date(), 'Purchase date cannot be in the future')
    .typeError('Invalid date format'),
  notes: yup.string()
    .max(500, 'Notes must not exceed 500 characters'),
  tags: yup.array()
    .of(yup.string())
    .max(10, 'Maximum 10 tags allowed')
});

// Component props interface
interface AddAssetProps {
  portfolioId: string;
  onSuccess: () => void;
  onCancel: () => void;
  onError: (error: Error) => void;
  onValidationStart?: () => void;
  onValidationComplete?: (isValid: boolean) => void;
}

// Form data interface
interface AddAssetFormData {
  symbol: string;
  type: AssetType;
  quantity: number;
  purchasePrice: number;
  purchaseDate: Date;
  notes?: string;
  tags?: string[];
}

/**
 * AddAsset Component
 * Provides a form interface for adding new cryptocurrency assets to a portfolio
 */
const AddAsset: React.FC<AddAssetProps> = ({
  portfolioId,
  onSuccess,
  onCancel,
  onError,
  onValidationStart,
  onValidationComplete
}) => {
  // Form state management
  const { control, handleSubmit, formState: { errors }, watch, setValue } = useForm<AddAssetFormData>({
    defaultValues: {
      type: 'cryptocurrency',
      tags: []
    },
    mode: 'onChange'
  });

  // Component state
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [symbolError, setSymbolError] = useState<string | null>(null);

  // Watch symbol field for validation
  const symbol = watch('symbol');
  const [debouncedSymbol] = useDebounce(symbol, 500);

  /**
   * Validates cryptocurrency symbol against market data
   */
  const validateSymbol = useCallback(async (value: string) => {
    if (!value) return;

    try {
      setLoadingState(LoadingState.LOADING);
      onValidationStart?.();

      const response = await portfolioApi.validateSymbol(value);
      setMarketData(response.data);
      setSymbolError(null);
      onValidationComplete?.(true);

      // Set current market price as default purchase price
      if (response.data?.price) {
        setValue('purchasePrice', response.data.price);
      }
    } catch (error) {
      setSymbolError('Invalid cryptocurrency symbol');
      setMarketData(null);
      onValidationComplete?.(false);
    } finally {
      setLoadingState(LoadingState.IDLE);
    }
  }, [setValue, onValidationStart, onValidationComplete]);

  // Validate symbol when it changes
  useEffect(() => {
    if (debouncedSymbol) {
      validateSymbol(debouncedSymbol.toUpperCase());
    }
  }, [debouncedSymbol, validateSymbol]);

  /**
   * Handles form submission with enhanced error handling and analytics
   */
  const onSubmit = async (formData: AddAssetFormData) => {
    try {
      setLoadingState(LoadingState.LOADING);

      // Track form submission attempt
      analytics.track('add_asset_attempt', {
        symbol: formData.symbol,
        type: formData.type,
        portfolioId
      });

      const asset: Partial<Asset> = {
        symbol: formData.symbol.toUpperCase(),
        type: formData.type,
        quantity: formData.quantity,
        average_buy_price: formData.purchasePrice,
        current_price: marketData?.price || formData.purchasePrice,
        total_value: formData.quantity * formData.purchasePrice
      };

      const response = await portfolioApi.addAsset(portfolioId, asset);

      // Track successful submission
      analytics.track('add_asset_success', {
        symbol: formData.symbol,
        type: formData.type,
        portfolioId
      });

      setLoadingState(LoadingState.SUCCESS);
      onSuccess();
    } catch (error: any) {
      // Track submission error
      analytics.track('add_asset_error', {
        symbol: formData.symbol,
        type: formData.type,
        portfolioId,
        error: error.message
      });

      setLoadingState(LoadingState.ERROR);
      onError(error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Symbol Input */}
      <Controller
        name="symbol"
        control={control}
        rules={{ required: true }}
        render={({ field }) => (
          <div>
            <label htmlFor="symbol" className="block text-sm font-medium text-gray-700">
              Cryptocurrency Symbol
            </label>
            <input
              {...field}
              type="text"
              id="symbol"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="BTC"
              autoComplete="off"
              onChange={(e) => {
                field.onChange(e.target.value.toUpperCase());
              }}
            />
            {symbolError && (
              <p className="mt-2 text-sm text-red-600">{symbolError}</p>
            )}
          </div>
        )}
      />

      {/* Asset Type Selection */}
      <Controller
        name="type"
        control={control}
        rules={{ required: true }}
        render={({ field }) => (
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700">
              Asset Type
            </label>
            <select
              {...field}
              id="type"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              {ASSET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>
        )}
      />

      {/* Quantity Input */}
      <Controller
        name="quantity"
        control={control}
        rules={{ required: true, min: 0 }}
        render={({ field }) => (
          <div>
            <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">
              Quantity
            </label>
            <input
              {...field}
              type="number"
              id="quantity"
              step="any"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="0.00"
            />
            {errors.quantity && (
              <p className="mt-2 text-sm text-red-600">{errors.quantity.message}</p>
            )}
          </div>
        )}
      />

      {/* Purchase Price Input */}
      <Controller
        name="purchasePrice"
        control={control}
        rules={{ required: true, min: 0 }}
        render={({ field }) => (
          <div>
            <label htmlFor="purchasePrice" className="block text-sm font-medium text-gray-700">
              Purchase Price (USD)
            </label>
            <input
              {...field}
              type="number"
              id="purchasePrice"
              step="any"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="0.00"
            />
            {marketData && (
              <p className="mt-2 text-sm text-gray-500">
                Current market price: ${marketData.price.toFixed(2)}
              </p>
            )}
          </div>
        )}
      />

      {/* Action Buttons */}
      <div className="flex justify-end space-x-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loadingState === LoadingState.LOADING || !!symbolError}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {loadingState === LoadingState.LOADING ? 'Adding...' : 'Add Asset'}
        </button>
      </div>
    </form>
  );
};

export default AddAsset;