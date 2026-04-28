const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { loadFarm, saveFarm } = require('../game/farmState');
const { CROPS } = require('../game/crops');
const { getSlotStatus, calcHarvest } = require('../game/mechanics');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('harvest')
    .setDescription('収穫できる作物をすべて収穫する')
    .addIntegerOption(opt =>
      opt.setName('slot')
        .setDescription('特定のスロットだけ収穫 (省略するとすべて収穫)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(9)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const farm = await loadFarm(interaction.user.id);
    const targetSlot = interaction.options.getInteger('slot');

    const results = [];
    let totalCoins = 0;

    const indices = targetSlot != null
      ? [targetSlot - 1]
      : farm.slots.map((_, i) => i);

    for (const i of indices) {
      const slot = farm.slots[i];
      if (!slot) continue;
      const status = getSlotStatus(slot);
      if (status === 'empty' || status === 'growing') continue;

      const result = calcHarvest(slot, true);
      if (!result) continue;

      const crop = CROPS[slot.crop];
      totalCoins += result.coins;
      results.push({ slotNum: i + 1, crop, result });

      // スロットをリセット
      farm.slots[i] = { crop: null, planted_at: null };
    }

    if (results.length === 0) {
      return interaction.editReply({
        content: '⚠️ 収穫できる作物がありません。成長中のものは `/farm` で確認できます。',
      });
    }

    // コイン加算
    farm.coins += totalCoins;
    farm.totalHarvests += results.length;
    farm.totalCoinsEarned += totalCoins;
    await saveFarm(interaction.user.id, farm);

    // 収穫サマリーの Embed
    const lines = results.map(({ slotNum, crop, result }) => {
      const bonusText = result.bonuses.length ? `\n  ${result.bonuses.join(' / ')}` : '';
      return `#${slotNum} ${crop.emoji} **${crop.name}** — ${result.quality.emoji} 品質 **${result.quality.label}** → **${result.coins} G**${bonusText}`;
    });

    const embed = new EmbedBuilder()
      .setTitle('🧺 収穫完了！')
      .setColor(0xFFD700)
      .setDescription(lines.join('\n'))
      .addFields(
        { name: '💰 今回の収益', value: `**${totalCoins} G**`, inline: true },
        { name: '💳 所持コイン', value: `${farm.coins} G`, inline: true },
      )
      .setFooter({ text: '次も良いタイミングで収穫して S 品質を狙おう！' });

    await interaction.editReply({ embeds: [embed] });
  },
};
