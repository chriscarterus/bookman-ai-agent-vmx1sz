/**
 * WebSocket Service for Bookman AI Platform
 * @version 1.0.0
 * @description Handles real-time data communication with enhanced security, reliability, and monitoring
 */

// External imports
import { EventEmitter } from 'events'; // ^3.3.0
import pako from 'pako'; // ^2.1.0
import { injectable } from 'inversify'; // ^6.0.1

// Internal imports
import { ApiResponse, ErrorSeverity } from '../types/api.types';
import { apiConfig } from '../config/api.config';
import { API_ENDPOINTS, API_HEADERS } from '../constants/api.constants';

// Constants for WebSocket configuration
const WS_RECONNECT_INTERVAL = 5000;
const WS_MAX_RECONNECT_ATTEMPTS = 5;
const WS_PING_INTERVAL = 30000;
const WS_MESSAGE_QUEUE_SIZE = 1000;
const WS_COMPRESSION_THRESHOLD = 1024;

// Types for WebSocket messages and options
interface Message {
  type: string;
  payload: any;
  timestamp: number;
  compressed?: boolean;
}

interface SubscriptionOptions {
  compression?: boolean;
  priority?: 'high' | 'normal' | 'low';
  retryOnError?: boolean;
}

interface MessageOptions {
  compress?: boolean;
  timeout?: number;
  retries?: number;
}

interface WebSocketMetrics {
  latency: number;
  messagesSent: number;
  messagesReceived: number;
  errors: number;
  reconnections: number;
}

@injectable()
export class WebSocketService {
  private socket: WebSocket | null = null;
  private eventEmitter: EventEmitter;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private subscribedChannels: Set<string> = new Set();
  private messageQueue: Message[] = [];
  private lastPingTime: number = 0;
  private pingInterval: NodeJS.Timeout | null = null;
  private metrics: WebSocketMetrics = {
    latency: 0,
    messagesSent: 0,
    messagesReceived: 0,
    errors: 0,
    reconnections: 0
  };

  constructor() {
    this.eventEmitter = new EventEmitter();
    this.eventEmitter.setMaxListeners(50); // Increased for multiple channel subscriptions
  }

  /**
   * Establishes WebSocket connection with security and monitoring
   */
  public async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      const wsUrl = this.buildSecureWsUrl();
      this.socket = new WebSocket(wsUrl);
      
      this.setupSocketHandlers();
      this.initializeHeartbeat();
      await this.waitForConnection();
      
      // Resubscribe to channels after reconnection
      if (this.subscribedChannels.size > 0) {
        await this.resubscribeToChannels();
      }
      
      // Process queued messages
      await this.processMessageQueue();
      
    } catch (error) {
      this.handleConnectionError(error);
    }
  }

  /**
   * Safely disconnects WebSocket with cleanup
   */
  public async disconnect(): Promise<void> {
    if (!this.socket) {
      return;
    }

    this.clearHeartbeat();
    this.subscribedChannels.clear();
    this.messageQueue = [];

    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.close(1000, 'Client disconnecting');
    }

    this.isConnected = false;
    this.socket = null;
  }

  /**
   * Subscribes to channels with enhanced security and monitoring
   */
  public async subscribe(channels: string[], options: SubscriptionOptions = {}): Promise<void> {
    if (!this.isConnected) {
      throw new Error('WebSocket not connected');
    }

    for (const channel of channels) {
      if (!this.subscribedChannels.has(channel)) {
        const subscribeMessage: Message = {
          type: 'subscribe',
          payload: { channel, options },
          timestamp: Date.now()
        };

        await this.sendMessage(subscribeMessage);
        this.subscribedChannels.add(channel);
      }
    }
  }

  /**
   * Sends messages with compression and reliability features
   */
  public async sendMessage(message: Message, options: MessageOptions = {}): Promise<boolean> {
    if (!this.socket || !this.isConnected) {
      this.queueMessage(message);
      return false;
    }

    try {
      const processedMessage = await this.processOutgoingMessage(message, options);
      this.socket.send(processedMessage);
      this.metrics.messagesSent++;
      return true;
    } catch (error) {
      this.handleSendError(error, message, options);
      return false;
    }
  }

  /**
   * Registers event handlers for specific message types
   */
  public on<T>(event: string, handler: (data: T) => void): void {
    this.eventEmitter.on(event, handler);
  }

  /**
   * Removes event handlers for specific message types
   */
  public off(event: string, handler: Function): void {
    this.eventEmitter.off(event, handler);
  }

  /**
   * Returns current WebSocket metrics
   */
  public getMetrics(): WebSocketMetrics {
    return { ...this.metrics };
  }

  private buildSecureWsUrl(): string {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const baseUrl = apiConfig.baseURL.replace(/^https?:/, wsProtocol);
    return `${baseUrl}/ws?token=${this.getAuthToken()}`;
  }

  private setupSocketHandlers(): void {
    if (!this.socket) return;

    this.socket.onopen = () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.eventEmitter.emit('connected');
    };

    this.socket.onmessage = async (event) => {
      try {
        const message = await this.processIncomingMessage(event.data);
        this.metrics.messagesReceived++;
        this.eventEmitter.emit(message.type, message.payload);
      } catch (error) {
        this.handleMessageError(error);
      }
    };

    this.socket.onclose = (event) => {
      this.handleDisconnection(event);
    };

    this.socket.onerror = (error) => {
      this.metrics.errors++;
      this.eventEmitter.emit('error', error);
    };
  }

  private async processOutgoingMessage(message: Message, options: MessageOptions): Promise<string> {
    const messageString = JSON.stringify(message);
    
    if (options.compress && messageString.length > WS_COMPRESSION_THRESHOLD) {
      const compressed = pako.deflate(messageString);
      return new Blob([compressed], { type: 'application/octet-stream' }).toString();
    }
    
    return messageString;
  }

  private async processIncomingMessage(data: string | Blob): Promise<Message> {
    if (data instanceof Blob && data.type === 'application/octet-stream') {
      const arrayBuffer = await data.arrayBuffer();
      const decompressed = pako.inflate(new Uint8Array(arrayBuffer), { to: 'string' });
      return JSON.parse(decompressed);
    }
    
    return JSON.parse(data.toString());
  }

  private initializeHeartbeat(): void {
    this.pingInterval = setInterval(() => {
      if (this.isConnected) {
        this.sendMessage({
          type: 'ping',
          payload: { timestamp: Date.now() },
          timestamp: Date.now()
        });
      }
    }, WS_PING_INTERVAL);
  }

  private clearHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private async resubscribeToChannels(): Promise<void> {
    const channels = Array.from(this.subscribedChannels);
    this.subscribedChannels.clear();
    await this.subscribe(channels);
  }

  private queueMessage(message: Message): void {
    if (this.messageQueue.length < WS_MESSAGE_QUEUE_SIZE) {
      this.messageQueue.push(message);
    }
  }

  private async processMessageQueue(): Promise<void> {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      if (message) {
        await this.sendMessage(message);
      }
    }
  }

  private getAuthToken(): string {
    return localStorage.getItem('accessToken') || '';
  }

  private async waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, apiConfig.timeout);

      this.eventEmitter.once('connected', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  private handleConnectionError(error: any): void {
    this.metrics.errors++;
    this.eventEmitter.emit('error', {
      code: 'WS_CONNECTION_ERROR',
      message: error.message,
      severity: ErrorSeverity.ERROR
    });

    if (this.reconnectAttempts < WS_MAX_RECONNECT_ATTEMPTS) {
      setTimeout(() => {
        this.reconnectAttempts++;
        this.metrics.reconnections++;
        this.connect();
      }, WS_RECONNECT_INTERVAL);
    }
  }

  private handleDisconnection(event: CloseEvent): void {
    this.isConnected = false;
    this.clearHeartbeat();
    
    if (!event.wasClean) {
      this.handleConnectionError(new Error('Connection lost'));
    }
  }

  private handleSendError(error: any, message: Message, options: MessageOptions): void {
    this.metrics.errors++;
    if (options.retries && options.retries > 0) {
      setTimeout(() => {
        this.sendMessage(message, {
          ...options,
          retries: options.retries - 1
        });
      }, 1000);
    }
  }

  private handleMessageError(error: any): void {
    this.metrics.errors++;
    this.eventEmitter.emit('error', {
      code: 'WS_MESSAGE_ERROR',
      message: error.message,
      severity: ErrorSeverity.WARNING
    });
  }
}