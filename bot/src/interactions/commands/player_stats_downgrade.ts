import { SlashCommandBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction } from "discord.js";
import { BOT_ADMIN_ROLE, RATING_DOWNGRADE_AMOUNT } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";
import { interactionUtils } from "../../services/interactionUtils";
import { regionService } from "../../services/regionService";
import { statsService } from "../../services/statsService";

export default {
    data: new SlashCommandBuilder()
        .setName('player_stats_downgrade')
        .setDescription("Downgrades a player rating")
        .addUserOption(option => option.setName('player')
            .setRequired(true)
            .setDescription('The player you to downgrade the stats')),
    authorizedRoles: [BOT_ADMIN_ROLE],
    async execute(interaction: ChatInputCommandInteraction) {
        if (!regionService.isOfficialDiscord(interaction.guildId!)) {
            await interaction.reply({ content: "⛔ Only official discords can use this command", ephemeral: true })
            return
        }

        const region = regionService.getRegionByGuildId(interaction.guildId!)!
        const player = interaction.options.getUser('player')!
        const stats = await statsService.downgradePlayerStats(region, player.id)
        await interaction.reply({ embeds: [interactionUtils.createInformationEmbed(`✅ ${player.username} (${player}) rating has been downgraded by ${RATING_DOWNGRADE_AMOUNT} (new rating ${stats?.rating})`)] })
    }
} as ICommandHandler;