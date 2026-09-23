import { randomBytes, scryptSync, timingSafeEqual, createHash, createHmac } from "node:crypto";
export const token=()=>randomBytes(32).toString('hex');
export const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export function passwordHash(password:string){const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex');}
export function passwordMatches(password:string,stored:string){const [salt,key]=stored.split(':');if(!salt||!key)return false;const computed=scryptSync(password,salt,64);const expected=Buffer.from(key,'hex');return expected.length===computed.length&&timingSafeEqual(computed,expected);}
export function sign(secret:string,value:string){return createHmac('sha256',secret).update(value).digest('hex');}
export function validSignature(secret:string,value:string,signature:string){const expected=Buffer.from(sign(secret,value));const actual=Buffer.from(signature);return expected.length===actual.length&&timingSafeEqual(expected,actual);}
