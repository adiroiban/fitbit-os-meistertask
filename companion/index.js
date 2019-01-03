import { TODOIST_CLIENT_ID, TODOIST_CLIENT_SECRET } from "../common/constant"
import { settingsStorage } from 'settings'

//
// ---------- Settings handling --------------------
//

if (!settingsStorage.getItem('oauth_status')) {
    settingsStorage.setItem('oauth_status', 'Login')
}

// Called when setting was changed.
settingsStorage.onchange = function(event) {

    if (event.key === 'exchange_code') {
        getToken(event.newValue)
            .then(function(result) {
                // Token type should always be `Bearer` so we don't store that.
                settingsStorage.setItem('access_token', result.access_token)
                settingsStorage.setItem('oauth_status', 'Re-Login')
            })
            .catch(function(err){
                settingsStorage.setItem('oauth_status', 'Login')
                console.log('Err get token: '+ err);
            })
    }
}

// Helper to get an OAuth token as the settings page is not able to do CORS.
async function getToken(exchangeCode) {
    const urlEncodePost = function (object) {
        let fBody = [];
        for (let prop in object) {
            let key = encodeURIComponent(prop);
            let value = encodeURIComponent(object[prop]);
            fBody.push(key + "=" + value);
        }
        fBody = fBody.join("&");
        return fBody;
    };

    // https://developer.todoist.com/sync/v7/#oauth
    const Token_Body = {
        'method': 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: urlEncodePost({
            client_id: TODOIST_CLIENT_ID,
            client_secret: TODOIST_CLIENT_SECRET,
            code: exchangeCode,
            redirect_uri:'https://app-settings.fitbitdevelopercontent.com/simple-redirect.html'
        })
    }

    return await fetch('https://todoist.com/oauth/access_token', Token_Body)
        .then(function(data){
            return data.json();
        }).catch(function(err) {
            console.log('Err on token gen '+ err);
        })
}

