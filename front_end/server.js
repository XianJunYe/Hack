// server.js

const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { Writable } = require('stream');
const { spawn } = require('child_process');

const PORT = 8080;

// 创建 WebSocket 服务器
const wss = new WebSocket.Server({ port: PORT }, () => {
    console.log(`WebSocket 服务器已启动，监听端口：${PORT}`);
});

wss.on('connection', ws => {
    console.log('客户端已连接');

    // 创建一个唯一的文件名
    const fileName = `audio_${Date.now()}.webm`;
    const filePath = path.join(__dirname, 'audio', fileName);

    // 确保音频目录存在
    if (!fs.existsSync(path.join(__dirname, 'audio'))) {
        fs.mkdirSync(path.join(__dirname, 'audio'));
    }

    const fileStream = fs.createWriteStream(filePath);

    ws.on('message', message => {
        fileStream.write(message);
    });

    ws.on('close', () => {
        fileStream.end();
        console.log(`客户端已断开，音频保存为：${fileName}`);

        // 可选：将 webm 格式转换为 mp3
        convertWebMToMP3(filePath);
    });

    ws.on('error', error => {
        console.error('WebSocket 错误:', error);
    });
});

// 将 WebM 转换为 MP3
function convertWebMToMP3(inputPath) {
    const outputPath = inputPath.replace('.webm', '.mp3');
    const ffmpeg = spawn('ffmpeg', [
        '-y', // 覆盖输出文件
        '-i', inputPath,
        '-vn', // 无视频
        '-ab', '128k', // 音频比特率
        '-ar', '44100', // 音频采样率
        '-f', 'mp3',
        outputPath
    ]);

    ffmpeg.stderr.on('data', data => {
        console.error(`ffmpeg 错误：${data}`);
    });

    ffmpeg.on('close', code => {
        if (code === 0) {
            console.log(`转换成功：${outputPath}`);
            // 可选：删除原始的 webm 文件
            fs.unlinkSync(inputPath);
        } else {
            console.error(`ffmpeg 进程退出，退出码：${code}`);
        }
    });
}
