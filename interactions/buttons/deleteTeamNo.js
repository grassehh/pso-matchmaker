module.exports = {
    customId: 'delete_team_no_',
    async execute(interaction) {
        await interaction.reply({ content: 'Easy peasy ! Nothing has been deleted', ephemeral: true })
    }
}