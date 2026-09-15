import { env } from 'cloudflare:workers';
import { GameError,newGame,publicState } from './blackjack.mjs';
type Row={id:string;state:string;revision:number;bot_seen:number|null};
export function database(){if(!env.DB)throw new GameError('The table service is unavailable. Please try again.',503);return env.DB;}
export function token(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');}
export async function hash(value:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');}
export function playerToken(request:Request){return request.headers.get('cookie')?.match(/(?:^|;\s*)ah_player=([a-f0-9]{64})(?:;|$)/)?.[1]??'';}
export function bearer(request:Request){return request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/i)?.[1]??'';}
export async function loadTable(secret:string,role:'player'|'dealer'){
  if(!/^[a-f0-9]{64}$/.test(secret))throw new GameError('Table key is missing or invalid.',401);
  const row=await database().prepare('SELECT id,state,revision,bot_seen FROM blackjack_tables WHERE '+(role==='player'?'player_hash':'dealer_hash')+' = ?').bind(await hash(secret)).first<Row>();
  if(!row)throw new GameError('This table key has expired or was revoked.',401);
  return {row,game:JSON.parse(row.state)};
}
export async function createTable(){
  const player=token(),dealer=token(),game=newGame(crypto.randomUUID());
  await database().prepare('INSERT INTO blackjack_tables (id,player_hash,dealer_hash,state,revision,created_at) VALUES (?,?,?,?,?,?)').bind(game.id,await hash(player),await hash(dealer),JSON.stringify(game),0,Date.now()).run();
  return {game,player,dealer};
}
export async function mutate(secret:string,role:'player'|'dealer',revision:unknown,fn:(game:any)=>void){
  if(!Number.isSafeInteger(revision))throw new GameError('Include the current expectedRevision.',400);
  const {row,game}=await loadTable(secret,role);
  if(row.revision!==revision)throw new GameError('The table changed. Read it again before making a move.',409);
  fn(game);game.revision=row.revision+1;
  const r=await database().prepare('UPDATE blackjack_tables SET state=?,revision=? WHERE id=? AND revision=? AND '+(role==='player'?'player_hash':'dealer_hash')+'=?').bind(JSON.stringify(game),game.revision,row.id,row.revision,await hash(secret)).run();
  if(r.meta.changes!==1)throw new GameError('The table changed. Read it again before making a move.',409);
  return publicState(game,row.bot_seen);
}
export async function markSeen(secret:string){await database().prepare('UPDATE blackjack_tables SET bot_seen=? WHERE dealer_hash=?').bind(Date.now(),await hash(secret)).run();}
export async function rotateDealer(secret:string){
  const dealer=token();
  const r=await database().prepare('UPDATE blackjack_tables SET dealer_hash=?,bot_seen=NULL WHERE player_hash=?').bind(await hash(dealer),await hash(secret)).run();
  if(r.meta.changes!==1)throw new GameError('Your table is unavailable.',401);return dealer;
}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});}
export function failure(error:unknown){if(error instanceof GameError)return json({error:error.message},error.status);console.error('Table operation failed',error instanceof Error?error.message:'unknown');return json({error:'The table service is temporarily unavailable. Please try again.'},503);}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new GameError('Origin is not allowed.',403);}
export async function body(request:Request){if(Number(request.headers.get('content-length')??0)>16384)throw new GameError('Request is too large.',413);const text=await request.text();if(text.length>16384)throw new GameError('Request is too large.',413);try {return JSON.parse(text);}catch{throw new GameError('Send a valid JSON object.',400);}}
