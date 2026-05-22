FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN chmod +x node_modules/.bin/tsc && npm run build

EXPOSE 3000

CMD ["npm", "start"]
