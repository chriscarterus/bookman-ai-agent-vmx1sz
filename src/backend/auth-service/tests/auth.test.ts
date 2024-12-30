import { MongoMemoryServer } from 'mongodb-memory-server'; // v8.12.0
import { connect, Connection, Model } from 'mongoose';
import { AuthService } from '../src/services/auth.service';
import { User, IUser } from '../src/models/user.model';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as speakeasy from 'speakeasy'; // v2.0.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0

// Test constants
const TEST_USERS = {
  regular: {
    email: 'test@example.com',
    password: 'Test123!@#',
    role: 'user',
    mfaEnabled: true,
    backupCodes: ['123456', '234567']
  },
  premium: {
    email: 'premium@example.com',
    password: 'Premium123!@#',
    role: 'premium',
    mfaEnabled: true
  },
  admin: {
    email: 'admin@example.com',
    password: 'Admin123!@#',
    role: 'admin',
    mfaEnabled: true
  }
};

const MOCK_TOKENS = {
  google: 'mock.google.token.string',
  mfa: '123456',
  invalidMfa: '999999'
};

const RATE_LIMITS = {
  login: { max: 5, window: '15m' },
  register: { max: 3, window: '1h' },
  mfa: { max: 3, window: '5m' }
};

describe('AuthService', () => {
  let mongod: MongoMemoryServer;
  let mongoConnection: Connection;
  let authService: AuthService;
  let jwtService: JwtService;
  let configService: ConfigService;
  let userModel: Model<IUser>;

  beforeAll(async () => {
    // Setup MongoDB Memory Server
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    mongoConnection = (await connect(uri)).connection;
    userModel = mongoConnection.model<IUser>('User', User.schema);

    // Setup services
    configService = new ConfigService();
    jwtService = new JwtService({
      secret: 'test-secret',
      signOptions: { expiresIn: '1h' }
    });
    authService = new AuthService(userModel, jwtService, configService);

    // Create test users
    await Promise.all(Object.values(TEST_USERS).map(async (userData) => {
      const user = new userModel({
        user_id: uuidv4(),
        email: userData.email,
        username: userData.email.split('@')[0],
        password_hash: await User.hashPassword(userData.password),
        role: userData.role,
        status: 'active',
        auth_provider: 'email',
        security_settings: {
          two_factor_enabled: userData.mfaEnabled,
          two_factor_secret: speakeasy.generateSecret().base32,
          backup_codes: userData.backupCodes || [],
          security_questions: [],
          last_password_change: new Date(),
          password_history: [],
          security_events: []
        }
      });
      await user.save();
    }));
  });

  afterAll(async () => {
    await mongoConnection.dropDatabase();
    await mongoConnection.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    // Reset user states before each test
    await userModel.updateMany(
      {},
      {
        $set: {
          status: 'active',
          failed_login_attempts: 0,
          account_locked_until: null
        }
      }
    );
  });

  describe('Authentication Flow', () => {
    it('should successfully authenticate a user with valid credentials', async () => {
      const result = await authService.login({
        email: TEST_USERS.regular.email,
        password: TEST_USERS.regular.password,
        ip_address: '127.0.0.1'
      });

      expect(result.requires_mfa).toBe(true);
      expect(result.user.email).toBe(TEST_USERS.regular.email);
      expect(result.user.role).toBe(TEST_USERS.regular.role);
    });

    it('should complete MFA authentication with valid token', async () => {
      const user = await userModel.findOne({ email: TEST_USERS.regular.email });
      const token = speakeasy.totp({
        secret: user.security_settings.two_factor_secret,
        encoding: 'base32'
      });

      const result = await authService.login({
        email: TEST_USERS.regular.email,
        password: TEST_USERS.regular.password,
        ip_address: '127.0.0.1'
      }, token);

      expect(result.access_token).toBeTruthy();
      expect(result.refresh_token).toBeTruthy();
      expect(result.requires_mfa).toBe(false);
    });

    it('should fail authentication with invalid credentials', async () => {
      await expect(authService.login({
        email: TEST_USERS.regular.email,
        password: 'wrong_password',
        ip_address: '127.0.0.1'
      })).rejects.toThrow('Invalid credentials');
    });
  });

  describe('Security Features', () => {
    it('should lock account after maximum failed attempts', async () => {
      const loginAttempt = {
        email: TEST_USERS.regular.email,
        password: 'wrong_password',
        ip_address: '127.0.0.1'
      };

      for (let i = 0; i < RATE_LIMITS.login.max; i++) {
        await expect(authService.login(loginAttempt))
          .rejects.toThrow('Invalid credentials');
      }

      const user = await userModel.findOne({ email: TEST_USERS.regular.email });
      expect(user.status).toBe('locked');
      expect(user.account_locked_until).toBeTruthy();
    });

    it('should validate backup codes for MFA', async () => {
      const result = await authService.login({
        email: TEST_USERS.regular.email,
        password: TEST_USERS.regular.password,
        ip_address: '127.0.0.1'
      }, TEST_USERS.regular.backupCodes[0]);

      expect(result.access_token).toBeTruthy();
      expect(result.requires_mfa).toBe(false);

      const user = await userModel.findOne({ email: TEST_USERS.regular.email });
      expect(user.security_settings.backup_codes).not.toContain(TEST_USERS.regular.backupCodes[0]);
    });

    it('should enforce rate limiting', async () => {
      const loginAttempt = {
        email: TEST_USERS.regular.email,
        password: TEST_USERS.regular.password,
        ip_address: '127.0.0.1'
      };

      for (let i = 0; i < RATE_LIMITS.login.max + 1; i++) {
        try {
          await authService.login(loginAttempt);
        } catch (error) {
          if (i === RATE_LIMITS.login.max) {
            expect(error.message).toContain('Too many requests');
          }
        }
      }
    });
  });

  describe('OAuth Integration', () => {
    it('should authenticate with valid Google token', async () => {
      const mockGoogleProfile = {
        email: 'google@example.com',
        sub: '12345',
        name: 'Google User'
      };

      // Mock Google verification
      jest.spyOn(authService['googleClient'], 'verifyIdToken').mockResolvedValue({
        getPayload: () => mockGoogleProfile
      } as any);

      const result = await authService.googleAuth(MOCK_TOKENS.google, '127.0.0.1');
      expect(result.user.email).toBe(mockGoogleProfile.email);
      expect(result.access_token).toBeTruthy();
    });

    it('should handle invalid OAuth tokens', async () => {
      jest.spyOn(authService['googleClient'], 'verifyIdToken').mockRejectedValue(new Error('Invalid token'));
      
      await expect(authService.googleAuth('invalid_token', '127.0.0.1'))
        .rejects.toThrow('Authentication failed');
    });
  });

  describe('Token Management', () => {
    it('should refresh access token with valid refresh token', async () => {
      // First login to get tokens
      const user = await userModel.findOne({ email: TEST_USERS.regular.email });
      const token = speakeasy.totp({
        secret: user.security_settings.two_factor_secret,
        encoding: 'base32'
      });

      const loginResult = await authService.login({
        email: TEST_USERS.regular.email,
        password: TEST_USERS.regular.password,
        ip_address: '127.0.0.1'
      }, token);

      const refreshResult = await authService.refreshToken(loginResult.refresh_token);
      expect(refreshResult.access_token).toBeTruthy();
      expect(refreshResult.access_token).not.toBe(loginResult.access_token);
    });

    it('should invalidate all tokens on logout', async () => {
      const user = await userModel.findOne({ email: TEST_USERS.regular.email });
      await authService.logout(user.user_id);

      // Attempt to use old refresh token
      const oldToken = jwtService.sign({ sub: user.user_id, type: 'refresh' });
      await expect(authService.refreshToken(oldToken)).rejects.toThrow();
    });
  });
});