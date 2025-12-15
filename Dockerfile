FROM node:14.20.1 AS base
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

FROM base AS dev
EXPOSE 4200
CMD ["npm", "run", "ng", "serve", "--", "--host", "0.0.0.0", "--port", "4200"]

FROM base AS prod
RUN npm run build-prod
EXPOSE 5200
CMD ["npm", "start"]