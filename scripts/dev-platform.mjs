import { spawn } from 'node:child_process';
const children=['@pharmacy/api','@pharmacy/admin'].map(workspace=>spawn(process.platform==='win32'?'npm.cmd':'npm',['run','dev','-w',workspace],{stdio:'inherit',shell:process.platform==='win32',windowsHide:true}));
for(const child of children)child.on('exit',code=>{if(code)process.exitCode=code;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{children.forEach(child=>child.kill());process.exit();});
