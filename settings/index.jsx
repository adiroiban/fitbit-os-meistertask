import { TODOIST_CLIENT_ID, TODOIST_CLIENT_SECRET } from "../common/constant"

function settingsComponent(props) {

  return (
    <Page>
      <Section
        title={
          <Text bold align="center">
            Todoist Settings
          </Text>
        }
      />
      <Oauth
        title="OAuth Login"
        label="Authentication status"
        status={props.settings.oauth_status}
        authorizeUrl="https://todoist.com/oauth/authorize"
        requestTokenUrl="https://todoist.com/oauth/access_token"
        clientId={TODOIST_CLIENT_ID}
        clientSecret={TODOIST_CLIENT_SECRET}
        scope="data:read_write"
        pkce="false"
        onReturn={async (data) => {
          // Todoist required CORS and Fitbit Settings don't support CORS.
          // The actual token generation is delegated to the companion.
          // So we just set the authentication code.
          // There is also data.state but we ignore it as I don't know how to
          // use it.
          props.settingsStorage.setItem('exchange_code', data.code);
        }}
      />

    </Page>
  );
}

registerSettingsPage(settingsComponent);
