export type Post = {id:string;kind:'photo'|'journal';title:string;body:string;image_key:string|null;location:string;taken_at:string;created_at:string;updated_at:string;featured?:boolean;demo?:boolean;source?:string};
export function imageUrl(p:Post) { return p.demo ? p.image_key || '' : p.image_key ? `/api/images/${p.image_key}` : ''; }
// Keep the existing planet collection selected when upgrading older content.
export function isFeaturedPhoto(post: Post) { return post.kind === 'photo' && !!post.image_key && post.featured !== false; }
