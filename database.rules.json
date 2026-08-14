{
  "rules": {
    "user_permissions": {
      ".read": "auth != null && auth.token.email == 'thanakrit_kas@hotmail.com'",
      "$emailKey": {
        ".read": "auth != null && (!data.exists() || auth.token.email == data.child('email').val() || auth.token.email == 'thanakrit_kas@hotmail.com')",
        ".write": "auth != null && (auth.token.email == 'thanakrit_kas@hotmail.com' || (!data.exists() && newData.child('email').val() == auth.token.email && newData.child('status').val() == 'pending' && newData.child('trialStartedAt').val() == now) || (data.exists() && data.child('email').val() == auth.token.email && newData.child('email').val() == data.child('email').val() && newData.child('status').val() == data.child('status').val() && (newData.child('trialStartedAt').val() == data.child('trialStartedAt').val() || (!data.hasChild('trialStartedAt') && newData.child('trialStartedAt').val() == now))))",
        ".validate": "auth != null && (auth.token.email == 'thanakrit_kas@hotmail.com' || (newData.hasChildren(['email', 'status', 'lastLogin']) && (newData.child('status').val() == 'allowed' || newData.child('status').val() == 'pending' || newData.child('status').val() == 'denied') && (newData.child('status').val() != 'pending' || (newData.child('trialStartedAt').isNumber() && newData.child('trialStartedAt').val() <= now))))"
      }
    },
    "whitelist": {
      ".read": "auth != null",
      ".write": "auth != null && auth.token.email == 'thanakrit_kas@hotmail.com'"
    }
  }
}
