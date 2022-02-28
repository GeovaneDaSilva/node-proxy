FROM node:12
WORKDIR /usr/src/node_socket_proxy
COPY package.json .
RUN npm install --only=prod
COPY ./src ./src
EXPOSE 5000
CMD npm start