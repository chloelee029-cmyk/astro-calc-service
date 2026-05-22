FROM node:22-slim

WORKDIR /app

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --unsafe-perm

COPY . .

RUN mkdir -p ephe && \
    curl -sL https://github.com/drvinaayaksingh/swisseph/raw/master/ephe/sepl_18.se1 -o ephe/sepl_18.se1 && \
    curl -sL https://github.com/drvinaayaksingh/swisseph/raw/master/ephe/semo_18.se1 -o ephe/semo_18.se1 && \
    curl -sL https://github.com/drvinaayaksingh/swisseph/raw/master/ephe/seas_18.se1 -o ephe/seas_18.se1

RUN chmod -R 755 node_modules/.bin && npx tsc

EXPOSE 3000

CMD ["npm", "start"]
