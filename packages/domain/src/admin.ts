import { z } from "zod";
export type RecordData = { id: string; version: number; createdAt: string; updatedAt: string; [key: string]: any };
export type Field = { key: string; label: string; type?: "text" | "textarea" | "number" | "money" | "boolean" | "select" | "multi" | "tags" | "sections" | "image" | "date" | "password"; required?: boolean; choices?: string[]; reference?: string; help?: string; group?: string };
export type Module = { key: string; title: string; singular: string; description: string; fields: Field[]; columns: string[]; roles: string[] };
const publication: Field = { key:"status",label:"Publication",type:"select",choices:["draft","published","archived"],required:true };
const source: Field[] = [{key:"sourceUrl",label:"Source URL"},{key:"sourceCheckedAt",label:"Verified on",type:"date"}];
export const roles = ["admin","catalog","pharmacist","support"];
export const orderStatuses = ["Order Received","Confirmed","Preparing","Out for Delivery","Delivered","Cancelled"];
export const categoryNames = ["Medicines","Skin & Personal Care","Baby Care","Vitamins & Wellness","Women & Family Care"];
export const modules: Module[] = [
 {key:"products",title:"Products",singular:"product",description:"Medicine packs, pricing and prescription rules.",columns:["brandName","manufacturerGroup","category","pricePaise","stock","status"],roles:["admin","catalog"],fields:[
 {key:"brandName",label:"Product name",required:true},{key:"genericName",label:"Generic name",required:true},{key:"manufacturerGroup",label:"Manufacturer",type:"select",reference:"manufacturers",required:true},{key:"manufacturer",label:"Manufacturer",required:true},{key:"composition",label:"Composition",type:"textarea",required:true},{key:"strength",label:"Strength"},{key:"dosageForm",label:"Dosage form",type:"select",reference:"dosageForms",required:true},{key:"packageSize",label:"Pack size"},{key:"category",label:"Subcategory",type:"select",reference:"subcategories",required:true},{key:"mrpPaise",label:"MRP (₹)",type:"money",required:true},{key:"pricePaise",label:"Selling price (₹)",type:"money",required:true},{key:"prescriptionRequired",label:"Prescription required",type:"boolean"},{key:"image",label:"Pack photograph",type:"image",required:true},{key:"imageAlt",label:"Image description",required:true},{key:"imageRights",label:"Image rights / provenance",type:"textarea"},...source,publication]},
 {key:"categories",title:"Categories",singular:"category",description:"Five customer categories and their related subcategories.",columns:["name","icon","sortOrder","status"],roles:["admin","catalog"],fields:[{key:"name",label:"Category",type:"select",choices:categoryNames,required:true},{key:"icon",label:"Category icon",type:"select",choices:["pill","lotion-outline","baby-face-outline","bottle-tonic-plus-outline","human-male-female-child"],required:true},{key:"subcategories",label:"Subcategories",type:"tags",required:true},{key:"sortOrder",label:"Display order",type:"number",required:true},publication]},
 {key:"manufacturers",title:"Manufacturers",singular:"manufacturer",description:"Approved manufacturer information and sources.",columns:["name","legalName","status"],roles:["admin","catalog"],fields:[{key:"name",label:"Manufacturer name",required:true},{key:"legalName",label:"Legal name",required:true},{key:"website",label:"Website"},publication]},
 {key:"customers",title:"Customers",singular:"customer",description:"Customer accounts, delivery information and order history.",columns:["name","phone","locality","active"],roles:["admin","support"],fields:[{key:"name",label:"Full name",required:true},{key:"phone",label:"Mobile number",required:true,help:"Creating a record does not verify ownership of a phone."},{key:"address",label:"Delivery address",type:"textarea",required:true},{key:"locality",label:"Locality",type:"select",reference:"localities",required:true},{key:"landmark",label:"Nearby landmark",required:true},{key:"active",label:"Account active",type:"boolean"}]},
 {key:"localities",title:"Delivery localities",singular:"locality",description:"Areas served by the pharmacy. Doctor clinic localities are separate.",columns:["name","active"],roles:["admin","support"],fields:[{key:"name",label:"Locality name",required:true},{key:"active",label:"Serviceable",type:"boolean"}]},
 {key:"specialties",title:"Specialties",singular:"specialty",description:"Searchable specialties in the doctor directory.",columns:["name","active"],roles:["admin","catalog"],fields:[{key:"name",label:"Specialty name",required:true},{key:"active",label:"Available",type:"boolean"}]},
 {key:"clinics",title:"Clinics",singular:"clinic",description:"Addresses, consultation schedules and directions.",columns:["name","locality","timings","status"],roles:["admin","catalog"],fields:[{key:"name",label:"Clinic name",required:true},{key:"address",label:"Full address",type:"textarea",required:true},{key:"locality",label:"Clinic locality",required:true},{key:"timings",label:"Consultation timings",type:"textarea",required:true},{key:"directionsUrl",label:"Google Maps directions URL",required:true},...source,publication]},
 {key:"doctors",title:"Doctors",singular:"doctor",description:"Verified profiles with one or more clinic schedules.",columns:["name","specialty","qualifications","status"],roles:["admin","catalog"],fields:[{key:"name",label:"Doctor name",required:true},{key:"qualifications",label:"Qualifications",required:true},{key:"specialty",label:"Specialty",type:"select",reference:"specialties",required:true},{key:"clinicIds",label:"Clinics",type:"multi",reference:"clinics",required:true},{key:"contact",label:"Contact number"},{key:"photo",label:"Portrait (optional)",type:"image"},...source,publication]},
 {key:"home",title:"Home & branding",singular:"home configuration",description:"Branding, banner and the exact order of featured products.",columns:["shopName","status","updatedAt"],roles:["admin","catalog"],fields:[{key:"shopName",label:"Shop name",required:true},{key:"tagline",label:"Tagline",required:true},{key:"logo",label:"Logo",type:"image"},{key:"bannerImage",label:"Charminar / banner image",type:"image"},{key:"bannerTitle",label:"Banner headline",required:true},{key:"bannerButton",label:"Banner button text",required:true},{key:"bannerTarget",label:"Banner destination",type:"select",choices:["Medicines","Doctors","Request"],required:true},{key:"featuredIds",label:"Featured products (selection order)",type:"multi",reference:"products"},{key:"supportPhone",label:"Support phone"},{key:"supportEmail",label:"Support email"},{key:"orderSuccess",label:"Order success message",type:"textarea",required:true},{key:"requestSuccess",label:"Request success message",type:"textarea",required:true},publication]},
 {key:"pages",title:"Help & policies",singular:"information page",description:"Publish help, terms, privacy and about content to the app.",columns:["title","page","status","updatedAt"],roles:["admin"],fields:[{key:"page",label:"Page",type:"select",choices:["help","terms","privacy","about"],required:true},{key:"title",label:"Page title",required:true},{key:"sections",label:"Sections",type:"sections",required:true},publication]},
 {key:"staff",title:"Team & access",singular:"staff member",description:"Individual staff accounts and role-based permissions.",columns:["name","email","role","active"],roles:["admin"],fields:[{key:"name",label:"Full name",required:true},{key:"email",label:"Email",required:true},{key:"role",label:"Role",type:"select",choices:roles,required:true},{key:"password",label:"New password",type:"password",help:"At least 12 characters. Leave blank to keep the existing password."},{key:"active",label:"Account active",type:"boolean"}]}
];
export function schemaFor(module: Module) {
 const shape: Record<string,z.ZodType> = {};
 for(const f of module.fields) {
  let schema:z.ZodType;
  if(f.type==="boolean") schema=z.boolean();
  else if(f.type==="number"||f.type==="money") schema=z.number().int().min(0).max(100000000);
  else if(f.type==="tags"||f.type==="multi") schema=z.array(z.string().trim().min(1).max(200)).max(100);
  else if(f.type==="sections") schema=z.array(z.tuple([z.string().trim().min(1).max(200),z.string().trim().min(1).max(10000)])).min(1).max(40);
  else if(f.choices) schema=z.enum(f.choices as [string,...string[]]);
  else schema=z.string().trim().max(f.type==="textarea"?10000:1000).min(f.required?1:0);
  shape[f.key]=f.required?schema:schema.optional();
 }
 return z.object(shape).strict();
}

export const inventoryMasterKeys = ['dosageForms','manufacturers','categories','unitTypes','suppliers','drugSchedules','storageRequirements'];
for (const [key,title,singular] of [['dosageForms','Dosage Forms','dosage form'],['unitTypes','Unit Types','unit type'],['suppliers','Suppliers','supplier'],['drugSchedules','Drug Schedules','drug schedule'],['storageRequirements','Storage Requirements','storage requirement']]) modules.push({key,title,singular,description:'Manage the values available in medicine inventory dropdowns.',columns:['name','active'],roles:['admin','catalog'],fields:[{key:'name',label:'Name',required:true},{key:'active',label:'Available for new receipts',type:'boolean'}]});
export const inventoryFields: Field[] = [
 {key:'brandName',label:'Medicine / Brand Name',required:true,group:'Medicine Details'},
 {key:'genericName',label:'Generic / Salt Name',required:true},
 {key:'strength',label:'Strength'},
 {key:'dosageForm',label:'Dosage Form',type:'select',reference:'dosageForms',required:true},
 {key:'manufacturer',label:'Manufacturer',type:'select',reference:'manufacturers',required:true},
 {key:'category',label:'Medicine Category',type:'select',reference:'subcategories',required:true},
 {key:'packageSize',label:'Pack Size'},
 {key:'unitType',label:'Unit Type',type:'select',reference:'unitTypes',required:true,group:'Inventory'},
 {key:'quantityReceived',label:'Quantity Received',type:'number',required:true},
 {key:'quantityAvailable',label:'Quantity Available',type:'number'},
 {key:'batchNumber',label:'Batch Number',required:true},
 {key:'manufacturingDate',label:'Manufacturing Date',type:'date'},
 {key:'expiryDate',label:'Expiry Date',type:'date',required:true},
 {key:'supplier',label:'Supplier',type:'select',reference:'suppliers',required:true,group:'Purchase Details'},
 {key:'invoice',label:'Purchase Invoice Number'},
 {key:'purchaseDate',label:'Purchase Date',type:'date'},
 {key:'purchasePricePaise',label:'Purchase Price',type:'money',required:true},
 {key:'mrpPaise',label:'MRP',type:'money',required:true,group:'Pricing'},
 {key:'pricePaise',label:'Selling Price',type:'money',required:true},
 {key:'prescriptionRequired',label:'Prescription Required',type:'boolean',group:'Regulatory'},
 {key:'drugSchedule',label:'Drug Schedule',type:'select',reference:'drugSchedules',required:true},
 {key:'hsnCode',label:'HSN Code',group:'Tax Classification'},
 {key:'gstRate',label:'GST Rate (%)',type:'number'},
 {key:'barcode',label:'Barcode',group:'Other'},
 {key:'storageRequirement',label:'Storage Requirement',type:'select',reference:'storageRequirements',required:true}
];
