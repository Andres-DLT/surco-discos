import {api} from '../../lib/api';
export const config={api:{bodyParser:false}};
export default async function handler(req,res){
  const chunks=[];
  for await(const chunk of req)chunks.push(chunk);
  const r=await api(new Request('http://localhost'+req.url,{method:req.method,headers:req.headers,body:chunks.length?Buffer.concat(chunks):undefined}),process.env);
  r.headers.forEach((v,k)=>res.setHeader(k,v));
  res.status(r.status).send(await r.text());
}
