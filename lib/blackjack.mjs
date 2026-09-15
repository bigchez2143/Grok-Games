export class GameError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function score(cards) {
  let total=0, aces=0;
  for(const c of cards){ if(c.rank==='A'){aces++;total+=11;} else total+=['K','Q','J'].includes(c.rank)?10:Number(c.rank); }
  while(total>21 && aces){total-=10;aces--;}
  return {total,soft:aces>0};
}
export function shuffledShoe() {
  const deck=[];
  for(let d=0;d<6;d++) for(const suit of ['spades','hearts','diamonds','clubs']) for(const rank of ['A','2','3','4','5','6','7','8','9','10','J','Q','K']) deck.push({rank,suit});
  for(let i=deck.length-1;i>0;i--){
    const range=i+1,limit=Math.floor(4294967296/range)*range;let r;
    do{r=crypto.getRandomValues(new Uint32Array(1))[0];}while(r>=limit);
    const j=r%range;[deck[i],deck[j]]=[deck[j],deck[i]];
  }
  return deck;
}
export function newGame(id) {
  const g={id,revision:0,round:0,bankroll:1000,bet:0,phase:'betting',mode:'house',dealerName:'House dealer',player:[],dealer:[],deck:shuffledShoe(),revealed:false,outcome:null,history:[],messages:[],wins:0,hands:0};
  addMessage(g,'dealer','Welcome to After Hours. Choose your chips and I’ll deal you in.');return g;
}
export function addMessage(g,role,text) {
  g.messages.push({id:crypto.randomUUID(),role,name:role==='dealer'?g.dealerName:role==='player'?'You':'Table',text,at:Date.now()});
  g.messages=g.messages.slice(-80);
}
function draw(g,hand){if(!g.deck.length)throw new GameError('The shoe is empty. Open a new table.',409);hand.push(g.deck.pop());}
export function legalDealer(g){return g.phase==='dealer'?[score(g.dealer).total<17?'hit':'stand']:[];}
export function legalPlayer(g){
  if(g.phase==='betting'||g.phase==='settled')return ['deal',...(g.bankroll<5?['refill']:[])];
  if(g.phase==='player')return ['hit','stand',...(g.player.length===2&&g.bankroll>=g.bet?['double']:[])];
  return [];
}
/** @param {any} g @param {number|null} botSeen */
export function publicState(g,botSeen=null) {
  const dealer=g.revealed?g.dealer:g.dealer.map((c,i)=>i===0?c:{hidden:true});
  return {id:g.id,revision:g.revision,round:g.round,bankroll:g.bankroll,bet:g.bet,phase:g.phase,mode:g.mode,dealerName:g.dealerName,player:g.player,dealer,dealerScore:score(g.revealed?g.dealer:g.dealer.slice(0,1)),playerScore:score(g.player),revealed:g.revealed,outcome:g.outcome,history:g.history,messages:g.messages,wins:g.wins,hands:g.hands,legalPlayerActions:legalPlayer(g),legalDealerActions:legalDealer(g),botSeen,rules:{decks:6,blackjackPayout:'3:2',dealerStandsOnSoft17:true,doubleOnAnyFirstTwo:true,split:false,insurance:false,minimumBet:5,maximumBet:500},nextStep:g.phase==='dealer'?'Dealer must '+legalDealer(g)[0]+'.':g.phase==='player'?'Wait for the player to hit, stand, or double.':'Wait for the player to place a bet and deal.'};
}
function settle(g,result,reason){
  if(g.phase==='settled')throw new GameError('This hand is already settled.',409);
  const returned=result==='blackjack'?g.bet*2.5:result==='win'?g.bet*2:result==='push'?g.bet:0;
  g.bankroll+=returned;g.revealed=true;g.phase='settled';g.hands++;if(['win','blackjack'].includes(result))g.wins++;
  g.outcome={result,reason,profit:returned-g.bet};
  g.history.unshift({round:g.round,result,profit:returned-g.bet,player:score(g.player).total,dealer:score(g.dealer).total});g.history=g.history.slice(0,12);
  addMessage(g,'system',reason);
}
function compare(g){const p=score(g.player).total,d=score(g.dealer).total;settle(g,d>21||p>d?'win':p===d?'push':'loss',d>21?'Dealer busts. You win.':p>d?'Your hand wins.':p===d?'Push. Your bet is returned.':'Dealer wins this hand.');}
export function dealerAction(g,action,message){
  if(g.phase!=='dealer')throw new GameError('It is not the dealer’s turn.',409);
  if(!legalDealer(g).includes(action))throw new GameError('Dealer must '+legalDealer(g)[0]+'. House rules cannot be overridden.',409);
  if(message)addMessage(g,'dealer',validateMessage(message));
  if(action==='hit'){draw(g,g.dealer);addMessage(g,'system','Dealer draws '+g.dealer.at(-1).rank+'.');if(score(g.dealer).total>21)compare(g);}
  else compare(g);
}
export function finishHouse(g){
  if(g.mode==='house'&&g.phase==='dealer'){
    addMessage(g,'dealer','Let’s turn these over and see where we land.');
    while(g.phase==='dealer')dealerAction(g,legalDealer(g)[0]);
  }
}
function playerDone(g){g.phase='dealer';g.revealed=true;finishHouse(g);}
export function playerAction(g,action,bet){
  if(!legalPlayer(g).includes(action))throw new GameError('That move is not available right now.',409);
  if(action==='refill'){g.bankroll=1000;addMessage(g,'system','Your play chips have been refilled to 1,000.');return;}
  if(action==='deal'){
    if(typeof bet!=='number'||!Number.isInteger(bet)||bet<5||bet>500||bet>g.bankroll)throw new GameError('Choose a whole-chip bet from 5 to 500 within your balance.');
    if(g.deck.length<52)g.deck=shuffledShoe();
    g.bet=bet;g.bankroll-=bet;g.player=[];g.dealer=[];g.outcome=null;g.revealed=false;g.round++;g.phase='player';
    draw(g,g.player);draw(g,g.dealer);draw(g,g.player);draw(g,g.dealer);
    addMessage(g,'system','Hand '+g.round+' · '+bet+' chips on the table.');
    const p=score(g.player).total===21,d=score(g.dealer).total===21;
    if(p||d){settle(g,p&&d?'push':p?'blackjack':'loss',p&&d?'Two blackjacks. Push.':p?'Blackjack! Paid at 3:2.':'Dealer has blackjack.');}
    else if(g.mode==='house')addMessage(g,'dealer','You have '+score(g.player).total+'. Hit, stand, or make it a double?');
  } else if(action==='hit'){
    draw(g,g.player);const p=score(g.player).total;
    if(p>21)settle(g,'loss','You bust. Dealer wins.');else if(p===21)playerDone(g);
  } else if(action==='stand'){playerDone(g);}
  else if(action==='double'){g.bankroll-=g.bet;g.bet*=2;draw(g,g.player);if(score(g.player).total>21)settle(g,'loss','You bust on the double.');else playerDone(g);}
}
export function validateMessage(message){if(typeof message!=='string'||!message.trim()||message.trim().length>1000)throw new GameError('Messages must be between 1 and 1,000 characters.');return message.trim();}
export function joinDealer(g,name){if(typeof name!=='string'||!name.trim()||name.trim().length>32)throw new GameError('Dealer name must be 1 to 32 characters.');g.mode='grok';g.dealerName=name.trim();addMessage(g,'dealer','I’m at the table. Let’s play.');}
export function setMode(g,mode){if(!['house','grok'].includes(mode))throw new GameError('Choose house or grok.');g.mode=mode;if(mode==='house'){g.dealerName='House dealer';addMessage(g,'dealer','I’ll take it from here.');finishHouse(g);}else{g.dealerName='Grok dealer';addMessage(g,'system','Grok dealer selected. Connect your bot, then ask it to join the table.');}}
