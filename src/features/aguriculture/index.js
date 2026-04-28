const fs = require('fs');
const path = require('path');
const { handleShopButton } = require('./commands/shop');

// commands/ 内のファイルをすべて自動ロード
const commands = [];
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const mod = require(path.join(commandsPath, file));
  if (mod.data && mod.execute) commands.push(mod);
}

// ショップの Button interaction を処理
async function handleButton(interaction) {
  const { customId } = interaction;
  if (customId.startsWith('farm_')) {
    await handleShopButton(interaction);
  }
}

module.exports = { commands, handleButton };
