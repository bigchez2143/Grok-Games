import { bearer,body,failure,json } from '@/lib/table-store';
import {runDealerTool} from '@/lib/dealer-tools';
export async function GET(request:Request){try{return json(await runDealerTool(bearer(request),'get_table'));}catch(e){return failure(e);}}
export async function POST(request:Request){try{const b=await body(request);return json(await runDealerTool(bearer(request),b.tool,b.arguments));}catch(e){return failure(e);}}
