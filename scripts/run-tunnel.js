// Starts the shared ngrok tunnel with NGROK_AUTHTOKEN from .env in the environment.
// ngrok does not merge the default agent config's saved authtoken with a custom
// --config file, so the token has to be supplied another way (env var, --authtoken
// flag, or inline in ngrok.yml). This uses the env var so the token never has to be
// committed into ngrok.yml.
require('dotenv').config();

const { spawn } = require('child_process');

const child = spawn('ngrok', ['start', '--config', 'ngrok.yml', 'dev-webhook'], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

child.on('exit', (code) => process.exit(code ?? 0));
