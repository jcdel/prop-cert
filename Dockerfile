
FROM node:21-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "--watch", "--env-file=.env", "src/app.js"]