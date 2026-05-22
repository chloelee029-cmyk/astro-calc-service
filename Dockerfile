FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --unsafe-perm

COPY . .

RUN chmod -R 755 node_modules/.bin && npx tsc

EXPOSE 3000

CMD ["npm", "start"]
