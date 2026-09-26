import React from 'react';
import { Box, Typography } from '@mui/material';
import type { Field } from '@pharmacy/domain/admin';
import { FieldInput } from './Editor';
import { money } from './api';
export function InlineField({field,value,refs,editing,onEdit,onChange,disabled=false}:{field:Field;value:any;refs:any;editing:boolean;onEdit:()=>void;onChange:(value:any)=>void;disabled?:boolean}){
 const reference=(v:string)=>refs[field.reference||'']?.find((r:any)=>r.id===v)?.name||v;
 const display=field.type==='password'?'••••••••':field.type==='money'?money(value||0):typeof value==='boolean'?(value?'Yes':'No'):Array.isArray(value)?value.map(v=>Array.isArray(v)?v.join(': '):reference(v)).join(' · '):value===undefined||value===null||value===''?'Not set':value;
 if(editing)return <Box component="fieldset" disabled={disabled} sx={{minWidth:0,border:0,m:0,p:0}}><FieldInput field={field} value={value} refs={refs} onChange={onChange}/></Box>;
 return <Box tabIndex={disabled?undefined:0} role={disabled?undefined:'button'} aria-label={`${field.label}: ${field.type==='password'?'hidden':display}. ${disabled?'Read only':'Double-click to edit'}`} onDoubleClick={disabled?undefined:onEdit} onKeyDown={e=>{if(!disabled&&(e.key==='Enter'||e.key==='F2'||e.key===' ')){e.preventDefault();onEdit();}}} sx={{p:1.25,borderRadius:1.5,minWidth:0,border:'1px solid transparent',cursor:disabled?'default':'text','&:hover':{bgcolor:'#f4f8f6'},'&:focus-visible':{outline:'2px solid #0a6b58'}}}>
 <Typography variant="caption" color="text.secondary">{field.label}</Typography>
 {field.type==='image'&&value?<Box component="img" src={value} alt={field.label} sx={{display:'block',height:140,maxWidth:'100%',objectFit:'contain',mt:1}}/>:<Typography variant="body2" sx={{overflowWrap:'anywhere',whiteSpace:'pre-wrap'}}>{display}</Typography>}
 </Box>;
}
