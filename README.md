# Jerry Zhu · Personal Homepage

A local Next.js personal website. The homepage opens with a full-screen photograph, gradually blurs and darkens the background, and brings the profile content up from the bottom. The content sits directly over the photograph with no opaque panel. The left third contains the profile; the right two thirds show a large handwritten welcome, with a lyric ticker in the bottom-right corner. All website interface text is in English; supplied lyrics appear in their original language.

## Run locally on Windows

Node.js 22.13 or later is required. In PowerShell:

```powershell
cd C:\Users\jiaru\Desktop\site\jerry-journal-local\jerry-journal-local
npm.cmd install
npm.cmd run dev
```

Open http://127.0.0.1:3000. Keep the terminal running; press Ctrl+C to stop.

Once dependencies are installed, only `npm.cmd run dev` is needed. Using `npm.cmd` also works when PowerShell blocks `npm.ps1`.

## Customize the homepage

- Profile text, interests, location, music, MBTI, and zodiac sign: `lib/profile.ts`. Location appears directly below the cycling/interests line.
- Background photograph: `public/background.jpg`.
- Background blur strength: `--home-background-blur` in `app/home.css` (currently 6 px).
- White Fudan University emblem: `public/icons/fudan.svg`, displayed before the university name.
- Circular portrait: add `public/profile.jpg`, then set `photo: '/profile.jpg'` in `lib/profile.ts`.
- Personality line: set `mbti` and `zodiac`; leave both empty to hide that line.
- Homepage layout: `app/page.tsx`.
- Homepage styling and animation timing: `app/home.css`.
- Image loading and entrance sequence: `components/home-intro.tsx`.
- Welcome message: `components/home-welcome.tsx` and `lib/welcome.ts`. The visitor's local entry time selects morning (05:00–11:59), afternoon (12:00–17:59), or night (18:00–04:59). SVG pen strokes write the greeting, "Welcome to", and "My Space!" once during the entrance, taking about 7 seconds. Reduced-motion preferences show the finished writing immediately. On mobile the welcome appears below the profile. Vector glyph data and attribution are in `lib/handwriting/`.
- Homepage navigation: the links below the welcome open `/about`, `/journey`, `/gallery`, `/music`, and `/notes`. Labels and descriptions are in `lib/spaces.ts`. Each route has a basic page with matching background, navigation, and a Home link; detailed content is still to be added. Pages are in `app/(spaces)/`, with their shared content scaffold in `components/space-page.tsx` and styling in `app/(spaces)/spaces.css`.
- GitHub, Gmail, Douyin, and rednote contact details, displayed in that order: `contacts` in `lib/profile.ts`. GitHub currently shows the supplied display name; leave an account empty to display "Not added yet". The contact heading, icons, and popup text use gray.
- Social icons and account popups: `components/social-logos.tsx` and `public/icons/`. Hover or focus an icon to preview its account; click or tap to keep it open. Click the icon again, click outside, or press Escape to close. External links are not connected yet.
- Site title, description, and language: `app/layout.tsx`.
- Lyric collection: `lyric.txt` in the project root, one lyric per line, currently in Traditional Chinese. Blank lines are ignored. Edit this file and refresh during development; rebuild to update a production site.
- Lyric ticker: `components/lyrics-ticker.tsx` and `app/home.css`. Each page load shuffles the lyrics after hydration, then continuously scrolls them from right to left after the entrance finishes. The end joins seamlessly back to the beginning. The top and bottom edges have white lines that fade toward both ends. Hover or keyboard focus pauses scrolling. Reduced-motion preferences show one static lyric. On mobile the ticker sits below the welcome to avoid overlapping content.

The background starts blurring and darkening after 300 ms over 2.4 seconds. Content begins rising after 900 ms over 2.2 seconds and settles after a small bounce. The full entrance takes about 3.1 seconds after the photograph loads. Animation timing is controlled by the variables at the top of `app/home.css`. Reduced-motion preferences display the profile immediately against the darkened, blurred photograph.

## Photo journal and studio

- Photo journal: http://127.0.0.1:3000/moments.
- Upload, edit, and delete moments: http://127.0.0.1:3000/studio.
- Sample content: `lib/demo.ts`. Publishing a photograph or journal entry replaces the samples in that section.
- Text and metadata are saved in `data/posts.json`.
- Uploaded images are saved in `data/images/`. JPEG, PNG, and WebP are supported, up to 12 MB per image.
- Back up the entire `data` folder. Deleting an entry also permanently deletes its associated photograph.

The development server listens only on this computer and stores data locally. Temporary sharing uses a separate production preview; permanent hosting needs its own deployment setup.

## Share a temporary preview

Run `npm.cmd run share` from the project folder. It builds the current website, starts a production server on `127.0.0.1:3100`, and shares the read-only relay on `127.0.0.1:3101` through a Cloudflare Quick Tunnel. Copy the printed `https://....trycloudflare.com` address to your friends. Keep the computer awake, online, and the sharing process running; Ctrl+C stops sharing. Each new tunnel gets a new address.

The relay shares only the homepage, About, Journey, Gallery, Music, Notes, and their static assets. It blocks upload/edit/delete requests, `/studio`, `/api`, and other routes. Local development and editing on port 3000 continue as before.

The Windows tunnel executable is stored at `node_modules/.cache/jerry-preview/cloudflared.exe`, outside committed source. If it is removed, download the Windows amd64 executable from the [official Cloudflare releases](https://github.com/cloudflare/cloudflared/releases), then restore that path or set `CLOUDFLARED_PATH` to the executable. No Cloudflare account or domain is required for this temporary URL. See [Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) for service limitations.

## Check and build

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd start
```
