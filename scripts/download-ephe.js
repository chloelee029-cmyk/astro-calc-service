const fs = require('fs');
const https = require('https');
const path = require('path');

const EPHE_DIR = path.join(__dirname, '../ephe');

const FILES_TO_DOWNLOAD = [
  // 行星基本数据 (1800-2399)
  'https://github.com/drvinaayaksingh/swisseph/raw/master/ephe/sepl_18.se1',
  'https://github.com/drvinaayaksingh/swisseph/raw/master/ephe/semo_18.se1',
  
  // 行星扩展数据 (1200-1799)
  'https://github.com/drvinaayaksingh/swisseph/raw/master/ephe/sepl_12.se1',
  'https://github.com/drvinaayaksingh/swisseph/raw/master/ephe/semo_12.se1',
  
  // 行星扩展数据 (1-599)
  'https://github.com/drvinaayaksingh/swisseph/raw/master/ephe/sepl_00.se1',
  'https://github.com/drvinaayaksingh/swisseph/raw/master/ephe/semo_00.se1',
  
  // 行星扩展数据 (600-1199)
  'https://github.com/drvinaayaksingh/swisseph/raw/master/ephe/sepl_06.se1',
  'https://github.com/drvinaayaksingh/swisseph/raw/master/ephe/semo_06.se1',
  
  // 行星扩展数据 (2400-2999)
  'https://github.com/drvinaayaksingh/swisseph/raw/master/ephe/sepl_24.se1',
  'https://github.com/drvinaayaksingh/swisseph/raw/master/ephe/semo_24.se1',
  
  // 小行星数据
  'https://github.com/drvinaayaksingh/swisseph/raw/master/ephe/seas_18.se1',
  
  // 恒星数据
  'https://github.com/drvinaayaksingh/swisseph/raw/master/ephe/sefix_18.se1',
  
  // 交点数据
  'https://github.com/drvinaayaksingh/swisseph/raw/master/ephe/seasc_18.se1',
  
  // 月球交点数据
  'https://github.com/drvinaayaksingh/swisseph/raw/master/ephe/senode.se1',
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    
    const request = https.get(url, (response) => {
      // 处理重定向
      if (response.statusCode === 302 || response.statusCode === 301) {
        const redirectUrl = response.headers.location;
        if (!redirectUrl) {
          reject(new Error(`No redirect URL for ${url}`));
          return;
        }
        request.destroy();
        downloadFile(redirectUrl, dest).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close(resolve);
      });
      
      file.on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function main() {
  if (!fs.existsSync(EPHE_DIR)) {
    fs.mkdirSync(EPHE_DIR, { recursive: true });
    console.log(`Created directory: ${EPHE_DIR}`);
  }
  
  console.log('Starting download of Swiss Ephemeris data files...\n');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const url of FILES_TO_DOWNLOAD) {
    const filename = url.split('/').pop();
    const dest = path.join(EPHE_DIR, filename);
    
    try {
      // 强制重新下载，不跳过已存在的文件
      console.log(`Downloading ${filename}...`);
      await downloadFile(url, dest);
      
      // 验证文件大小
      const stats = fs.statSync(dest);
      if (stats.size === 0) {
        throw new Error('File is empty');
      }
      
      console.log(`✓ ${filename} (downloaded successfully, ${stats.size} bytes)`);
      successCount++;
    } catch (err) {
      console.log(`✗ ${filename} (failed: ${err.message})`);
      failCount++;
    }
  }
  
  console.log(`\nDownload complete!`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  
  if (failCount > 0) {
    console.log('\nSome files failed to download. You can manually download them from:');
    console.log('https://www.astro.com/ftp/swisseph/ephe/');
  }
}

main().catch(console.error);
