const fs = require('fs');
const path = require('path');

const scriptDir = __dirname;
const rootFile = path.join(scriptDir, 'project-root.txt');
const startEcPath = 'C:\\dev\\start-ec.cmd';
const rootTxtPath = 'C:\\dev\\ec-agent\\scripts\\project-root.txt';

fs.mkdirSync('C:\\dev', { recursive: true });
// ASCII only: read path at runtime so cmd.exe does not get encoding issues
const body = [
  '@echo off',
  'chcp 65001 >nul',
  `set /p PROJECT_ROOT=<${rootTxtPath}`,
  'cd /d "%PROJECT_ROOT%"',
  'npm run dev',
  ''
].join('\r\n');
fs.writeFileSync(startEcPath, body, 'utf8');
console.log('Created', startEcPath);
