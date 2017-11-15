FROM mhart/alpine-node:8.9.1

RUN apk add --no-cache git libgcj --repository http://dl-cdn.alpinelinux.org/alpine/edge/main/ \
    && apk add --no-cache pdftk --repository http://dl-cdn.alpinelinux.org/alpine/edge/community/

RUN npm install pm2 gulp -g

RUN cd $(npm root -g)/npm \
 && npm install fs-extra \
 && sed -i -e s/graceful-fs/fs-extra/ -e s/fs\.rename/fs.move/ ./lib/utils/rename.js

ADD package.json /tmp/package.json
RUN cd /tmp && npm install
RUN mkdir -p /usr/src/app && cp -a /tmp/node_modules /usr/src/app/

WORKDIR /usr/src/app

COPY . /usr/src/app

RUN npm run prod \
 && npm prune --production

EXPOSE 3001

CMD pm2 start app.json --no-daemon
