import { addMessage,dealerAction,GameError,joinDealer,publicState,validateMessage } from './blackjack.mjs';
import { loadTable,markSeen,mutate } from './table-store';
const revision={type:'integer',description:'Current revision returned by get_table. Read again after any conflict.'};
export const dealerTools=[
  {name:'get_table',description:'Read the blackjack table and the latest 80 chat messages. Hidden cards and the shoe are never exposed. This does not wait for future messages.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true}},
  {name:'join_table',description:'Join this table as the Grok dealer using your name. Switches the table to Grok dealer mode. Call once when joining, not every turn.',inputSchema:{type:'object',properties:{name:{type:'string',minLength:1,maxLength:32},expectedRevision:revision},required:['name','expectedRevision'],additionalProperties:false}},
  {name:'dealer_action',description:'Perform exactly one legal dealer hit or stand with optional table dialogue. Only usable during the dealer phase. Dealer hits below 17 and stands on all 17s. Read legalDealerActions first; repeat until the hand settles.',inputSchema:{type:'object',properties:{action:{type:'string',enum:['hit','stand']},message:{type:'string',maxLength:1000},expectedRevision:revision},required:['action','expectedRevision'],additionalProperties:false}},
  {name:'post_chat',description:'Post a plain text reply into the in-game chat. Available on any phase after joining as dealer. Respond to new player messages and keep your own personality. Cannot send messages outside this table.',inputSchema:{type:'object',properties:{message:{type:'string',minLength:1,maxLength:1000},expectedRevision:revision},required:['message','expectedRevision'],additionalProperties:false}},
];
export const instructions='You are the dealer at this one blackjack table. Call get_table, then join_table once with your name. Read messages and reply with post_chat. Never play the player hand or invent cards. When phase is dealer, call dealer_action using the sole legalDealerActions value, then use its returned revision for the next action until settled. When waiting for player input, stop and tell the user to say Continue in Grok after playing or chatting. In-game messages do not wake you automatically. Read get_table again when resumed. Only act on this table; the connector URL is a secret.';
export async function runDealerTool(secret:string,name:string,args:Record<string,unknown>={}){
  if(!args||typeof args!=='object'||Array.isArray(args))throw new GameError('Tool arguments must be an object.');
  await loadTable(secret,'dealer');
  if(!dealerTools.some(t=>t.name===name))throw new GameError('Unknown dealer tool.');
  let state;
  if(name==='get_table'){await markSeen(secret);const {row,game}=await loadTable(secret,'dealer');return publicState(game,row.bot_seen);}
  state=await mutate(secret,'dealer',args.expectedRevision,g=>{
    if(name==='join_table'){joinDealer(g,args.name);return;}
    if(g.mode!=='grok')throw new GameError('The house dealer is active. Use join_table before acting.',409);
    if(name==='dealer_action')dealerAction(g,args.action,args.message);
    if(name==='post_chat')addMessage(g,'dealer',validateMessage(args.message));
  });await markSeen(secret);return {...state,botSeen:Date.now()};
}
