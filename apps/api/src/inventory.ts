import { z } from 'zod';
import type { Store } from './store';
import type { RecordData } from '@pharmacy/domain/admin';
export class InventoryError extends Error { constructor(public status:number,message:string){super(message);} }
const bad=(message:string):never=>{throw new InventoryError(400,message);};
export const masterKinds=['dosageForms','unitTypes','suppliers','drugSchedules','storageRequirements','manufacturers'];
export function initializeInventory(store:Store){
 if(store.get('meta','inventory-masters'))return;
 store.transaction(()=>{
  const defaults:Record<string,string[]>={dosageForms:['Tablet','Capsule','Syrup','Cream','Drops',...store.list('products').map(p=>p.dosageForm)],unitTypes:['Strip','Bottle','Tube','Box','Piece','Sachet','Vial','Ampoule'],suppliers:[],drugSchedules:['Schedule H','Schedule H1','Schedule X','OTC/Non-Scheduled','Other'],storageRequirements:['Room Temperature','Refrigerated','Keep in Cool & Dry Place','Protect from Light']};
  for(const [kind,names] of Object.entries(defaults))for(const name of new Set(names.filter(Boolean)))if(!store.list(kind).some(r=>r.name===name))store.put(kind,{name,active:true});
  store.put('meta',{id:'inventory-masters',schema:1});
 });
}
const text=z.string().trim().max(200), required=text.min(1);
const date=z.string().refine(v=>!v||(/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v),'Use a valid date.');
const cash=z.number().int().min(0).max(100000000);
export const receiptSchema=z.object({productId:z.string().optional(),version:z.number().optional(),reason:required.min(3),data:z.object({invoiceImageId:z.string().max(100).optional(),image:z.string().min(1).max(1000).refine(v=>/^https:\/\/|^\/assets\/|^\/api\/media\//.test(v),'Upload a valid medicine photograph.'),brandName:required,genericName:required,strength:text,dosageForm:required,manufacturer:required,category:required,packageSize:text,unitType:required,quantityReceived:z.number().int().min(1).max(100000),batchNumber:required,manufacturingDate:date,expiryDate:date.refine(Boolean,'Expiry date is required.'),supplier:required,invoice:text,purchaseDate:date,purchasePricePaise:cash,mrpPaise:cash.positive(),pricePaise:cash,prescriptionRequired:z.boolean(),drugSchedule:required,hsnCode:text,gstRate:z.number().min(0).max(100),barcode:text,storageRequirement:required}).strict()}).strict();
export function batches(store:Store,id:string){return store.list('batches').filter(b=>b.productId===id);}
export function availableBatches(store:Store,id:string){const today=new Date().toISOString().slice(0,10);return batches(store,id).filter(b=>b.expiryDate>=today&&b.quantityAvailable>0).sort((a,b)=>a.expiryDate.localeCompare(b.expiryDate)||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));}
// One displayed price per product. Reserve only batches matching the earliest-expiring offer.
export function offer(store:Store,p:RecordData){
 if(!store.get('products',p.id)?.batchManaged)return {stock:store.get('products',p.id)?.stock??p.stock,pricePaise:p.pricePaise,mrpPaise:p.mrpPaise};
 const all=availableBatches(store,p.id),first=all[0];
 return {stock:first?all.filter(b=>b.pricePaise===first.pricePaise&&b.mrpPaise===first.mrpPaise).reduce((n,b)=>n+b.quantityAvailable,0):0,pricePaise:first?.pricePaise??p.pricePaise,mrpPaise:first?.mrpPaise??p.mrpPaise};
}
export function syncStock(store:Store,id:string){const p=store.get('products',id)!;return store.put('products',{...p,stock:availableBatches(store,id).reduce((n,b)=>n+b.quantityAvailable,0)});}
export function moveBatch(store:Store,b:RecordData,delta:number,kind:string,reason:string,actor:string,orderId?:string){
 if(b.quantityAvailable+delta<0)bad('Insufficient quantity in this batch.');
 const next=store.put('batches',{...b,quantityAvailable:b.quantityAvailable+delta});
 store.put('inventory',{productId:b.productId,productName:store.get('products',b.productId)?.brandName,batchId:b.id,batchNumber:b.batchNumber,delta,balance:next.quantityAvailable,kind,reason,actor,orderId});return next;
}
export function receive(store:Store,raw:unknown,actor:string){
 const input=receiptSchema.parse(raw),d=input.data;
 return store.transaction(()=>{
  if(d.invoiceImageId){const image=store.db.prepare('SELECT owner,public FROM media WHERE id=?').get(d.invoiceImageId) as any;if(!image||image.public||image.owner!==actor)bad('Attach a private invoice image uploaded by your account.');}
  if(d.pricePaise>d.mrpPaise)bad('Selling price cannot exceed MRP.');
  const today=new Date().toISOString().slice(0,10);
  if(d.expiryDate<today)bad('Do not receive expired stock.');
  if(d.manufacturingDate&&(d.manufacturingDate>d.expiryDate||d.manufacturingDate>today))bad('Manufacturing date must be before expiry and not in the future.');
  if(d.purchaseDate&&(d.purchaseDate>today||d.purchaseDate>d.expiryDate||(d.manufacturingDate&&d.purchaseDate<d.manufacturingDate)))bad('Check the purchase date against manufacture and expiry dates.');
  const references:Record<string,string>={};
  for(const [key,kind]of Object.entries({dosageForm:'dosageForms',manufacturer:'manufacturers',unitType:'unitTypes',supplier:'suppliers',drugSchedule:'drugSchedules',storageRequirement:'storageRequirements'})){
   const value=(d as any)[key],master=store.list(kind).find(r=>r.name===value&&r.active!==false&&r.status!=='archived');if(!master)bad('Choose an active '+key+' from Master Data.');references[key]=master!.id;
  }
  if(!store.list('categories').some(c=>c.status!=='archived'&&c.subcategories.includes(d.category)))bad('Choose a configured medicine category.');
  let product=input.productId?store.get('products',input.productId):undefined;
  if(input.productId&&!product)bad('Medicine not found.');
  if(product&&product.version!==input.version)throw new InventoryError(409,'Medicine changed. Close and reopen before saving.');
  if(!product){const same=store.list('products').find(p=>p.brandName.toLowerCase()===d.brandName.toLowerCase()&&p.manufacturerGroup===d.manufacturer&&p.strength.toLowerCase()===d.strength.toLowerCase()&&p.packageSize.toLowerCase()===d.packageSize.toLowerCase());if(same)throw new InventoryError(409,'This medicine already exists. Select it to receive another batch.');}
  const master={brandName:d.brandName,genericName:d.genericName,strength:d.strength,dosageForm:d.dosageForm,manufacturer:d.manufacturer,manufacturerGroup:d.manufacturer,category:d.category,packageSize:d.packageSize,prescriptionRequired:d.prescriptionRequired};
  if(product&&Object.entries(master).some(([key,value])=>key!=='manufacturer'&&product![key]!==value))bad('Existing medicine details are read-only here. Edit the medicine master separately.');
  const prior=product;
  product=store.put('products',{...master,composition:d.genericName,status:'draft',mrpPaise:d.mrpPaise,pricePaise:d.pricePaise,...product,image:d.image,imageAlt:d.brandName,batchManaged:true,stock:0});
  if(prior&&!prior.batchManaged&&prior.stock>0){store.put('inventory',{productId:product.id,productName:product.brandName,delta:-prior.stock,balance:0,kind:'legacy quarantine',reason:'Unverified opening stock held for reconciliation; receive verified batches before selling.',actor});store.put('legacyStock',{productId:product.id,quantity:prior.stock,status:'needs reconciliation'});}
  const batch=store.put('batches',{...d,productId:product.id,masterIds:references,quantityAvailable:d.quantityReceived,actor});
  store.put('purchases',{...d,productId:product.id,productName:product.brandName,batchId:batch.id,quantity:d.quantityReceived,receivedDate:d.purchaseDate||today,actor});
  store.put('inventory',{productId:product.id,productName:product.brandName,batchId:batch.id,batchNumber:d.batchNumber,delta:d.quantityReceived,balance:d.quantityReceived,kind:'receipt',reason:input.reason,actor});
  syncStock(store,product.id);store.audit(actor,'receive batch','batches',batch.id,input.reason,null,batch);return batch;
 });
}
export function reserveBatches(store:Store,product:RecordData,quantity:number,orderId:string,actor:string){
 const price=offer(store,product);let remaining=quantity;const allocations:{batchId:string;quantity:number}[]=[];
 for(const b of availableBatches(store,product.id).filter(b=>b.pricePaise===price.pricePaise&&b.mrpPaise===price.mrpPaise)){
  const count=Math.min(remaining,b.quantityAvailable);if(!count)break;moveBatch(store,b,-count,'sale','Order '+orderId,actor,orderId);allocations.push({batchId:b.id,quantity:count});remaining-=count;
 }
 if(remaining)throw new InventoryError(409,'Batch availability changed. Review the cart.');syncStock(store,product.id);return allocations;
}
