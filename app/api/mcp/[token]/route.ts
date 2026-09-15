import { body,failure,json,loadTable } from '@/lib/table-store';
import { dealerTools,instructions,runDealerTool } from '@/lib/dealer-tools';
const versions=['2025-03-26','2025-06-18','2025-11-25'];
type Context={params:Promise<{token:string}>};
const rpcError=(id:unknown,code:number,message:string)=>({jsonrpc:'2.0',id,error:{code,message}});
async function handle(message:any,token:string){
 if(!message||typeof message!=='object'||Array.isArray(message)||message.jsonrpc!=='2.0'||typeof message.method!=='string')return rpcError(null,-32600,'Invalid JSON-RPC request.');
 if(message.id===undefined)return null;
 const id=message.id;
 if(typeof id!=='string'&&!(typeof id==='number'&&Number.isSafeInteger(id)))return rpcError(null,-32600,'Request id must be a string or integer.');
 if(message.params!==undefined&&(!message.params||typeof message.params!=='object'||Array.isArray(message.params)))return rpcError(id,-32602,'Params must be an object.');
 let result:unknown;
 if(message.method==='initialize')result={protocolVersion:versions.includes(message.params?.protocolVersion)?message.params.protocolVersion:'2025-11-25',capabilities:{tools:{listChanged:false}},serverInfo:{name:'after-hours-blackjack',version:'1.0.0'},instructions};
 else if(message.method==='ping')result={};
 else if(message.method==='tools/list')result={tools:dealerTools};
 else if(message.method==='tools/call'){
  const name=message.params?.name,args=message.params?.arguments??{};
  const tool=dealerTools.find(t=>t.name===name);
  if(!tool)return rpcError(id,-32602,'Unknown tool.');
  if(!args||typeof args!=='object'||Array.isArray(args))return rpcError(id,-32602,'Tool arguments must be an object.');
  const schema=tool.inputSchema as unknown as {properties:Record<string,{type:string;enum?:string[];minLength?:number;maxLength?:number}>;required?:string[]};
  if(Object.keys(args).some(key=>!(key in schema.properties))||(schema.required??[]).some(key=>!(key in args)))return rpcError(id,-32602,'Unexpected or missing tool arguments.');
  for(const [key,value] of Object.entries(args)){const property=schema.properties[key];if(property.type==='integer'&&!Number.isSafeInteger(value))return rpcError(id,-32602,key+' must be an integer.');if(property.type==='string'&&(typeof value!=='string'||(property.minLength!==undefined&&value.length<property.minLength)||(property.maxLength!==undefined&&value.length>property.maxLength)||(property.enum&&!property.enum.includes(value))))return rpcError(id,-32602,'Invalid '+key+'.');}
  try{const state=await runDealerTool(token,name,args);result={content:[{type:'text',text:JSON.stringify(state)}],structuredContent:state,isError:false};}
  catch(e){result={content:[{type:'text',text:e instanceof Error?e.message:'Tool failed.'}],isError:true};}
 }else return rpcError(id,-32601,'Method not found.');
 return {jsonrpc:'2.0',id,result};
}
export async function POST(request:Request,context:Context){
 try{
  const origin=request.headers.get('origin');if(origin&&!['https://grok.com','https://www.grok.com',new URL(request.url).origin].includes(origin))return json({error:'Origin is not allowed.'},403);
  const {token}=await context.params;await loadTable(token,'dealer');
  const version=request.headers.get('MCP-Protocol-Version');if(version&&!versions.includes(version))return json({error:'Unsupported MCP protocol version.'},400);
  let message;
  try{message=await body(request);}catch(e){if(e instanceof Error&&e.message==='Send a valid JSON object.')return json(rpcError(null,-32700,'Parse error.'),400);throw e;}
  if(Array.isArray(message)){
   if((version&&version!=='2025-03-26')||!message.length||message.length>20)return json(rpcError(null,-32600,'Invalid or unsupported batch.'),400);
   const responses=[];
   for(const item of message){const response=await handle(item,token);if(response)responses.push(response);}
   return responses.length?json(responses):new Response(null,{status:202,headers:{'Cache-Control':'no-store'}});
  }
  const response=await handle(message,token);return response?json(response):new Response(null,{status:202,headers:{'Cache-Control':'no-store'}});
 }catch(e){return failure(e);}
}
export function GET(){return new Response(null,{status:405,headers:{Allow:'POST','Cache-Control':'no-store'}});}
export function DELETE(){return new Response(null,{status:405,headers:{Allow:'POST','Cache-Control':'no-store'}});}

