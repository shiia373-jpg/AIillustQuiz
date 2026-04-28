const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { loadFarm } = require('../game/farmState');
const { generateFarmImage } = require('../game/farmCanvas');
const { CROPS } = require('../game/crops');
const { getSlotStatus, formatTime, getTimeToReady } = require('../game/mechanics');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('farm')
    .setDescription('農場の状態を確認する'),

  async execute(interaction) {
    await interaction.deferReply();

    const farm = await loadFarm(interaction.user.id);
    const imageBuffer = generateFarmImage(farm);
    const attachment = new AttachmentBuilder(imageBuffer, { name: 'farm.png' });

    // スロットのテキストサマリーを生成
    const slotLines = farm.slots.map((slot, i) => {
      const status = getSlotStatus(slot);
      if (status === 'empty') return `**#${i + 1}** 空き`;
      const crop = CROPS[slot.crop];
      const icons = { growing: '🌱', optimal: '⭐', ready: '✅', overripe: '⚠️' };
      const icon = icons[status] || '';
      if (status === 'growing') {
        return `**#${i + 1}** ${icon} ${crop.name} — あと ${formatTime(getTimeToReady(slot))}`;
      }
      const labels = { optimal: 'ベストタイミング！', ready: '収穫OK', overripe: '過熟（早く収穫！）' };
      return `**#${i + 1}** ${icon} ${crop.name} — ${labels[status]}`;
    });

    // 持っている種の一覧
    const seedLines = Object.entries(farm.seeds)
      .filter(([, count]) => count > 0)
      .map(([id, count]) => `${CROPS[id]?.emoji ?? id} ${CROPS[id]?.name ?? id} ×${count}`);

    const embed = new EmbedBuilder()
      .setTitle('🌾 あなたの農場')
      .setColor(0x3D7A26)
      .addFields(
        { name: '📋 スロット', value: slotLines.join('\n') || '(なし)', inline: false },
        { name: '🌱 所持している種', value: seedLines.length ? seedLines.join(' ／ ') : 'なし', inline: false },
        { name: '💰 所持コイン', value: `${farm.coins} G`, inline: true },
        { name: '📦 解放スロット', value: `${farm.slots.length} / 9`, inline: true },
      )
      .setImage('attachment://farm.png')
      .setFooter({ text: '/plant で植える・/harvest で収穫・/shop で種購入' });

    await interaction.editReply({ embeds: [embed], files: [attachment] });
  },
};
