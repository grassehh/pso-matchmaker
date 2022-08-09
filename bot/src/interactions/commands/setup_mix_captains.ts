import { SlashCommandBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction } from "discord.js";
import { BOT_ADMIN_ROLE, MIN_LINEUP_SIZE_FOR_RANKED } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";
import { authorizationService } from "../../services/authorizationService";
import { interactionUtils } from "../../services/interactionUtils";
import { matchmakingService } from "../../services/matchmakingService";
import { LINEUP_TYPE_CAPTAINS, LINEUP_VISIBILITY_TEAM, teamService } from "../../services/teamService";

export default {
    data:
        new SlashCommandBuilder()
            .setName('setup_mix_captains')
            .setDescription('Setup a mix lineup with captains picking')
            .addIntegerOption(option => option.setName('size')
                .setRequired(true)
                .setDescription('The number of players in each team')
                .addChoices(
                    { name: '3', value: 3 },
                    { name: '4', value: 4 },
                    { name: '5', value: 5 },
                    { name: '6', value: 6 },
                    { name: '7', value: 7 },
                    { name: '8', value: 8 },
                    { name: '9', value: 9 },
                    { name: '10', value: 10 },
                    { name: '11', value: 11 }
                )
            )
            .addBooleanOption(option => option.setName('ranked')
                .setRequired(false)
                .setDescription('Indicates if this lineup is ranked and should update ratings')),
    authorizedRoles: [BOT_ADMIN_ROLE],
    async execute(interaction: ChatInputCommandInteraction) {
        const team = await teamService.findTeamByGuildId(interaction.guildId!)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        const lineupSize = interaction.options.getInteger("size")!
        const ranked = interaction.options.getBoolean("ranked") === true
        if (ranked) {
            if (!authorizationService.isOfficialDiscord(interaction.guildId!)) {
                await interaction.reply({ content: "⛔ Only official community discords can create ranked mixes", ephemeral: true })
                return
            }

            if (lineupSize < MIN_LINEUP_SIZE_FOR_RANKED) {
                await interaction.reply({ content: `⛔ Ranked lineups are only allowed for **${MIN_LINEUP_SIZE_FOR_RANKED}v${MIN_LINEUP_SIZE_FOR_RANKED}**`, ephemeral: true })
                return
            }
        }

        const lineup = teamService.createLineup(interaction.channelId, lineupSize, undefined, false, ranked, team, LINEUP_TYPE_CAPTAINS, LINEUP_VISIBILITY_TEAM, false)
        await teamService.upsertLineup(lineup)

        await matchmakingService.deleteLineupQueuesByChannelId(interaction.channelId)

        let reply = await interactionUtils.createReplyForLineup(lineup)
        reply.embeds?.splice(0, 0, interactionUtils.createInformationEmbed(interaction.user, '✅ New mix captains lineup configured'))
        await interaction.reply(reply);
    }
} as ICommandHandler;