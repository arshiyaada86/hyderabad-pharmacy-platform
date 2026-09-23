import { medicines, doctors, customers, localities, specialties } from "@pharmacy/domain/seed";
import { shopCategories } from "../../../packages/domain/src/shopCategories";
import { initialInformation } from "../../../packages/domain/src/content";
import { Store } from "./store";
import { passwordHash } from "./security";
export function seed(store:Store,email:string,password:string,demo:boolean){
 if(!store.list('staff').length) store.put('staff',{id:'owner',name:'Pharmacy owner',email,role:'admin',active:true,passwordHash:passwordHash(password)});
 if(store.get('meta','seed'))return;
 store.transaction(()=>{
  shopCategories.forEach((c,i)=>store.put('categories',{...c,id:'category-'+i,sortOrder:i,status:'published'}));
  ["Dr. Reddy's","Abbott","Cipla"].forEach((name,i)=>store.put('manufacturers',{id:'manufacturer-'+i,name,legalName:name,status:'published'}));
  localities.forEach((name,i)=>store.put('localities',{id:'locality-'+i,name,active:true}));
  specialties.forEach((name,i)=>store.put('specialties',{id:'specialty-'+i,name,active:true}));
  medicines.forEach(({price,mrp,...m},i)=>store.put('products',{...m,status:'published',image:'/assets/products/'+m.image,imageAlt:m.brandName+' pack',imageRights:'Reference: '+m.sourceUrl,pricePaise:Math.round(price*100),mrpPaise:Math.round((mrp??price)*100),stock:demo?(i%5===0?8:40):0}));
  doctors.forEach(({clinics,...d})=>{
   clinics.forEach(c=>store.put('clinics',{...c,status:'published'}));
   store.put('doctors',{...d,clinicIds:clinics.map(c=>c.id),status:'published'});
  });
  store.put('home',{id:'home',shopName:'Old City Pharmacy',tagline:'Your health, our priority',logo:'/assets/pharmacy-icon.png',bannerImage:'/assets/charminar-cutout.png',bannerTitle:'Your neighbourhood pharmacy',bannerButton:'Order now',bannerTarget:'Medicines',featuredIds:medicines.slice(0,2).map(m=>m.id),supportPhone:'',supportEmail:'',orderSuccess:'Order received successfully. Our pharmacy team will call you shortly to confirm medicine availability.',requestSuccess:"Request received. We'll contact you soon.",status:'published'});
  Object.entries(initialInformation).forEach(([page,value])=>store.put('pages',{id:page,page,...value,status:'published'}));
  const privacy=store.get('pages','privacy')!;
  store.put('pages',{...privacy,sections:[['Data stored by this workspace','Account details, carts, orders and requests are stored by the shared pharmacy API. Submitted photos are private and accessible to authorized pharmacy staff.'],['Testing workspace','Use fictional personal details and sample photos while this workspace is in testing mode. Demo sign-in uses a public fixed code.'],['External links','Directions and hospital links open third-party services with their own privacy practices.'],['Your session','Signing out ends your session. It does not delete records stored by the pharmacy workspace.']]});
  const help=store.get('pages','help')!;
  store.put('pages',{...help,sections:help.sections.map((s:string[])=>s[0]==='Need to contact the pharmacy?'?[s[0],'Orders and requests are sent to the connected pharmacy workspace. In testing mode, no real medicine delivery or payment is arranged.']:s)});

  if(demo){
   customers.forEach((c,i)=>{
    store.put('customers',{...c,active:true});
    const product=store.get('products',medicines[i%2].id)!;
    const {pricePaise,mrpPaise,...rest}=product;
    const medicine={...rest,price:pricePaise/100,mrp:mrpPaise/100};
    const date=new Date(Date.now()-(i+1)*86400000).toISOString();
    store.put('orders',{id:'OC00'+(i+1)+'A',customerId:c.id,date,items:[{medicine,quantity:2}],totalPaise:pricePaise*2,deliveryContribution:0,delivery:{name:c.name,address:c.address,locality:c.locality,landmark:c.landmark},phone:c.phone,status:i===0?'Order Received':i===1?'Delivered':'Cancelled',timeline:[{status:'Order Received',date}],sample:true,prescriptionSubmitted:false,notes:'',eta:'',review:'Not required'});
    store.put('requests',{id:'REQ-DEMO-'+i,customerId:c.id,date,status:'Received',followUp:'New',notes:'',assignedTo:'',photo:null,demo:true});
   });
  }
  store.put('meta',{id:'seed',schema:1});
 });
}
