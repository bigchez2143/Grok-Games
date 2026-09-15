import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL||'http://localhost:5173';
let cookie,secret,state;
async function player(payload){const r=await fetch(base+'/api/table',{method:payload?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:payload?JSON.stringify(payload):undefined});const playerCookie=r.headers.getSetCookie().find(c=>c.startsWith('ah_player='));if(playerCookie)cookie=playerCookie.split(';')[0];return {r,data:await r.json()};}
async function rpc(method,params={},id=1,token=secret){const r=await fetch(base+'/api/mcp/'+token,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id,method,params})});return {r,data:await r.json()};}
async function tool(name,args={}){const {data,r}=await rpc('tools/call',{name,arguments:args});assert.equal(r.status,200);return data.result;}
let created=await player({action:'create'});assert.equal(created.r.status,200);state=created.data;secret=state.dealerToken;assert.equal(secret.length,64);
assert.equal((await player()).data.id,state.id);
const init=await rpc('initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'test-bot',version:'1'}},0);assert.equal(init.data.id,0);assert.equal(init.data.result.protocolVersion,'2025-03-26');
assert.equal((await rpc('tools/list')).data.result.tools.length,4);
assert.equal((await rpc('ping',{},null)).data.error.code,-32600);
assert.equal((await rpc('ping',{},1.5)).data.error.code,-32600);
assert.equal((await rpc('tools/call',{name:'missing'})).data.error.code,-32602);
assert.equal((await rpc('tools/call',{name:'post_chat',arguments:{}})).data.error.code,-32602);
const malformed=await fetch(base+'/api/mcp/'+secret,{method:'POST',headers:{'Content-Type':'application/json'},body:'{broken'});assert.equal((await malformed.json()).error.code,-32700);
const batch=await fetch(base+'/api/mcp/'+secret,{method:'POST',headers:{'Content-Type':'application/json','MCP-Protocol-Version':'2025-03-26'},body:JSON.stringify([{jsonrpc:'2.0',method:'notifications/initialized'},{jsonrpc:'2.0',id:2,method:'ping'}])});const batchData=await batch.json();assert.equal(batchData.length,1);assert.equal(batchData[0].id,2);
const n=await fetch(base+'/api/mcp/'+secret,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})});assert.equal(n.status,202);assert.equal(await n.text(),'');
assert.equal((await fetch(base+'/api/mcp/'+secret)).status,405);
state=(await tool('join_table',{name:'Test Grok',expectedRevision:state.revision})).structuredContent;assert.equal(state.mode,'grok');
const chat=await player({action:'chat',message:'Hello from the player',expectedRevision:state.revision});assert.equal(chat.r.status,200,chat.data.error);state=chat.data;
let read=(await tool('get_table')).structuredContent;assert.ok(read.messages.some(m=>m.text==='Hello from the player'));assert.ok(!('deck'in read));
state=(await tool('post_chat',{message:'Hello from the MCP dealer',expectedRevision:read.revision})).structuredContent;
assert.ok((await player()).data.messages.some(m=>m.text==='Hello from the MCP dealer'));
const stale=await tool('post_chat',{message:'duplicate',expectedRevision:read.revision});assert.equal(stale.isError,true);
const oldRev=state.revision;
const race=await Promise.all([player({action:'deal',bet:25,expectedRevision:oldRev}),player({action:'deal',bet:25,expectedRevision:oldRev})]);assert.deepEqual(race.map(x=>x.r.status).sort(),[200,409]);state=(await player()).data;
if(state.phase==='player'){assert.ok(state.dealer[1].hidden);assert.equal((await tool('dealer_action',{action:'hit',expectedRevision:state.revision})).isError,true);state=(await player({action:'stand',expectedRevision:state.revision})).data;}
while(state.phase==='dealer'){state=(await tool('dealer_action',{action:state.legalDealerActions[0],expectedRevision:state.revision,message:'Dealer test move'})).structuredContent;}
assert.equal(state.phase,'settled');const balance=state.bankroll;assert.equal((await tool('dealer_action',{action:'stand',expectedRevision:state.revision})).isError,true);assert.equal((await player()).data.bankroll,balance);
assert.equal((await fetch(base+'/api/dealer')).status,401);
const h=await fetch(base+'/api/dealer',{headers:{Authorization:'Bearer '+secret}});assert.equal(h.status,200);assert.equal((await h.json()).id,state.id);
const rotated=await player({action:'connector'});const old=secret;secret=rotated.data.dealerToken;assert.notEqual(old,secret);assert.equal((await rpc('tools/list',{},1,old)).r.status,401);assert.equal((await rpc('tools/list')).r.status,200);
const csrf=await fetch(base+'/api/table',{method:'POST',headers:{Origin:'https://untrusted.example','Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({action:'chat',message:'cross-origin',expectedRevision:state.revision})});assert.equal(csrf.status,403);
console.log('PASS: MCP initialize/notifications/tools, shared chat, hidden cards, duplicate-action race, dealer settlement, HTTP auth, key revocation, origin checks.');
