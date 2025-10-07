const qiniu = require('qiniu');
const logger = require('../config/logger');

const ACCESS_KEY = process.env.QINIU_ACCESS_KEY;
const SECRET_KEY = process.env.QINIU_SECRET_KEY;
const BUCKET = process.env.QINIU_BUCKET || 'youxuan-images';
const DOMAIN = process.env.QINIU_DOMAIN || 'https://qiniu.aihubzone.cn';

const mac = new qiniu.auth.digest.Mac(ACCESS_KEY, SECRET_KEY);

const PATH_PREFIX = {
  TEXT: 'opentenbase/text/',
  CT: 'opentenbase/CT/',
  STRUCTURE: 'opentenbase/structure/'
};

function getUploadToken(key, expires = 3600) {
  const options = {
    scope: `${BUCKET}:${key}`,
    expires: expires,
    returnBody: JSON.stringify({
      key: '$(key)',
      hash: '$(etag)',
      fsize: '$(fsize)',
      bucket: '$(bucket)',
      name: '$(x:name)'
    })
  };

  const putPolicy = new qiniu.rs.PutPolicy(options);
  const uploadToken = putPolicy.uploadToken(mac);

  return uploadToken;
}

async function uploadFile(fileBuffer, fileName, type = 'text') {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const prefix = PATH_PREFIX[type.toUpperCase()] || PATH_PREFIX.TEXT;
    const key = `${prefix}${timestamp}_${fileName}`;

    const uploadToken = getUploadToken(key);

    const config = new qiniu.conf.Config();
    config.zone = qiniu.zone.Zone_z0;

    const formUploader = new qiniu.form_up.FormUploader(config);
    const putExtra = new qiniu.form_up.PutExtra();

    formUploader.put(uploadToken, key, fileBuffer, putExtra, (err, respBody, respInfo) => {
      if (err) {
        logger.error('Qiniu upload failed', { error: err.message });
        return reject(err);
      }

      if (respInfo.statusCode === 200) {
        const url = `${DOMAIN}/${key}`;
        logger.info('Qiniu upload success', { key, url });
        resolve({
          url,
          key,
          hash: respBody.hash,
          size: respBody.fsize
        });
      } else {
        logger.error('Qiniu upload failed', { statusCode: respInfo.statusCode, body: respBody });
        reject(new Error(`Upload failed: ${respInfo.statusCode}`));
      }
    });
  });
}

async function deleteFile(key) {
  return new Promise((resolve, reject) => {
    const config = new qiniu.conf.Config();
    const bucketManager = new qiniu.rs.BucketManager(mac, config);

    bucketManager.delete(BUCKET, key, (err, respBody, respInfo) => {
      if (err) {
        logger.error('Qiniu delete failed', { error: err.message, key });
        return reject(err);
      }

      if (respInfo.statusCode === 200) {
        logger.info('Qiniu delete success', { key });
        resolve();
      } else {
        logger.error('Qiniu delete failed', { statusCode: respInfo.statusCode, key });
        reject(new Error(`Delete failed: ${respInfo.statusCode}`));
      }
    });
  });
}

function getKeyFromUrl(url) {
  return url.replace(`${DOMAIN}/`, '');
}

module.exports = {
  uploadFile,
  deleteFile,
  getUploadToken,
  getKeyFromUrl,
  PATH_PREFIX
};
