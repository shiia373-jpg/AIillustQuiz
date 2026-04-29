const { SlashCommandBuilder } = require('discord.js');
const { buildFarmPayload } = require('../game/farmView');
const { setFarmMessage } = require('../game/farmState');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('farm')
    .setDescription('農場を表示してボタンで操作する'),

  async execute(interaction) {
    await interaction.deferReply();
    const payload = await buildFarmPayload(interaction.user.id, interaction.guildId);
    const msg = await interaction.editReply(payload);
    await setFarmMessage(interaction.user.id, msg.id, interaction.channelId);
  },
};
