const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = 8080;

// 创建 WebSocket 服务器
const wss = new WebSocket.Server({ port: PORT }, () => {
    console.log(`WebSocket 服务器已启动，监听端口：${PORT}`);
});

wss.on('connection', ws => {
    console.log('客户端已连接');

    // 创建一个唯一的文件名
    const fileName = `audio_${Date.now()}.wav`;
    const filePath = path.join(__dirname, 'audio', fileName);

    // 确保音频目录存在
    if (!fs.existsSync(path.join(__dirname, 'audio'))) {
        fs.mkdirSync(path.join(__dirname, 'audio'));
    }

    const fileStream = fs.createWriteStream(filePath);

    let audioData = Buffer.alloc(0); // 用于缓存音频数据

    // 写入WAV文件头信息
    const writeWAVHeader = (fileStream, bufferLength) => {
        const header = Buffer.alloc(44);

        // RIFF Chunk
        header.write('RIFF', 0);
        header.writeUInt32LE(36 + bufferLength, 4);  // ChunkSize (文件总大小 - 8)
        header.write('WAVE', 8);

        // fmt subchunk
        header.write('fmt ', 12);
        header.writeUInt32LE(16, 16); // Subchunk1Size (PCM格式，16字节)
        header.writeUInt16LE(1, 20);  // 音频格式 (1 = PCM)
        header.writeUInt16LE(1, 22);  // 声道数 (1 = 单声道)
        header.writeUInt32LE(44100, 24); // 采样率 (44.1kHz)
        header.writeUInt32LE(44100 * 2, 28); // ByteRate (采样率 * 声道数 * 每个样本的字节数)
        header.writeUInt16LE(2, 32);  // BlockAlign (声道数 * 每个样本的字节数)
        header.writeUInt16LE(16, 34); // 每个样本的位数

        // data subchunk
        header.write('data', 36);
        header.writeUInt32LE(bufferLength, 40);  // Subchunk2Size (数据大小)

        fileStream.write(header);
    };

    ws.on('message', message => {
        // 将数据追加到缓存中
        audioData = Buffer.concat([audioData, message]);
    });

    ws.on('close', () => {
        const bufferLength = audioData.length;

        // 在关闭连接时，写入WAV文件头
        writeWAVHeader(fileStream, bufferLength);

        // 写入音频数据
        fileStream.write(audioData);
        fileStream.end(); // 结束写入文件

        console.log(`客户端已断开，音频保存为：${fileName}`);
    });

    ws.on('error', error => {
        console.error('WebSocket 错误:', error);
    });

    // 可选：在 10 秒后发送已缓存的音频数据回客户端
    setTimeout(() => {
        if (audioData.length > 0) {
            ws.send(audioData); // 发送音频数据到前端
            console.log('音频数据已发送到前端');
        }
    }, 10000); // 10 秒后触发
});
