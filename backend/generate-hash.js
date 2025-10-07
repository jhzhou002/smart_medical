const bcrypt = require('bcrypt');

async function generateHash() {
  const password = '123456';
  const hash = await bcrypt.hash(password, 10);
  console.log('\n密码: 123456');
  console.log('哈希值:', hash);
  console.log('\nSQL 更新语句:');
  console.log(`UPDATE users SET password_hash = '${hash}' WHERE username IN ('admin', 'doctor_im', 'doctor_rad', 'doctor_lab', 'doctor_card');`);
}

generateHash();
