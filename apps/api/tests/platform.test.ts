import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { Store } from '../src/store';
import { seed } from '../src/seed';
import { createApp } from '../src/app';
import { modules } from '@pharmacy/domain/admin';
async function setup(t:any){
 const store=new Store(':memory:');seed(store,'owner@example.com','Test-password-1234',true);
 const app=createApp(store,{demo:true,secret:'test-media-secret',origins:['http://localhost:5173'],assets:resolve('../mobile/assets')});
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');const url='http://127.0.0.1:'+(server.address() as any).port;
 t.after(()=>{server.close();server.closeAllConnections();store.close();});
 const call=async(path:string,method='GET',body?:any,token?:string)=>{const headers:any={};if(token)headers.Authorization='Bearer '+token;if(body&&!(body instanceof FormData))headers['Content-Type']='application/json';const response=await fetch(url+'/api'+path,{method,headers,body:body instanceof FormData?body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json()};};
 const admin=(await call('/admin/login','POST',{email:'owner@example.com',password:'Test-password-1234'})).data.token;
 const login=async(phone='9000000001')=>{const r=await call('/auth/otp','POST',{phone});return (await call('/auth/verify','POST',{challenge:r.data.challenge,code:'123456'})).data.token;};
 return {store,url,call,admin,login};
}
const editable=(collection:string,row:any)=>Object.fromEntries(modules.find(m=>m.key===collection)!.fields.filter(f=>row[f.key]!==undefined).map(f=>[f.key,row[f.key]]));
test('catalog publication, validation, role access, optimistic versions and safe public payloads',async t=>{
 const {store,call,admin}=await setup(t);const row=store.list('products')[0],data=editable('products',row);
 assert.equal((await call('/admin/products')).status,401);
 assert.equal((await call('/admin/products/'+row.id,'PUT',{data:{...data,pricePaise:data.mrpPaise+1},version:row.version,reason:'Invalid price test'},admin)).status,400);
 assert.equal((await call('/admin/products/'+row.id,'PUT',{data:{...data,purchasePrice:1},version:row.version,reason:'Private field test'},admin)).status,400);
 const draft=await call('/admin/products/'+row.id,'PUT',{data:{...data,brandName:'Draft product title',status:'draft'},version:row.version,reason:'Save draft'},admin);assert.equal(draft.status,200);
 assert.equal((await call('/products/'+row.id)).data.brandName,row.brandName);
 const published=await call('/admin/products/'+row.id,'PUT',{data:{...data,brandName:'Published product title',status:'published'},version:draft.data.version,reason:'Publish product'},admin);assert.equal(published.status,200);
 const publicProduct=(await call('/products/'+row.id)).data;assert.equal(publicProduct.brandName,'Published product title');assert.equal(publicProduct.price,row.pricePaise/100);assert.equal(publicProduct.purchasePrice,undefined);assert.equal(publicProduct.version,undefined);
 assert.equal((await call('/admin/products/'+row.id,'PUT',{data,version:row.version,reason:'Stale update'},admin)).status,409);
 const staff=await call('/admin/staff','POST',{data:{name:'Support',email:'support@example.com',role:'support',password:'Support-password-123',active:true},reason:'Add support staff'},admin);assert.equal(staff.status,201);assert.equal(staff.data.passwordHash,undefined);
 const support=(await call('/admin/login','POST',{email:'support@example.com',password:'Support-password-123'})).data.token;
 assert.equal((await call('/admin/products','GET',undefined,support)).status,403);
 assert.equal((await call('/admin/orders','GET',undefined,support)).status,200);
 assert.ok(store.list('audit').length>=3);
});
test('required contribution, authoritative quote, immutable snapshots, idempotency, stock reserve and cancellation',async t=>{
 const {store,call,admin,login}=await setup(t);const customer=await login();const p=store.list('products')[0];
 assert.equal((await call('/cart/'+p.id,'PUT',{quantity:2},customer)).status,200);const q=(await call('/checkout/quote','GET',undefined,customer)).data;
 assert.equal((await call('/orders','POST',{fingerprint:q.fingerprint,idempotencyKey:'test-order-12345678'},customer)).status,400);
 const body={deliveryContribution:20,fingerprint:q.fingerprint,idempotencyKey:'test-order-12345678'};
 const order=(await call('/orders','POST',body,customer)).data;assert.match(order.id,/^[A-Z0-9]{6}$/);assert.equal(order.total,p.pricePaise*2/100+20);assert.equal(order.deliveryContribution,20);assert.equal(store.get('products',p.id)!.stock,p.stock-2);
 const retry=(await call('/orders','POST',body,customer)).data;assert.equal(retry.id,order.id);assert.equal(store.get('products',p.id)!.stock,p.stock-2);
 assert.deepEqual((await call('/cart','GET',undefined,customer)).data,[]);
 const raw=store.get('orders',order.id)!;assert.equal(raw.phone,'9000000001');
 const cancel=await call('/admin/orders/'+order.id,'PATCH',{version:raw.version,status:'Cancelled',review:'Not required',eta:'',notes:'internal note',reason:'Customer requested cancellation'},admin);assert.equal(cancel.status,200);assert.equal(store.get('products',p.id)!.stock,p.stock);
 const cancelAgain=await call('/admin/orders/'+order.id,'PATCH',{version:cancel.data.version,status:'Cancelled',review:'Not required',eta:'',notes:'internal note',reason:'No status change'},admin);assert.equal(cancelAgain.status,200);assert.equal(store.get('products',p.id)!.stock,p.stock);
 assert.equal((await call('/orders/'+order.id,'GET',undefined,customer)).data.notes,undefined);
 const other=await login('9000000002');assert.equal((await call('/orders/'+order.id,'GET',undefined,other)).status,404);
 const before=store.get('products',p.id)!;store.put('products',{...before,pricePaise:1000});assert.equal((await call('/orders/'+order.id,'GET',undefined,customer)).data.items[0].medicine.price,p.pricePaise/100);
 const again=(await call('/orders/'+order.id+'/again','POST',undefined,customer)).data;assert.equal(again.available[0].currentPrice,10);assert.equal(again.available[0].quantity,2);
});
test('price changes force review; stock cannot go negative; invalid quantity rejected',async t=>{
 const {store,call,admin,login}=await setup(t);const c=await login();const p=store.list('products')[0];
 assert.equal((await call('/cart/'+p.id,'PUT',{quantity:21},c)).status,400);await call('/cart/'+p.id,'PUT',{quantity:1},c);
 const quote=(await call('/checkout/quote','GET',undefined,c)).data;store.put('products',{...p,pricePaise:p.pricePaise+1});
 assert.equal((await call('/orders','POST',{deliveryContribution:0,fingerprint:quote.fingerprint,idempotencyKey:'changed-price-123456'},c)).status,409);
 const current=store.get('products',p.id)!;assert.equal((await call('/admin/products/'+p.id+'/stock','POST',{version:current.version,delta:-10000,reason:'Attempt negative'},admin)).status,400);
 const changed=await call('/admin/products/'+p.id+'/stock','POST',{version:current.version,delta:5,reason:'Received delivery'},admin);assert.equal(changed.status,400);assert.equal(store.get('products',p.id)!.stock,p.stock);
});
test('private uploads, prescription ownership and clinical approval; request follow-up stays private',async t=>{
 const {store,url,call,admin,login}=await setup(t);const c=await login(),other=await login('9000000002');
 const bytes=await sharp({create:{width:10,height:10,channels:3,background:'#fff'}}).jpeg().toBuffer();
 const form=new FormData();form.append('file',new Blob([new Uint8Array(bytes)],{type:'image/jpeg'}),'test.jpg');const upload=await call('/media','POST',form,c);assert.equal(upload.status,201);
 assert.equal((await fetch(url+'/api/media/'+upload.data.id)).status,403);assert.equal((await fetch(url+upload.data.uri)).status,200);
 const request=await call('/requests','POST',{photoId:upload.data.id},c);assert.equal(request.status,201);
 assert.equal((await call('/requests','POST',{photoId:upload.data.id},other)).status,400);
 const r=store.get('requests',request.data.id)!;assert.equal((await call('/admin/requests/'+r.id,'PATCH',{version:r.version,followUp:'Contacted',assignedTo:'owner',notes:'Private contact notes',reason:'Called customer'},admin)).status,200);
 const publicRequests=(await call('/requests','GET',undefined,c)).data;assert.equal(publicRequests.find((x:any)=>x.id===r.id).notes,undefined);assert.equal(publicRequests.find((x:any)=>x.id===r.id).status,'Received');
 const rx=store.list('products').find(p=>p.prescriptionRequired)!;await call('/cart/'+rx.id,'PUT',{quantity:1},c);const q=(await call('/checkout/quote','GET',undefined,c)).data;
 const data={deliveryContribution:10,fingerprint:q.fingerprint,idempotencyKey:'rx-test-order-123456'};
 assert.equal((await call('/orders','POST',data,c)).status,400);
 const result=await call('/orders','POST',{...data,prescriptionId:upload.data.id},c);assert.equal(result.status,201);
 const o=store.get('orders',result.data.id)!;
 assert.equal((await call('/admin/orders/'+o.id,'PATCH',{version:o.version,status:'Confirmed',review:'Pending',notes:'',eta:'',reason:'Attempt confirmation'},admin)).status,400);
 assert.equal((await call('/admin/orders/'+o.id,'PATCH',{version:o.version,status:'Confirmed',review:'Approved',notes:'Reviewed',eta:'Tomorrow',reason:'Prescription reviewed'},admin)).status,200);
 assert.equal((await call('/media/'+upload.data.id,'DELETE',undefined,c)).status,409);
 const bad=new FormData();bad.append('file',new Blob(['not an image'],{type:'image/jpeg'}),'bad.jpg');assert.equal((await call('/media','POST',bad,c)).status,400);
});
test('all dashboard data modules validate and save; published content drives app configuration',async t=>{
 const {store,call,admin}=await setup(t);
 for(const module of modules.filter(m=>m.key!=='staff')){
  const original=store.list(module.key)[0];if(!original)continue;const data=editable(module.key,original);
  const result=await call('/admin/'+module.key+'/'+original.id,'PUT',{data,version:original.version,reason:'Verify '+module.title},admin);
  assert.equal(result.status,200,JSON.stringify({module:module.key,error:result.data}));
 }
 const home=store.list('home')[0];const d=editable('home',home);d.shopName='Integration Pharmacy';d.featuredIds=[store.list('products')[2].id];
 assert.equal((await call('/admin/home/'+home.id,'PUT',{data:d,version:home.version,reason:'Update app home'},admin)).status,200);
 const config=(await call('/config')).data;assert.equal(config.shopName,'Integration Pharmacy');assert.equal(config.featuredIds[0],d.featuredIds[0]);assert.equal(config.categories.length,5);assert.ok(config.pages.terms.sections.length);
 const doctors=(await call('/doctors')).data;assert.equal(doctors.length,9);assert.ok(doctors.every((d:any)=>d.clinics.length));
});
test('SQLite state survives restart and failed transactions roll back',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pharmacy-db-'));const file=join(dir,'test.sqlite');let db=new Store(file);
 try{db.put('localities',{id:'persist',name:'Test locality',active:true});assert.throws(()=>db.transaction(()=>{db.put('localities',{id:'rollback',name:'Invalid'});throw new Error('Rollback');}));assert.equal(db.get('localities','rollback'),undefined);db.close();db=new Store(file);assert.equal(db.get('localities','persist')!.name,'Test locality');}finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

test('product filters combine before pagination and stock history is scoped to the product',async t=>{
 const {store,call,admin}=await setup(t);
 const expected=store.list('products').filter(p=>p.manufacturerGroup==='Cipla'&&p.category==='Antibiotics');
 const filtered=await call('/admin/products?manufacturer=Cipla&category=Antibiotics&limit=1','GET',undefined,admin);
 assert.equal(filtered.status,200);assert.equal(filtered.data.total,expected.length);assert.equal(filtered.data.items.length,1);
 assert.equal(filtered.data.items[0].manufacturerGroup,'Cipla');assert.equal(filtered.data.items[0].category,'Antibiotics');
 const low=await call('/admin/products?stock=low','GET',undefined,admin);assert.ok(low.data.items.every((p:any)=>p.stock<=10));
 const p=store.list('products')[0],other=store.list('products')[1];
 store.put('inventory',{productId:p.id,delta:3,balance:p.stock+3,reason:'Test stock'});
 store.put('inventory',{productId:other.id,delta:1,balance:other.stock+1,reason:'Other stock'});
 const history=await call('/admin/inventory?productId='+p.id,'GET',undefined,admin);
 assert.equal(history.data.total,1);assert.equal(history.data.items[0].productId,p.id);
});

test('unified product master save is atomic and rejects unbatched stock overwrites',async t=>{
 const {store,call,admin}=await setup(t);const p=store.list('products')[0],m=store.list('manufacturers').find(m=>m.name===p.manufacturerGroup)!;
 const changes=[{collection:'products',id:p.id,version:p.version,data:{...editable('products',p),pricePaise:p.pricePaise-100}},{collection:'manufacturers',id:m.id,version:m.version,data:{...editable('manufacturers',m),website:'https://example.com'}}];
 const body={version:p.version,reason:'Update product details',changes};
 assert.equal((await call('/admin/products/'+p.id+'/details','PUT',{...body,stock:50},admin)).status,400);
 assert.equal(store.get('products',p.id)!.version,p.version);
 assert.equal((await call('/admin/products/'+p.id+'/details','PUT',body,admin)).status,200);
 assert.equal(store.get('manufacturers',m.id)!.website,'https://example.com');
 assert.equal((await call('/admin/products/'+p.id+'/details','PUT',body,admin)).status,409);
});

test('batch receipts validate master data, keep costs private, allocate FEFO and cancel exactly once',async t=>{
 const {store,call,admin,login}=await setup(t),p=store.list('products').find(p=>!p.prescriptionRequired)!;const productCount=store.list('products').length;
 const supplier=await call('/admin/suppliers','POST',{data:{name:'Test supplier',active:true},reason:'Configure supplier'},admin);assert.equal(supplier.status,201);
 const receipt=(overrides:any={})=>({productId:p.id,version:store.get('products',p.id)!.version,reason:'Receive verified stock',data:{image:p.image,brandName:p.brandName,genericName:p.genericName,strength:p.strength,dosageForm:p.dosageForm,manufacturer:p.manufacturerGroup,category:p.category,packageSize:p.packageSize,prescriptionRequired:!!p.prescriptionRequired,unitType:'Strip',quantityReceived:5,batchNumber:'BATCH-1',manufacturingDate:'2025-01-01',expiryDate:'2098-04-30',supplier:'Test supplier',invoice:'INV-1',purchaseDate:'2025-05-01',purchasePricePaise:7200,mrpPaise:10500,pricePaise:9200,drugSchedule:'OTC/Non-Scheduled',hsnCode:'3004',gstRate:5,barcode:'123456',storageRequirement:'Room Temperature',...overrides}});
 for(const invalid of [{image:''},{image:'javascript:alert(1)'},{supplier:'Unknown'},{pricePaise:10600},{quantityReceived:-1},{expiryDate:'2026-02-31'},{quantityAvailable:90},{gstRate:101}])assert.equal((await call('/admin/inventory/receive','POST',receipt(invalid),admin)).status,400);
 assert.equal(store.list('batches').length,0);
 const invoiceForm=new FormData();invoiceForm.append('file',new Blob([new Uint8Array(await sharp({create:{width:10,height:10,channels:3,background:'#fff'}}).jpeg().toBuffer())],{type:'image/jpeg'}),'invoice.jpg');const invoiceUpload=await call('/media?invoice=true','POST',invoiceForm,admin);assert.equal(invoiceUpload.status,201);assert.equal((await call('/media/'+invoiceUpload.data.id)).status,403);
 const firstBody=receipt({invoiceImageId:invoiceUpload.data.id});const first=await call('/admin/inventory/receive','POST',firstBody,admin);assert.equal(first.status,201,JSON.stringify(first.data));assert.equal(first.data.quantityAvailable,5);assert.equal((await call('/admin/invoices/'+invoiceUpload.data.id,'GET',undefined,admin)).status,200);assert.equal((await call('/admin/invoices/'+invoiceUpload.data.id)).status,401);assert.equal(first.data.image,p.image);assert.equal(store.get('products',p.id)!.image,p.image);
 assert.equal((await call('/admin/inventory/receive','POST',firstBody,admin)).status,409);
 assert.equal(store.list('legacyStock')[0].quantity,p.stock);assert.equal(store.get('products',p.id)!.stock,5);
 const second=await call('/admin/inventory/receive','POST',receipt({batchNumber:'BATCH-2',expiryDate:'2099-09-30',quantityReceived:30,purchasePricePaise:7500,mrpPaise:11000,pricePaise:9500}),admin);assert.equal(second.status,201);assert.equal(store.list('products').length,productCount);
 const publicProduct=(await call('/products/'+p.id)).data;assert.equal(publicProduct.price,92);assert.equal(publicProduct.stock,5);assert.equal(publicProduct.purchasePricePaise,undefined);assert.equal(publicProduct.supplier,undefined);
 const customer=await login();assert.equal((await call('/admin/batches','GET',undefined,customer)).status,401);
 assert.equal((await call('/cart/'+p.id,'PUT',{quantity:6},customer)).status,409);
 await call('/cart/'+p.id,'PUT',{quantity:5},customer);const q=(await call('/checkout/quote','GET',undefined,customer)).data;
 const order=await call('/orders','POST',{deliveryContribution:0,fingerprint:q.fingerprint,idempotencyKey:'batch-order-123456789'},customer);assert.equal(order.status,201,JSON.stringify(order.data));assert.equal(order.data.total,460);assert.equal(order.data.batchAllocations,undefined);
 assert.equal(store.get('batches',first.data.id)!.quantityAvailable,0);assert.equal(store.get('batches',second.data.id)!.quantityAvailable,30);assert.equal((await call('/products/'+p.id)).data.price,95);
 const raw=store.get('orders',order.data.id)!;const cancelBody={version:raw.version,status:'Cancelled',review:'Not required',eta:'',notes:'',reason:'Customer cancelled'};
 const cancel=await call('/admin/orders/'+raw.id,'PATCH',cancelBody,admin);assert.equal(cancel.status,200);assert.equal(store.get('batches',first.data.id)!.quantityAvailable,5);
 await call('/admin/orders/'+raw.id,'PATCH',{...cancelBody,version:cancel.data.version},admin);assert.equal(store.get('batches',first.data.id)!.quantityAvailable,5);
 const b=store.get('batches',first.data.id)!;
 const movement=await call('/admin/batches/'+b.id+'/movements','POST',{version:b.version,kind:'damage',delta:-2,reason:'Damaged packs'},admin);assert.equal(movement.status,200);assert.equal(movement.data.quantityAvailable,3);
 assert.equal((await call('/admin/batches/'+b.id+'/movements','POST',{version:movement.data.version,kind:'damage',delta:-10,reason:'Invalid removal'},admin)).status,400);
 assert.equal((await call('/admin/batches/'+b.id,'PUT',{data:{quantityAvailable:500},version:movement.data.version,reason:'Bypass attempt'},admin)).status,404);
 store.put('batches',{...store.get('batches',b.id),expiryDate:'2000-01-01'});assert.equal((await call('/products/'+p.id)).data.price,95);
});

test('new medicines stay draft, duplicate medicine masters are blocked, and catalog staff cannot adjust stock',async t=>{
 const {store,call,admin}=await setup(t);const p=store.list('products')[0];
 await call('/admin/suppliers','POST',{data:{name:'Receipt supplier',active:true},reason:'Configure test supplier'},admin);
 const data={image:'/assets/products/test.jpg',brandName:'New medicine test',genericName:'Test salt',strength:'5 mg',dosageForm:'Tablet',manufacturer:p.manufacturerGroup,category:p.category,packageSize:'10 tablets',unitType:'Strip',quantityReceived:8,batchNumber:'NEW-1',manufacturingDate:'2025-01-01',expiryDate:'2099-01-01',supplier:'Receipt supplier',invoice:'INV-NEW',purchaseDate:'2025-02-01',purchasePricePaise:5000,mrpPaise:10000,pricePaise:8500,prescriptionRequired:true,drugSchedule:'Schedule H',hsnCode:'3004',gstRate:5.5,barcode:'NEW123',storageRequirement:'Room Temperature'};
 const result=await call('/admin/inventory/receive','POST',{data,reason:'First receipt'},admin);assert.equal(result.status,201,JSON.stringify(result.data));assert.equal(store.get('products',result.data.productId)!.status,'draft');
 assert.equal((await call('/products/'+result.data.productId)).status,400);
 assert.equal((await call('/admin/inventory/receive','POST',{data:{...data,batchNumber:'NEW-2'},reason:'Duplicate master attempt'},admin)).status,409);
 await call('/admin/staff','POST',{data:{name:'Catalog user',email:'catalog@example.com',password:'Catalog-password-123',role:'catalog',active:true},reason:'Test stock permissions'},admin);
 const catalog=(await call('/admin/login','POST',{email:'catalog@example.com',password:'Catalog-password-123'})).data.token;
 assert.equal((await call('/admin/batches/'+result.data.id+'/movements','POST',{version:result.data.version,kind:'adjustment',delta:2,reason:'Blocked overwrite'},catalog)).status,403);
 const b=store.get('batches',result.data.id)!;
 assert.equal((await call('/admin/batches/'+b.id+'/movements','POST',{version:b.version,kind:'expiry',delta:-1,reason:'Not expired'},admin)).status,400);
 const damaged=await call('/admin/batches/'+b.id+'/movements','POST',{version:b.version,kind:'damage',delta:-2,reason:'Damaged stock'},admin);assert.equal(damaged.status,200);
 assert.equal((await call('/admin/batches/'+b.id+'/movements','POST',{version:b.version,kind:'return',delta:1,reason:'Stale movement'},admin)).status,409);
 assert.equal((await call('/admin/batches/'+b.id+'/movements','POST',{version:damaged.data.version,kind:'return',delta:1,reason:'Verified return'},admin)).data.quantityAvailable,7);
});
