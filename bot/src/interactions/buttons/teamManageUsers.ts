import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle } from "discord.js";
import { IButtonHandler } from "../../handlers/buttonHandler";

export default {
    customId: 'team_manage_users_',
    async execute(interaction: ButtonInteraction) {
        const category = interaction.customId.split('_')[3]
        const guildId = interaction.customId.split('_')[4]
        const teamCaptainsActionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`team_users_add_${category}_${guildId}`)
                    .setLabel(`Add ${category === 'captains' ? 'Captains' : 'Players'}`)
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`team_users_remove_${category}_${guildId}`)
                    .setLabel(`Remove ${category === 'captains' ? 'Captains' : 'Players'}`)
                    .setStyle(ButtonStyle.Danger)
            )
        await interaction.reply({ content: 'What do you want to do ?', components: [teamCaptainsActionRow], ephemeral: true })
    }
} as IButtonHandler