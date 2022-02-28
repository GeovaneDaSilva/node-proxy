# node_socket_proxy

## Run the following commands:
1. `npm install`

## Local Setup:?
2. Install NodeJS https://nodejs.org/en/download/
3. install https://redis.io/topics/quickstart
4. You need to run redis on your machine, example commands for mac: redis-server - link: https://phoenixnap.com/kb/install-redis-on-mac
5. `npm start` you should see in the terminal console: `index.js::Server started on port 5000`


## Local Setup - Docker
2. You need to download Docker and install it on your machine: https://docs.docker.com/
Install `docker` and `docker-compose`. 

3. You'll need access to the  Docker Cloud, rocketcyber/node_socket_proxy.

4. `$ docker login` You need to ask an administrator for access to be able to download the docker image.
5. `$ docker-compose pull`
6. `$ npm run up` || `$ docker-compose up` you should see in the terminal console: `index.js::Server started`

## Test Agent Console:?
To connect to the test agent, you need to go through the authentication process. When you pass authentication, you will be able to connect to the server. send and receive messages.

7. Start agent `npm run agent`
8. Enter device signature: `/signed/listen` is relative path `/token/fingerprint`
9. Enter device fingerprint: `device_id`
Example signature: `token*****************==--**********`
Exemple fingerprint device_id: `EBB3A27D170B2A**********`

If you did everything correctly, you should see this on your console: 
Enter json message to send to server(write ping only to send a ping): message received from server: `connected`
message received from server: `ready`

## Test Agent Browser
7. To send events to the server you need to download the agent from this repository: 
https://github.com/gdasilvarocketcyber/agent-websockets-test .


## Authentication:
Authentication. is done by fingerprint.
You need to consult a `GET` api to be able to validate that this user has this fingerprint.
AuthenticationAuthentication is light, based on a lightweight registration key in the URL:
https://rocketcyber.docs.apiary.io/#introduction/versioning

I find the fingerprint in the url
and print it and based on that fingerprint..device is identified throughout the connection.

## Redis
Example if agent sends a message, it will pushed to redis queue and there is another process/timer that read messages from the redis queue and transfer to other agents.

## Environments

// PORT
// SOCKET_PROXY_SECRET
// REDIS_URL
// REDIS_PROVIDER