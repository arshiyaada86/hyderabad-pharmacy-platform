import express from "express";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import sharp from "sharp";
import { randomUUID, randomInt } from "node:crypto";
import { resolve } from "node:path";
import { z } from "zod";
import { modules, schemaFor, orderStatuses, type RecordData } from "@pharmacy/domain/admin";
import { Store } from "./store";
import { InventoryError,initializeInventory,masterKinds,batches,availableBatches,offer,receive,moveBatch,syncStock,reserveBatches } from "./inventory";
import { hash, passwordHash, passwordMatches, sign, token, validSignature } from "./security";
export type Options={demo:boolean;secret:string;origins:string[];assets:string;otpUrl?:string;otpToken?:string};
class ApiError extends Error { constructor(public status:number,message:string){super(message);} }
const fail=(status:number,message:string):never=>{throw new ApiError(status,message);};
const cleanStaff=(r:RecordData)=>{const {passwordHash,...rest}=r;return rest;};
const profileSchema=z.object({name:z.string().trim().min(1).max(80),address:z.string().trim().min(1).max(200),locality:z.string().trim().min(1),landmark:z.string().trim().min(1).max(120)}).strict();
const phoneSchema=z.string().transform(v=>v.replace(/[\s()-]/g,'').replace(/^\+91/,'')).refine(v=>/^[6-9]\d{9}$/.test(v),'Enter a valid Indian mobile number.');
export function createApp(store:Store,options:Options){
 initializeInventory(store);
 const app=express();
 app.disable('x-powered-by');
 app.use(helmet({crossOriginResourcePolicy:{policy:'cross-origin'}}));
 app.use(cors({origin:(origin,done)=>done(null,!origin||options.origins.includes(origin)),credentials:true}));
 app.use((req,res,next)=>{if(req.headers.origin&&!options.origins.includes(req.headers.origin))return res.status(403).json({error:'Origin is not allowed.'});next();});
 app.use(express.json({limit:'128kb'}));
 app.use('/api',(_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
 app.use('/assets',express.static(resolve(options.assets),{dotfiles:'deny'}));
 const buckets=new Map<string,{count:number;expires:number}>();
 const throttle=(key:string,max:number,ms=60000)=>{const now=Date.now();if(buckets.size>10000)for(const [k,v] of buckets)if(v.expires<now)buckets.delete(k);const b=buckets.get(key);if(!b||b.expires<now){buckets.set(key,{count:1,expires:now+ms});return;}if(++b.count>max)fail(429,'Too many attempts. Please try again later.');};
 app.use('/api',(req,_res,next)=>{try{throttle('ip:'+req.ip,500);next();}catch(e){next(e);}});
 const session=(kind:string,subject:string)=>{const value=token();store.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(hash(value),kind,subject,Date.now()+8*3600000);return value;};
 const auth=(req:express.Request,kind:string)=>{
  const raw=req.headers.authorization?.replace(/^Bearer /,'')??'';
  const s=store.db.prepare('SELECT * FROM sessions WHERE token=? AND expires>?').get(hash(raw),Date.now()) as any;
  if(!s||s.kind!==kind)fail(401,'Sign in to continue.');
  const record=store.get(kind==='staff'?'staff':'customers',s.subject);
  if(!record||!record.active)fail(401,'This account is inactive.');
  return record!;
 };
 const permit=(req:express.Request,roles:string[])=>{const staff=auth(req,'staff');if(!roles.includes(staff.role))fail(403,'Your role does not have access to this action.');return staff;};
 const operational=['admin','pharmacist','support'];
 const version=(record:RecordData,expected:unknown)=>{if(record.version!==expected)fail(409,'This record changed. Refresh before saving.');};
 const reason=(value:unknown)=>z.string().trim().min(3,'Please add a reason.').max(500).parse(value);
 const assetUrl=(id:string)=>'/api/media/'+id;
 const mediaView=(id:string,owner:string,publicImage=false)=>{
  const row=store.db.prepare('SELECT id,owner,public,length(bytes) size,mime FROM media WHERE id=?').get(id) as any;
  if(!row||(!publicImage&&row.owner!==owner))fail(400,'Choose a valid photo belonging to this account.');
  const exp=Date.now()+5*60000;const signature=sign(options.secret,id+':'+exp);
  return {id,uri:assetUrl(id)+(row.public?'':`?expires=${exp}&signature=${signature}`),mimeType:row.mime,size:row.size};
 };
 const medicine=(p:RecordData)=>({id:p.id,brandName:p.brandName,genericName:p.genericName,manufacturer:p.manufacturer,manufacturerGroup:p.manufacturerGroup,composition:p.composition,strength:p.strength,dosageForm:p.dosageForm,packageSize:p.packageSize,image:p.image,category:p.category,price:offer(store,p).pricePaise/100,mrp:offer(store,p).mrpPaise/100,prescriptionRequired:!!p.prescriptionRequired,active:true,stock:offer(store,p).stock,sourceUrl:p.sourceUrl,sourceCheckedAt:p.sourceCheckedAt});
 const publishedProduct=(id:string)=>store.published('products').find(p=>p.id===id)??fail(400,'This product is unavailable.');
 const customerOrder=(o:RecordData)=>({id:o.id,customerId:o.customerId,date:o.date,items:o.items,total:o.totalPaise/100,deliveryContribution:o.deliveryContribution,delivery:o.delivery,status:o.status,eta:o.eta,sample:o.sample,prescriptionSubmitted:o.prescriptionSubmitted,prescription:o.prescriptionId?mediaView(o.prescriptionId,o.customerId):undefined,timeline:o.timeline});
 const own=(collection:string,id:string,customer:string)=>{const value=store.get(collection,id);if(!value||value.customerId!==customer)fail(404,'Record not found.');return value!;};
 const cart=(customer:string)=>store.get('carts',customer)?.lines??[];
 const quantity=(n:unknown)=>z.number().int().min(0).max(20).parse(n);
 const validateProfile=(data:unknown)=>{const p=profileSchema.parse(data);if(!store.list('localities').some(l=>l.active&&l.name===p.locality))fail(400,'Choose a serviceable locality.');return p;};
 const quote=(customer:string)=>{
  const lines=cart(customer);if(!lines.length)fail(400,'Your cart is empty.');
  const items=lines.map((line:any)=>{const p=publishedProduct(line.medicineId);if(!line.quantity||line.quantity>offer(store,p).stock)fail(409,`${p.brandName} does not have enough stock. Review your cart.`);return {medicine:medicine(p),quantity:line.quantity,pricePaise:offer(store,p).pricePaise,mrpPaise:offer(store,p).mrpPaise};});
  const fingerprint=hash(JSON.stringify(items.map((i:any)=>[i.medicine.id,i.quantity,i.pricePaise,i.mrpPaise,i.medicine.prescriptionRequired])));
  return {items,fingerprint,subtotalPaise:items.reduce((s:number,i:any)=>s+i.pricePaise*i.quantity,0)};
 };
 const serialize=(collection:string,r:RecordData)=>collection==='staff'?cleanStaff(r):r;
 app.get('/api/health',(_req,res)=>res.json({ok:true,mode:options.demo?'demo':'live',schema:1}));
 app.post('/api/admin/login',(req,res)=>{
  throttle('staff:'+req.ip,10,15*60000);
  const {email,password}=z.object({email:z.string().email(),password:z.string().max(200)}).parse(req.body);
  const staff=store.list('staff').find(s=>s.email.toLowerCase()===email.toLowerCase());
  if(!staff?.active||!passwordMatches(password,staff.passwordHash))fail(401,'Incorrect email or password.');
  res.json({token:session('staff',staff!.id),user:cleanStaff(staff!)});
 });
 app.get('/api/admin/me',(req,res)=>res.json(cleanStaff(auth(req,'staff'))));
 app.post('/api/logout',(req,res)=>{store.db.prepare('DELETE FROM sessions WHERE token=?').run(hash(req.headers.authorization?.replace(/^Bearer /,'')??''));res.json({ok:true});});
 app.get('/api/admin/overview',(req,res)=>{
  const staff=auth(req,'staff');const orders=store.list('orders');const products=store.list('products').map(p=>p.batchManaged?{...p,stock:availableBatches(store,p.id).reduce((n,b)=>n+b.quantityAvailable,0)}:p);
  res.json({products:products.length,lowStock:products.filter(p=>p.stock<=10&&p.status!=='archived').length,orders:orders.length,openOrders:orders.filter(o=>!['Delivered','Cancelled'].includes(o.status)).length,requests:store.list('requests').filter(r=>r.followUp!=='Closed').length,customers:store.list('customers').length,doctors:store.list('doctors').length,orderValuePaise:orders.filter(o=>o.status!=='Cancelled').reduce((s,o)=>s+o.totalPaise,0),recentOrders:operational.includes(staff.role)?orders.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6):[],recentActivity:store.list('audit').filter(a=>staff.role==='admin'||a.actor===staff.id).slice(-6).reverse(),demoMode:options.demo});
 });
 app.get('/api/admin/reference',(req,res)=>{
  auth(req,'staff');const result:any={};for(const name of ['products','categories','localities','specialties','clinics','staff',...masterKinds])result[name]=store.list(name).filter(r=>r.status!=='archived'&&r.active!==false).map(r=>({id:r.id,name:r.brandName||r.name||r.title,subcategories:r.subcategories}));res.json(result);
 });
 app.get('/api/admin/:collection',(req,res)=>{
  const c=req.params.collection as string;const module=modules.find(m=>m.key===c);
  const allowed=module?.roles??(['orders','requests'].includes(c)?operational:['inventory','batches'].includes(c)?['admin','catalog']:c==='audit'?['admin']:[]);
  permit(req,allowed);
  const search=String(req.query.search??'').toLowerCase();const status=String(req.query.status??'');
  let rows=store.list(c).map(r=>serialize(c,r));
  if(c==='batches')rows=rows.map(b=>({...b,quantityOnHand:b.quantityAvailable,quantityAvailable:b.expiryDate<new Date().toISOString().slice(0,10)?0:b.quantityAvailable}));
  if(c==='products')rows=rows.map(p=>p.batchManaged?{...p,stock:batches(store,p.id).filter(b=>b.expiryDate>=new Date().toISOString().slice(0,10)).reduce((n,b)=>n+b.quantityAvailable,0)}:p);
  if(c==='products'){
   if(req.query.manufacturer)rows=rows.filter(r=>r.manufacturerGroup===req.query.manufacturer);
   if(req.query.category){const category=store.list('categories').find(r=>r.name===req.query.category);rows=rows.filter(r=>category?category.subcategories.includes(r.category):r.category===req.query.category);}
   if(req.query.stock==='low')rows=rows.filter(r=>r.stock<=10);
   if(req.query.stock==='out')rows=rows.filter(r=>r.stock===0);
   if(req.query.stock==='available')rows=rows.filter(r=>r.stock>0);
  }
  if(['inventory','batches'].includes(c)&&req.query.productId)rows=rows.filter(r=>r.productId===req.query.productId);
  if(c==='inventory'&&req.query.batchId)rows=rows.filter(r=>r.batchId===req.query.batchId);
  if(c==='orders'&&req.query.prescription==='true')rows=rows.filter(r=>r.prescriptionSubmitted);
  rows=rows.filter(r=>(!search||JSON.stringify(r).toLowerCase().includes(search))&&(!status||r.status===status||r.followUp===status));
  rows.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  const page=Math.max(0,Number(req.query.page)||0),limit=Math.min(100,Math.max(1,Number(req.query.limit)||25));
  res.json({items:rows.slice(page*limit,(page+1)*limit),total:rows.length});
 });
 function validateBusiness(c:string,data:any,old?:RecordData){
  for(const key of ['sourceUrl','website','directionsUrl'])if(data[key]&&!/^https:\/\//.test(data[key]))fail(400,'External links must use HTTPS.');
  for(const key of ['image','photo','logo','bannerImage'])if(data[key]&&!/^https:\/\/|^\/assets\/|^\/api\/media\//.test(data[key]))fail(400,'Upload an image or use a valid HTTPS image URL.');
  const unique=(field:string)=>{if(store.list(c).some(r=>r.id!==old?.id&&r[field]===data[field]))fail(409,`${field} already exists.`);};
  if(c==='products'){
   if(data.mrpPaise<=0||data.pricePaise>data.mrpPaise)fail(400,'MRP must be positive and at least the selling price.');
   if(!store.list('categories').some(x=>x.subcategories.includes(data.category)))fail(400,'Choose a configured subcategory.');
   if(!store.list('manufacturers').some(m=>m.name===data.manufacturerGroup&&m.status!=='archived'))fail(400,'Choose a configured manufacturer.');
   if(!store.list('dosageForms').some(m=>m.name===data.dosageForm&&m.active))fail(400,'Choose a configured dosage form.');
   data.stock=old?.stock??0;
  }
  if(c==='categories'){unique('name');if(!data.subcategories.length)fail(400,'Add at least one subcategory.');}
  if(masterKinds.includes(c)||c==='localities'||c==='specialties'){unique('name');if(old&&old.name!==data.name&&store.list('batches').some(b=>Object.values(b.masterIds||{}).includes(old.id)))fail(409,'This master value is used by batches. Deactivate it and create a new value to preserve history.');}
  if(c==='customers'){data.phone=phoneSchema.parse(data.phone);unique('phone');validateProfile({name:data.name,address:data.address,locality:data.locality,landmark:data.landmark});data.demo=options.demo;}
  if(c==='doctors'){
   if(!data.clinicIds.length||data.clinicIds.some((id:string)=>!store.get('clinics',id)))fail(400,'Choose at least one existing clinic.');
   if(!store.list('specialties').some(s=>s.name===data.specialty&&s.active))fail(400,'Choose a configured specialty.');
   if(data.contact&&!/^\+?[0-9]{10,13}$/.test(data.contact))fail(400,'Enter a valid contact number.');
  }
  if(c==='home'){
   if(data.supportPhone&&!/^\+?[0-9]{10,13}$/.test(data.supportPhone))fail(400,'Enter a valid support phone.');
   if(data.supportEmail)z.string().email().parse(data.supportEmail);
   if(!old&&store.list('home').length)fail(409,'Edit the existing home configuration.');
   if(data.featuredIds?.some((id:string)=>!store.get('products',id)))fail(400,'Choose existing featured products.');
  }
  if(c==='pages')unique('page');
  if(c==='staff'){
   data.email=z.string().email().parse(data.email).toLowerCase();unique('email');
   if(!old&&!data.password)fail(400,'A password is required for a new staff member.');
   if(data.password){if(data.password.length<12)fail(400,'Use a password with at least 12 characters.');data.passwordHash=passwordHash(data.password);}else data.passwordHash=old?.passwordHash;
   delete data.password;
   if(old?.role==='admin'&&old.active&&(data.role!=='admin'||!data.active)&&store.list('staff').filter(s=>s.role==='admin'&&s.active).length<=1)fail(400,'Keep at least one active administrator.');
  }
 }
 const saveRecord=(req:express.Request,res:express.Response)=>{
  const c=req.params.collection as string;const module=modules.find(m=>m.key===c)??fail(404,'Unknown module.');const staff=permit(req,module.roles);
  const envelope=z.object({data:z.record(z.string(),z.unknown()),version:z.number().optional(),reason:z.string()}).strict().parse(req.body);
  const why=reason(envelope.reason);const old=req.params.id?store.get(c,req.params.id as string):undefined;
  if(req.params.id&&!old)fail(404,'Record not found.');if(old)version(old,envelope.version);
  const data:any=schemaFor(module).parse(envelope.data);
  const saved=store.transaction(()=>{validateBusiness(c,data,old);const next=store.put(c,{...old,...data,id:old?.id});store.audit(staff.id,old?'update':'create',c,next.id,why,old,next);if(c==='staff'&&old)store.db.prepare('DELETE FROM sessions WHERE kind=? AND subject=?').run('staff',old.id);return next;});
  res.status(old?200:201).json(serialize(c,saved));
 };
 app.post('/api/admin/inventory/receive',(req,res)=>{const staff=permit(req,['admin','catalog']);res.status(201).json(receive(store,req.body,staff.id));});
 app.post('/api/admin/batches/:id/movements',(req,res)=>{
  const staff=permit(req,['admin']);
  const input=z.object({version:z.number(),kind:z.enum(['return','damage','expiry','adjustment']),delta:z.number().int().min(-100000).max(100000).refine(n=>n!==0),reason:z.string().trim().min(3).max(500)}).strict().parse(req.body);
  const result=store.transaction(()=>{const b=store.get('batches',req.params.id as string)??fail(404,'Batch not found.');version(b,input.version);
   if(['damage','expiry'].includes(input.kind)&&input.delta>0)fail(400,'Damage and expiry must remove stock.');
   if(input.kind==='return'&&input.delta<0)fail(400,'A customer return must add stock.');
   if(input.kind==='return'&&b.quantityAvailable+input.delta>b.quantityReceived)fail(400,'Return exceeds this batch receipt.');
   if(input.kind==='expiry'&&b.expiryDate>=new Date().toISOString().slice(0,10))fail(400,'This batch has not expired.');
   const next=moveBatch(store,b,input.delta,input.kind,input.reason,staff.id);syncStock(store,b.productId);store.audit(staff.id,'batch '+input.kind,'batches',b.id,input.reason,b,next);return next;});res.json(result);
 });
 app.post('/api/admin/:collection',saveRecord);app.put('/api/admin/:collection/:id',saveRecord);
 // Save the complete product dialog atomically: related records and stock either all save or none do.
 app.put('/api/admin/products/:id/details',(req,res)=>{
  const staff=permit(req,['admin','catalog']);
  const input=z.object({version:z.number(),reason:z.string().min(3),changes:z.array(z.object({collection:z.enum(['products','manufacturers','categories']),id:z.string(),version:z.number(),data:z.record(z.string(),z.unknown())}).strict()).max(10),stock:z.number().int().min(0).max(1000000).optional(),receipt:z.object({supplier:z.string().trim().min(1).max(200),quantity:z.number().int().min(1).max(100000),receivedDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),invoice:z.string().max(200)}).strict().optional()}).strict().parse(req.body);
  const result=store.transaction(()=>{
   const original=store.get('products',req.params.id as string)??fail(404,'Product not found.');version(original,input.version);
   if(input.stock!==undefined||input.receipt)fail(400,'Use Medicine Inventory to receive stock or record a batch movement.');
   const keys=new Set<string>();
   const changes=input.changes.map(change=>{
    const key=change.collection+':'+change.id;if(keys.has(key))fail(400,'Duplicate record update.');keys.add(key);
    if(change.collection==='products'&&change.id!==original.id)fail(400,'Only this product may be updated.');
    const old=store.get(change.collection,change.id)??fail(404,'Related record not found.');version(old,change.version);
    const module=modules.find(m=>m.key===change.collection)!;const data=schemaFor(module).parse(change.data);return {change,old,data};
   });
   // Taxonomy edits must validate before product edits that depend on them.
   changes.sort((a,b)=>Number(a.change.collection==='products')-Number(b.change.collection==='products'));
   for(const {change,old,data} of changes){validateBusiness(change.collection,data,old);const next=store.put(change.collection,{...old,...data});store.audit(staff.id,'update',change.collection,next.id,input.reason,old,next);}
   let product=store.get('products',original.id)!;
   return product;
  });res.json(result);
 });
 app.get('/api/admin/products/:id/purchases',(req,res)=>{
  permit(req,['admin','catalog']);const rows=store.list('purchases').filter(r=>r.productId===req.params.id).sort((a,b)=>b.receivedDate.localeCompare(a.receivedDate)||b.createdAt.localeCompare(a.createdAt));
  const page=Math.max(0,Number(req.query.page)||0);res.json({items:rows.slice(page*10,page*10+10),total:rows.length});
 });
 app.post('/api/admin/products/:id/stock',(req,res)=>{permit(req,['admin','catalog']);fail(400,'Use a batch movement in Medicine Inventory.');});
 app.patch('/api/admin/orders/:id',(req,res)=>{
  const staff=permit(req,['admin','pharmacist']);
  const data=z.object({version:z.number(),status:z.enum(orderStatuses as [string,...string[]]),eta:z.string().max(200),notes:z.string().max(5000),review:z.enum(['Pending','Approved','Rejected','Not required']),reason:z.string().min(3)}).strict().parse(req.body);
  const result=store.transaction(()=>{
   const o=store.get('orders',req.params.id as string)??fail(404,'Order not found.');version(o,data.version);
   if(data.status!==o.status){
    const next=orderStatuses[orderStatuses.indexOf(o.status)+1];
    if(['Delivered','Cancelled'].includes(o.status)||(data.status!==next&&data.status!=='Cancelled'))fail(400,'Invalid order status transition.');
    if(data.status==='Confirmed'&&o.prescriptionSubmitted&&data.review!=='Approved')fail(400,'Approve the prescription before confirming this order.');
    if(data.status==='Cancelled'&&o.stockReserved)for(const line of o.items){const p=store.get('products',line.medicine.id)!;const allocations=o.batchAllocations?.[p.id];if(allocations){for(const a of allocations){const b=store.get('batches',a.batchId)!;moveBatch(store,b,a.quantity,'cancellation','Cancelled '+o.id,staff.id,o.id);}syncStock(store,p.id);}else if(!p.batchManaged){const n=store.put('products',{...p,stock:p.stock+line.quantity});store.put('inventory',{productId:p.id,productName:p.brandName,delta:line.quantity,balance:n.stock,reason:'Cancelled '+o.id,actor:staff.id});}else{store.put('legacyStock',{productId:p.id,quantity:line.quantity,status:'cancelled legacy order needs reconciliation',orderId:o.id});}}
   }
   const n=store.put('orders',{...o,status:data.status,eta:data.eta,notes:data.notes,review:data.review,timeline:data.status===o.status?o.timeline:[...o.timeline,{status:data.status,date:new Date().toISOString()}]});store.audit(staff.id,'fulfillment','orders',o.id,data.reason,o,n);return n;
  });res.json(result);
 });
 app.patch('/api/admin/requests/:id',(req,res)=>{
  const staff=permit(req,operational);const data=z.object({version:z.number(),followUp:z.enum(['New','Contacted','Sourcing','Closed']),assignedTo:z.string(),notes:z.string().max(5000),reason:z.string().min(3)}).strict().parse(req.body);
  const r=store.get('requests',req.params.id as string)??fail(404,'Request not found.');version(r,data.version);
  if(data.assignedTo&&!store.get('staff',data.assignedTo)?.active)fail(400,'Choose active staff.');
  const n=store.transaction(()=>{const n=store.put('requests',{...r,followUp:data.followUp,notes:data.notes,assignedTo:data.assignedTo});store.audit(staff.id,'follow up','requests',r.id,data.reason,r,n);return n;});res.json(n);
 });
 app.get('/api/admin/customers/:id/history',(req,res)=>{permit(req,operational);res.json({orders:store.list('orders').filter(o=>o.customerId===req.params.id),requests:store.list('requests').filter(o=>o.customerId===req.params.id)});});
 app.get('/api/admin/media/:id',(req,res)=>{const staff=permit(req,operational);const row=store.db.prepare('SELECT owner FROM media WHERE id=?').get(req.params.id as string) as any;if(!row)fail(404,'Photo not found.');store.audit(staff.id,'view attachment','media',req.params.id as string,'Authorized clinical/support review');res.json(mediaView(req.params.id as string,row.owner));});
 const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024,files:1}});
 app.post('/api/media',upload.single('file'),async(req,res)=>{
  const isPublic=req.query.public==='true';const owner=isPublic?permit(req,['admin','catalog']):auth(req,'customer');if(!req.file)fail(400,'Select one image.');
  let bytes:Buffer;try{const pipeline=sharp(req.file!.buffer,{limitInputPixels:40000000});const meta=await pipeline.metadata();if(!['jpeg','png','webp'].includes(meta.format??''))fail(400,'Use a JPEG, PNG or WebP image.');bytes=await pipeline.rotate().resize({width:2000,height:2000,fit:'inside',withoutEnlargement:true}).jpeg({quality:85}).toBuffer();}catch{fail(400,'This image could not be read.');}
  const id=randomUUID();store.db.prepare('INSERT INTO media VALUES(?,?,?,?,?,?)').run(id,owner.id,isPublic?1:0,bytes!,'image/jpeg',Date.now());res.status(201).json(mediaView(id,owner.id,isPublic));
 });
 app.get('/api/media/:id',(req,res)=>{
  const row=store.db.prepare('SELECT * FROM media WHERE id=?').get(req.params.id as string) as any;if(!row)fail(404,'Image not found.');
  if(!row.public){const exp=Number(req.query.expires);if(!Number.isFinite(exp)||exp<Date.now()||exp>Date.now()+6*60000||!validSignature(options.secret,req.params.id+':'+exp,String(req.query.signature??'')))fail(403,'This photo link has expired. Reopen the record.');}
  res.setHeader('Content-Type',row.mime);res.setHeader('Cache-Control',row.public?'public, max-age=86400':'private, no-store');res.send(Buffer.from(row.bytes));
 });
 app.delete('/api/media/:id',(req,res)=>{const user=auth(req,'customer');const row=store.db.prepare('SELECT owner FROM media WHERE id=?').get(req.params.id as string) as any;if(!row||row.owner!==user.id)fail(404,'Image not found.');if(store.list('orders').some(o=>o.prescriptionId===req.params.id)||store.list('requests').some(r=>r.photoId===req.params.id))fail(409,'Submitted images cannot be removed as drafts.');store.db.prepare('DELETE FROM media WHERE id=?').run(req.params.id as string);res.json({ok:true});});
 app.get('/api/config',(_req,res)=>{
  const home=store.published('home')[0];const pages=Object.fromEntries(store.published('pages').map(p=>[p.page,{title:p.title,sections:p.sections}]));
  res.json({...home,categories:store.published('categories').sort((a,b)=>a.sortOrder-b.sortOrder).map(c=>({name:c.name,icon:c.icon,subcategories:c.subcategories})),pages,demoMode:options.demo,reference:{categories:store.published('categories').sort((a,b)=>a.sortOrder-b.sortOrder).map(c=>c.name),localities:store.list('localities').filter(x=>x.active).map(x=>x.name),specialties:store.list('specialties').filter(x=>x.active).map(x=>x.name),doctorLocalities:[...new Set(store.published('clinics').map(c=>c.locality))],demoPhone:options.demo?'9000000001':'',demoOtp:options.demo?'123456':''}});
 });
 app.get('/api/products',(req,res)=>{
  const q=String(req.query.q??'').toLowerCase(),category=String(req.query.category??'');const group=store.published('categories').find(c=>c.name===category);
  res.json(store.published('products').filter(p=>(!q||[p.brandName,p.genericName,p.manufacturer].join(' ').toLowerCase().includes(q))&&(!category||(group?group.subcategories.includes(p.category):p.category===category))).map(medicine));
 });
 app.get('/api/products/:id',(req,res)=>res.json(medicine(publishedProduct(req.params.id as string))));
 const doctor=(d:RecordData)=>{const clinics=store.published('clinics').filter(c=>d.clinicIds.includes(c.id));return {id:d.id,name:d.name,qualifications:d.qualifications,specialty:d.specialty,contact:d.contact,photo:d.photo,sourceUrl:d.sourceUrl,sourceCheckedAt:d.sourceCheckedAt,clinics:clinics.map(c=>({id:c.id,name:c.name,address:c.address,locality:c.locality,timings:c.timings,directionsUrl:c.directionsUrl,mapsUrl:c.directionsUrl,sourceUrl:c.sourceUrl})),clinic:clinics[0]?.name??'',address:clinics[0]?.address??'',locality:clinics[0]?.locality??'',timings:clinics[0]?.timings??''};};
 app.get('/api/doctors',(req,res)=>{const q=String(req.query.q??'').toLowerCase();res.json(store.published('doctors').map(doctor).filter(d=>(!q||JSON.stringify(d).toLowerCase().includes(q))&&(!req.query.specialty||d.specialty===req.query.specialty)&&(!req.query.locality||d.clinics.some(c=>c.locality===req.query.locality))));});
 app.get('/api/doctors/:id',(req,res)=>{const d=store.published('doctors').find(d=>d.id===req.params.id)??fail(404,'Doctor not found.');res.json(doctor(d));});
 const challenges=new Map<string,{phone:string;code:string;expires:number;attempts:number;verified:boolean}>();
 app.post('/api/auth/otp',async(req,res)=>{
  throttle('otp:'+req.ip,5,5*60000);const phone=phoneSchema.parse(req.body.phone);throttle('phone:'+phone,3,5*60000);
  const code=options.demo?'123456':String(randomInt(100000,1000000));const challenge=token();
  if(!options.demo){if(!options.otpUrl||!options.otpToken)fail(503,'SMS delivery is not configured.');const response=await fetch(options.otpUrl!,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+options.otpToken},body:JSON.stringify({phone:'+91'+phone,code}),signal:AbortSignal.timeout(10000)});if(!response.ok)fail(503,'Could not send the verification code.');}
  for(const [key,c]of challenges)if(c.expires<Date.now()||c.phone===phone)challenges.delete(key);
  challenges.set(challenge,{phone,code:hash(code),expires:Date.now()+300000,attempts:0,verified:false});res.json({challenge,demo:options.demo});
 });
 app.post('/api/auth/verify',(req,res)=>{
  const {challenge,code}=z.object({challenge:z.string(),code:z.string().regex(/^\d{6}$/)}).parse(req.body);const c=challenges.get(challenge);
  if(!c||c.expires<Date.now()||c.attempts>=5||c.verified)fail(400,'Code expired. Request a new code.');c!.attempts++;
  if(hash(code)!==c!.code)fail(400,'Incorrect verification code.');c!.verified=true;
  const user=store.list('customers').find(u=>u.phone===c!.phone);
  if(user){if(!user.active)fail(403,'This account is inactive.');challenges.delete(challenge);res.json({token:session('customer',user.id),user});}else res.json({registrationToken:challenge,user:null});
 });
 app.post('/api/auth/register',(req,res)=>{
  const c=challenges.get(req.body.registrationToken);if(!c?.verified||c.expires<Date.now())fail(401,'Verify your number first.');
  if(store.list('customers').some(u=>u.phone===c!.phone))fail(409,'Account already exists. Sign in.');
  const data=validateProfile(req.body.profile);const user=store.put('customers',{...data,phone:c!.phone,active:true,demo:options.demo});challenges.delete(req.body.registrationToken);res.json({token:session('customer',user.id),user});
 });
 app.get('/api/me',(req,res)=>res.json(auth(req,'customer')));
 app.put('/api/me',(req,res)=>{const user=auth(req,'customer');const data=validateProfile(req.body);const n=store.transaction(()=>{const n=store.put('customers',{...user,...data});store.audit(user.id,'profile update','customers',user.id,'Customer updated profile',user,n);return n;});res.json(n);});
 app.get('/api/cart',(req,res)=>res.json(cart(auth(req,'customer').id)));
 app.put('/api/cart/:id',(req,res)=>{const user=auth(req,'customer');const {quantity:n,add}=z.object({quantity:z.number(),add:z.boolean().optional()}).strict().parse(req.body);quantity(n);const lines=cart(user.id);const existing=lines.find((x:any)=>x.medicineId===req.params.id);const total=quantity(add?(existing?.quantity??0)+n:n);if(total){publishedProduct(req.params.id as string);if(total>medicine(publishedProduct(req.params.id as string)).stock)fail(409,'Not enough stock for that quantity.');}const next=lines.filter((x:any)=>x.medicineId!==req.params.id);if(total)next.push({medicineId:req.params.id,quantity:total});store.put('carts',{id:user.id,lines:next});res.json(next);});
 app.get('/api/checkout/quote',(req,res)=>res.json(quote(auth(req,'customer').id)));
 app.get('/api/orders',(req,res)=>{const u=auth(req,'customer');res.json(store.list('orders').filter(o=>o.customerId===u.id).sort((a,b)=>b.date.localeCompare(a.date)).map(customerOrder));});
 app.get('/api/orders/:id',(req,res)=>res.json(customerOrder(own('orders',req.params.id as string,auth(req,'customer').id))));
 app.post('/api/orders',(req,res)=>{
  const user=auth(req,'customer');const data=z.object({deliveryContribution:z.union([z.literal(0),z.literal(10),z.literal(20)]),prescriptionId:z.string().optional(),fingerprint:z.string(),idempotencyKey:z.string().min(16).max(100)}).strict().parse(req.body);
  const order=store.transaction(()=>{
   const prior=store.db.prepare('SELECT orderId FROM idempotency WHERE customer=? AND key=?').get(user.id,data.idempotencyKey) as any;if(prior)return store.get('orders',prior.orderId)!;
   const q=quote(user.id);if(q.fingerprint!==data.fingerprint)fail(409,'Prices changed. Review your cart before ordering.');
   const rx=q.items.some((i:any)=>i.medicine.prescriptionRequired);if(rx&&!data.prescriptionId)fail(400,'Upload a prescription.');if(data.prescriptionId)mediaView(data.prescriptionId,user.id);
   const delivery=validateProfile({name:user.name,address:user.address,locality:user.locality,landmark:user.landmark});
   let id:string;do{id='O'+randomInt(0,10)+randomInt(0,36**4).toString(36).toUpperCase().padStart(4,'0');}while(store.get('orders',id));
   const batchAllocations:Record<string,any>={};for(const line of q.items){const p=store.get('products',line.medicine.id)!;if(p.batchManaged)batchAllocations[p.id]=reserveBatches(store,p,line.quantity,id,user.id);}
   const date=new Date().toISOString();const order=store.put('orders',{id,batchAllocations,internalId:randomUUID(),customerId:user.id,date,items:q.items.map(({medicine,quantity}:any)=>({medicine,quantity})),totalPaise:q.subtotalPaise+data.deliveryContribution*100,deliveryContribution:data.deliveryContribution,delivery,phone:user.phone,status:'Order Received',timeline:[{status:'Order Received',date}],prescriptionId:rx?data.prescriptionId:undefined,prescriptionSubmitted:rx,review:rx?'Pending':'Not required',eta:'',notes:'',sample:options.demo,stockReserved:true});
   // Reserve stock at submission; cancellation releases once, delivery does not deduct twice.
   for(const line of q.items){const p=store.get('products',line.medicine.id)!;if(p.batchManaged)continue;const n=store.put('products',{...p,stock:p.stock-line.quantity});store.put('inventory',{productId:p.id,productName:p.brandName,delta:-line.quantity,balance:n.stock,reason:'Order '+id,actor:user.id});}
   store.put('carts',{id:user.id,lines:[]});store.db.prepare('INSERT INTO idempotency VALUES(?,?,?)').run(user.id,data.idempotencyKey,id);store.audit(user.id,'place order','orders',id,'Customer submitted order',null,order);return order;
  });res.status(201).json(customerOrder(order));
 });
 app.post('/api/orders/:id/again',(req,res)=>{const u=auth(req,'customer');const o=own('orders',req.params.id as string,u.id);const lines=cart(u.id);const review:any={orderId:o.id,available:[],unavailable:[]};for(const item of o.items){const p=store.published('products').find(p=>p.id===item.medicine.id);if(!p||medicine(p).stock<item.quantity){review.unavailable.push(item.medicine.brandName);continue;}quantity(item.quantity);const i=lines.findIndex((x:any)=>x.medicineId===p.id);const line={medicineId:p.id,quantity:item.quantity};if(i<0)lines.push(line);else lines[i]=line;review.available.push({...line,name:p.brandName,previousPrice:item.medicine.price,currentPrice:medicine(p).price});}store.put('carts',{id:u.id,lines});res.json(review);});
 app.get('/api/requests',(req,res)=>{const u=auth(req,'customer');res.json(store.list('requests').filter(r=>r.customerId===u.id).map(r=>({id:r.id,customerId:r.customerId,date:r.date,status:'Received',demo:r.demo,photo:r.photoId?mediaView(r.photoId,u.id):{id:'demo',uri:'demo://medicine',size:1,mimeType:'image/jpeg'}})));});
 app.post('/api/requests',(req,res)=>{const u=auth(req,'customer');const {photoId}=z.object({photoId:z.string()}).strict().parse(req.body);const photo=mediaView(photoId,u.id);const r=store.put('requests',{customerId:u.id,photoId,date:new Date().toISOString(),status:'Received',followUp:'New',notes:'',assignedTo:'',demo:options.demo});res.status(201).json({id:r.id,customerId:u.id,date:r.date,status:'Received',photo});});
 app.use((_req,res)=>res.status(404).json({error:'Endpoint not found.'}));
 app.use((error:any,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
  const status=error instanceof ApiError||error instanceof InventoryError?error.status:error instanceof z.ZodError||error instanceof multer.MulterError?400:500;
  res.status(status).json({error:error instanceof z.ZodError?error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; '):status===500?'The request could not be completed.':error.message});
 });
 return app;
}
