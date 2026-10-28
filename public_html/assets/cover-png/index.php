<?php
// Read-only cover catalog. No request parameters, uploads or file writes.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');

$images = [];
$entries = scandir(__DIR__);
if ($entries === false) {
    http_response_code(503);
    echo json_encode(['images' => []]);
    exit;
}

foreach ($entries as $file) {
    if ($file[0] === '.' || !preg_match('/\.(png|jpe?g|webp|gif|avif)$/i', $file)) {
        continue;
    }
    $path = __DIR__ . DIRECTORY_SEPARATOR . $file;
    if (!is_file($path) || is_link($path) || !is_readable($path)) {
        continue;
    }
    $images[] = ['file' => $file, 'version' => (string) filemtime($path)];
}

echo json_encode(['images' => $images], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
