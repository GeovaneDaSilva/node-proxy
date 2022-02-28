const WebSocket = require('ws');
const winston = require('winston');
const readline = require('readline');
require('../config/env');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const logger = winston.createLogger({
  transports: [new winston.transports.File({ filename: 'agent_error.log' })],
});

// helper function to write log to winston file
function write_to_log(msg, level = 'info') {
  logger.log({
    date: new Date().toString(),
    level: level,
    message: msg,
  });
}

// helper function to show any log message
function write_log(lg, add_to_log_file = false) {
  console.log(lg);
  if (add_to_log_file) {
    write_to_log(lg);
  }
}

let client = null;

function ask_message_and_send() {
  rl.question(
    'Enter json message to send to server(write ping only to send a ping): ',
    (msg) => {
      msg = msg.trim();
      if (msg === 'ping') {
        client.ping();
        write_log('Ping sent');
      } else {
        client.send(msg);
        write_log('Message sent');
      }
      ask_message_and_send();
    }
  );
}

function start_client() {
  const wsUrl =
    'ws://' +
    serverHostPort +
    '/' +
    SERVER_BASE_PATH +
    signature +
    '/' +
    fingerprint;
  write_log('Connecting to websocket server on ' + wsUrl);
  client = new WebSocket(wsUrl);
  client.on('message', (msg) => {
    write_log('message received from server: ' + msg);
  });
  client.on('close', () => {
    write_log('connection closed');
  });
  client.on('open', () => {
    write_log('connection opened');
    ask_message_and_send();
  });
  client.on('error', (err) => {
    write_log('Websocket error: ' + err, true);
  });
}

const { SERVER_HOST } = process.env;
const { SERVER_PORT } = process.env;
let SERVER_BASE_PATH = 'signed/listen/';
let signature = '';
let fingerprint = '';
let serverHostPort = SERVER_HOST + ':' + SERVER_PORT;

rl.question('Enter device signature: ', (sg) => {
  signature = sg.trim();
  rl.question('Enter device fingerprint: ', (fp) => {
    fingerprint = fp.trim();
    start_client();
  });
});
