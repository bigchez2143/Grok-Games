import { body,createTable,failure,json,loadTable,mutate,playerToken,sameOrigin,rotateDealer } from '@/lib/table-store';
import { addMessage,GameError,playerAction,publicState,setMode,validateMessage,dealerAction } from '@/lib/blackjack.mjs';
export async function GET(request:Request){try{const {row,game}=await loadTable(playerToken(request),'player');return json(publicState(game,row.bot_seen));}catch(e){return failure(e);}}
export async function POST(request:Request){try{
  sameOrigin(request);const b=await body(request);if(!b||typeof b!=='object')throw new GameError('Send a JSON object.');
  if(b.action==='create'){
    if(playerToken(request)){try{const {game}=await loadTable(playerToken(request),'player');return json(publicState(game));}catch(e){if(!(e instanceof GameError)||e.status!==401)throw e;}}
    const {game,player,dealer}=await createTable();const response=json({...publicState(game),dealerToken:dealer});
    response.headers.set('Set-Cookie','ah_player='+player+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000'+(new URL(request.url).protocol==='https:'?'; Secure':''));return response;
  }
  if(b.action==='connector'){const dealer=await rotateDealer(playerToken(request));return json({dealerToken:dealer});}
  const state=await mutate(playerToken(request),'player',b.expectedRevision,g=>{
    if(b.action==='chat'){addMessage(g,'player',validateMessage(b.message));if(g.mode==='house')addMessage(g,'dealer','I’m the house dealer. I can handle the cards; connect your Grok bot for conversation.');}
    else if(b.action==='mode')setMode(g,b.mode);
    else if(b.action==='bridge'){
      if(b.gameId!==g.id)throw new GameError('This reply belongs to another table.',409);
      if(g.mode!=='grok')throw new GameError('Choose Grok dealer first.',409);
      if(b.dealerAction==='say')addMessage(g,'dealer',validateMessage(b.message));else dealerAction(g,b.dealerAction,b.message);
    }else playerAction(g,b.action,b.bet);
  });return json(state);
}catch(e){return failure(e);}}
