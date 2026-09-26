import React,{useState} from 'react';
import {Alert,Box,Button,Typography} from '@mui/material';
import {AttachFileOutlined} from '@mui/icons-material';
import {api} from './api';
export default function InvoiceUpload({value,onChange,onBusy}:{value:string;onChange:(id:string)=>void;onBusy:(busy:boolean)=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 return <Box><Typography fontWeight={600}>Invoice image (optional)</Typography><Button component="label" startIcon={<AttachFileOutlined/>} disabled={busy}>{busy?'Uploading…':value?'Replace invoice image':'Attach invoice image'}<input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setBusy(true);onBusy(true);setError('');try{const body=new FormData();body.append('file',file);const result=await api('/media?invoice=true',{method:'POST',body});onChange(result.id);}catch(e){setError((e as Error).message);}finally{setBusy(false);onBusy(false);}}}/></Button>{value&&<Typography variant="caption" display="block" color="primary">Invoice image attached</Typography>}{error&&<Alert severity="error">{error}</Alert>}</Box>;
}
