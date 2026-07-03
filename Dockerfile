FROM node:22-slim

WORKDIR /app
ENV EPHE_PATH=/app/ephe

COPY package*.json ./
RUN npm install --unsafe-perm

COPY . .
RUN mkdir -p /app/ephe

RUN chmod -R 755 node_modules/.bin && npx tsc

EXPOSE 3000

CMD ["npm", "start"]
