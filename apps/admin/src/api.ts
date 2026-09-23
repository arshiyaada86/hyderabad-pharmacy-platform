export async function api(path:string,options:RequestInit={}) {
 const token=sessionStorage.getItem('pharmacy.admin.token');const headers=new Headers(options.headers);if(token)headers.set('Authorization','Bearer '+token);
 if(options.body&&!(options.body instanceof FormData))headers.set('Content-Type','application/json');
 const response=await fetch('/api'+path,{...options,headers});const data=await response.json().catch(()=>({error:'Invalid server response.'}));
 if(!response.ok){if(response.status===401){sessionStorage.removeItem('pharmacy.admin.token');window.dispatchEvent(new Event('pharmacy:signout'));}throw new Error(data.error||'Request failed.');}return data;
}
export const money=(paise:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(paise/100);
export const date=(value:string)=>new Date(value).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});
