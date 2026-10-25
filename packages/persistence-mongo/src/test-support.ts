import mongoose, { Schema } from 'mongoose';
import type { Connection } from 'mongoose';
import type { MongoUserDoc } from './user-mapper';

/**
 * Test-only mirror of the data-schemas user schema (fields and indexes the adapter touches).
 * Password length limits are omitted so contract fixtures can use short placeholder hashes.
 */
export function buildUserModel(connection: Connection) {
  const schema = new Schema(
    {
      name: String,
      username: { type: String, lowercase: true, default: '' },
      email: {
        type: String,
        required: [true, "can't be blank"],
        lowercase: true,
        match: [/\S+@\S+\.\S+/, 'is invalid'],
      },
      emailVerified: { type: Boolean, required: true, default: false },
      password: { type: String, trim: true, select: false },
      avatar: String,
      provider: { type: String, required: true, default: 'local' },
      role: { type: String, default: 'USER' },
      googleId: String,
      facebookId: String,
      openidId: String,
      openidIssuer: String,
      samlId: String,
      ldapId: String,
      githubId: String,
      discordId: String,
      appleId: String,
      plugins: { type: Array },
      expiresAt: Date,
      personalization: {
        type: { memories: { type: Boolean, default: true }, statefulCodeEnvironment: String },
        default: {},
      },
      favorites: {
        type: [{ _id: false, agentId: String, model: String, endpoint: String, spec: String }],
        default: [],
      },
      pinnedOrder: { type: [String], default: [] },
      skillStates: { type: Map, of: Boolean, default: () => new Map() },
      tenantId: { type: String, index: true },
    },
    { timestamps: true },
  );
  schema.index({ email: 1, tenantId: 1 }, { unique: true });
  return connection.model<MongoUserDoc>('User', schema);
}

export async function connectTestMongo(): Promise<{
  connection: Connection;
  stop(): Promise<void>;
}> {
  const envUri = process.env.MONGO_URI;
  let stopServer: () => Promise<void> = async () => undefined;
  let uri = envUri;
  if (!uri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const server = await MongoMemoryServer.create();
    uri = server.getUri();
    stopServer = async () => {
      await server.stop();
    };
  }
  const dbName = `lcmig_test_${process.pid}_${Date.now()}`;
  const connection = await mongoose.createConnection(uri, { dbName }).asPromise();
  return {
    connection,
    stop: async () => {
      await connection.dropDatabase();
      await connection.close();
      await stopServer();
    },
  };
}
