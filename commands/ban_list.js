const { SlashCommandBuilder } = require('@discordjs/builders');
const interactionUtils = require("../services/interactionUtils");
const teamService = require("../services/teamService");
const authorizationService = require("../services/authorizationService");
const { handle } = require('../utils');
const { MessageEmbed } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban_list')
        .setDescription('Display a list of banned players'),
    authorizedRoles: [authorizationService.BOT_ADMIN_ROLE],
    async execute(interaction) {
        let team = await teamService.findTeamByGuildId(interaction.guildId)
        if (!team) {
            await interactionUtils.replyTeamNotRegistered(interaction)
            return
        }

        const bans = await teamService.findBansByGuildId(team.guildId)

        const bansEmbed = new MessageEmbed()
            .setColor('#566573')
            .setTitle(`Banned players`)
            .setTimestamp()

        if (bans.length === 0) {
            bansEmbed.setDescription("✅ No user is banned")
        } else {
            for (let ban of bans) {
                const [user] = await handle(interaction.client.users.fetch(ban.userId))
                let username
                if (!user) {
                    continue
                }
                username = user.username
                let bansEmbedFieldValue = '*Permanent*'
                if (ban.expireAt) {
                    bansEmbedFieldValue = ban.expireAt.toUTCString()
                }
                bansEmbed.addField(username, bansEmbedFieldValue)
            }
        }

        await interaction.reply({ embeds: [bansEmbed], ephemeral: true })
    }
}