import { listPosts } from '@/lib/posts';
import { listDestinations } from '@/lib/destinations';
import ContentStudio from '@/components/content-studio';
import type { Destination } from '@/lib/destination-shared';
import { listAlbums } from '@/lib/albums';
import type { Album } from '@/lib/album-shared';
import './studio.css';
export const dynamic='force-dynamic';
export default async function Page(){let posts:Awaited<ReturnType<typeof listPosts>>=[];let destinations:Destination[]=[];let albums:Album[]=[];let error='';try{[posts,destinations]=await Promise.all([listPosts(),listDestinations()]);albums=await listAlbums(posts)}catch(e){console.error(e);error='Could not load your website content.'}return <ContentStudio posts={posts} destinations={destinations} albums={albums} error={error}/>}
