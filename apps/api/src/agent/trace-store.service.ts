import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { DataPathService } from '../common/data-path';

type Trace = { id: string; createdAt: string; question: string; steps: Array<{step:string;detail:string}> };
@Injectable()
export class TraceStoreService implements OnModuleDestroy {
  private pool?: Pool;
  private ready = false;
  constructor(private readonly dataPath: DataPathService) {
    if (process.env.DATABASE_URL) this.pool = new Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:3000});
  }
  private async db() {
    if (!this.pool) return false;
    if (this.ready) return true;
    try { await this.pool.query('CREATE TABLE IF NOT EXISTS assistant_traces (id TEXT PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL, question TEXT NOT NULL, steps JSONB NOT NULL)'); this.ready=true; return true; }
    catch { return false; }
  }
  private path() { return this.dataPath.resolve('traces/assistant.json'); }
  private async fileRead(): Promise<Trace[]> { try { return JSON.parse(await readFile(this.path(),'utf8')) as Trace[]; } catch { return []; } }
  async save(question:string,steps:Trace['steps']):Promise<string> {
    const trace:Trace={id:crypto.randomUUID(),createdAt:new Date().toISOString(),question,steps};
    if(await this.db()) {try {await this.pool!.query('INSERT INTO assistant_traces(id,created_at,question,steps) VALUES($1,$2,$3,$4)',[trace.id,trace.createdAt,trace.question,JSON.stringify(trace.steps)]); await this.pool!.query('DELETE FROM assistant_traces WHERE id NOT IN (SELECT id FROM assistant_traces ORDER BY created_at DESC LIMIT 100)');return trace.id;}catch {/* file fallback */}}
    const recent=[trace,...await this.fileRead()].slice(0,100);
    await mkdir(this.dataPath.resolve('traces'),{recursive:true});await writeFile(this.path(),JSON.stringify(recent),'utf8');return trace.id;
  }
  async recent():Promise<Trace[]> {
    if(await this.db()) {try {const rows=await this.pool!.query('SELECT id, created_at AS "createdAt", question, steps FROM assistant_traces ORDER BY created_at DESC LIMIT 100');return rows.rows as Trace[];}catch {/* file fallback */}}
    return this.fileRead();
  }
  async onModuleDestroy(){await this.pool?.end();}
}
