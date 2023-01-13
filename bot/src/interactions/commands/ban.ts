import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { BOT_ADMIN_ROLE } from "../../constants";
import { ICommandHandler } from "../../handlers/commandHandler";
import { Bans } from "../../mongoSchema";
import { interactionUtils } from "../../services/interactionUtils";
import { teamService } from "../../services/teamService";
import parse from 'parse-duration'

export default {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a player from using the bot in this team')
        .addUserOption(option => option.setName('player')
            .setRequired(true)
            .setDescription('The player to ban'))
        .addStringOption(option => option.setName('reason')
            .setRequired(false)
            .setDescription('The reason of the ban'))
        .addStringOption(option => option.setName('duration')
            .setRequired(false)
            .setDescription('The duration of the ban (ex: 1d2h. Minimum 1h. Permanent ban if not specified)')),
    authorizedRoles: [BOT_ADMIN_ROLE],
    async execute(interaction: ChatInputCommandInteraction) {
        const team = await teamService.findTeamByGuildId(interaction.guildId!)
        if (!team) {
            await interaction.reply(interactionUtils.createReplyTeamNotRegistered())
            return
        }

        let duration = null
        const durationOption = interaction.options.getString('duration')
        if (durationOption != null) {
            duration = parse(durationOption)
            if (duration == null) {
                await interaction.reply({ content: `⛔ Unkown duration format ${durationOption}`, ephemeral: true })
                return
            }

            if (duration < 60 * 60 * 1000) {
                await interaction.reply({ content: `⛔ Please choose a duration greater than or equal to 1h`, ephemeral: true })
                return
            }
        }

        const player = interaction.options.getUser('player')!
        if (player.id === interaction.client.user?.id) {
            await interaction.reply({ content: `⛔ You cannot ban the bot !`, ephemeral: true })
            return
        }
        
        if (player.id === interaction.user.id) {
            await interaction.reply({ content: `⛔ You surely don't want to ban yourself !`, ephemeral: true })
            return
        }

        const reason = interaction.options.getString('reason');
        const now = Date.now()
        let expireAt = duration ? now + duration : null
        await Bans.updateOne({ userId: player.id, guildId: team.guildId }, { userId: player.id, reason, expireAt }, { upsert: true })

        let formattedDate
        if (expireAt) {
            formattedDate = new Date(expireAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit', hour: '2-digit', minute: 'numeric' })
        }
        await interaction.reply({ content: `Player **${player.username}** is now ${formattedDate ? `banned until ${formattedDate}` : 'permanently banned'}` })
    }
} as ICommandHandler;