import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';
import { z } from 'zod';
import { pool } from './db.js';
dotenv.config();
const app = express();
app.set("trust proxy", 1);
const port = Number(process.env.PORT || 3001);
const jwtSecret = process.env.JWT_SECRET || 'development-only-change-this-secret';
app.use(helmet());
app.use(cors({ origin: (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map(x=>x.trim()), credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use('/api/auth/login', rateLimit({ windowMs: 15*60*1000, limit: 10, standardHeaders: true, legacyHeaders: false }));
app.get('/api/health', (_req,res)=>res.json({ok:true,service:'bodas-alex-ana-api'}));
async function ensureAdmin(){
 const name=process.env.ADMIN_NAME || 'Ana'; const password=process.env.ADMIN_PASSWORD;
 if(!password){ console.warn('ADMIN_PASSWORD não definido; administrador inicial não foi criado.'); return; }
 const found=await pool.query('SELECT id FROM admins LIMIT 1');
 if(!found.rowCount){const hash=await bcrypt.hash(password,12); await pool.query('INSERT INTO admins(name,password_hash) VALUES($1,$2)',[name,hash]); console.log(`Administrador inicial criado: ${name}`);}
}
function auth(req:express.Request,res:express.Response,next:express.NextFunction){
 const header=req.headers.authorization; const token=header?.startsWith('Bearer ')?header.slice(7):'';
 if(!token){res.status(401).json({error:'Faça login para continuar.'});return;}
 try{(req as any).admin=jwt.verify(token,jwtSecret);next();}catch{res.status(401).json({error:'Sessão inválida ou expirada.'});}
}
const loginSchema=z.object({name:z.string().min(1).max(100),password:z.string().min(1).max(200)});
app.post('/api/auth/login',async(req,res)=>{try{const data=loginSchema.parse(req.body);const result=await pool.query('SELECT id,name,password_hash FROM admins WHERE LOWER(name)=LOWER($1)',[data.name]);const admin=result.rows[0];if(!admin||!(await bcrypt.compare(data.password,admin.password_hash)))return res.status(401).json({error:'Nome ou senha incorretos.'});const token=jwt.sign({id:admin.id,name:admin.name},jwtSecret,{expiresIn:'8h'});res.json({token,admin:{name:admin.name}});}catch(e){res.status(400).json({error:'Dados de login inválidos.'});}});
app.get('/api/admin/me',auth,(req,res)=>res.json({admin:(req as any).admin}));
app.get('/api/public/invitations/:token',async(req,res)=>{try{const r=await pool.query('SELECT id,token,group_name,authorized_count,active,confirmed_at FROM invitations WHERE token=$1',[req.params.token]);const inv=r.rows[0];if(!inv||!inv.active)return res.status(404).json({error:'Este convite não foi encontrado ou está desativado.'});const guests=await pool.query('SELECT id,name,attending FROM guests WHERE invitation_id=$1 ORDER BY id',[inv.id]);res.json({...inv,guests:guests.rows});}catch{res.status(500).json({error:'Não foi possível carregar o convite.'});}});
const confirmSchema=z.object({guestIds:z.array(z.number().int().positive()).min(1)});
app.post('/api/public/invitations/:token/confirm',async(req,res)=>{const client=await pool.connect();try{const data=confirmSchema.parse(req.body);await client.query('BEGIN');const found=await client.query('SELECT * FROM invitations WHERE token=$1 AND active=TRUE FOR UPDATE',[req.params.token]);const inv=found.rows[0];if(!inv){await client.query('ROLLBACK');return res.status(404).json({error:'Convite inválido ou desativado.'});}if(inv.confirmed_at){await client.query('ROLLBACK');return res.status(409).json({error:'Este convite já teve a confirmação registrada.'});}const guests=await client.query('SELECT id,name FROM guests WHERE invitation_id=$1',[inv.id]);const allowed=new Set(guests.rows.map((g:any)=>g.id));if(data.guestIds.some(id=>!allowed.has(id))||data.guestIds.length>inv.authorized_count){await client.query('ROLLBACK');return res.status(400).json({error:'Selecione apenas pessoas autorizadas neste convite.'});}await client.query('UPDATE guests SET attending=(id=ANY($1::int[])) WHERE invitation_id=$2',[data.guestIds,inv.id]);await client.query('UPDATE invitations SET confirmed_at=NOW() WHERE id=$1',[inv.id]);await client.query('COMMIT');const names=guests.rows.filter((g:any)=>data.guestIds.includes(g.id)).map((g:any)=>g.name);void sendWhatsApp(names,inv.id);res.json({ok:true,names,count:names.length,message:'Presença confirmada com sucesso!'});}catch(e){await client.query('ROLLBACK').catch(()=>{});if(e instanceof z.ZodError)return res.status(400).json({error:'Seleção de convidados inválida.'});res.status(500).json({error:'Erro ao salvar a confirmação.'});}finally{client.release();}});
async function sendWhatsApp(names:string[], invitationId:number){const to=process.env.WHATSAPP_TO||'5511945644162';const token=process.env.WHATSAPP_TOKEN;const phoneId=process.env.WHATSAPP_PHONE_NUMBER_ID;if(!token||!phoneId)return;try{const response=await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to,type:'text',text:{body:`Olá, Ana! A presença de ${names.join(', ')} foi confirmada para as Bodas de Prata de Alex & Ana.`}})});const body=await response.text();await pool.query('INSERT INTO notifications(invitation_id,recipient,status,error) VALUES($1,$2,$3,$4)',[invitationId,to,response.ok?'sent':'failed',response.ok?null:body.slice(0,500)]);}catch(e){await pool.query('INSERT INTO notifications(invitation_id,recipient,status,error) VALUES($1,$2,$3,$4)',[invitationId,to,'failed',String(e).slice(0,500)]).catch(()=>{});}}
const invitationSchema=z.object({groupName:z.string().trim().min(1).max(150),names:z.array(z.string().trim().min(1).max(150)).min(1).max(30),authorizedCount:z.number().int().min(1).max(30)}).refine(v=>v.names.length<=v.authorizedCount,{message:'A quantidade de nomes não pode exceder o limite autorizado.'});
app.get('/api/admin/invitations',auth,async(_req,res)=>{try{const r=await pool.query(`SELECT i.id,i.token,i.group_name,i.authorized_count,i.active,i.confirmed_at,i.created_at,COALESCE(json_agg(json_build_object('id',g.id,'name',g.name,'attending',g.attending)) FILTER (WHERE g.id IS NOT NULL),'[]') AS guests FROM invitations i LEFT JOIN guests g ON g.invitation_id=i.id GROUP BY i.id ORDER BY i.created_at DESC`);res.json(r.rows);}catch{res.status(500).json({error:'Não foi possível carregar os convites.'});}});
app.post('/api/admin/invitations',auth,async(req,res)=>{const client=await pool.connect();try{const data=invitationSchema.parse(req.body);await client.query('BEGIN');const token=randomBytes(24).toString('hex');const r=await client.query('INSERT INTO invitations(token,group_name,authorized_count) VALUES($1,$2,$3) RETURNING *',[token,data.groupName,data.authorizedCount]);for(const name of data.names)await client.query('INSERT INTO guests(invitation_id,name) VALUES($1,$2)',[r.rows[0].id,name]);await client.query('COMMIT');res.status(201).json({...r.rows[0],guests:data.names.map(name=>({name,attending:false}))});}catch(e){await client.query('ROLLBACK').catch(()=>{});if(e instanceof z.ZodError)return res.status(400).json({error:e.issues[0]?.message||'Dados inválidos.'});res.status(500).json({error:'Não foi possível criar o convite.'});}finally{client.release();}});
app.patch('/api/admin/invitations/:id/toggle',auth,async(req,res)=>{try{const r=await pool.query('UPDATE invitations SET active=NOT active WHERE id=$1 RETURNING id,active',[Number(req.params.id)]);if(!r.rowCount)return res.status(404).json({error:'Convite não encontrado.'});res.json(r.rows[0]);}catch{res.status(500).json({error:'Não foi possível atualizar o convite.'});}});
app.get('/api/admin/stats',auth,async(_req,res)=>{try{const r=await pool.query(`SELECT COUNT(*)::int AS invitations,COALESCE(SUM(authorized_count),0)::int AS invited,COALESCE(SUM((SELECT COUNT(*) FROM guests g WHERE g.invitation_id=i.id AND g.attending)),0)::int AS confirmed,COUNT(*) FILTER(WHERE confirmed_at IS NOT NULL)::int AS responded FROM invitations i WHERE active=TRUE`);const row=r.rows[0];res.json({...row,pending:Math.max(0,row.invited-row.confirmed)});}catch{res.status(500).json({error:'Não foi possível calcular as estatísticas.'});}});
app.use((_req,res)=>res.status(404).json({error:'Rota não encontrada.'}));
app.listen(port,async()=>{console.log(`API em http://localhost:${port}`);try{await ensureAdmin();}catch(e){console.error('Banco de dados indisponível ou não inicializado:',e);}});
