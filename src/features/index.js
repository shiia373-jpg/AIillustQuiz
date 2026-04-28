const fs = require('fs');
const path = require('path');

const commands = [];
const buttonHandlers = [];
const modalHandlers = [];

// features/ 内の各ディレクトリを自動ロード
for (const entry of fs.readdirSync(__dirname)) {
  const full = path.join(__dirname, entry);
  if (!fs.statSync(full).isDirectory()) continue;
  const indexFile = path.join(full, 'index.js');
  if (!fs.existsSync(indexFile)) continue;

  const mod = require(indexFile);
  for (const cmd of mod.commands ?? []) commands.push(cmd);
  if (mod.handleButton) buttonHandlers.push(mod.handleButton);
  if (mod.handleModal)  modalHandlers.push(mod.handleModal);
}

async function handleButton(interaction) {
  for (const handler of buttonHandlers) await handler(interaction);
}

async function handleModal(interaction) {
  for (const handler of modalHandlers) await handler(interaction);
}

module.exports = { commands, handleButton, handleModal };
