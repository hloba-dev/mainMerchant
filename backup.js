import 'dotenv/config';
import cron from 'node-cron';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

function backupMongoDB() {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `backup_mongo_${timestamp}.gz`;
    const command = `mongodump --uri="${process.env.MONGO_URI}" --archive="${backupFile}" --gzip`;
    exec(command, (error) => {
      if (error) return reject(error);
      console.log(`[OK] Бэкап БД создан: ${backupFile}`);
      resolve(backupFile);
    });
  });
}

function backupProject() {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join('/tmp', `backup_project_${timestamp}.tar.gz`);
    const projectPath = process.cwd();
    const command = [
      `tar -czf "${backupFile}"`,
      '--exclude="node_modules"',
      '--exclude=".git"',
      '--exclude="*.log"',
      `-C "${projectPath}" .`,
    ].join(' ');
    exec(command, (error) => {
      if (error) return reject(error);
      console.log(`[OK] Архив проекта создан: ${backupFile}`);
      resolve(backupFile);
    });
  });
}

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function uploadToS3(localFilePath) {
  const fileStream = fs.createReadStream(localFilePath);
  const Key = path.basename(localFilePath);
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key,
    Body: fileStream,
    ContentType: 'application/gzip',
  });
  return s3.send(command);
}

async function runBackup() {
  console.log('=== Запуск бэкапа БД и проекта ===', new Date().toString());
  try {
    const mongoDump = await backupMongoDB();
    const projectDump = await backupProject();
    const resMongo = await uploadToS3(mongoDump);
    console.log(`[OK] ${mongoDump} загружен в S3 (ETag ${resMongo.ETag})`);
    const resProject = await uploadToS3(projectDump);
    console.log(`[OK] ${projectDump} загружен в S3 (ETag ${resProject.ETag})`);
    [mongoDump, projectDump].forEach((file) => {
      fs.unlinkSync(file);
      console.log(`[OK] Локальный файл ${file} удалён`);
    });
  } catch (err) {
    console.error('[ERR] Ошибка во время бэкапа:', err);
  }
}

cron.schedule('0 3 * * *', runBackup);

(async () => {
  console.log('Скрипт backup.js запущен. Бэкап выполняется немедленно, затем ежедневно в 03:00.');
  await runBackup();
})();
