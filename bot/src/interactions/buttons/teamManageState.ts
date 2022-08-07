import { ButtonInteraction, EmbedBuilder, Guild, InteractionUpdateOptions, TextChannel } from "discord.js";
import { IButtonHandler } from "../../handlers/buttonHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { teamService } from "../../services/teamService";
import { getOfficialDiscordIdByRegion, handle } from "../../utils";

export default {
    customId: 'team_manage_state_',
    async execute(interaction: ButtonInteraction) {
        const verify = interaction.customId.split('_')[3] === 'verify'
        const guildId = interaction.customId.split('_')[4]

        const team = (await teamService.verify(guildId, verify))!
        const channelIds = await teamService.findChannelIdsByGuildId(guildId)
        let description
        if (verify) {
            description = "✅ Congratulations ! Your team has been verified and is now allowed to use ranked matchmaking."
        } else {
            const officialGuild = await interaction.client.guilds.fetch(getOfficialDiscordIdByRegion(team.region)) as Guild
            description = `🛑 Your team has been unverified by the admins. You can no longer participate in ranked matches.\nPlease contact the admins of the official **${officialGuild.name}** discord to get your team verified by providing your team id: **${team.guildId}**.`
        }
        const informationEmbed = new EmbedBuilder()
            .setColor('#566573')
            .setTimestamp()
            .setDescription(description)
        await Promise.all(channelIds.map(async channelId => {
            const [channel] = await handle(interaction.client.channels.fetch(channelId))
            if (channel instanceof TextChannel) {
                channel?.send({ embeds: [informationEmbed] })
            }
        }))

        await interaction.update(interactionUtils.createTeamManagementReply(interaction, team) as InteractionUpdateOptions)

    }
} as IButtonHandler