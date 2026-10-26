import type { MongoDocument, UsersCollection } from './types';
import type { SourceUserDoc } from '../mappings/users';

/** Streams the Mongo `users` collection by `_id` cursor in batches (size is a parameter). */
export async function* extractUsers(
  collection: UsersCollection,
  batchSize: number,
): AsyncGenerator<SourceUserDoc[]> {
  let last: unknown;
  for (;;) {
    const filter: MongoDocument = last === undefined ? {} : { _id: { $gt: last } };
    const docs = (await collection
      .find(filter)
      .sort({ _id: 1 })
      .limit(batchSize)
      .toArray()) as unknown as SourceUserDoc[];
    if (docs.length === 0) return;
    yield docs;
    last = docs[docs.length - 1]?._id;
    if (docs.length < batchSize) return;
  }
}

export async function countUsers(collection: UsersCollection): Promise<number> {
  return collection.countDocuments({});
}
