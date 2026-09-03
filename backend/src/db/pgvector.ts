import { prisma } from './prisma';

export function formatVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

/**
 * Updates ForensicsResult with 1536-dim vector embedding using raw SQL
 */
export async function updateForensicsFingerprint(
  documentId: string,
  embedding: number[]
): Promise<void> {
  const vectorStr = formatVector(embedding);
  await prisma.$executeRawUnsafe(
    `UPDATE "ForensicsResult" SET "fingerprintEmbedding" = $1::vector WHERE "documentId" = $2`,
    vectorStr,
    documentId
  );
}

/**
 * Finds matching documents by fingerprint cosine similarity
 */
export async function findRingMatches(
  currentDocumentId: string,
  threshold: number = 0.85,
  limit: number = 5
): Promise<Array<{ documentId: string; similarityScore: number }>> {
  try {
    // 1 - (A <=> B) gives cosine similarity
    const matches: any = await prisma.$queryRawUnsafe(
      `
      WITH current_doc AS (
        SELECT "fingerprintEmbedding" as current_emb
        FROM "ForensicsResult"
        WHERE "documentId" = $1 AND "fingerprintEmbedding" IS NOT NULL
        LIMIT 1
      )
      SELECT 
        f."documentId",
        ROUND((1 - (f."fingerprintEmbedding" <=> c.current_emb))::numeric, 4)::float as "similarityScore"
      FROM "ForensicsResult" f, current_doc c
      WHERE f."documentId" != $1 
        AND f."fingerprintEmbedding" IS NOT NULL
        AND (1 - (f."fingerprintEmbedding" <=> c.current_emb)) >= $2
      ORDER BY "similarityScore" DESC
      LIMIT $3;
      `,
      currentDocumentId,
      threshold,
      limit
    );

    return matches.map((m: any) => ({
      documentId: m.documentId,
      similarityScore: parseFloat(m.similarityScore),
    }));
  } catch (error) {
    console.error('[pgvector] findRingMatches error:', error);
    return [];
  }
}

/**
 * Inserts a PolicyClause with pgvector embedding
 */
export async function insertPolicyClause(
  id: string,
  text: string,
  category: string,
  embedding: number[]
): Promise<void> {
  const vectorStr = formatVector(embedding);
  await prisma.$executeRawUnsafe(
    `INSERT INTO "PolicyClause" ("id", "text", "category", "embedding") 
     VALUES ($1, $2, $3, $4::vector)`,
    id,
    text,
    category,
    vectorStr
  );
}

/**
 * Searches top matching Policy Clauses by cosine similarity
 */
export async function searchPolicyClauses(
  queryEmbedding: number[],
  topK: number = 3
): Promise<Array<{ id: string; text: string; category: string; similarity: number }>> {
  try {
    const vectorStr = formatVector(queryEmbedding);
    const results: any = await prisma.$queryRawUnsafe(
      `
      SELECT 
        "id", "text", "category",
        ROUND((1 - ("embedding" <=> $1::vector))::numeric, 4)::float as "similarity"
      FROM "PolicyClause"
      WHERE "embedding" IS NOT NULL
      ORDER BY "embedding" <=> $1::vector ASC
      LIMIT $2;
      `,
      vectorStr,
      topK
    );

    return results.map((r: any) => ({
      id: r.id,
      text: r.text,
      category: r.category,
      similarity: parseFloat(r.similarity),
    }));
  } catch (error) {
    console.error('[pgvector] searchPolicyClauses error:', error);
    return [];
  }
}
