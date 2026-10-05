import { listPosts } from '@/lib/posts';
import Studio from './studio';
export const dynamic='force-dynamic';
export default async function Page(){let posts:Awaited<ReturnType<typeof listPosts>>=[];let error='';try{posts=await listPosts()}catch(e){console.error(e);error='Could not load your moments. Please refresh and try again.'}return <Studio initialPosts={posts} initialError={error}/>}
