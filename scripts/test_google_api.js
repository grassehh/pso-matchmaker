const { google } = require('googleapis');
const moment = require('moment')

async function sendMessage() {
    const sheets = google.sheets('v4');
    await sheets.spreadsheets.values.get({
        spreadsheetId: '1LNeajA7pLcBwcPLAICp5ETVV2mChpzxJ5xDUS-aNsAs',
        range: '📅 Schedules 📅!I9:R119',
        key: 'AIzaSyC0kdqsgZpXmx0tPrERhYziA1O7ELfiuyY'
    }).then((response) => {
        const rows = response.data.values
        const date = moment(rows[0][0], 'DD.MM.YYYY').toDate()
        console.log(date)
    }).catch(console.error);

}

sendMessage().finally(async res => {
    console.log("Message sent")
    process.exit()
}).catch(e => { console.log(e) })

