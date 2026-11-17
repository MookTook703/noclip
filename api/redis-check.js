const Redis=require('ioredis');
module.exports=async(req,res)=>{
 res.setHeader('Content-Type','application/json');
 if(!process.env.REDIS_URL){res.statusCode=503;res.end(JSON.stringify({ok:false,reason:'not-configured'}));return}
 const client=new Redis(process.env.REDIS_URL,{lazyConnect:true,maxRetriesPerRequest:1,connectTimeout:3500,retryStrategy:()=>null});
 try{await client.connect();const pong=await client.ping();res.statusCode=200;res.end(JSON.stringify({ok:pong==='PONG',redis:'connected'}))}
 catch(e){res.statusCode=503;res.end(JSON.stringify({ok:false,redis:'unavailable',error:String(e.code||e.message).slice(0,80)}))}
 finally{client.disconnect()}
};
