require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const srcPath = __dirname;

// 各モジュールの index.js が export する commands 配列を使う
const botDirs = fs.readdirSync(srcPath).filter(entry => {
  const full = path.join(srcPath, entry);
  return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, 'index.js'));
});

for (const dir of botDirs) {
  const mod = require(path.join(srcPath, dir));
  for (const command of mod.commands ?? []) {
    if (command.data) commands.push(command.data.toJSON());
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`🔄 ${commands.length} 件のコマンドを登録中...`);
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log('✅ グローバルコマンドの登録が完了しました！');
    console.log('⚠️ 反映まで最大1時間かかる場合があります。');
  } catch (err) {
    console.error('❌ コマンド登録エラー:', err);
  }
})();
