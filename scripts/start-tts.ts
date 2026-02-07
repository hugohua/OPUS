import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, '..');
const ttsDir = path.join(rootDir, 'python_tts_service');

// 加载 .env 环境变量
dotenv.config({ path: path.join(rootDir, '.env') });

const isWindows = process.platform === 'win32';

let cmd: string;
let args: string[];

if (isWindows) {
    cmd = 'powershell';
    args = ['-ExecutionPolicy', 'Bypass', '-File', 'start.ps1'];
} else {
    cmd = './start.sh';
    args = [];
}

console.log(`Starting TTS service in ${ttsDir} on ${process.platform}...`);

// 计算 CACHE_DIR 绝对路径，确保 Python 无论从哪里启动都写入正确位置
const cacheDir = path.join(rootDir, 'public', 'audio');

const child = spawn(cmd, args, {
    cwd: ttsDir,
    stdio: 'inherit',
    shell: true,
    env: {
        ...process.env,
        CACHE_DIR: cacheDir,  // 覆盖/注入 CACHE_DIR
    },
});

child.on('exit', (code) => {
    process.exit(code ?? 0);
});
