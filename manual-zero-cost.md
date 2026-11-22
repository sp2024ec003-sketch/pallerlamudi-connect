# Zero-cost WhatsApp operating mode

This project does not automate WhatsApp Web or simulate user clicks.

1. Import only contacts who have clearly opted in to receive Pallerlamudi public updates.
2. Select recipients in the dashboard.
3. Prepare the Telugu/English message.
4. For each selected recipient, use a `https://wa.me/<countrycode><number>?text=<urlencoded-message>` link to open WhatsApp.
5. Review the recipient and message, then press Send yourself.
6. Record the send confirmation in the campaign log.
7. Alternatively, use WhatsApp Business broadcast lists if the recipients meet WhatsApp's broadcast requirements.

A `wa.me` link only opens a chat; it does not send automatically. For 1,000 recipients this manual approach is operationally slower. Official API automation requires a non-zero budget for applicable outbound message categories.
