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

const child = spawn(cmd, args, {
    cwd: ttsDir,
    stdio: 'inherit',
    shell: true,
});

child.on('exit', (code) => {
    process.exit(code ?? 0);
});
