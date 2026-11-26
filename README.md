# Meow Bio

## GitHub Pages Preview

- Preview branch: `codex/github-pages-preview`; AWS and custom-domain DNS stay unchanged.
- Run `node --test public_html/tests/pages-build.test.mjs public_html/tests/music-covers.test.mjs` and `node public_html/tests/music-lrc.test.cjs`.
- Run `node public_html/deploy/build-pages.mjs` to create `_site/` (the output must not already exist).
- The build generates `assets/cover-png/catalog.json`; PHP, archives and deployment tools are not published.
- New covers and MP3/LRC files are included on the next build. Enable Pages with GitHub Actions before deployment.
- Optional browser QA (requires Playwright and Edge): `node public_html/tests/pages-browser-smoke.cjs [preview-url]`.

Website cá nhân của **Meow Bebyboi — Nguyễn Lâm Hùng**.

- Website đang chạy: https://bio.mieowparadise.io.vn/
- Nhánh source hiện tại: **main**.
- Mã nguồn website nằm trong [`public_html/`](public_html/), gồm HTML, CSS, JavaScript, ảnh, video intro, nhạc MP3 và lời LRC.
- Hướng dẫn deploy và chỉnh nhạc: [`public_html/deploy/README.md`](public_html/deploy/README.md).
- Danh sách SHA-256 của 106 file trong gói web ngày 26/11/2026: [`public_html/deploy/release-manifest.sha256`](public_html/deploy/release-manifest.sha256).

## Cập nhật ngày 26/11/2026

Thẻ dự án SnapTrans đã được thay bằng Meow Tu Tiên với link chơi game và repo riêng tư. Security Lab đã được gỡ khỏi trang và menu; sáu section được đánh số từ 01 đến 06.

Ảnh đại diện và các LRC chỉnh trực tiếp trên VPS đã được đưa về source. Khi deploy tiếp, đối chiếu các file đã chỉnh trên server trước khi ghi đè. Công cụ đóng gói chỉ đưa các file phục vụ web vào bản phát hành; browser profile, cache, bản sao cũ và công cụ phát triển được giữ ngoài gói deploy.
