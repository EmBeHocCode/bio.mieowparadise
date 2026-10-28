# Lưu trữ: dịch vụ nhận dạng AI đã ngừng sử dụng

Player hiện chỉ đọc file LRC. Dịch vụ `meow-bio-lyrics` đã dừng và disable;
API cũ trả 410. Không cài hay khởi động lại dịch vụ này khi deploy.
Hướng dẫn hiện tại ở `assets/music/README.md`. Mã và cache cũ giữ lại để
tham khảo; các phần dưới ghi lại kiến trúc cũ, không phải hướng dẫn vận hành hiện tại.

## Kiến trúc trước đây

Player nhận dạng lời trực tiếp từ MP3 trên VPS bằng Faster Whisper, không cần
thêm `.lrc`. Khi mở player, bài đang chọn được xếp hàng xử lý một lần; các lần
sau đọc JSON đã lưu. Giao diện theo `audio.currentTime`, hỗ trợ tua và đổi tốc độ.
Đóng player dừng việc tải trạng thái; tác vụ VPS đã nhận vẫn hoàn thành và lưu kết quả.

## Thêm bài

1. Đưa MP3 vào `assets/music/<playlist>/` và khai báo trong `js/music-library.js`.
2. Mở player, chọn bài. Lần đầu có thể cần vài phút, tùy độ dài và tải VPS.
3. Lời hiện dần khi xử lý, sau đó được lưu dùng chung cho mọi người xem.

Đây là nhận dạng giọng hát, có thể sai từ hoặc timestamp, nhất là rap, remix,
nhạc nhiều bè và đoạn instrumental. Không bảo đảm giống lời chính thức.

## Cài đặt đang chạy trên VPS

| Thành phần | Đường dẫn |
| --- | --- |
| Mã dịch vụ và virtualenv | `/opt/meow-bio-lyrics/` |
| Cấu hình | `/etc/meow-bio-lyrics.json` |
| Lời đã lưu | `/var/lib/meow-bio-lyrics/` |
| Model | `/var/cache/meow-bio-lyrics/` |
| Systemd | `/etc/systemd/system/meow-bio-lyrics.service` |

```sh
sudo systemctl status meow-bio-lyrics --no-pager
sudo journalctl -u meow-bio-lyrics -n 30 --no-pager
sudoedit /etc/meow-bio-lyrics.json
sudo systemctl restart meow-bio-lyrics
```

Cấu hình mẫu nằm trong `config.json`, unit trong `deploy/meow-bio-lyrics.service`.
Một worker CPU int8, giới hạn CPU 60%, RAM tối đa 1700 MB, tự nhả model sau
120 giây rảnh. Model được tải lần đầu; âm thanh được xử lý tại VPS.
`languages_by_folder` ép ngôn ngữ nếu biết trước (`vi` cho Chill-music);
playlist không khai báo dùng tự nhận diện ngôn ngữ.

Giữ các phiên bản trong `requirements.txt`, đặc biệt `av==16.0.1`:
PyAV 19 không tương thích với Faster Whisper 1.2.1 ở tham số giải mã.

## API và cache

```text
GET /api/lyrics?track=Chill-music%2F02-khongbuong.mp3
```

API chỉ nghe tại `127.0.0.1:3014`, được Nginx proxy theo
`deploy/bio-content.conf`. Chỉ nhận MP3 trong đúng thư mục nhạc, giới hạn
200 MB / một giờ, tối đa 32 tác vụ chờ và không xử lý trùng cùng bài.

Cache tự đổi khi thay file MP3 (kích thước/mtime), model, ngôn ngữ hoặc revision
pipeline. Lỗi nhận dạng lưu một giờ trước khi thử lại. Khi cần sửa lời thủ công,
đợi tác vụ hoàn thành rồi dùng `sudoedit /var/lib/meow-bio-lyrics/<id>.json`;
giữ `status: ready` và danh sách `lines` có `start`, `end` (giây), `text`.

## Kiểm tra và triển khai

```sh
python -m unittest discover -s server/lyrics
node --check js/music-lyrics.js
```

`deploy/build-release.py` chỉ đóng gói frontend/assets. Dịch vụ Python,
virtualenv, cấu hình và model cài riêng bên ngoài web root. Khi đổi frontend,
tăng `?v=` của JS/CSS trong HTML. Server preview tĩnh Python không có API này
và không hỗ trợ Range để tua MP3; kiểm tra tích hợp trên Nginx.
