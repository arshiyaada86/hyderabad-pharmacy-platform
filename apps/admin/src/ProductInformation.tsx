import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, Typography } from '@mui/material';
import type { RecordData } from '@pharmacy/domain/admin';
import { api, date } from './api';

export default function ProductInformation({record,onRelated}:{record:RecordData;onRelated?:(key:string,record:RecordData)=>void}) {
 const [data,setData]=useState<any>(),[error,setError]=useState(''),[page,setPage]=useState(0),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setError('');Promise.all([
  api('/admin/inventory?productId='+encodeURIComponent(record.id)+'&page='+page+'&limit=10'),
  api('/admin/manufacturers?limit=100'),api('/admin/categories?limit=100')
 ]).then(([inventory,manufacturers,categories])=>{if(active)setData({inventory,manufacturer:manufacturers.items.find((m:any)=>m.name===record.manufacturerGroup),category:categories.items.find((c:any)=>c.subcategories.includes(record.category))});}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[record.id,page,retry]);
 return <Stack spacing={2}>
  <Paper variant="outlined" sx={{p:2,bgcolor:'#eef6f1'}}><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography variant="caption">CURRENT INVENTORY</Typography><Typography variant="h5">{record.stock??0} packs</Typography></Box><Chip label={record.stock===0?'Out of stock':record.stock<=10?'Low stock':'In stock'} color={record.stock<=10?'warning':'success'}/></Stack></Paper>
  {error&&<Alert severity="error" action={<Button onClick={()=>setRetry(n=>n+1)}>Retry</Button>}>{error}</Alert>}
  {!data&&!error&&<CircularProgress size={24}/>}
  {data&&<>
   <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',sm:'1fr 1fr'},gap:2}}>
    <Paper variant="outlined" sx={{p:2}}><Typography fontWeight={700}>Manufacturer</Typography><Typography>{record.manufacturerGroup}</Typography><Typography variant="body2">{record.manufacturer}</Typography>{data.manufacturer?.legalName!==record.manufacturer&&<Typography variant="body2">{data.manufacturer?.legalName}</Typography>}{data.manufacturer?.website&&<Typography variant="body2" sx={{overflowWrap:'anywhere'}}>{data.manufacturer.website}</Typography>}{data.manufacturer&&onRelated&&<Button size="small" onClick={()=>onRelated('manufacturers',data.manufacturer)}>Edit manufacturer information</Button>}</Paper>
    <Paper variant="outlined" sx={{p:2}}><Typography fontWeight={700}>Category</Typography><Typography>{data.category?.name||record.category}</Typography><Typography variant="body2">Subcategory: {record.category}</Typography>{data.category&&onRelated&&<Button size="small" onClick={()=>onRelated('categories',data.category)}>Edit category information</Button>}</Paper>
   </Box>
   <Box><Typography variant="h6">Stock history</Typography><Typography variant="body2" color="text.secondary">Stock adjustments and order movements for this product only.</Typography><TableContainer><Table size="small"><TableHead><TableRow><TableCell>Date</TableCell><TableCell>Change</TableCell><TableCell>Balance</TableCell><TableCell>Reason</TableCell></TableRow></TableHead><TableBody>{data.inventory.items.map((entry:any)=><TableRow key={entry.id}><TableCell>{date(entry.createdAt)}</TableCell><TableCell>{entry.delta>0?'+':''}{entry.delta}</TableCell><TableCell>{entry.balance} packs</TableCell><TableCell>{entry.reason}</TableCell></TableRow>)}{!data.inventory.total&&<TableRow><TableCell colSpan={4}>No stock movements recorded. Current stock includes the opening balance.</TableCell></TableRow>}</TableBody></Table></TableContainer><TablePagination component="div" count={data.inventory.total} page={page} onPageChange={(_,p)=>setPage(p)} rowsPerPage={10} rowsPerPageOptions={[10]}/></Box>
  </>}
 </Stack>;
}
