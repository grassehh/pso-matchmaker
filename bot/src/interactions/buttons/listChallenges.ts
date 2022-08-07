import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, Guild } from "discord.js";
import { MIN_LINEUP_SIZE_FOR_RANKED } from "../../constants";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { teamService } from "../../services/teamService";
import { getOfficialDiscordIdByRegion } from "../../utils";

export default {
    customId: 'listChallenges',
    async execute(interaction: ButtonInteraction) {
        const lineup = await teamService.retrieveLineup(interaction.channelId)
        if (lineup === null) {
            await interaction.reply(interactionUtils.createReplyLineupNotSetup())
            return
        }

        const searchModeEmbed = new EmbedBuilder()
            .setTitle('Select a game mode')

        const isAllowedToPlayRanked = lineup.isAllowedToPlayRanked()
        if (!isAllowedToPlayRanked) {
            const officialGuild = await interaction.client.guilds.fetch(getOfficialDiscordIdByRegion(lineup.team.region)) as Guild
            searchModeEmbed.setDescription(`
            **In order to play ranked mode:**
             1. Create a lineup with a **${MIN_LINEUP_SIZE_FOR_RANKED}v${MIN_LINEUP_SIZE_FOR_RANKED}** format or more
             2. Manage your team using **/team_manage** command
             3. Contact the admins of the official **${officialGuild.name}** discord by providing your team id: **${lineup.team.guildId}**
             4. Do not have any **merc** players signed
             5. All players in the lineup must have been declared in the **/team_manage** command
            `)
        }

        const searchActionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('challenges_ranked')
                    .setLabel('Ranked')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(!isAllowedToPlayRanked),
                new ButtonBuilder()
                    .setCustomId('challenges_casual')
                    .setLabel('Casual')
                    .setStyle(ButtonStyle.Secondary)
            )
        await interaction.reply({ embeds: [searchModeEmbed], components: [searchActionRow], ephemeral: true })
    }
} as IButtonHandler