export const dynamic='force-static';import {NextResponse} from 'next/server';export function GET(){return NextResponse.json({status:'ok',live:false,database_connected:false})}
