# Intro video

Video: `bg-load01_sharp.mp4`, copied from the local Meow Tu Tien loading assets.
The original 1920×1080 file plays for 9.033 seconds, muted for reliable autoplay.

The page opens on the video's `ended` event. The bottom-right skip button or
Escape exits early. Home's quick reload skips the intro and video download.
Mobile also plays the full video, with the complete frame visible.

Replace the MP4 at the same path to change the intro. If renaming it, update
`data-src` on `#bio-intro-video` in `index.html`. Styles: `css/video-intro.css`.
Healthy playback is never cut short by a timer. Playback errors or 12 seconds
without progress unlock the page; listeners, timers and video are cleaned up.
