const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shiiabot')
    .setDescription('shiiabotの機能一覧を表示する'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('🤖 shiiabot')
      .setDescription('遊びたい機能を選んでください！')
      .addFields(
        { name: '🌾 農場ゲーム', value: '種を植えて育てて収穫しよう', inline: true },
        { name: '🎨 AIイラストクイズ', value: 'AIが描いた絵を当てるクイズ', inline: true },
      )
      .setColor(0x57f287);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('menu_farm')
        .setLabel('🌾 農場ゲーム')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('menu_quiz')
        .setLabel('🎨 AIイラストクイズ')
        .setStyle(ButtonStyle.Primary),
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  },
};
