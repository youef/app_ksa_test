export function safeServiceMapUrl(value:unknown):string|null{
 if(typeof value!=='string')return null;
 try{const url=new URL(value.trim());const hosts=['google.com','www.google.com','maps.google.com','google.com.sa','www.google.com.sa','maps.google.com.sa','maps.app.goo.gl','goo.gl','maps.apple.com','openstreetmap.org','www.openstreetmap.org'];return url.protocol==='https:'&&!url.username&&!url.password&&hosts.includes(url.hostname)?url.href:null;}catch{return null;}
}
