/**
 * Enhanced WebSocket Hook for Bookman AI Platform
 * @version 1.0.0
 * @description Advanced React hook for managing secure WebSocket connections with automatic
 * reconnection, message queuing, and real-time data communication
 */

// External imports - v18.2.0
import { useState, useEffect, useCallback, useRef } from 'react';

// Internal imports
import { WebSocketService } from '../services/websocket.service';
import { ApiResponse } from '../types/api.types';

// Constants
const DEFAULT_RECONNECT_ATTEMPTS = 5;
const DEFAULT_RECONNECT_INTERVAL = 5000;
const MAX_MESSAGE_QUEUE_SIZE = 1000;
const HEARTBEAT_INTERVAL = 30000;

// Types
export enum ConnectionState {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR'
}

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
  compressed?: boolean;
}

export interface WebSocketError {
  code: string;
  message: string;
  timestamp: number;
}

export interface WebSocketOptions {
  autoReconnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatEnabled?: boolean;
  heartbeatInterval?: number;
  compression?: boolean;
}

export interface WebSocketHookResult<T> {
  isConnected: boolean;
  sendMessage: (message: WebSocketMessage) => boolean;
  lastMessage: ApiResponse<T> | null;
  error: WebSocketError | null;
  connectionState: ConnectionState;
  messageQueue: WebSocketMessage[];
  retryCount: number;
  latency: number;
}

/**
 * Enhanced WebSocket hook for managing real-time connections
 * @param channels - Array of channels to subscribe to
 * @param options - WebSocket configuration options
 */
export function useWebSocket<T>(
  channels: string[],
  options: WebSocketOptions = {}
): WebSocketHookResult<T> {
  // State management
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastMessage, setLastMessage] = useState<ApiResponse<T> | null>(null);
  const [error, setError] = useState<WebSocketError | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [messageQueue, setMessageQueue] = useState<WebSocketMessage[]>([]);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [latency, setLatency] = useState<number>(0);

  // Refs for persistent values
  const wsRef = useRef<WebSocketService | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPingTimestampRef = useRef<number>(0);

  // Merge default options with provided options
  const wsOptions = {
    autoReconnect: true,
    reconnectAttempts: DEFAULT_RECONNECT_ATTEMPTS,
    reconnectInterval: DEFAULT_RECONNECT_INTERVAL,
    heartbeatEnabled: true,
    heartbeatInterval: HEARTBEAT_INTERVAL,
    compression: true,
    ...options
  };

  /**
   * Initialize WebSocket connection
   */
  const initializeWebSocket = useCallback(async () => {
    try {
      if (!wsRef.current) {
        wsRef.current = new WebSocketService();
      }

      setConnectionState(ConnectionState.CONNECTING);
      await wsRef.current.connect();
      
      // Subscribe to channels after connection
      if (channels.length > 0) {
        await wsRef.current.subscribe(channels, {
          compression: wsOptions.compression,
          priority: 'high',
          retryOnError: true
        });
      }

      setIsConnected(true);
      setConnectionState(ConnectionState.CONNECTED);
      setRetryCount(0);
    } catch (err) {
      handleConnectionError(err);
    }
  }, [channels, wsOptions.compression]);

  /**
   * Handle WebSocket connection errors
   */
  const handleConnectionError = useCallback((err: any) => {
    const wsError: WebSocketError = {
      code: err.code || 'WS_ERROR',
      message: err.message || 'WebSocket connection error',
      timestamp: Date.now()
    };

    setError(wsError);
    setConnectionState(ConnectionState.ERROR);
    setIsConnected(false);

    if (wsOptions.autoReconnect && retryCount < wsOptions.reconnectAttempts) {
      setConnectionState(ConnectionState.RECONNECTING);
      setRetryCount(prev => prev + 1);
      setTimeout(initializeWebSocket, wsOptions.reconnectInterval);
    }
  }, [wsOptions.autoReconnect, wsOptions.reconnectAttempts, wsOptions.reconnectInterval, retryCount, initializeWebSocket]);

  /**
   * Send message through WebSocket
   */
  const sendMessage = useCallback((message: WebSocketMessage): boolean => {
    if (!wsRef.current || !isConnected) {
      if (messageQueue.length < MAX_MESSAGE_QUEUE_SIZE) {
        setMessageQueue(prev => [...prev, message]);
      }
      return false;
    }

    try {
      return wsRef.current.sendMessage(message);
    } catch (err) {
      handleConnectionError(err);
      return false;
    }
  }, [isConnected, messageQueue.length, handleConnectionError]);

  /**
   * Handle heartbeat monitoring
   */
  const setupHeartbeat = useCallback(() => {
    if (!wsOptions.heartbeatEnabled) return;

    heartbeatIntervalRef.current = setInterval(() => {
      if (isConnected && wsRef.current) {
        lastPingTimestampRef.current = Date.now();
        wsRef.current.sendMessage({
          type: 'ping',
          payload: { timestamp: lastPingTimestampRef.current },
          timestamp: lastPingTimestampRef.current
        });
      }
    }, wsOptions.heartbeatInterval);

    // Setup heartbeat response handler
    wsRef.current?.onHeartbeat(() => {
      const latencyValue = Date.now() - lastPingTimestampRef.current;
      setLatency(latencyValue);
    });
  }, [wsOptions.heartbeatEnabled, wsOptions.heartbeatInterval, isConnected]);

  /**
   * Process queued messages after reconnection
   */
  const processMessageQueue = useCallback(async () => {
    if (!isConnected || messageQueue.length === 0) return;

    const queueCopy = [...messageQueue];
    setMessageQueue([]);

    for (const message of queueCopy) {
      sendMessage(message);
    }
  }, [isConnected, messageQueue, sendMessage]);

  // Initialize WebSocket connection
  useEffect(() => {
    initializeWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [initializeWebSocket]);

  // Setup heartbeat monitoring
  useEffect(() => {
    if (isConnected) {
      setupHeartbeat();
    }
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [isConnected, setupHeartbeat]);

  // Process message queue after reconnection
  useEffect(() => {
    if (isConnected) {
      processMessageQueue();
    }
  }, [isConnected, processMessageQueue]);

  return {
    isConnected,
    sendMessage,
    lastMessage,
    error,
    connectionState,
    messageQueue,
    retryCount,
    latency
  };
}