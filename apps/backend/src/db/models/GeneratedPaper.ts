import { ObjectId } from 'mongodb';
import { GeneratedPaper } from '../../types';
import { getDb } from '../mongodb';

const COLLECTION_NAME = 'generated_papers';

export class GeneratedPaperModel {
  private static async getCollection() {
    const db = await getDb();
    const collection = db.collection<GeneratedPaper>(COLLECTION_NAME);
    collection.createIndex({ assignmentId: 1 }).catch(() => undefined);
    return collection;
  }

  static async create(paper: Omit<GeneratedPaper, 'id' | 'createdAt'>): Promise<GeneratedPaper> {
    const collection = await this.getCollection();
    const nextPaper: GeneratedPaper = {
      ...paper,
      id: new ObjectId().toString(),
      createdAt: new Date().toISOString(),
    };

    await collection.insertOne(nextPaper);
    return nextPaper;
  }

  static async findById(id: string) {
    const collection = await this.getCollection();
    return collection.findOne({ id });
  }

  static async findByAssignmentId(assignmentId: string) {
    const collection = await this.getCollection();
    return collection.find({ assignmentId }).sort({ createdAt: -1 }).toArray();
  }

  static async findAll() {
    const collection = await this.getCollection();
    return collection.find().sort({ createdAt: -1 }).toArray();
  }

  static async delete(id: string) {
    const collection = await this.getCollection();
    const result = await collection.deleteOne({ id });
    return result.deletedCount > 0;
  }
}
