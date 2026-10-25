import { PortError } from '@lcmig/persistence-core';
import type {
  NewUser,
  UserAuthRecord,
  UserPatch,
  UserRecord,
  UserRepo,
} from '@lcmig/persistence-core';
import type { Model } from 'mongoose';
import { mapMongoError } from './errors';
import {
  isObjectIdString,
  normalizeEmail,
  normalizeUsername,
  toMongoWrite,
  toUserRecord,
} from './user-mapper';
import type { MongoUserDoc } from './user-mapper';

type Filter = Record<string, unknown>;

/** `UserRepo` over the Mongoose user model; callers never see `_id`, ObjectId or documents. */
export class MongoUserRepo implements UserRepo {
  constructor(private readonly users: Model<MongoUserDoc>) {}

  async findById(id: string): Promise<UserRecord | null> {
    if (!isObjectIdString(id)) return null;
    const doc = await this.run(() => this.users.findById(id).lean<MongoUserDoc>().exec());
    return doc ? toUserRecord(doc) : null;
  }

  async findByEmail(email: string, tenantId?: string | null): Promise<UserRecord | null> {
    const doc = await this.run(() =>
      this.users.findOne(this.emailFilter(email, tenantId)).lean<MongoUserDoc>().exec(),
    );
    return doc ? toUserRecord(doc) : null;
  }

  async getAuthByEmail(email: string, tenantId?: string | null): Promise<UserAuthRecord | null> {
    const doc = await this.run(() =>
      this.users
        .findOne(this.emailFilter(email, tenantId))
        .select('+password')
        .lean<MongoUserDoc>()
        .exec(),
    );
    return doc ? { ...toUserRecord(doc), passwordHash: doc.password ?? null } : null;
  }

  async create(input: NewUser): Promise<UserRecord> {
    const email = normalizeEmail(input?.email);
    if (!email) {
      throw new PortError('ConstraintViolation', 'Email is required', { field: 'email' });
    }
    const { set } = toMongoWrite({ ...input, email });
    await this.assertUsernameFree(set.username, input.tenantId ?? null);
    const created = await this.run(() => this.users.create(set));
    return this.reload(created._id.toString());
  }

  async update(id: string, patch: UserPatch): Promise<UserRecord> {
    const current = isObjectIdString(id)
      ? await this.run(() => this.users.findById(id).lean<MongoUserDoc>().exec())
      : null;
    if (!current) {
      throw new PortError('NotFound', 'User not found');
    }
    if (patch.email !== undefined && !normalizeEmail(patch.email)) {
      throw new PortError('ConstraintViolation', 'Email is required', { field: 'email' });
    }
    const { set, unset } = toMongoWrite(patch);
    if (set.username) {
      const tenant = patch.tenantId !== undefined ? patch.tenantId : (current.tenantId ?? null);
      await this.assertUsernameFree(set.username, tenant, id);
    }
    const update: Filter = {};
    if (Object.keys(set).length) update.$set = set;
    if (unset.length) update.$unset = Object.fromEntries(unset.map((f) => [f, 1]));
    if (Object.keys(update).length) {
      await this.run(() =>
        this.users.updateOne({ _id: id }, update, { runValidators: true }).exec(),
      );
    }
    return this.reload(id);
  }

  async count(): Promise<number> {
    return this.run(() => this.users.countDocuments({}).exec());
  }

  private emailFilter(email: string, tenantId?: string | null): Filter {
    return { email: normalizeEmail(email), tenantId: tenantId ?? null };
  }

  /** Mongo has no unique username index; uniqueness per tenant is enforced here (not race-free). */
  private async assertUsernameFree(
    username: unknown,
    tenantId: string | null,
    selfId?: string,
  ): Promise<void> {
    if (typeof username !== 'string' || username === '') return;
    const filter: Filter = { username: normalizeUsername(username), tenantId };
    if (selfId) filter._id = { $ne: selfId };
    const clash = await this.run(() => this.users.exists(filter));
    if (clash) {
      throw new PortError('Conflict', 'Unique constraint violated on username', {
        field: 'username',
      });
    }
  }

  private async reload(id: string): Promise<UserRecord> {
    const doc = await this.run(() => this.users.findById(id).lean<MongoUserDoc>().exec());
    if (!doc) throw new PortError('NotFound', 'User not found');
    return toUserRecord(doc);
  }

  private async run<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      throw mapMongoError(err);
    }
  }
}
