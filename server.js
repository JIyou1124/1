'use strict';
const http = require('node:http'), fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const {URL}=require('node:url');
const PORT=Number(process.env.PORT||3000), SITE=(process.env.SITE_URL||'').replace(/\/$/,'');
const ID=process.env.WECHAT_APP_ID||'', SECRET=process.env.WECHAT_APP_SECRET||'';
const TZ='Asia/Shanghai', DBFILE=path.join(__dirname,'data.json');
let db={users:{},sessions:{}};
try { if(fs.existsSync(DBFILE)) db=JSON.parse(fs.readFileSync(DBFILE,'utf8')); }catch(e){console.error('Database read error',e);process.exit(1);}
const goods={shield:60,glasses:40}, states=new Map();
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function dayBefore(d,n){const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()-n);return x.toISOString().slice(0,10)}
function save(){fs.writeFileSync(DBFILE+'.tmp',JSON.stringify(db));fs.renameSync(DBFILE+'.tmp',DBFILE)}
function stats(u){const dates=[...new Set(u.dates||[])].sort(),set=new Set(dates),now=today();let d=set.has(now)?now:dayBefore(now,1),streak=0,best=0,run=0,prev='';
 while(set.has(d)){streak++;d=dayBefore(d,1)}
 for(const date of dates){run=prev===dayBefore(date,1)?run+1:1;best=Math.max(best,run);prev=date}
 return {streak,total:dates.length,best,checkedToday:set.has(now),dates}
}
function profile(u){return {name:u.name,avatar:u.avatar||'',points:u.points||0,inventory:u.inventory||{shield:0,glasses:0},equipped:u.equipped||'none',challenge:(u.challenges||{})[today()]||null,...stats(u)}}
function cookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').map(v=>v.trim().split('=')).filter(v=>v.length===2))}
function cookie(k,v,age){return k+'='+encodeURIComponent(v)+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+age+(SITE.startsWith('https')?'; Secure':'')}
function user(req){const s=db.sessions[cookies(req).session];return s&&s.exp>Date.now()?db.users[s.uid]:null}
function send(res,code,data){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
function redirect(res,loc,ck){res.writeHead(302,{Location:loc,...(ck?{'Set-Cookie':ck}:{})});res.end()}
async function body(req){let x='';for await(const c of req){x+=c;if(x.length>1024)throw Error('payload too long')}return JSON.parse(x||'{}')}
function newSession(res,uid){const sid=crypto.randomBytes(24).toString('hex');db.sessions[sid]={uid,exp:Date.now()+30*86400000};save();redirect(res,'/',cookie('session',sid,30*86400))}
function ensure(u){u.dates||=[];u.points||=0;u.inventory||={shield:0,glasses:0};u.challenges||={};u.equipped||='none'}
function guard(req){if(req.headers.origin){try {const o=new URL(req.headers.origin);const h=req.headers.host;if(o.host!==h)return false}catch{return false}}return true}
const server=http.createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,'http://localhost'),p=url.pathname,method=req.method;
 if(method==='GET'&&p==='/'){const html=fs.readFileSync(path.join(__dirname,'index.html'));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(html)}
 if(method==='GET'&&p==='/api/me')return send(res,200,{me:user(req)?profile(user(req)):null,today:today(),wechatReady:!!(ID&&SECRET&&SITE.startsWith('https'))});
 if(method==='GET'&&p==='/api/board'){const mode=url.searchParams.get('mode')==='total'?'total':'streak';const list=Object.values(db.users).filter(x=>x.public!==false).map(x=>({name:x.name,avatar:x.avatar||'',...stats(x)})).sort((a,b)=>b[mode]-a[mode]||b.total-a.total).slice(0,50);return send(res,200,{rows:list})}
 if(method==='GET'&&p==='/demo/login'){const uid='guest:'+crypto.randomBytes(12).toString('hex');db.users[uid]={uid,name:'见习宇航员-'+uid.slice(-4),avatar:'',points:0,dates:[],inventory:{shield:0,glasses:0},challenges:{},equipped:'none'};return newSession(res,uid)}
 if(method==='GET'&&p==='/auth/wechat'){
  if(!(ID&&SECRET&&SITE.startsWith('https')))return send(res,503,{error:'尚未配置公众号网页授权'});
  const state=crypto.randomBytes(18).toString('hex');states.set(state,Date.now()+600000);
  const dest=encodeURIComponent(SITE+'/auth/callback');
  return redirect(res,'https://open.weixin.qq.com/connect/oauth2/authorize?appid='+encodeURIComponent(ID)+'&redirect_uri='+dest+'&response_type=code&scope=snsapi_userinfo&state='+state+'#wechat_redirect',cookie('wx_state',state,600));
 }
 if(method==='GET'&&p==='/auth/callback'){
  const state=url.searchParams.get('state'),code=url.searchParams.get('code');
  if(!code||state!==cookies(req).wx_state||!states.has(state)||states.get(state)<Date.now())return redirect(res,'/?error=auth');
  states.delete(state);
  const r=await fetch('https://api.weixin.qq.com/sns/oauth2/access_token?appid='+encodeURIComponent(ID)+'&secret='+encodeURIComponent(SECRET)+'&code='+encodeURIComponent(code)+'&grant_type=authorization_code');
  const t=await r.json();if(!t.access_token||!t.openid)throw Error('wechat token failed');
  const r2=await fetch('https://api.weixin.qq.com/sns/userinfo?access_token='+encodeURIComponent(t.access_token)+'&openid='+encodeURIComponent(t.openid)+'&lang=zh_CN');
  const info=await r2.json();if(info.openid!==t.openid||!info.nickname)throw Error('wechat user info unavailable');
  const uid='wx:'+t.openid;const u=db.users[uid]||{uid,dates:[],points:0,inventory:{shield:0,glasses:0},challenges:{},equipped:'none'};
  u.name=String(info.nickname).slice(0,80);u.avatar=String(info.headimgurl||'').replace(/^http:/,'https:').slice(0,350);db.users[uid]=u;return newSession(res,uid);
 }
 if(method==='POST'){
  if(!guard(req))return send(res,403,{error:'请求来源不合法'});
  if(p==='/api/logout'){delete db.sessions[cookies(req).session];save();res.writeHead(204,{'Set-Cookie':cookie('session','',0)});return res.end()}
  const u=user(req);if(!u)return send(res,401,{error:'请先登录'});ensure(u);
  if(p==='/api/checkin'){if(!u.dates.includes(today()))u.dates.push(today());save();return send(res,200,{me:profile(u)})}
  const b=await body(req);
  if(p==='/api/challenge'){
   if(u.challenges[today()])return send(res,409,{error:'今天已经完成挑战'});
   if(!['resist','skip'].includes(b.result))return send(res,400,{error:'无效选项'});
   const amount=b.result==='resist'?20:0;u.points+=amount;u.challenges[today()]={result:b.result,amount};save();return send(res,200,{me:profile(u)});
  }
  if(p==='/api/buy'){if(!(b.item in goods))return send(res,400,{error:'道具不存在'});if(u.points<goods[b.item])return send(res,400,{error:'积分不足'});u.points-=goods[b.item];u.inventory[b.item]=(u.inventory[b.item]||0)+1;save();return send(res,200,{me:profile(u)})}
  if(p==='/api/equip'){if(!['none','shield','glasses'].includes(b.item))return send(res,400,{error:'无效道具'});if(b.item!=='none'&&!u.inventory[b.item])return send(res,400,{error:'尚未购买'});u.equipped=b.item;save();return send(res,200,{me:profile(u)})}
  if(p==='/api/public'){u.public=!!b.public;save();return send(res,200,{me:profile(u)})}
 }
 return send(res,404,{error:'Not found'});
 }catch(e){console.error(e);return send(res,500,{error:'服务暂时出现问题'})}
});
server.listen(PORT,'0.0.0.0',()=>console.log('Duanxian Space listening '+PORT));
