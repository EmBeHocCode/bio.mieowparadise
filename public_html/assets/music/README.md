# Thêm bài và playlist

File cấu hình: `../../js/music-library.js`.

## Cấu trúc

```text
assets/music/
  Drill-music/  → bài 01–07
  Chill-music/  → 10 bài đơn
  Remix-music/  → đang trống
```

## Thêm bài

Cho file nhạc vào đúng thư mục rồi thêm tên file vào `tracks` của playlist
trong `music-library.js`. Giữ đúng chữ hoa/thường và phần mở rộng. Không cần
đánh lại số tên bài cũ. Tên file có dấu hoặc khoảng trắng vẫn được mã hóa URL.

Tên hiển thị có dấu được khai báo riêng, không cần đổi tên MP3 hoặc LRC:

```js
{ file: '01-timem.mp3', title: 'Tìm em' }
```

Sửa `title` để đổi tên trên player và danh sách bài; giữ `file` khớp tên MP3.
Kiểu cũ `'ten-bai.mp3'` vẫn dùng được, player sẽ tự tạo tên từ tên file.

## Thêm lời bài hát LRC

Đặt file `.lrc` UTF-8 cùng thư mục, cùng tên với file MP3, phân biệt chữ hoa/thường:

```text
assets/music/Chill-music/02-khongbuong.mp3
assets/music/Chill-music/02-khongbuong.lrc
```

Không cần thêm đường dẫn lời vào cấu hình. Player tự tìm file LRC khi mở form
hoặc đổi bài; không có file thì báo chưa có lời, nhạc vẫn phát bình thường.
Đã bỏ nhận dạng AI; không gọi dịch vụ hay dùng lời AI cũ.

Định dạng hỗ trợ: `[mm:ss]`, `[mm:ss.xx]`, `[mm:ss.xxx]`, nhiều timestamp
cho cùng một câu và metadata. Enhanced LRC đọc nội dung theo dòng, không tô từng từ.
`[offset:+500]` cho lời xuất hiện sớm hơn 0,5 giây; `-500` muộn hơn 0,5 giây.

Mỗi câu giữ tới timestamp tiếp theo. Để kết thúc câu trước đoạn nhạc dạo,
thêm một dòng timestamp trống, ví dụ `[01:20.00]`. Nên có dòng trống khi hết lời.
LRC phải khớp đúng bản MP3 (intro, remix, tốc độ); player không tự sửa timing sai.

Sau khi upload LRC mới, đóng/mở player nếu bài trước đó chưa có lời.
Khi sửa LRC đã tải, reload trang để nạp bản mới.
Nút **Tải lại** chỉ xuất hiện khi tải file gặp lỗi mạng/máy chủ;
trường hợp chưa có file không hiển thị nút này vì không thể tự tạo lời.

### Xuất MP3 thành text có thời gian ở local

Tool: `deploy/export-music-lyrics.py`. Chạy thủ công một lần trên máy local;
không cần dịch vụ nhận dạng trên web/VPS. Dùng whisper.cpp + model đa ngôn ngữ
và FFmpeg đặt bên ngoài `public_html`. File nhạc gốc giữ nguyên.

Kết quả: LRC bên cạnh MP3; TXT có `[phút:giây --> phút:giây]`, SRT và JSON
trong thư mục output ngoài web root. Lời này là bản nhận dạng tự động, có thể sai
hoặc thiếu đoạn khi nhạc lấn giọng. Sửa chữ trực tiếp trong LRC (UTF-8), giữ
timestamp và thứ tự các câu theo đúng bản MP3 đang dùng.

```powershell
python deploy/export-music-lyrics.py --cli PATH_TO_WHISPER_CLI --model PATH_TO_MODEL --ffmpeg PATH_TO_FFMPEG --dll-dir PATH_TO_CUBLAS --output E:/bio.mieowparadise.io.vn/lyrics-exports
```

Mặc định bỏ qua LRC đã có. Dùng `--folder Chill-music --track 02-khongbuong.mp3`
để chọn một bài; thêm `--overwrite` chỉ khi muốn tạo lại file lời hiện có.
`--temperature-fallback` thử lại đoạn khó, sẽ chạy lâu hơn. Công cụ dừng nếu
không dùng được GPU; chỉ thêm `--allow-cpu` khi chủ động muốn chạy CPU.

## Tạo playlist mới

Tạo thư mục mới rồi thêm một mục cấu hình:

```js
{
    id: 'acoustic',              // ID riêng, không đổi sau khi sử dụng
    name: 'Acoustic-music',      // Tên hiện trên giao diện
    folder: 'Acoustic-music',    // Thư mục bên trong assets/music/
    tracks: ['ten-bai.mp3']
}
```

## Tự phát

Mỗi lần reload, shuffle luôn bật và bài đầu được chọn ngẫu nhiên. Mặc định
chọn ngẫu nhiên một playlist có bài; playlist trống không được chọn tự động.
Trong player, mục “Tự phát khi mở web” lưu playlist mong muốn riêng cho trình
duyệt đó. Thay đổi mục này chỉ áp dụng cho lần mở web sau.

Đổi `startupPlaylist: 'random'` thành `'chill'` (hoặc ID khác) để thay mặc định
cho khách chưa lưu lựa chọn. Next, Previous, shuffle, repeat và kết thúc bài
chỉ hoạt động bên trong playlist đang phát. Chọn playlist khác bằng tay mới
chuyển playlist. Chọn playlist trống sẽ dừng phát và hiện thông báo chưa có bài.

Ảnh bìa vẫn lấy từ `../cover-png/`; không đặt ảnh vào thư mục playlist.
Khi upload, giữ đúng toàn bộ cấu trúc thư mục và upload file cấu hình mới.
