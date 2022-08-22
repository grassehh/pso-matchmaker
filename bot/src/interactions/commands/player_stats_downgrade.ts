import { SlashCommandBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction } from "discord.js";
import { BOT_ADMIN_ROLE, RATING_DOWNGRADE_AMOUNT } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { regionService } from "../../services/regionService";
import { statsService } from "../../services/statsService";
import { ROLE_ATTACKER, ROLE_DEFENDER, ROLE_GOAL_KEEPER, ROLE_MIDFIELDER } from "../../services/teamService";

export default {
    data: new SlashCommandBuilder()
        .setName('player_stats_downgrade')
        .setDescription("Downgrades a player rating")
        .addUserOption(option => option.setName('player')
            .setRequired(true)
            .setDescription('The player you to downgrade the stats'))
        .addStringOption(option => option.setName('position')
            .setRequired(true)
            .setDescription('The position you want to downgrade the rating')
            .addChoices(
                { name: 'Attack', value: ROLE_ATTACKER.toString() },
                { name: 'Midfield', value: ROLE_MIDFIELDER.toString() },
                { name: 'Defense', value: ROLE_DEFENDER.toString() },
                { name: 'Goal Keeper', value: ROLE_GOAL_KEEPER.toString() },
            )),
    authorizedRoles: [BOT_ADMIN_ROLE],
    async execute(interaction: ChatInputCommandInteraction) {
        if (!regionService.isOfficialDiscord(interaction.guildId!)) {
            await interaction.reply({ content: "⛔ Only official discords can use this command", ephemeral: true })
            return
        }

        const region = regionService.getRegionByGuildId(interaction.guildId!)!
        const player = interaction.options.getUser('player')!
        const position = parseInt(interaction.options.getString('position')!)
        const stats = await statsService.downgradePlayerStats(region, player.id, position)
        await interaction.reply({ embeds: [interactionUtils.createInformationEmbed(`✅ User rating has been downgraded by ${RATING_DOWNGRADE_AMOUNT} (new average rating ${stats?.getAverageRating()})`)] })
    }
} as ICommandHandler;