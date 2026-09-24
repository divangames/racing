'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const target=path.join(root,'assets','HUD','cursor');
if(!fs.existsSync(path.join(root,'rnr.html'))||!fs.existsSync(path.join(root,'site','press.css'))||!fs.existsSync(target)){
  throw new Error('Не найден корень игры, сайт или заданная папка курсора');
}
for(const name of ['default.svg','default.png','action.svg','action.png','cursor.css']){
  fs.copyFileSync(path.join(__dirname,name),path.join(target,name));
}
const link='  <link rel="stylesheet" href="assets/HUD/cursor/cursor.css">';
for(const name of ['rnr.html','index.html']){
  const filename=path.join(root,name);
  const current=fs.readFileSync(filename,'utf8');
  if(current.includes(link))continue;
  if(!current.includes('</head>'))throw new Error('В '+name+' не найден </head>');
  const eol=current.includes('\r\n')?'\r\n':'\n';
  fs.writeFileSync(filename,current.replace('</head>',link+eol+'</head>'));
}
console.log(target);
