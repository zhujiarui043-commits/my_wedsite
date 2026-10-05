import { bucket, listPosts, writePosts, withWriteLock } from '@/lib/posts';
export const dynamic='force-dynamic';
const fail=(s:string,status:number)=>Response.json({error:s},{status});
async function guard(req:Request) {
  const host = req.headers.get('host');
  if (!host) return fail('Invalid request address.',403);
  const localUrl = new URL(`http://${host}`);
  if (!['localhost','127.0.0.1','[::1]'].includes(localUrl.hostname)) return fail('Use a local address to edit your moments.',403);
  if (req.headers.get('origin') !== localUrl.origin) return fail('Invalid request origin. Please refresh and try again.',403);
  return null;
}
export async function GET(){try{return Response.json({posts:await listPosts()},{headers:{'Cache-Control':'no-store'}})}catch(e){console.error(e);return fail('Could not load your moments. Please try again.',503)}}
export async function POST(req:Request){return withWriteLock(()=>save(req,false))}
export async function PATCH(req:Request){return withWriteLock(()=>save(req,true))}
async function save(req:Request,edit:boolean){
 let newKey:string|null=null;
 try {
  const denied=await guard(req);if(denied)return denied;
  if(Number(req.headers.get('content-length')||0)>13*1024*1024)return fail('Photos must be no larger than 12 MB.',413);
  const f=await req.formData(); const get=(k:string)=>String(f.get(k)||'').trim();
  const id=edit?get('id'):crypto.randomUUID();const kind=get('kind'),title=get('title'),body=get('body'),location=get('location'),takenAt=get('taken_at');
  if(!['photo','journal'].includes(kind)||!title||title.length>100||body.length>20000||location.length>100||!/^\d{4}-\d{2}-\d{2}$/.test(takenAt)||(!Number.isFinite(Date.parse(takenAt))||new Date(takenAt).toISOString().slice(0,10)!==takenAt))return fail('Check the title, date, and content length.',400);
  const posts=await listPosts();const old=edit?posts.find(p=>p.id===id):null;
  if(edit&&!old)return fail('This moment no longer exists.',404);
  const file=f.get('image');let key=old?.image_key||null;
  if(file instanceof File&&file.size){
   if(file.size>12*1024*1024)return fail('Photos must be no larger than 12 MB.',413);
   const bytes=await file.arrayBuffer();const a=new Uint8Array(bytes);
   const isJpeg=a[0]===255&&a[1]===216&&a[2]===255;const isPng=a[0]===137&&a[1]===80&&a[2]===78&&a[3]===71;const isWebp=String.fromCharCode(...a.slice(0,4))==='RIFF'&&String.fromCharCode(...a.slice(8,12))==='WEBP';
   const type=isJpeg?'image/jpeg':isPng?'image/png':isWebp?'image/webp':null;
   if(!type||type!==file.type)return fail('Choose a JPG, PNG, or WebP photo.',400);
   newKey=crypto.randomUUID();await bucket().put(newKey,bytes,{httpMetadata:{contentType:type}});key=newKey;
  }
  if(kind==='photo'&&!key)return fail('Add a photo to publish a photograph.',400);
  const now=new Date().toISOString();
  const post={id,kind:kind as 'photo'|'journal',title,body,image_key:key,location,taken_at:takenAt,created_at:old?.created_at||now,updated_at:now};
  await writePosts([post,...posts.filter(p=>p.id!==id)]);
  if(newKey&&old?.image_key)try{await bucket().delete(old.image_key)}catch(e){console.error('Old image cleanup failed',e)}
  return Response.json({post:{id,kind,title,body,image_key:key,location,taken_at:takenAt,created_at:old?.created_at||now,updated_at:now}});
 } catch(e){if(newKey)try{await bucket().delete(newKey)}catch{}console.error(e);return fail('Could not save. Your draft is still in the editor. Please try again.',503)}
}
export async function DELETE(req:Request){return withWriteLock(async()=>{try{const denied=await guard(req);if(denied)return denied;const {id}=await req.json() as {id?:unknown};if(typeof id!=='string')return fail('Invalid moment ID.',400);const posts=await listPosts();const old=posts.find(p=>p.id===id);if(!old)return fail('This moment no longer exists.',404);await writePosts(posts.filter(p=>p.id!==id));if(old.image_key)try{await bucket().delete(old.image_key)}catch(e){console.error(e)}return Response.json({id})}catch(e){console.error(e);return fail('Could not delete. Please try again.',503)}});}
