# Web bio tren VPS

## Dia chi va thu muc

- Website: https://bio.mieowparadise.io.vn/
- SSH da co tren may local: `ssh meow-aws` (tai khoan `ubuntu`).
- Thu muc web: `/var/www/bio.mieowparadise.io.vn/public_html`.
- `public_html` la symlink den release `releases/20261028-1835`.
- Nguon duoc chuyen tu `E:\bio.mieowparadise.io.vn\public_html`.

Nginx dung `/etc/nginx/sites-available/bio.mieowparadise.io.vn` va snippet
`/etc/nginx/snippets/bio-content.conf`. `.htaccess` chi danh cho Apache;
cache, PHP va cac route tren VPS duoc cau hinh trong Nginx.

## Them nhac va anh tren VPS

Dung SFTP voi cung thong tin SSH, vao thu muc web o tren:

- Nhac: `assets/music/Drill-music`, `Chill-music`, `Remix-music`.
- Them ten file vao `js/music-library.js` de bai xuat hien trong player.
- Anh bia: `assets/cover-png`; PHP tu nhan anh moi, khong can sua danh sach.
- Giu file `assets/cover-png/index.php` de cung cap danh muc anh.

Vi du upload cau hinh tu thu muc ma nguon local:

```powershell
scp js/music-library.js meow-aws:/var/www/bio.mieowparadise.io.vn/public_html/js/
```

File cau hinh nhac va HTML dung `no-cache`. CSS/JS/anh/nhac khac cache 30 ngay,
nen khi thay CSS/JS can tang version `?v=` tuong ung trong HTML. Tranh ghi de
file tren VPS bang ban local cu neu da them anh/nhac truc tiep tren VPS.

## Loi bai hat LRC

Player doc file `.lrc` UTF-8 cung ten, cung thu muc voi MP3.
Vi du: `assets/music/Chill-music/02-khongbuong.lrc`.
Khong can backend nhan dang. `meow-bio-lyrics` da dung va disable tren VPS;
API cu `/api/lyrics` tra 410 de client cu khong kich hoat AI.
Nginx phuc vu LRC nhu text/plain, no-cache. Huong dan: `assets/music/README.md`.
Goi release tu dong gom LRC trong assets; khong can cai Python/model tren VPS moi.

## Chung chi HTTPS

Chung chi Let's Encrypt cho rieng `bio.mieowparadise.io.vn`, cap bang webroot
`/var/lib/letsencrypt`. `certbot.timer` tu gia han; deploy hook reload Nginx
sau khi gia han thanh cong. Da thu `certbot renew --dry-run` thanh cong.

IPv4 public luc chuyen la `3.25.155.199`, dang la IP auto-assigned cua EC2.
Neu Stop/Start instance, kiem tra IP moi va cap nhat DNS `bio` tren Cloudflare.

## Dong goi va sao luu

```powershell
& 'C:\Users\Meow\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' deploy/build-release.py 'E:\bio.mieowparadise.io.vn\bio-next-release.tar'
```

Script chi dong goi HTML/CSS/JS/assets hien tai; bo browser profiles, archive,
legacy va cac ban sao cu. File `.sha256` ben canh archive dung de doi chieu
toan bo file sau khi giai nen.

Ban sao cau hinh Nginx truoc khi chuyen va goi release da upload nam tai
`/home/ubuntu/bio-migration-20261028/`. Hosting cu van giu nguyen du lieu.
Chi doi DNS `bio` ve hosting cu khi can quay lui va da kiem tra ban cu.
