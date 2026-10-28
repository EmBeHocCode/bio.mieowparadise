# Music cover images

Put cover images directly in this folder (no subfolders). Supported formats:
PNG, JPG/JPEG, WebP, GIF and AVIF. Keep `index.php` here: the PHP host uses it
to return the current image list automatically. No manual list is required.

- Recommended: square images, 512 × 512 px (1024 × 1024 px also works).
- Non-square images are center-cropped by `object-fit: cover`.
- Aim for 100–300 KB per image when possible.
- Each song gets a random cover that stays with it for the current page session.
- Different songs get different covers until every available image has been used.
  If there are fewer images than songs, the bag reshuffles and permits reuse.

After adding/removing images, reload the page. An already-open player also checks
the folder when loading another song, at most once every 30 seconds. Existing
unique assignments are kept when new images arrive; new unused images take
priority. Modified files use their mtime as a cache version. An empty folder
uses a neutral music icon.

The local Python preview reads its directory listing; production uses the PHP
catalog. Upload `index.php` together with the images. This endpoint only reads
this folder and never accepts uploads or modifies files.
