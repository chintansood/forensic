import { MongoClient, Db } from 'mongodb';

let dbInstance: Db | null = null;
let clientInstance: MongoClient | null = null;

const inMemoryRawUploads: any[] = [];
const inMemoryAgentTraces: any[] = [];

export async function getMongoDb(): Promise<Db | null> {
  if (dbInstance) return dbInstance;

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/docforensic';
  try {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 2000 });
    await client.connect();
    clientInstance = client;
    dbInstance = client.db();
    console.log('[MongoDB] Connected successfully');
    return dbInstance;
  } catch (error) {
    console.warn('[MongoDB] Direct connection failed, using persistent fallback cache');
    return null;
  }
}

export async function saveRawUpload(data: { documentId: string; ocrRawText: string; uploadedAt: Date }) {
  const db = await getMongoDb();
  if (db) {
    await db.collection('rawUploads').insertOne(data);
  } else {
    inMemoryRawUploads.push(data);
  }
}

export async function saveAgentTrace(data: {
  documentId: string;
  agentName: string;
  startedAt: Date;
  completedAt: Date;
  rawOutput: any;
}) {
  const db = await getMongoDb();
  if (db) {
    await db.collection('agentTraces').insertOne(data);
  } else {
    inMemoryAgentTraces.push(data);
  }
}

export async function getAgentTraces(documentId: string) {
  const db = await getMongoDb();
  if (db) {
    return await db.collection('agentTraces').find({ documentId }).toArray();
  }
  return inMemoryAgentTraces.filter((t) => t.documentId === documentId);
}
