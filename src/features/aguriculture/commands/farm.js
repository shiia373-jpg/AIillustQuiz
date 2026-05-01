const { SlashCommandBuilder } = require('discord.js');
const { buildFarmPayload } = require('../game/farmView');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('farm')
    .setDescription('農場を表示してボタンで操作する'),

  async execute(interaction) {
    const payload = await buildFarmPayload(interaction.user.id);
    await interaction.reply({ ...payload, flags: 64 });
  },
};
