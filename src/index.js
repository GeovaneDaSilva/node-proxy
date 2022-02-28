const WebSocket = require('ws');
const axios = require('axios');
const WsLogger = require('./ws-logger');
const WsHelper = require('./ws-helper');
const RedisHelper = require('./redis-helper');
const WaitingMessages = require('./waiting-messages');
const MessageQueuer = require('./message-queuer');
const MessageHandler = require('./message-handler');
const ConnectionHandler = require('./connection-handler');
require('./config/env');

const accessToken = process.env.ACCESS_TOKEN

const url_heartbeat = process.env.URL_HEARTBEAT

const currentDate = () => new Date().toISOString()

const config = {
  headers: {
    Authorization: `Bearer ${accessToken}`
  }
};

const paramsHeartBeat = {
  lastConnected: currentDate(),
  connectivity: 2
}

function send_heartbeat_api(device_id) {
  write_log(`device ID: ${device_id}`);
  axios.put(`${url_heartbeat}/${device_id}/heartbeat`, paramsHeartBeat, config)
    .then(res => {
      write_log(`send: ${res.status}`);
    }, res => {
      write_log(`error on ${device_id}, error: ${res}`, true);
    })
}

// helper function to show any log message
function write_log(lg, log_to_file = false) {
  let logType = 'info';
  if (log_to_file) {
    logType = 'error';
  }
  WsLogger.log('index.js', lg, logType, log_to_file);
}

// helper function to subscribe to redis pattern
function redis_subscribe(redisUrl, pattern, onMessage) {
  const subscriber = RedisHelper.create(redisUrl);
  RedisHelper.subscribe(subscriber, pattern, onMessage);
}

// helper function to return unix timestamp
function unix_timestamp(dt) {
  return WsHelper.unixTimestamp(dt);
}

function handle_message(data, socket, fingerprint) {
  write_log('Device ' + fingerprint + ' sent message ' + data)

  let dataObj = null;

  try {
    dataObj = JSON.parse(data);
  } catch (e) {
    write_log('Device ' + fingerprint + ' sent malformed JSON ' + data, true);
    return;
  }

  if (!dataObj.payload) {
    dataObj.payload = 'ping';
  }

  MessageHandler.create(dataObj, socket, fingerprint, sideKiqPool).handle();
}

// helper function to queue message in redis
function queue_message(fingerprint, message, message_type) {
  MessageQueuer.create(
    fingerprint,
    message,
    message_type,
    sideKiqPool
  ).enqueue();
}

// helper function add socket in DEVICE_SOCKETS if it doesnt exists by fingerprint
function store_socket(fingerprint, license_key, socket) {
  if (!WaitingMessages.DEVICE_SOCKETS[fingerprint]) {
    WaitingMessages.DEVICE_SOCKETS[fingerprint] = socket;
  }
}

function send_heartbeat(fingerprint, socket) {
  const currTimestamp = unix_timestamp();
  if (
    !HEARTBEATS[fingerprint] ||
    currTimestamp - HEARTBEATS[fingerprint] > 60 * 4
  ) {
    HEARTBEATS[fingerprint] = currTimestamp;
    write_log('Device ' + fingerprint + ' heartbeat being refreshed!');
    send_heartbeat_api(fingerprint);
  }
}

function onConnectionMessage(message, fingerprint, license_key, socket) {
  store_socket(fingerprint, license_key, socket);
  const clean_message = message.toString().trim();
  handle_message(clean_message, socket, fingerprint);
}

function onConnectionPing(fingerprint, license_key, socket) {
  write_log('Received ping from ' + fingerprint + ', responding with pong');
  socket.pong();
  send_heartbeat(fingerprint, socket);
}

function onConnectionClose(fingerprint, license_key, socket) {
  delete WaitingMessages.DEVICE_SOCKETS[fingerprint];
  delete HEARTBEATS[fingerprint];
}

function onConnectionError(fingerprint, license_key, socket, err) {
  write_log('Error in device ' + fingerprint + ' websocket: ' + err);
}

function handle_connection(fingerprint, license_key, socket) {
  write_log('Device ' + fingerprint + ' connected for Customer ' + license_key);

  store_socket(fingerprint, license_key, socket);

  socket.send('connected');
  socket.send('ready');

  send_heartbeat_api(fingerprint);

  const conn = ConnectionHandler.create(fingerprint, license_key, socket);
  conn.onMessage = onConnectionMessage;
  conn.onPing = onConnectionPing;
  conn.onClose = onConnectionClose;
  conn.onError = onConnectionError;
  conn.handle();
}

const SERVER_PORT = process.env.PORT; // port on which server will run00;
const HEARTBEATS = {};
const redisPool = RedisHelper.create(RedisHelper.REDIS_URL);
const sideKiqPool = RedisHelper.create(RedisHelper.REDIS_PROVIDER);
const webSocketServer = new WebSocket.Server({
  port: SERVER_PORT
});

webSocketServer.on('error', (err) => {
  write_log('Error in webSocketServer: ' + err);
});

redisPool.on('error', (error) => {
  write_log('redisPool error: ' + error, true);
});

sideKiqPool.on('error', (error) => {
  write_log('sideKiqPool error: ' + error, true);
});

redis_subscribe(RedisHelper.REDIS_PROVIDER, 'device', (channel, message) => {
  write_log("Subscriber received message in '" + channel + "': " + message);

  let device_message = null;

  try {
    device_message = JSON.parse(message);
  } catch (e) {
    return write_log("Malformed JSON sent in '" + channel + "': " + message, true);
  }

  if (WaitingMessages.DEVICE_SOCKETS[device_message.target]) {

    WaitingMessages.DEVICE_SOCKETS[device_message.target].send(device_message.payload);

    return write_log(
      'Device ' +
      device_message.target +
      ' relaying message ' +
      device_message.payload
    );

  }
  write_log(
    'Unable to Relay Device ' +
    device_message.target +
    ' message ' +
    device_message.payload,
    true
  );
});

redis_subscribe(RedisHelper.REDIS_URL, 'trigger.queue.device', (channel, message) => {
  write_log("Subscriber received message in '" + channel + "': " + message);

  device_fingerprint = message.trim();

  if (WaitingMessages.DEVICE_SOCKETS[device_fingerprint]) {
    if (!WaitingMessages.MESSAGES_WAITING.includes(device_fingerprint)) {
      WaitingMessages.MESSAGES_WAITING.push(device_fingerprint);
    }
  }
});

WaitingMessages.startTimer();

function sendSuggestConfig(socket) {
  socket.send(JSON.stringify({
    type: 'config',
    payload: {}
  }))
}

webSocketServer.on('connection', (socket, req) => {
  write_log(`New connection: ${req.url}`);

  try {

    const validate_url = WsHelper.validateUrl(req.url);

    if (validate_url === false) {
      write_log(`Invalid url: ${req.url}`, true);

      sendSuggestConfig(socket);

      return socket.close();
    }

    const signed_token = validate_url[0];

    const fingerprint = validate_url[1].toLowerCase();

    write_log(`fingerprint= ${fingerprint}, signed_token= ${signed_token}`, true);

    const get_license_key = WsHelper.verifyToken(signed_token);

    if (get_license_key === false) {

      sendSuggestConfig(socket)

      socket.close();

      return write_log(`Suggested config update for ${fingerprint}, closed socket`);
    }

    handle_connection(fingerprint, get_license_key, socket);

  } catch (e) {
    write_log('Exception in on-connection: ' + e.message, true);
  }
});

write_log('Server started on port ' + SERVER_PORT, true);