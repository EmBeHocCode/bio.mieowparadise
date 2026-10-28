/* CẤU HÌNH NHẠC — chỉ cần sửa file này khi thêm bài hoặc playlist.
 * 1. Cho MP3 vào assets/music/<folder>/.
 * 2. Thêm { file: 'ten-file.mp3', title: 'Tên bài có dấu' } vào tracks.
 *    Có thể chỉ ghi chuỗi tên file như playlist Drill; tên file phân biệt hoa/thường.
 * 3. Playlist mới: sao chép một mục bên dưới, đặt id riêng và tên folder.
 * Không cần sửa bộ điều khiển phát nhạc trong script.js.
 */
window.MEOW_MUSIC_LIBRARY = {
    // 'random': chọn một playlist CÓ BÀI mỗi lần mở web.
    // Hoặc dùng id như 'chill'. Lựa chọn lưu trên trình duyệt được ưu tiên.
    startupPlaylist: 'random',
    playlists: [
        {
            id: 'drill',
            name: 'Drill-music',
            folder: 'Drill-music',
            tracks: [
                '01-drill-playlist.mp3',
                '02-drill-playlist.mp3',
                '03-drill-playlist.mp3',
                '04-drill-playlist.mp3',
                '05-drill-playlist.mp3',
                '06-drill-playlist.mp3',
                '07-drill-playlist.mp3'
            ]
        },
        {
            id: 'chill',
            name: 'Chill-music',
            folder: 'Chill-music',
            tracks: [
                { file: '01-timem.mp3', title: 'Tìm em' },
                { file: '02-khongbuong.mp3', title: 'Không Buông' },
                { file: '03-cohaytubaogio.mp3', title: 'Có hay từ bao giờ 2' },
                { file: '04-nhinaibaiduong.mp3', title: 'Nhìn ai bái đường' },
                { file: '05-gioihancuanoidau.mp3', title: 'Giới hạn của nỗi đau-AI' },
                { file: '06-doitranoianh.mp3', title: 'Dối trá nơi anh' },
                { file: '07-leluuly.mp3', title: 'Lệ Lưu Ly' },
                { file: '08-thuongthithoi-chill.mp3', title: 'Thương Thì Thôi' },
                { file: '09-doiainaygiu.mp3', title: 'Đời này ai nấy giữ' },
                { file: '10-nguocloiyeu.mp3', title: 'Ngược lối yêu' }
            ]
        },
        {
            id: 'remix',
            name: 'Remix-music',
            folder: 'Remix-music',
            tracks: [
                // 'ten-bai-remix.mp3'
            ]
        }
    ]
};
