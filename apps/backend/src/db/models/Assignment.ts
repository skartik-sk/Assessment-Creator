import { ObjectId } from 'mongodb';
import { Assignment } from '../../types';
import { getDb } from '../mongodb';

const COLLECTION_NAME = 'assignments';

type AssignmentFilter = Partial<Pick<Assignment, 'id' | 'subject' | 'school'>>;

export class AssignmentModel {
  private static async getCollection() {
    const db = await getDb();
    const collection = db.collection<Assignment>(COLLECTION_NAME);
    collection.createIndex({ createdAt: -1 }).catch(() => undefined);
    return collection;
  }

  static async create(
    assignment: Omit<Assignment, 'id' | 'assignedDate' | 'createdAt' | 'updatedAt'>
  ): Promise<Assignment> {
    const collection = await this.getCollection();
    const now = new Date().toISOString();

    const newAssignment: Assignment = {
      ...assignment,
      id: new ObjectId().toString(),
      assignedDate: now,
      createdAt: now,
      updatedAt: now,
    };

    await collection.insertOne(newAssignment);
    return newAssignment;
  }

  static async findById(id: string) {
    const collection = await this.getCollection();
    return collection.findOne({ id });
  }

  static async findAll(filter: AssignmentFilter = {}) {
    const collection = await this.getCollection();
    return collection.find(filter).sort({ createdAt: -1 }).toArray();
  }

  static async update(id: string, updates: Partial<Assignment>) {
    const collection = await this.getCollection();
    const result = await collection.findOneAndUpdate(
      { id },
      { $set: { ...updates, updatedAt: new Date().toISOString() } },
      { returnDocument: 'after' }
    );

    return result;
  }

  static async delete(id: string) {
    const collection = await this.getCollection();
    const result = await collection.deleteOne({ id });
    return result.deletedCount > 0;
  }

  static async count(filter: AssignmentFilter = {}) {
    const collection = await this.getCollection();
    return collection.countDocuments(filter);
  }
}
