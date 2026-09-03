import { Response } from 'express';
import { EventEmitter } from 'events';

class SSEManager extends EventEmitter {
  private clients: Map<string, Set<Response>> = new Map();

  addClient(documentId: string, res: Response) {
    if (!this.clients.has(documentId)) {
      this.clients.set(documentId, new Set());
    }
    this.clients.get(documentId)!.add(res);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', documentId })}\n\n`);

    res.on('close', () => {
      const set = this.clients.get(documentId);
      if (set) {
        set.delete(res);
        if (set.size === 0) {
          this.clients.delete(documentId);
        }
      }
    });
  }

  broadcast(documentId: string, payload: any) {
    const set = this.clients.get(documentId);
    if (set && set.size > 0) {
      const dataStr = `data: ${JSON.stringify(payload)}\n\n`;
      set.forEach((res) => {
        try {
          res.write(dataStr);
        } catch (e) {
          // ignore closed connection
        }
      });
    }
  }
}

export const sseManager = new SSEManager();
