import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import type { RecordData } from "@pharmacy/domain/admin";
export class Store {
 db: DatabaseSync;
 constructor(path:string) {
  this.db=new DatabaseSync(path);
  this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS records(collection TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,published TEXT,PRIMARY KEY(collection,id));
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,kind TEXT NOT NULL,subject TEXT NOT NULL,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY,owner TEXT NOT NULL,public INTEGER NOT NULL,bytes BLOB NOT NULL,mime TEXT NOT NULL,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS idempotency(customer TEXT NOT NULL,key TEXT NOT NULL,orderId TEXT NOT NULL,PRIMARY KEY(customer,key));
    PRAGMA user_version=1;`);
 }
 list(collection:string):RecordData[] { return (this.db.prepare('SELECT data FROM records WHERE collection=?').all(collection) as any[]).map(r=>JSON.parse(r.data)); }
 get(collection:string,id:string):RecordData|undefined {const r=this.db.prepare('SELECT data FROM records WHERE collection=? AND id=?').get(collection,id) as any;return r?JSON.parse(r.data):undefined;}
 published(collection:string):RecordData[] {return (this.db.prepare('SELECT published FROM records WHERE collection=? AND published IS NOT NULL').all(collection) as any[]).map(r=>JSON.parse(r.published));}
 put(collection:string,value:any):RecordData {
  const old=value.id?this.get(collection,value.id):undefined;
  const now=new Date().toISOString();
  const data={...value,id:value.id||randomUUID(),version:(old?.version??0)+1,createdAt:old?.createdAt??now,updatedAt:now};
  const previous=this.db.prepare('SELECT published FROM records WHERE collection=? AND id=?').get(collection,data.id) as any;
  const published=data.status==='published'?JSON.stringify(data):data.status==='archived'?null:previous?.published??null;
  this.db.prepare('INSERT INTO records(collection,id,data,published) VALUES(?,?,?,?) ON CONFLICT(collection,id) DO UPDATE SET data=excluded.data,published=excluded.published').run(collection,data.id,JSON.stringify(data),published);
  return data;
 }
 transaction<T>(fn:()=>T):T {this.db.exec('BEGIN IMMEDIATE');try {const result=fn();this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 audit(actor:string,action:string,collection:string,id:string,reason:string,before?:any,after?:any) {
  const scrub=(v:any)=>v?Object.fromEntries(Object.entries(v).filter(([k])=>!['password','passwordHash'].includes(k))):null;
  this.put('audit',{actor,action,collection,recordId:id,reason,before:scrub(before),after:scrub(after)});
 }
 close(){this.db.close();}
}
