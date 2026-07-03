const fs = require('fs');
const https = require('https');
const path = require('path');

const EPHE_DIR = path.join(__dirname, '../ephe');
const RAW_BASE_URL = 'https://raw.githubusercontent.com/aloistr/swisseph/master/ephe';

// 现代产品最关键的星历文件：主行星、月亮、小行星。
// sepl_18/semo_18 覆盖现代用户常见出生年份和未来运势计算，必须存在。
const REQUIRED_FILES = [
  ['sepl_18.se1', `${RAW_BASE_URL}/sepl_18.se1`, '主行星星历'],
  ['semo_18.se1', `${RAW_BASE_URL}/semo_18.se1`, '月亮星历'],
];

// 可选扩展文件：当前 forecast 不强依赖，但以后做固定星、小行星名称展示时会用到。
const OPTIONAL_FILES = [
  ['seas_18.se1', `${RAW_BASE_URL}/seas_18.se1`, '主要小行星星历'],
  ['sefstars.txt', `${RAW_BASE_URL}/sefstars.txt`, '固定星列表'],
  ['seasnam.txt', `${RAW_BASE_URL}/seasnam.txt`, '小行星名称列表'],
];

function removePartialFile(dest) {
  try {
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
  } catch {
    // 下载失败后的清理不能掩盖原始错误。
  }
}

function hasUsableFile(dest) {
  return fs.existsSync(dest) && fs.statSync(dest).size > 0;
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);

    const request = https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
        const redirectUrl = response.headers.location;
        file.close(() => removePartialFile(dest));
        request.destroy();
        if (!redirectUrl) {
          reject(new Error(`No redirect URL for ${url}`));
          return;
        }
        downloadFile(redirectUrl, dest).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        file.close(() => removePartialFile(dest));
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }

      response.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', (err) => {
        removePartialFile(dest);
        reject(err);
      });
    });

    request.on('error', (err) => {
      file.close(() => removePartialFile(dest));
      reject(err);
    });
  });
}

async function downloadSet(files, required) {
  let successCount = 0;
  const failures = [];

  for (const [filename, url, label] of files) {
    const dest = path.join(EPHE_DIR, filename);

    try {
      if (hasUsableFile(dest)) {
        const stats = fs.statSync(dest);
        console.log(`Skip ${filename} (${label}, ${stats.size} bytes already exists)`);
        successCount += 1;
        continue;
      }

      console.log(`Downloading ${filename} (${label})...`);
      await downloadFile(url, dest);
      const stats = fs.statSync(dest);
      if (stats.size === 0) {
        removePartialFile(dest);
        throw new Error('File is empty');
      }
      console.log(`OK ${filename} (${stats.size} bytes)`);
      successCount += 1;
    } catch (error) {
      console.log(`${required ? 'FAIL' : 'WARN'} ${filename} (${error.message})`);
      failures.push(filename);
    }
  }

  return { successCount, failures };
}

async function main() {
  if (!fs.existsSync(EPHE_DIR)) {
    fs.mkdirSync(EPHE_DIR, { recursive: true });
    console.log(`Created directory: ${EPHE_DIR}`);
  }

  console.log('Downloading required Swiss Ephemeris files...\n');
  const required = await downloadSet(REQUIRED_FILES, true);

  console.log('\nDownloading optional Swiss Ephemeris files...\n');
  const optional = await downloadSet(OPTIONAL_FILES, false);

  console.log('\nDownload complete!');
  console.log(`Required success: ${required.successCount}/${REQUIRED_FILES.length}`);
  console.log(`Optional success: ${optional.successCount}/${OPTIONAL_FILES.length}`);

  if (required.failures.length > 0) {
    console.error(`Required files failed: ${required.failures.join(', ')}`);
    console.error('Manual source: https://github.com/aloistr/swisseph/tree/master/ephe');
    process.exitCode = 1;
  }

  if (optional.failures.length > 0) {
    console.warn(`Optional files failed: ${optional.failures.join(', ')}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
