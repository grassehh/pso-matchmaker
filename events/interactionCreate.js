const { MessageActionRow, MessageButton } = require("discord.js");
const { retrieveTeam, retrieveLineup, createLineupComponents } = require("../services");

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (interaction.isCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) return;

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
                return
            }
        }

        if (interaction.isButton()) {
            let team = await retrieveTeam(interaction.guildId)
            let lineup = await retrieveLineup(interaction.channelId, team)

            if (interaction.customId.startsWith("role_")) {
                let roleName = interaction.customId.substring(5)
                let playerRole = lineup.roles.find(role => role.name == roleName)

                let existingPlayerRole = lineup.roles.find(role => role.user?.id === interaction.user.id)
                if (existingPlayerRole != null) {
                    existingPlayerRole.user = null
                }
                playerRole.user = {
                    id: interaction.user.id,
                    name: interaction.user.username,
                    tag: interaction.user.toString()
                }
                team.save()
                interaction.message.delete()
                interaction.reply({ content: `Current lineup size is ${lineup.size}`, components: createLineupComponents(lineup, interaction.user.id) })
                return
            }

            if (interaction.customId === 'leaveLineup') {
                let existingPlayerRole = lineup.roles.find(role => role.user?.id === interaction.user.id)
                if (existingPlayerRole != null) {
                    existingPlayerRole.user = null
                }
                team.save()
                interaction.message.delete()
                interaction.reply({ content: `Current lineup size is ${lineup.size}`, components: createLineupComponents(lineup, interaction.user.id) })
                return
            }

            if (interaction.customId.startsWith('challenge_')) {
                let teamChannelId = interaction.customId.substring(10);
                let teamsComponents = new MessageActionRow().addComponents(
                    new MessageButton()
                        .setLabel(`Challenge request sent`)
                        .setEmoji('⚽')
                        .setStyle('PRIMARY')
                        .setCustomId(`challenge_${teamChannelId}`)
                        .setDisabled(true)
                )
                //interaction.message.delete()
                interaction.reply({ components: [teamsComponents] })
                return
            }
            return
        }
    }
};



