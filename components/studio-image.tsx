'use client';
import { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';

export function useStudioImage(initial = '') {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(initial);
  const [removed, setRemoved] = useState(false);
  useEffect(() => () => { if (preview.startsWith('blob:')) URL.revokeObjectURL(preview); }, [preview]);
  return { file, preview, removed, setFile, setPreview, setRemoved };
}
export default function StudioImage({ image, optional, disabled, onChange, onError }: {
  image: ReturnType<typeof useStudioImage>; optional?: boolean; disabled: boolean;
  onChange: () => void; onError: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return <div className="field"><span>Photo{optional ? ' (optional)' : ''}</span>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose photo" className="sr-only" disabled={disabled} onChange={event => {
      const file = event.target.files?.[0]; if (!file) return;
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) { onError('Choose a JPG, PNG, or WebP photo up to 12 MB.'); event.target.value = ''; return; }
      image.setFile(file); image.setPreview(URL.createObjectURL(file)); image.setRemoved(false); onError(''); onChange();
    }} />
    <button className={`upload-zone ${image.preview ? 'has-preview' : ''}`} type="button" disabled={disabled} onClick={() => input.current?.click()}>
      {image.preview ? <><img src={image.preview} alt="Photo preview" /><span>Change photo</span></> : <><Upload size={23} /><strong>Choose a photo</strong><small>JPG, PNG, WebP · up to 12 MB</small></>}
    </button>
    {image.preview && <button className="text-button studio-image-remove" type="button" disabled={disabled} onClick={() => { image.setFile(null); image.setPreview(''); image.setRemoved(true); if (input.current) input.current.value = ''; onChange(); }}>Remove photo</button>}
  </div>;
}
