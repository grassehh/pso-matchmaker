import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, Guild } from "discord.js";
import { MAX_TEAM_CAPTAINS, MAX_TEAM_PLAYERS, MIN_LINEUP_SIZE_FOR_RANKED } from "../../constants";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { teamService } from "../../services/teamService";
import { getOfficialDiscordIdByRegion } from "../../utils";

export default {
    customId: 'startSearch',
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
             2. Manage your team using **/team_manage** command and add maximum **${MAX_TEAM_CAPTAINS} captains** and **${MAX_TEAM_PLAYERS} players**
             3. Contact the admins of the official **${officialGuild.name}** discord by providing your team id: **${lineup.team.guildId}**
             4. Every player signed in the lineup must have been declared in the **/team_manage** command
             5. You must have a **goal keeper** signed
            `)
        }

        const searchActionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('search_ranked')
                    .setLabel('Ranked')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(!isAllowedToPlayRanked),
                new ButtonBuilder()
                    .setCustomId('search_casual')
                    .setLabel('Casual')
                    .setStyle(ButtonStyle.Secondary)
            )


        await interaction.reply({ embeds: [searchModeEmbed], components: [searchActionRow], ephemeral: true })
    }
} as IButtonHandler