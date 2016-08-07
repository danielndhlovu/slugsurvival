FROM node:latest

RUN apt-get update -qq && apt-get install -y -qq curl

RUN npm install forever browserify uglifyjs -g

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY package.json /usr/src/app/
RUN npm install

COPY . /usr/src/app

EXPORT 3001

RUN npm run prod

CMD ["pm2", "start", "app.json", "--env", "dev", "--no-daemon"]
