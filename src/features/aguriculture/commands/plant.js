const { SlashCommandBuilder } = require('discord.js');
const { loadFarm, saveFarm } = require('../game/farmState');
const { CROPS } = require('../game/crops');
const { getSlotStatus } = require('../game/mechanics');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('plant')
    .setDescription('作物を植える')
    .addStringOption(opt =>
      opt.setName('crop')
        .setDescription('植える作物')
        .setRequired(true)
        .addChoices(
          ...Object.values(CROPS).map(c => ({ name: `${c.emoji} ${c.name}`, value: c.id }))
        )
    )
    .addIntegerOption(opt =>
      opt.setName('slot')
        .setDescription('植えるスロット番号 (1〜9)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(9)
    ),

  async execute(interaction) {
    const cropId = interaction.options.getString('crop');
    const slotNum = interaction.options.getInteger('slot');
    const slotIndex = slotNum - 1;

    const farm = await loadFarm(interaction.user.id);
    const crop = CROPS[cropId];

    // スロット解放チェック
    if (slotIndex >= farm.slots.length) {
      return interaction.reply({
        content: `❌ スロット #${slotNum} はまだ解放されていません。\`/shop\` でスロットを解放できます。`,
        ephemeral: true,
      });
    }

    // スロット空きチェック
    const slot = farm.slots[slotIndex];
    if (getSlotStatus(slot) !== 'empty') {
      return interaction.reply({
        content: `❌ スロット #${slotNum} にはすでに作物があります。先に \`/harvest\` で収穫してください。`,
        ephemeral: true,
      });
    }

    // 種の所持チェック
    const owned = farm.seeds[cropId] ?? 0;
    if (owned <= 0) {
      return interaction.reply({
        content: `❌ ${crop.emoji} **${crop.name}**の種を持っていません。\`/shop\` で購入できます。`,
        ephemeral: true,
      });
    }

    // 植える
    farm.slots[slotIndex] = { crop: cropId, planted_at: Date.now() };
    farm.seeds[cropId] = owned - 1;
    await saveFarm(interaction.user.id, farm);

    const { formatTime } = require('../game/mechanics');
    await interaction.reply({
      content: [
        `✅ スロット **#${slotNum}** に ${crop.emoji} **${crop.name}** を植えました！`,
        `⏱ 収穫まで: **${formatTime(crop.growTime)}**`,
        `⭐ ベストタイミング: 収穫可能後 **${formatTime(crop.optimalWindow / 2)}** 以内に収穫で S 品質！`,
      ].join('\n'),
      ephemeral: false,
    });
  },
};
