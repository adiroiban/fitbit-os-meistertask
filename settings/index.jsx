import {
  OAUTH_CLIENT_ID,
  OAUTH_CLIENT_SECRET,
  OAUTH_AUTHORIZE_URL,
  OAUTH_TOKEN_URL,
  OAUTH_SCOPE
  } from "../common/constant"

function settingsComponent(props) {

  let oauth_status
  let oauth_action

  if (props.settingsStorage.getItem('access_token')) {
    oauth_status = 'Token present'
    oauth_action = 'Optional Re-Login'
  } else {
    oauth_status = 'Missing token'
    oauth_action = 'Login Required'
  }

  let wake_interval_text
  let wake_interval = props.settingsStorage.getItem('wake_interval')
  if (wake_interval == 0) {
    wake_interval_text = `Background sync: disabled`
  } else{
    wake_interval_text = `Background sync: ${wake_interval} (min).`
  }

  return (
    <Page>
      <Section
        title={
          <Text bold align="center">
            MeisterTask Settings
          </Text>
        }
      description="Only managing a single project is supported. Project needs to be active."
      />
      <Oauth
        title="MeisterTask Authentication"
        label={oauth_status}
        status={oauth_action}
        authorizeUrl={OAUTH_AUTHORIZE_URL}
        requestTokenUrl={OAUTH_TOKEN_URL}
        clientId={OAUTH_CLIENT_ID}
        clientSecret={OAUTH_CLIENT_SECRET}
        scope={OAUTH_SCOPE}
        pkce="false"
        onReturn={async (data) => {
          // CORS is required and Fitbit Settings don't support CORS.
          // The actual token generation is delegated to the companion.
          // So we just set the authentication code.
          // There is also data.state but we ignore it as I don't know how to
          // use it.
          props.settingsStorage.setItem('authorization_code', data.code);
        }}
        // Fitbit OS don't support CORS, so we can't get the token from
        // settings page.
        // onAccessToken={async (data) => {
        //     console.log('Got token' + data)
        //     props.settingsStorage.setItem('access_token', data);
        // }}
      />

    <Slider
      label={wake_interval_text}
      settingsKey="wake_interval"
      min="0"
      max="120"
      step="15"
    />

     <TextInput
        label="Project"
        placeholder="Project name"
        value={props.settings.project_name}
        onChange={value => props.settingsStorage.setItem('project_name', value.name)}
      />

      <Button
        label="Reset session token"
        onClick={() => props.settingsStorage.setItem('access_token', '')}
      />

      <Button
        label="Reset settings"
        onClick={() => props.settingsStorage.clear()}
      />

    </Page>
  );
}

registerSettingsPage(settingsComponent);
