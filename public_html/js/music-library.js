/* CẤU HÌNH NHẠC — chỉ cần sửa file này khi thêm bài hoặc playlist.
 * 1. Cho MP3 vào assets/music/<folder>/.
 * 2. Thêm đúng tên file vào tracks (có phân biệt chữ hoa/thường trên host).
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
                '01-timem.mp3',
                '02-khongbuong.mp3',
                '03-cohaytubaogio.mp3',
                '04-nhinaibaiduong.mp3',
                '05-gioihancuanoidau.mp3',
                '06-doitranoianh.mp3',
                '07-leluuly.mp3',
                '08-thuongthithoi-chill.mp3',
                '09-doiainaygiu.mp3',
                '10-nguocloiyeu.mp3'
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
