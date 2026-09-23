import { Platform } from "react-native";
import { randomUUID } from "expo-crypto";
import { AppConfiguration, KeyValueStorage, Media, MediaService, Services } from "./types";
export function createApiServices(baseUrl:string,session:KeyValueStorage,localMedia:MediaService):Services {
 const base=baseUrl.replace(/\/$/,'');const key='pharmacy.api.session.'+Array.from(base).map(char=>char.charCodeAt(0).toString(16).padStart(4,'0')).join('');
 let challenge='',registrationToken='',lastQuote:any,checkoutKey='';
 const absolute=(url:string)=>url?.startsWith('/')?base+url:url;
 const images=(value:any):any=>{if(Array.isArray(value))return value.map(images);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,['image','uri','photo','logo','bannerImage'].includes(k)&&typeof v==='string'?absolute(v):images(v)]));return value;};
 async function request(path:string,method='GET',body?:any):Promise<any>{
  const token=await session.getItem(key);const headers:any={};if(token)headers.Authorization='Bearer '+token;if(body&&!(body instanceof FormData))headers['Content-Type']='application/json';
  const response=await fetch(base+'/api'+path,{method,headers,body:body instanceof FormData?body:body?JSON.stringify(body):undefined});
  const data=await response.json();if(!response.ok){if(response.status===401)await session.removeItem(key);throw Object.assign(new Error(data.error||'Unable to complete request.'),{status:response.status});}return images(data);
 }
 const saveLogin=async(result:any)=>{if(result.token)await session.setItem(key,result.token);registrationToken=result.registrationToken||'';return result.user;};
 const uploaded=new Map<string,Media>();
 const upload=async(media:Media)=>{
  if(uploaded.has(media.id))return uploaded.get(media.id)!;
  await localMedia.validate(media);const form=new FormData();
  if(Platform.OS==='web'){form.append('file',await(await fetch(media.uri)).blob(),'photo.jpg');}else form.append('file',{uri:media.uri,name:'photo.jpg',type:'image/jpeg'} as any);
  const result=await request('/media','POST',form);uploaded.set(media.id,result);return result as Media;
 };
 const services:Services={
  reference:{categories:[],localities:[],specialties:[],doctorLocalities:[],demoPhone:'',demoOtp:''},
  configuration:async()=>{const data=await request('/config');Object.assign(services.reference,data.reference);return data as AppConfiguration;},
  medicine:{list:(q='',category='')=>request('/products?q='+encodeURIComponent(q)+'&category='+encodeURIComponent(category)),get:id=>request('/products/'+encodeURIComponent(id))},
  doctor:{list:(q='',specialty='',locality='')=>request('/doctors?q='+encodeURIComponent(q)+'&specialty='+encodeURIComponent(specialty)+'&locality='+encodeURIComponent(locality)),get:id=>request('/doctors/'+encodeURIComponent(id))},
  auth:{current:async()=>{if(!await session.getItem(key))return null;try{return await request('/me');}catch(e){if((e as any).status===401)return null;throw e;}},sendOtp:async phone=>{challenge=(await request('/auth/otp','POST',{phone})).challenge;},verifyOtp:async(_phone,code)=>saveLogin(await request('/auth/verify','POST',{challenge,code})),register:async profile=>saveLogin(await request('/auth/register','POST',{registrationToken,profile})),update:input=>request('/me','PUT',input),logout:async()=>{await request('/logout','POST');await session.removeItem(key);}},
  cart:{list:async()=>{const lines=await request('/cart');if(lines.length&&!lastQuote){try{lastQuote=await request('/checkout/quote');}catch{lastQuote=undefined;}}else if(!lines.length)lastQuote=undefined;return lines;},setQuantity:async(id,quantity)=>{await request('/cart/'+id,'PUT',{quantity});checkoutKey='';lastQuote=undefined;},add:async(id,quantity)=>{await request('/cart/'+id,'PUT',{quantity,add:true});checkoutKey='';lastQuote=undefined;}},
  order:{list:()=>request('/orders'),get:id=>request('/orders/'+id),again:async id=>{checkoutKey='';lastQuote=undefined;return request('/orders/'+id+'/again','POST');},place:async(deliveryContribution,prescription)=>{
   if(!lastQuote)throw new Error('Review your cart: stock or prices may have changed.');
   checkoutKey ||= randomUUID();const photo=prescription?await upload(prescription):undefined;
   try{const order=await request('/orders','POST',{deliveryContribution,prescriptionId:photo?.id,fingerprint:lastQuote.fingerprint,idempotencyKey:checkoutKey});checkoutKey='';lastQuote=undefined;return order;}catch(e){if((e as any).status===409){checkoutKey='';lastQuote=undefined;}throw e;}
  }},
  request:{list:()=>request('/requests'),submit:async photo=>request('/requests','POST',{photoId:(await upload(photo)).id})},
  media:{...localMedia,remove:async media=>{const remote=uploaded.get(media.id);if(remote){try{await request('/media/'+remote.id,'DELETE');}catch(e){if((e as any).status!==409)throw e;}uploaded.delete(media.id);}await localMedia.remove(media);}},
 };
 return services;
}
